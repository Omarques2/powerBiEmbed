import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_ROLES = new Set(["owner", "admin", "member", "viewer"]);

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    return this.prisma.users.findMany({
      where: { status: "pending" },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
        last_login_at: true,
        status: true,
      },
    });
  }

  private async resolveActorUserId(actorSub: string | null): Promise<string | null> {
    if (!actorSub) return null;
    const actor = await this.prisma.users.findUnique({
      where: { entra_sub: actorSub },
      select: { id: true },
    });
    return actor?.id ?? null;
  }

  async activateUser(
    userId: string,
    customerId: string,
    role: string,
    grantCustomerWorkspaces = true,
    actorSub: string | null = null,
  ) {
    if (!ALLOWED_ROLES.has(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true, status: true, email: true, display_name: true } });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customers.findUnique({ where: { id: customerId }, select: { id: true, status: true, code: true, name: true } });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = {
        user: { id: userId, status: user.status, email: user.email ?? null, displayName: user.display_name ?? null },
        customer: { id: customerId, code: customer.code, name: customer.name, status: customer.status },
      };

      await tx.users.update({
        where: { id: userId },
        data: { status: "active" },
      });

      await tx.user_customer_memberships.upsert({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        create: { user_id: userId, customer_id: customerId, role: role as any, is_active: true },
        update: { role: role as any, is_active: true },
      });

      let wsGranted = 0;
      let rpGranted = 0;

      if (grantCustomerWorkspaces) {
        // 1) Workspaces ativos do customer
        const workspaces = await tx.bi_workspaces.findMany({
          where: { customer_id: customerId, is_active: true, customers: { status: "active" } },
          select: { id: true },
        });

        if (workspaces.length) {
          const wsRes = await tx.bi_workspace_permissions.createMany({
            data: workspaces.map((ws) => ({
              user_id: userId,
              workspace_ref_id: ws.id,
              can_view: true,
            })),
            skipDuplicates: true,
          });

          wsGranted = wsRes.count;

          // 2) Reports ativos nos workspaces (permissão por report)
          const reports = await tx.bi_reports.findMany({
            where: {
              workspace_ref_id: { in: workspaces.map((w) => w.id) },
              is_active: true,
              bi_workspaces: { is_active: true, customers: { status: "active" } },
            },
            select: { id: true },
          });

          if (reports.length) {
            const rpRes = await tx.bi_report_permissions.createMany({
              data: reports.map((r) => ({
                user_id: userId,
                report_ref_id: r.id,
                can_view: true,
              })),
              skipDuplicates: true,
            });

            rpGranted = rpRes.count;
          }
        }
      }

      const after = {
        user: { id: userId, status: "active" },
        membership: { customerId, role, isActive: true },
        grants: { workspacePermissionsGranted: wsGranted, reportPermissionsGranted: rpGranted },
      };

      // Auditoria: ativação
      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_ACTIVATED",
          entity_type: "users",
          entity_id: userId,
          before_data: before,
          after_data: after,
        },
      });

      // Auditoria: grants (se existiram)
      if (wsGranted > 0) {
        await tx.audit_log.create({
          data: {
            actor_user_id: actorUserId,
            action: "WORKSPACE_PERMS_GRANTED",
            entity_type: "users",
            entity_id: userId,
            after_data: { customerId, count: wsGranted },
          },
        });
      }
      if (rpGranted > 0) {
        await tx.audit_log.create({
          data: {
            actor_user_id: actorUserId,
            action: "REPORT_PERMS_GRANTED",
            entity_type: "users",
            entity_id: userId,
            after_data: { customerId, count: rpGranted },
          },
        });
      }

      return { ok: true };
    });
  }

  async disableUser(userId: string, actorSub: string | null = null) {
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true, status: true, email: true } });
    if (!user) throw new NotFoundException("User not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = { user: { id: userId, status: user.status, email: user.email ?? null } };

      await tx.users.update({ where: { id: userId }, data: { status: "disabled" } });

      await tx.user_customer_memberships.updateMany({
        where: { user_id: userId },
        data: { is_active: false },
      });

      await tx.bi_workspace_permissions.updateMany({
        where: { user_id: userId },
        data: { can_view: false },
      });

      await tx.bi_report_permissions.updateMany({
        where: { user_id: userId },
        data: { can_view: false },
      });

      const after = { user: { id: userId, status: "disabled" } };

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_DISABLED",
          entity_type: "users",
          entity_id: userId,
          before_data: before,
          after_data: after,
        },
      });

      return { ok: true };
    });
  }

  async listCustomers() {
    const rows = await this.prisma.customers.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, status: true, created_at: true },
    });

    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      createdAt: c.created_at,
    }));
  }

  // =========================
  // AUDIT LOG (paginação)
  // =========================
  async listAuditLogs(input: {
    page: number;
    pageSize: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
  }) {
    const page = Number.isFinite(input.page) && input.page > 0 ? input.page : 1;
    const pageSizeRaw = Number.isFinite(input.pageSize) ? input.pageSize : 50;
    const pageSize = Math.max(1, Math.min(200, pageSizeRaw));

    const where: any = {};
    if (input.action) where.action = input.action;
    if (input.entityType) where.entity_type = input.entityType;
    if (input.entityId) where.entity_id = input.entityId;
    if (input.actorUserId) where.actor_user_id = input.actorUserId;

    if (input.from || input.to) {
      where.created_at = {};
      if (input.from) where.created_at.gte = new Date(input.from);
      if (input.to) where.created_at.lte = new Date(input.to);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.audit_log.count({ where }),
      this.prisma.audit_log.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, email: true, display_name: true } },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        actorUserId: r.actor_user_id,
        actor: r.actor ? { id: r.actor.id, email: r.actor.email, displayName: r.actor.display_name } : null,
        ip: r.ip,
        userAgent: r.user_agent,
        before: r.before_data,
        after: r.after_data,
      })),
    };
  }

  // =========================
  // LISTAR USUÁRIOS ATIVOS (paginação + busca)
  // =========================
  async listActiveUsers(input: { q?: string; page: number; pageSize: number }) {
    const page = Number.isFinite(input.page) && input.page > 0 ? input.page : 1;
    const pageSize = Math.max(1, Math.min(100, Number.isFinite(input.pageSize) ? input.pageSize : 25));
    const q = input.q?.trim();

    const where: any = { status: "active" };

    if (q) {
      where.OR = [
        { email: { contains: q } }, // citext ajuda no case-insensitive
        { display_name: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        orderBy: [{ last_login_at: "desc" }, { created_at: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          display_name: true,
          created_at: true,
          last_login_at: true,
          status: true,
        },
      }),
    ]);

    return { page, pageSize, total, rows };
  }

  // =========================
  // PERMISSÕES (customer -> workspaces -> reports)
  // =========================
  async getUserPermissions(userId: string, customerId: string | null) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, display_name: true, status: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const memberships = await this.prisma.user_customer_memberships.findMany({
      where: { user_id: userId, is_active: true, customers: { status: "active" } },
      include: { customers: { select: { id: true, code: true, name: true, status: true } } },
      orderBy: { created_at: "asc" },
    });

    // customer “context” (default: primeiro membership)
    const effectiveCustomerId =
      customerId ??
      memberships[0]?.customer_id ??
      null;

    if (!effectiveCustomerId) {
      return {
        user: { id: user.id, email: user.email, displayName: user.display_name, status: user.status },
        memberships: memberships.map((m) => ({
          customerId: m.customer_id,
          role: m.role,
          isActive: m.is_active,
          customer: m.customers,
        })),
        customerId: null,
        workspaces: [],
      };
    }

    const customer = await this.prisma.customers.findUnique({
      where: { id: effectiveCustomerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const workspaces = await this.prisma.bi_workspaces.findMany({
      where: { customer_id: effectiveCustomerId, is_active: true, customers: { status: "active" } },
      orderBy: { created_at: "asc" },
      select: { id: true, workspace_id: true, workspace_name: true },
    });

    const wsPerms = await this.prisma.bi_workspace_permissions.findMany({
      where: {
        user_id: userId,
        workspace_ref_id: { in: workspaces.map((w) => w.id) },
      },
      select: { workspace_ref_id: true, can_view: true },
    });

    const reports = await this.prisma.bi_reports.findMany({
      where: {
        workspace_ref_id: { in: workspaces.map((w) => w.id) },
        is_active: true,
        bi_workspaces: { is_active: true, customers: { status: "active" } },
      },
      orderBy: { created_at: "asc" },
      select: { id: true, workspace_ref_id: true, report_id: true, report_name: true, dataset_id: true },
    });

    const rpPerms = await this.prisma.bi_report_permissions.findMany({
      where: {
        user_id: userId,
        report_ref_id: { in: reports.map((r) => r.id) },
      },
      select: { report_ref_id: true, can_view: true },
    });

    const wsPermMap = new Map(wsPerms.map((p) => [p.workspace_ref_id, p.can_view]));
    const rpPermMap = new Map(rpPerms.map((p) => [p.report_ref_id, p.can_view]));

    return {
      user: { id: user.id, email: user.email, displayName: user.display_name, status: user.status },
      customer,
      customerId: effectiveCustomerId,
      memberships: memberships.map((m) => ({
        customerId: m.customer_id,
        role: m.role,
        isActive: m.is_active,
        customer: m.customers,
      })),
      workspaces: workspaces.map((w) => ({
        workspaceRefId: w.id,
        workspaceId: w.workspace_id,
        name: w.workspace_name ?? String(w.workspace_id),
        canView: wsPermMap.get(w.id) ?? false,
        reports: reports
          .filter((r) => r.workspace_ref_id === w.id)
          .map((r) => ({
            reportRefId: r.id,
            reportId: r.report_id,
            name: r.report_name ?? String(r.report_id),
            datasetId: r.dataset_id,
            canView: rpPermMap.get(r.id) ?? false,
          })),
      })),
    };
  }

  // =========================
  // SET workspace permission (com auditoria + opcional grant reports)
  // =========================
  async setWorkspacePermission(
    userId: string,
    workspaceRefId: string,
    canView: boolean,
    grantReports: boolean,
    actorSub: string | null,
  ) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const ws = await this.prisma.bi_workspaces.findUnique({
      where: { id: workspaceRefId },
      select: { id: true, customer_id: true, is_active: true, workspace_id: true, workspace_name: true },
    });
    if (!ws) throw new NotFoundException("Workspace not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.bi_workspace_permissions.findUnique({
        where: { user_id_workspace_ref_id: { user_id: userId, workspace_ref_id: workspaceRefId } },
        select: { id: true, can_view: true },
      });

      const up = await tx.bi_workspace_permissions.upsert({
        where: { user_id_workspace_ref_id: { user_id: userId, workspace_ref_id: workspaceRefId } },
        create: { user_id: userId, workspace_ref_id: workspaceRefId, can_view: canView },
        update: { can_view: canView },
        select: { id: true, can_view: true },
      });

      let reportsAffected = 0;

      if (!canView) {
        // Desabilita também reports desse workspace
        const repIds = await tx.bi_reports.findMany({
          where: { workspace_ref_id: workspaceRefId },
          select: { id: true },
        });
        if (repIds.length) {
          const r = await tx.bi_report_permissions.updateMany({
            where: { user_id: userId, report_ref_id: { in: repIds.map((x) => x.id) } },
            data: { can_view: false },
          });
          reportsAffected = r.count;
        }
      } else if (grantReports) {
        const reps = await tx.bi_reports.findMany({
          where: { workspace_ref_id: workspaceRefId, is_active: true },
          select: { id: true },
        });

        if (reps.length) {
          // cria novos
          const created = await tx.bi_report_permissions.createMany({
            data: reps.map((r) => ({ user_id: userId, report_ref_id: r.id, can_view: true })),
            skipDuplicates: true,
          });

          // garante que existentes fiquem true
          const updated = await tx.bi_report_permissions.updateMany({
            where: { user_id: userId, report_ref_id: { in: reps.map((r) => r.id) } },
            data: { can_view: true },
          });

          reportsAffected = Math.max(created.count, updated.count);
        }
      }

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "WORKSPACE_PERM_UPDATED",
          entity_type: "bi_workspaces",
          entity_id: workspaceRefId,
          before_data: {
            userId,
            workspaceRefId,
            canView: beforePerm?.can_view ?? null,
          },
          after_data: {
            userId,
            workspaceRefId,
            canView: up.can_view,
            grantReports,
            reportsAffected,
          },
        },
      });

      return { ok: true, reportsAffected };
    });
  }

  // =========================
  // SET report permission (com auditoria)
  // =========================
  async setReportPermission(userId: string, reportRefId: string, canView: boolean, actorSub: string | null) {
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const rep = await this.prisma.bi_reports.findUnique({
      where: { id: reportRefId },
      select: { id: true, is_active: true, workspace_ref_id: true },
    });
    if (!rep) throw new NotFoundException("Report not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.bi_report_permissions.findUnique({
        where: { user_id_report_ref_id: { user_id: userId, report_ref_id: reportRefId } },
        select: { id: true, can_view: true },
      });

      await tx.bi_report_permissions.upsert({
        where: { user_id_report_ref_id: { user_id: userId, report_ref_id: reportRefId } },
        create: { user_id: userId, report_ref_id: reportRefId, can_view: canView },
        update: { can_view: canView },
      });

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "REPORT_PERM_UPDATED",
          entity_type: "bi_reports",
          entity_id: reportRefId,
          before_data: { userId, reportRefId, canView: beforePerm?.can_view ?? null },
          after_data: { userId, reportRefId, canView },
        },
      });

      return { ok: true };
    });
  }
}
