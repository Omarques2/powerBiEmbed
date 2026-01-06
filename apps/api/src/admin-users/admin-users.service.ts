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
}
