import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

const ALLOWED_ROLES = new Set(["owner", "admin", "member", "viewer"]);
const ALLOWED_CUSTOMER_STATUS = new Set(["active", "inactive"]);
type MembershipRole = "owner" | "admin" | "member" | "viewer";

function asBool(v: any, def = false) {
  if (v === true || v === false) return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return def;
}

function normalizeCustomerCode(code: string): string {
  const v = (code ?? "").trim().toUpperCase();
  return v;
}

function validateCustomerCode(code: string) {
  // 3..32 chars, A-Z, 0-9, _ e -
  const ok = /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code);
  if (!ok) {
    throw new BadRequestException(
      "Invalid customer code. Use 3-32 chars: A-Z, 0-9, '_' or '-', starting with alphanumeric.",
    );
  }
}

function normalizeCustomerName(name: string): string {
  return (name ?? "").trim();
}

function validateCustomerName(name: string) {
  if (name.length < 2) throw new BadRequestException("Customer name is too short (min 2).");
  if (name.length > 120) throw new BadRequestException("Customer name is too long (max 120).");
}

/**
 * Hardening: valida UUID v4/v5 (aceita v1-5), evitando cast inválido em colunas @db.Uuid.
 */
function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

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

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, display_name: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
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

  async getUserById(userId: string) {
    const u = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
        last_login_at: true,
        status: true,
      },
    });

    if (!u) throw new NotFoundException("User not found");

    // Retorno alinhado ao padrão do seu frontend (snake_case)
    return {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      created_at: u.created_at.toISOString(),
      last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
      status: u.status,
    };
  }

  async disableUser(userId: string, actorSub: string | null = null) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true },
    });
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

  private async assertUserAndCustomer(userId: string, customerId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, display_name: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    return { user, customer };
  }

  private async grantCustomerCatalogAccessTx(tx: Prisma.TransactionClient, userId: string, customerId: string) {
    // 1) Workspaces ativos do customer
    const workspaces = await tx.bi_workspaces.findMany({
      where: { customer_id: customerId, is_active: true, customers: { status: "active" } },
      select: { id: true },
    });

    let wsGranted = 0;
    let rpGranted = 0;

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

    return { wsGranted, rpGranted };
  }

  private async revokeCustomerCatalogAccessTx(tx: Prisma.TransactionClient, userId: string, customerId: string) {
    // Descobre workspaces do customer e revoga apenas os que pertencem ao customer
    const workspaces = await tx.bi_workspaces.findMany({
      where: { customer_id: customerId },
      select: { id: true },
    });

    const wsIds = workspaces.map((w) => w.id);
    let wsRevoked = 0;
    let rpRevoked = 0;

    if (wsIds.length) {
      const wsRes = await tx.bi_workspace_permissions.updateMany({
        where: { user_id: userId, workspace_ref_id: { in: wsIds } },
        data: { can_view: false },
      });
      wsRevoked = wsRes.count;

      const reports = await tx.bi_reports.findMany({
        where: { workspace_ref_id: { in: wsIds } },
        select: { id: true },
      });

      const rpIds = reports.map((r) => r.id);
      if (rpIds.length) {
        const rpRes = await tx.bi_report_permissions.updateMany({
          where: { user_id: userId, report_ref_id: { in: rpIds } },
          data: { can_view: false },
        });
        rpRevoked = rpRes.count;
      }
    }

    return { wsRevoked, rpRevoked };
  }

  // ------------------------------------------
  // NOVO: upsert membership (add/reativar/trocar role)
  // ------------------------------------------
  async upsertUserMembership(
    userId: string,
    input: {
      customerId: string;
      role: MembershipRole;
      isActive?: boolean;
      grantCustomerWorkspaces?: boolean;
      revokeCustomerPermissions?: boolean;
      ensureUserActive?: boolean;
    },
    actorSub: string | null,
  ) {
    const customerId = (input.customerId ?? "").trim();
    const role = (input.role ?? "").trim() as MembershipRole;

    if (!customerId) throw new BadRequestException("customerId is required");
    if (!ALLOWED_ROLES.has(role)) throw new BadRequestException(`Invalid role: ${role}`);

    const isActive = asBool(input.isActive, true);
    const grantCustomerWorkspaces = asBool(input.grantCustomerWorkspaces, false);
    const revokeCustomerPermissions = asBool(input.revokeCustomerPermissions, false);
    const ensureUserActive = asBool(input.ensureUserActive, false);

    const { user, customer } = await this.assertUserAndCustomer(userId, customerId);
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforeMembership = await tx.user_customer_memberships.findUnique({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        select: { id: true, role: true, is_active: true, created_at: true }, // <-- inclui id
      });

      if (ensureUserActive && user.status !== "active") {
        await tx.users.update({ where: { id: userId }, data: { status: "active" } });
      }

      const membership = await tx.user_customer_memberships.upsert({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        create: { user_id: userId, customer_id: customerId, role: role as any, is_active: isActive },
        update: { role: role as any, is_active: isActive },
        select: { id: true, customer_id: true, role: true, is_active: true }, // <-- inclui id
      });

      let granted = { wsGranted: 0, rpGranted: 0 };
      let revoked = { wsRevoked: 0, rpRevoked: 0 };

      // regra recomendada: se está desativando, revoga permissões do customer
      if (!isActive && revokeCustomerPermissions) {
        revoked = await this.revokeCustomerCatalogAccessTx(tx, userId, customerId);
      }

      // se está ativando e pediu grant, aplica grant
      if (isActive && grantCustomerWorkspaces) {
        granted = await this.grantCustomerCatalogAccessTx(tx, userId, customerId);
      }

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_MEMBERSHIP_UPSERTED",
          entity_type: "user_customer_memberships",
          entity_id: membership.id, // <-- FIX: UUID válido (id da membership)
          before_data: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: beforeMembership ?? null,
          },
          after_data: {
            membership: { id: membership.id, customerId, role: membership.role, isActive: membership.is_active },
            key: { userId, customerId }, // humano/debug (não indexado)
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: { customerId, role: membership.role, isActive: membership.is_active },
        granted,
        revoked,
      };
    });
  }

  // ------------------------------------------
  // NOVO: patch membership (role/isActive)
  // ------------------------------------------
  async patchUserMembership(
    userId: string,
    customerIdRaw: string,
    input: {
      role?: MembershipRole;
      isActive?: boolean;
      grantCustomerWorkspaces?: boolean;
      revokeCustomerPermissions?: boolean;
    },
    actorSub: string | null,
  ) {
    const customerId = (customerIdRaw ?? "").trim();
    if (!customerId) throw new BadRequestException("customerId is required");

    const role = input.role ? (String(input.role).trim() as MembershipRole) : null;
    if (role && !ALLOWED_ROLES.has(role)) throw new BadRequestException(`Invalid role: ${role}`);

    const isActive = input.isActive === undefined ? undefined : asBool(input.isActive);
    const grantCustomerWorkspaces = asBool(input.grantCustomerWorkspaces, false);
    const revokeCustomerPermissions = asBool(input.revokeCustomerPermissions, false);

    const { user, customer } = await this.assertUserAndCustomer(userId, customerId);
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user_customer_memberships.findUnique({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        select: { id: true, role: true, is_active: true, created_at: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException("Membership not found");

      const nextRole = role ?? (before.role as any);
      const nextIsActive = isActive === undefined ? before.is_active : isActive;

      const updated = await tx.user_customer_memberships.update({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        data: { role: nextRole as any, is_active: nextIsActive },
        select: { id: true, customer_id: true, role: true, is_active: true }, // <-- inclui id
      });

      let granted = { wsGranted: 0, rpGranted: 0 };
      let revoked = { wsRevoked: 0, rpRevoked: 0 };

      if (!nextIsActive && revokeCustomerPermissions) {
        revoked = await this.revokeCustomerCatalogAccessTx(tx, userId, customerId);
      }
      if (nextIsActive && grantCustomerWorkspaces) {
        granted = await this.grantCustomerCatalogAccessTx(tx, userId, customerId);
      }

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_MEMBERSHIP_UPDATED",
          entity_type: "user_customer_memberships",
          entity_id: updated.id, // <-- FIX: UUID válido (id da membership)
          before_data: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: before,
          },
          after_data: {
            membership: { id: updated.id, customerId, role: updated.role, isActive: updated.is_active },
            key: { userId, customerId }, // humano/debug
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: { customerId, role: updated.role, isActive: updated.is_active },
        granted,
        revoked,
      };
    });
  }

  // ------------------------------------------
  // NOVO: remover membership
  // ------------------------------------------
  async removeUserMembership(
    userId: string,
    customerIdRaw: string,
    revokeCustomerPermissions: boolean,
    actorSub: string | null,
  ) {
    const customerId = (customerIdRaw ?? "").trim();
    if (!customerId) throw new BadRequestException("customerId is required");

    const { user, customer } = await this.assertUserAndCustomer(userId, customerId);
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user_customer_memberships.findUnique({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
        select: { id: true, role: true, is_active: true, created_at: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException("Membership not found");

      await tx.user_customer_memberships.delete({
        where: { user_id_customer_id: { user_id: userId, customer_id: customerId } },
      });

      const revoked = revokeCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, userId, customerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_MEMBERSHIP_REMOVED",
          entity_type: "user_customer_memberships",
          entity_id: before.id, // <-- FIX: UUID válido (id da membership removida)
          before_data: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: before,
          },
          after_data: {
            key: { userId, customerId }, // humano/debug
            revoked,
          },
        },
      });

      return { ok: true, revoked };
    });
  }

  // ------------------------------------------
  // NOVO: transferir membership (trocar customer)
  // ------------------------------------------
  async transferUserMembership(
    userId: string,
    input: {
      fromCustomerId: string;
      toCustomerId: string;
      toRole: MembershipRole;
      deactivateFrom?: boolean;
      revokeFromCustomerPermissions?: boolean;
      grantToCustomerWorkspaces?: boolean;
      toIsActive?: boolean;
    },
    actorSub: string | null,
  ) {
    const fromCustomerId = (input.fromCustomerId ?? "").trim();
    const toCustomerId = (input.toCustomerId ?? "").trim();
    const toRole = (input.toRole ?? "").trim() as MembershipRole;

    if (!fromCustomerId) throw new BadRequestException("fromCustomerId is required");
    if (!toCustomerId) throw new BadRequestException("toCustomerId is required");
    if (fromCustomerId === toCustomerId) {
      throw new BadRequestException("fromCustomerId and toCustomerId must be different");
    }
    if (!ALLOWED_ROLES.has(toRole)) throw new BadRequestException(`Invalid role: ${toRole}`);

    const deactivateFrom = asBool(input.deactivateFrom, true);
    const revokeFromCustomerPermissions = asBool(input.revokeFromCustomerPermissions, true);
    const grantToCustomerWorkspaces = asBool(input.grantToCustomerWorkspaces, false);
    const toIsActive = asBool(input.toIsActive, true);

    // valida usuário + customers
    const { user: usr } = await this.assertUserAndCustomer(userId, fromCustomerId);
    await this.assertUserAndCustomer(userId, toCustomerId);

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const fromBefore = await tx.user_customer_memberships.findUnique({
        where: { user_id_customer_id: { user_id: userId, customer_id: fromCustomerId } },
        select: { id: true, role: true, is_active: true, created_at: true }, // <-- inclui id
      });
      if (!fromBefore) throw new NotFoundException("Source membership not found");

      // 1) desativa origem
      if (deactivateFrom) {
        await tx.user_customer_memberships.update({
          where: { user_id_customer_id: { user_id: userId, customer_id: fromCustomerId } },
          data: { is_active: false },
        });
      }

      const revoked = revokeFromCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, userId, fromCustomerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      // 2) cria/ativa destino
      const toMembership = await tx.user_customer_memberships.upsert({
        where: { user_id_customer_id: { user_id: userId, customer_id: toCustomerId } },
        create: { user_id: userId, customer_id: toCustomerId, role: toRole as any, is_active: toIsActive },
        update: { role: toRole as any, is_active: toIsActive },
        select: { id: true, customer_id: true, role: true, is_active: true }, // <-- inclui id
      });

      const granted =
        toIsActive && grantToCustomerWorkspaces
          ? await this.grantCustomerCatalogAccessTx(tx, userId, toCustomerId)
          : { wsGranted: 0, rpGranted: 0 };

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "USER_MEMBERSHIP_TRANSFERRED",
          entity_type: "user_customer_memberships",
          entity_id: toMembership.id, // <-- FIX: UUID válido (id do membership destino)
          before_data: {
            user: { id: userId, email: usr.email ?? null },
            from: { customerId: fromCustomerId, membership: fromBefore },
          },
          after_data: {
            to: { id: toMembership.id, customerId: toCustomerId, role: toMembership.role, isActive: toMembership.is_active },
            key: { userId, fromCustomerId, toCustomerId }, // humano/debug
            revokedFrom: revoked,
            grantedTo: granted,
            deactivateFrom,
          },
        },
      });

      return {
        ok: true,
        toMembership: { customerId: toCustomerId, role: toMembership.role, isActive: toMembership.is_active },
        revokedFrom: revoked,
        grantedTo: granted,
      };
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

  async createCustomer(input: { code: string; name: string; status?: "active" | "inactive" }, actorSub: string | null) {
    const code = normalizeCustomerCode(input.code);
    const name = normalizeCustomerName(input.name);
    const status = (input.status ?? "active").trim();

    validateCustomerCode(code);
    validateCustomerName(name);

    if (!ALLOWED_CUSTOMER_STATUS.has(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const actorUserId = await this.resolveActorUserId(actorSub);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.customers.create({
          data: { code, name, status },
          select: { id: true, code: true, name: true, status: true, created_at: true },
        });

        await tx.audit_log.create({
          data: {
            actor_user_id: actorUserId,
            action: "CUSTOMER_CREATED",
            entity_type: "customers",
            entity_id: row.id,
            after_data: { id: row.id, code: row.code, name: row.name, status: row.status },
          },
        });

        return row;
      });

      return {
        id: created.id,
        code: created.code,
        name: created.name,
        status: created.status,
        createdAt: created.created_at,
      };
    } catch (e: any) {
      // Prisma unique constraint
      if (e?.code === "P2002") {
        throw new BadRequestException("Customer code already exists.");
      }
      throw e;
    }
  }

  async updateCustomer(customerId: string, input: { code?: string; name?: string }, actorSub: string | null) {
    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const next: { code?: string; name?: string } = {};

    if (typeof input.code === "string") {
      const code = normalizeCustomerCode(input.code);
      validateCustomerCode(code);
      next.code = code;
    }

    if (typeof input.name === "string") {
      const name = normalizeCustomerName(input.name);
      validateCustomerName(name);
      next.name = name;
    }

    if (!Object.keys(next).length) {
      throw new BadRequestException("Nothing to update.");
    }

    const actorUserId = await this.resolveActorUserId(actorSub);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.customers.update({
          where: { id: customerId },
          data: next,
          select: { id: true, code: true, name: true, status: true, created_at: true },
        });

        await tx.audit_log.create({
          data: {
            actor_user_id: actorUserId,
            action: "CUSTOMER_UPDATED",
            entity_type: "customers",
            entity_id: customerId,
            before_data: { id: customer.id, code: customer.code, name: customer.name, status: customer.status },
            after_data: { id: row.id, code: row.code, name: row.name, status: row.status },
          },
        });

        return row;
      });

      return {
        ok: true,
        customer: {
          id: updated.id,
          code: updated.code,
          name: updated.name,
          status: updated.status,
          createdAt: updated.created_at,
        },
      };
    } catch (e: any) {
      if (e?.code === "P2002") {
        throw new BadRequestException("Customer code already exists.");
      }
      throw e;
    }
  }

  async setCustomerStatus(customerId: string, statusRaw: "active" | "inactive", actorSub: string | null) {
    const status = (statusRaw ?? "").trim();
    if (!ALLOWED_CUSTOMER_STATUS.has(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const customer = await this.prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customers.update({
        where: { id: customerId },
        data: { status },
        select: { id: true, status: true },
      });

      // Cascata RECOMENDADA ao desativar: trava catálogo (reversível via novo sync/reativação)
      let workspacesDeactivated = 0;
      let reportsDeactivated = 0;

      if (status === "inactive") {
        const wsRes = await tx.bi_workspaces.updateMany({
          where: { customer_id: customerId, is_active: true },
          data: { is_active: false },
        });
        workspacesDeactivated = wsRes.count;

        // desativa reports de workspaces desse customer
        const wsRefs = await tx.bi_workspaces.findMany({
          where: { customer_id: customerId },
          select: { id: true },
        });

        if (wsRefs.length) {
          const rpRes = await tx.bi_reports.updateMany({
            where: { workspace_ref_id: { in: wsRefs.map((w) => w.id) }, is_active: true },
            data: { is_active: false },
          });
          reportsDeactivated = rpRes.count;
        }
      }

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "CUSTOMER_STATUS_CHANGED",
          entity_type: "customers",
          entity_id: customerId,
          before_data: { status: customer.status },
          after_data: { status: updated.status, workspacesDeactivated, reportsDeactivated },
        },
      });

      return { ok: true, status: updated.status, workspacesDeactivated, reportsDeactivated };
    });
  }

  async unlinkWorkspaceFromCustomer(customerId: string, workspaceRefId: string, actorSub: string | null) {
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const ws = await tx.bi_workspaces.findUnique({
        where: { id: workspaceRefId },
        select: {
          id: true,
          customer_id: true,
          workspace_id: true,
          workspace_name: true,
          is_active: true,
          customers: { select: { id: true, status: true } },
        },
      });
      if (!ws) throw new NotFoundException("Workspace not found");
      if (ws.customer_id !== customerId) throw new BadRequestException("Workspace does not belong to this customer");

      const before = {
        workspace: {
          workspaceRefId: ws.id,
          workspaceId: ws.workspace_id,
          name: ws.workspace_name ?? null,
          isActive: ws.is_active,
        },
      };

      // 1) Desativa workspace
      await tx.bi_workspaces.update({
        where: { id: workspaceRefId },
        data: { is_active: false },
      });

      // 2) Desativa reports do workspace
      const reports = await tx.bi_reports.findMany({
        where: { workspace_ref_id: workspaceRefId },
        select: { id: true, report_id: true, is_active: true },
      });

      const repIds = reports.map((r) => r.id);

      const repDeact = await tx.bi_reports.updateMany({
        where: { workspace_ref_id: workspaceRefId },
        data: { is_active: false },
      });

      // 3) Descobre usuários do customer (membership ativo)
      const memberRows = await tx.user_customer_memberships.findMany({
        where: {
          customer_id: customerId,
          is_active: true,
          customers: { status: "active" },
        },
        select: { user_id: true },
      });

      const userIds = memberRows.map((m) => m.user_id);

      let wsPermRevoked = 0;
      let rpPermRevoked = 0;

      if (userIds.length) {
        const wsPermRes = await tx.bi_workspace_permissions.updateMany({
          where: {
            workspace_ref_id: workspaceRefId,
            user_id: { in: userIds },
          },
          data: { can_view: false },
        });
        wsPermRevoked = wsPermRes.count;

        if (repIds.length) {
          const rpPermRes = await tx.bi_report_permissions.updateMany({
            where: {
              report_ref_id: { in: repIds },
              user_id: { in: userIds },
            },
            data: { can_view: false },
          });
          rpPermRevoked = rpPermRes.count;
        }
      }

      const after = {
        workspace: { workspaceRefId, isActive: false },
        reports: { totalFound: reports.length, deactivated: repDeact.count },
        permissions: {
          usersConsidered: userIds.length,
          workspacePermsRevoked: wsPermRevoked,
          reportPermsRevoked: rpPermRevoked,
        },
      };

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "CUSTOMER_WORKSPACE_UNLINKED",
          entity_type: "bi_workspaces",
          entity_id: workspaceRefId,
          before_data: before,
          after_data: after,
        },
      });

      return { ok: true, ...after };
    });
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

    // HARDENING: entity_id é @db.Uuid. Evita cast inválido no Prisma/Postgres.
    if (input.entityId) {
      const v = String(input.entityId).trim();
      if (!isUuid(v)) {
        throw new BadRequestException("entityId must be a UUID");
      }
      where.entity_id = v;
    }

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
      where: { user_id: userId, customers: { status: "active" } },
      include: { customers: { select: { id: true, code: true, name: true, status: true } } },
      orderBy: { created_at: "asc" },
    });

    const activeMemberships = memberships.filter((m) => m.is_active);

    const effectiveCustomerId =
      customerId && memberships.some((m) => m.customer_id === customerId)
        ? customerId
        : activeMemberships[0]?.customer_id ?? memberships[0]?.customer_id ?? null;

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

  // =============================
  // SECURITY / PLATFORM ADMINS
  // =============================

  async listPlatformAdmins(input: { appKey: string; roleKey?: string }) {
    const appKey = (input.appKey ?? "PBI_EMBED").trim();
    const roleKey = (input.roleKey ?? "platform_admin").trim();

    const rows = await this.prisma.user_app_roles.findMany({
      where: {
        customer_id: null,
        applications: { app_key: appKey },
        app_roles: { role_key: roleKey },
      },
      select: {
        created_at: true,
        users: { select: { id: true, email: true, display_name: true, status: true } },
        applications: { select: { app_key: true } },
        app_roles: { select: { role_key: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return rows.map((r) => ({
      userId: r.users.id,
      email: r.users.email ?? null,
      displayName: r.users.display_name ?? null,
      status: r.users.status,
      grantedAt: r.created_at,
      appKey: r.applications.app_key,
      roleKey: r.app_roles.role_key,
    }));
  }

  private async ensureAppAndRoleTx(
    tx: Prisma.TransactionClient,
    input: { appKey: string; roleKey: string },
  ) {
    const app = await tx.applications.upsert({
      where: { app_key: input.appKey },
      create: { app_key: input.appKey, name: input.appKey },
      update: { name: input.appKey },
      select: { id: true, app_key: true },
    });

    const role = await tx.app_roles.upsert({
      where: { application_id_role_key: { application_id: app.id, role_key: input.roleKey } },
      create: {
        application_id: app.id,
        role_key: input.roleKey,
        name: input.roleKey === "platform_admin" ? "Platform Admin" : input.roleKey,
      },
      update: {
        name: input.roleKey === "platform_admin" ? "Platform Admin" : input.roleKey,
      },
      select: { id: true, role_key: true },
    });

    return { app, role };
  }

  private async countPlatformAdminsTx(
    tx: Prisma.TransactionClient,
    input: { appKey: string; roleKey: string },
  ) {
    return tx.user_app_roles.count({
      where: {
        customer_id: null,
        applications: { app_key: input.appKey },
        app_roles: { role_key: input.roleKey },
      },
    });
  }

  async grantPlatformAdmin(
    input: { appKey: string; roleKey: string; userId: string | null; userEmail: string | null },
    actorSub: string | null,
  ) {
    const appKey = (input.appKey ?? "PBI_EMBED").trim();
    const roleKey = (input.roleKey ?? "platform_admin").trim();

    const actorUserId = await this.resolveActorUserId(actorSub);

    // Resolve user alvo
    const targetUser =
      input.userId
        ? await this.prisma.users.findUnique({
            where: { id: input.userId },
            select: { id: true, email: true, status: true },
          })
        : await this.prisma.users.findFirst({
            where: { email: { equals: String(input.userEmail), mode: "insensitive" } as any },
            select: { id: true, email: true, status: true },
          });

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const { app, role } = await this.ensureAppAndRoleTx(tx, { appKey, roleKey });

      // Idempotência: se já existe, no-op
      const existing = await tx.user_app_roles.findFirst({
        where: {
          user_id: targetUser.id,
          application_id: app.id,
          app_role_id: role.id,
          customer_id: null,
        },
        select: { id: true, created_at: true },
      });

      if (!existing) {
        await tx.user_app_roles.create({
          data: {
            user_id: targetUser.id,
            application_id: app.id,
            customer_id: null,
            app_role_id: role.id,
          },
        });
      }

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "PLATFORM_ADMIN_GRANTED",
          entity_type: "users",
          entity_id: targetUser.id,
          before_data: existing
            ? { alreadyHadRole: true, appKey, roleKey }
            : { alreadyHadRole: false, appKey, roleKey },
          after_data: {
            user: { id: targetUser.id, email: targetUser.email ?? null },
            application: appKey,
            role: roleKey,
          },
        },
      });

      return {
        ok: true,
        idempotent: Boolean(existing),
        userId: targetUser.id,
        appKey,
        roleKey,
      };
    });
  }

  async revokePlatformAdmin(
    input: { userId: string; appKey: string; roleKey: string },
    actorSub: string | null,
  ) {
    const userId = input.userId.trim();
    const appKey = (input.appKey ?? "PBI_EMBED").trim();
    const roleKey = (input.roleKey ?? "platform_admin").trim();

    const actorUserId = await this.resolveActorUserId(actorSub);

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.$transaction(async (tx) => {
      // Descobre app/role (cria se não existir)
      const { app, role } = await this.ensureAppAndRoleTx(tx, { appKey, roleKey });

      const existing = await tx.user_app_roles.findFirst({
        where: {
          user_id: userId,
          application_id: app.id,
          app_role_id: role.id,
          customer_id: null,
        },
        select: { id: true, created_at: true },
      });

      // Idempotente: se não existe, no-op (mas audita tentativa)
      if (!existing) {
        await tx.audit_log.create({
          data: {
            actor_user_id: actorUserId,
            action: "PLATFORM_ADMIN_REVOKED",
            entity_type: "users",
            entity_id: userId,
            before_data: { hadRole: false, appKey, roleKey },
            after_data: { ok: true, noOp: true },
          },
        });

        return { ok: true, idempotent: true };
      }

      // Break-glass: impedir remover o último admin do app/role
      const totalAdmins = await this.countPlatformAdminsTx(tx, { appKey, roleKey });
      if (totalAdmins <= 1) {
        throw new BadRequestException({ code: "LAST_PLATFORM_ADMIN", message: "Cannot revoke the last platform admin." });
      }

      await tx.user_app_roles.delete({ where: { id: existing.id } });

      await tx.audit_log.create({
        data: {
          actor_user_id: actorUserId,
          action: "PLATFORM_ADMIN_REVOKED",
          entity_type: "users",
          entity_id: userId,
          before_data: {
            hadRole: true,
            grantedAt: existing.created_at,
            application: appKey,
            role: roleKey,
          },
          after_data: {
            user: { id: userId, email: user.email ?? null },
            application: appKey,
            role: roleKey,
          },
        },
      });

      return { ok: true, idempotent: false };
    });
  }

  // ============================================================
  // Entrega 2 — Overview (stats) + Busca global
  // ============================================================

  async getAdminOverview() {
    // “Critical actions” deve refletir o que você considera operacional/risco.
    // Ajuste essa lista conforme seus actions atuais.
    const criticalActions = [
      "PLATFORM_ADMIN_GRANTED",
      "PLATFORM_ADMIN_REVOKED",
      "PLATFORM_ADMIN_BOOTSTRAPPED",
      "USER_DISABLED",
      "CUSTOMER_STATUS_CHANGED",
      "PBI_CATALOG_SYNC_OK",
      "PBI_CATALOG_SYNC_FAILED",
    ];

    const [
      pendingUsers,
      inactiveCustomers,
      platformAdmins,
      workspaces,
      reports,
      criticalAudit,
      lastSyncOk,
      lastSyncFail,
    ] = await this.prisma.$transaction([
      this.prisma.users.count({ where: { status: "pending" } }),
      this.prisma.customers.count({ where: { status: "inactive" } }),

      // conta platform admins para o app PBI_EMBED (role global customer_id = null)
      this.prisma.user_app_roles.count({
        where: {
          customer_id: null,
          applications: { app_key: "PBI_EMBED" },
          app_roles: { role_key: "platform_admin" },
          users: { status: "active" },
        },
      }),

      this.prisma.bi_workspaces.count({}),
      this.prisma.bi_reports.count({}),

      this.prisma.audit_log.findMany({
        where: { action: { in: criticalActions } },
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          id: true,
          created_at: true,
          action: true,
          entity_type: true,
          entity_id: true,
          actor_user_id: true,
          actor: {
            select: { id: true, email: true, display_name: true },
          },
        },
      }),

      this.prisma.audit_log.findFirst({
        where: { action: "PBI_CATALOG_SYNC_OK" },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      }),

      this.prisma.audit_log.findFirst({
        where: { action: "PBI_CATALOG_SYNC_FAILED" },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      }),
    ]);

    const okAt = lastSyncOk?.created_at ? new Date(lastSyncOk.created_at).getTime() : null;
    const failAt = lastSyncFail?.created_at ? new Date(lastSyncFail.created_at).getTime() : null;

    const lastSyncAt =
      okAt || failAt ? new Date(Math.max(okAt ?? 0, failAt ?? 0)).toISOString() : null;

    const lastSyncStatus =
      okAt || failAt
        ? okAt !== null && okAt >= (failAt ?? 0)
          ? "ok"
          : "fail"
        : "unknown";

    return {
      counts: {
        pendingUsers,
        inactiveCustomers,
        platformAdmins,
        workspaces,
        reports,
      },
      audit: {
        critical: criticalAudit.map((r) => ({
          id: r.id,
          createdAt: r.created_at.toISOString(),
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          actorUserId: r.actor_user_id,
          actor: r.actor
            ? {
                email: r.actor.email ?? null,
                displayName: r.actor.display_name ?? null,
              }
            : null,
        })),
      },
      powerbi: {
        lastSyncAt,
        lastSyncStatus,
      },
    };
  }

  async globalSearch(input: { q: string; limit: number }) {
    const q = input.q.trim();
    const limit = input.limit;

    // Heurísticas para id: Power BI GUIDs são comuns
    const looksLikeGuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);

    const [users, customers, workspaces, reports] = await this.prisma.$transaction([
      this.prisma.users.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { display_name: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ id: q }] : []),
          ],
        },
        orderBy: { created_at: "desc" },
        take: limit,
        select: { id: true, email: true, display_name: true, status: true },
      }),

      this.prisma.customers.findMany({
        where: {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ id: q }] : []),
          ],
        },
        orderBy: [{ status: "asc" }, { code: "asc" }],
        take: limit,
        select: { id: true, code: true, name: true, status: true },
      }),

      this.prisma.bi_workspaces.findMany({
        where: {
          OR: [
            { workspace_name: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ workspace_id: q }] : []),
          ],
        },
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          workspace_id: true,
          workspace_name: true,
          customer_id: true,
          is_active: true,
        },
      }),

      this.prisma.bi_reports.findMany({
        where: {
          OR: [
            { report_name: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ report_id: q }, { dataset_id: q }] : []),
          ],
        },
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          report_id: true,
          report_name: true,
          dataset_id: true,
          workspace_ref_id: true,
          is_active: true,
        },
      }),
    ]);

    return {
      q,
      users: users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        displayName: u.display_name ?? null,
        status: u.status,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        status: c.status,
      })),
      powerbi: {
        workspaces: workspaces.map((w) => ({
          id: w.id,
          workspaceId: w.workspace_id,
          name: w.workspace_name ?? w.workspace_id,
          customerId: w.customer_id,
          isActive: w.is_active,
        })),
        reports: reports.map((r) => ({
          id: r.id,
          reportId: r.report_id,
          name: r.report_name ?? r.report_id,
          datasetId: r.dataset_id,
          workspaceRefId: r.workspace_ref_id,
          isActive: r.is_active,
        })),
      },
    };
  }

}
