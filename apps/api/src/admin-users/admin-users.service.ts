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
    return this.prisma.user.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
      },
    });
  }

  private async resolveActorUserId(actorSub: string | null): Promise<string | null> {
    if (!actorSub) return null;
    const actor = await this.prisma.user.findUnique({
      where: { entraSub: actorSub },
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = {
        user: { id: userId, status: user.status, email: user.email ?? null, displayName: user.displayName ?? null },
        customer: { id: customerId, code: customer.code, name: customer.name, status: customer.status },
      };

      await tx.user.update({
        where: { id: userId },
        data: { status: "active" },
      });

      await tx.userCustomerMembership.upsert({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        create: { userId: userId, customerId: customerId, role: role as any, isActive: true },
        update: { role: role as any, isActive: true },
      });

      let wsGranted = 0;
      let rpGranted = 0;

      if (grantCustomerWorkspaces) {
        // 1) Workspaces ativos do customer
        const workspaces = await tx.biWorkspace.findMany({
          where: { customerId: customerId, isActive: true, customer: { status: "active" } },
          select: { id: true },
        });

        if (workspaces.length) {
          const wsRes = await tx.biWorkspacePermission.createMany({
            data: workspaces.map((ws) => ({
              userId: userId,
              workspaceRefId: ws.id,
              canView: true,
            })),
            skipDuplicates: true,
          });

          wsGranted = wsRes.count;

          // 2) Reports ativos nos workspaces (permissão por report)
          const reports = await tx.biReport.findMany({
            where: {
              workspaceRefId: { in: workspaces.map((w) => w.id) },
              isActive: true,
              workspace: { isActive: true, customer: { status: "active" } },
            },
            select: { id: true },
          });

          if (reports.length) {
            const rpRes = await tx.biReportPermission.createMany({
              data: reports.map((r) => ({
                userId: userId,
                reportRefId: r.id,
                canView: true,
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
      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_ACTIVATED",
          entityType: "users",
          entityId: userId,
          beforeData: before,
          afterData: after,
        },
      });

      // Auditoria: grants (se existiram)
      if (wsGranted > 0) {
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "WORKSPACE_PERMS_GRANTED",
            entityType: "users",
            entityId: userId,
            afterData: { customerId, count: wsGranted },
          },
        });
      }
      if (rpGranted > 0) {
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "REPORT_PERMS_GRANTED",
            entityType: "users",
            entityId: userId,
            afterData: { customerId, count: rpGranted },
          },
        });
      }

      return { ok: true };
    });
  }

  async getUserById(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
      },
    });

    if (!u) throw new NotFoundException("User not found");

    // Retorno alinhado ao padrão do seu frontend (snake_case)
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      status: u.status,
    };
  }

  async disableUser(userId: string, actorSub: string | null = null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = { user: { id: userId, status: user.status, email: user.email ?? null } };

      await tx.user.update({ where: { id: userId }, data: { status: "disabled" } });

      await tx.userCustomerMembership.updateMany({
        where: { userId: userId },
        data: { isActive: false },
      });

      await tx.biWorkspacePermission.updateMany({
        where: { userId: userId },
        data: { canView: false },
      });

      await tx.biReportPermission.updateMany({
        where: { userId: userId },
        data: { canView: false },
      });

      const after = { user: { id: userId, status: "disabled" } };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_DISABLED",
          entityType: "users",
          entityId: userId,
          beforeData: before,
          afterData: after,
        },
      });

      return { ok: true };
    });
  }

  private async assertUserAndCustomer(userId: string, customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.status !== "active") throw new BadRequestException("Customer is not active");

    return { user, customer };
  }

  private async grantCustomerCatalogAccessTx(tx: Prisma.TransactionClient, userId: string, customerId: string) {
    // 1) Workspaces ativos do customer
    const workspaces = await tx.biWorkspace.findMany({
      where: { customerId: customerId, isActive: true, customer: { status: "active" } },
      select: { id: true },
    });

    let wsGranted = 0;
    let rpGranted = 0;

    if (workspaces.length) {
      const wsRes = await tx.biWorkspacePermission.createMany({
        data: workspaces.map((ws) => ({
          userId: userId,
          workspaceRefId: ws.id,
          canView: true,
        })),
        skipDuplicates: true,
      });
      wsGranted = wsRes.count;

      const reports = await tx.biReport.findMany({
        where: {
          workspaceRefId: { in: workspaces.map((w) => w.id) },
          isActive: true,
          workspace: { isActive: true, customer: { status: "active" } },
        },
        select: { id: true },
      });

      if (reports.length) {
        const rpRes = await tx.biReportPermission.createMany({
          data: reports.map((r) => ({
            userId: userId,
            reportRefId: r.id,
            canView: true,
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
    const workspaces = await tx.biWorkspace.findMany({
      where: { customerId: customerId },
      select: { id: true },
    });

    const wsIds = workspaces.map((w) => w.id);
    let wsRevoked = 0;
    let rpRevoked = 0;

    if (wsIds.length) {
      const wsRes = await tx.biWorkspacePermission.updateMany({
        where: { userId: userId, workspaceRefId: { in: wsIds } },
        data: { canView: false },
      });
      wsRevoked = wsRes.count;

      const reports = await tx.biReport.findMany({
        where: { workspaceRefId: { in: wsIds } },
        select: { id: true },
      });

      const rpIds = reports.map((r) => r.id);
      if (rpIds.length) {
        const rpRes = await tx.biReportPermission.updateMany({
          where: { userId: userId, reportRefId: { in: rpIds } },
          data: { canView: false },
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
      const beforeMembership = await tx.userCustomerMembership.findUnique({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });

      if (ensureUserActive && user.status !== "active") {
        await tx.user.update({ where: { id: userId }, data: { status: "active" } });
      }

      const membership = await tx.userCustomerMembership.upsert({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        create: { userId: userId, customerId: customerId, role: role as any, isActive: isActive },
        update: { role: role as any, isActive: isActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
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

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_MEMBERSHIP_UPSERTED",
          entityType: "user_customer_memberships",
          entityId: membership.id, // <-- FIX: UUID válido (id da membership)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: beforeMembership ?? null,
          },
          afterData: {
            membership: { id: membership.id, customerId, role: membership.role, isActive: membership.isActive },
            key: { userId, customerId }, // humano/debug (não indexado)
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: { customerId, role: membership.role, isActive: membership.isActive },
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
      const before = await tx.userCustomerMembership.findUnique({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException("Membership not found");

      const nextRole = role ?? (before.role as any);
      const nextIsActive = isActive === undefined ? before.isActive : isActive;

      const updated = await tx.userCustomerMembership.update({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        data: { role: nextRole as any, isActive: nextIsActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
      });

      let granted = { wsGranted: 0, rpGranted: 0 };
      let revoked = { wsRevoked: 0, rpRevoked: 0 };

      if (!nextIsActive && revokeCustomerPermissions) {
        revoked = await this.revokeCustomerCatalogAccessTx(tx, userId, customerId);
      }
      if (nextIsActive && grantCustomerWorkspaces) {
        granted = await this.grantCustomerCatalogAccessTx(tx, userId, customerId);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_MEMBERSHIP_UPDATED",
          entityType: "user_customer_memberships",
          entityId: updated.id, // <-- FIX: UUID válido (id da membership)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: before,
          },
          afterData: {
            membership: { id: updated.id, customerId, role: updated.role, isActive: updated.isActive },
            key: { userId, customerId }, // humano/debug
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: { customerId, role: updated.role, isActive: updated.isActive },
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
      const before = await tx.userCustomerMembership.findUnique({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException("Membership not found");

      await tx.userCustomerMembership.delete({
        where: { userId_customerId: { userId: userId, customerId: customerId } },
      });

      const revoked = revokeCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, userId, customerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_MEMBERSHIP_REMOVED",
          entityType: "user_customer_memberships",
          entityId: before.id, // <-- FIX: UUID válido (id da membership removida)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: { id: customerId, code: customer.code, name: customer.name },
            membership: before,
          },
          afterData: {
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
      const fromBefore = await tx.userCustomerMembership.findUnique({
        where: { userId_customerId: { userId: userId, customerId: fromCustomerId } },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!fromBefore) throw new NotFoundException("Source membership not found");

      // 1) desativa origem
      if (deactivateFrom) {
        await tx.userCustomerMembership.update({
          where: { userId_customerId: { userId: userId, customerId: fromCustomerId } },
          data: { isActive: false },
        });
      }

      const revoked = revokeFromCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, userId, fromCustomerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      // 2) cria/ativa destino
      const toMembership = await tx.userCustomerMembership.upsert({
        where: { userId_customerId: { userId: userId, customerId: toCustomerId } },
        create: { userId: userId, customerId: toCustomerId, role: toRole as any, isActive: toIsActive },
        update: { role: toRole as any, isActive: toIsActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
      });

      const granted =
        toIsActive && grantToCustomerWorkspaces
          ? await this.grantCustomerCatalogAccessTx(tx, userId, toCustomerId)
          : { wsGranted: 0, rpGranted: 0 };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "USER_MEMBERSHIP_TRANSFERRED",
          entityType: "user_customer_memberships",
          entityId: toMembership.id, // <-- FIX: UUID válido (id do membership destino)
          beforeData: {
            user: { id: userId, email: usr.email ?? null },
            from: { customerId: fromCustomerId, membership: fromBefore },
          },
          afterData: {
            to: { id: toMembership.id, customerId: toCustomerId, role: toMembership.role, isActive: toMembership.isActive },
            key: { userId, fromCustomerId, toCustomerId }, // humano/debug
            revokedFrom: revoked,
            grantedTo: granted,
            deactivateFrom,
          },
        },
      });

      return {
        ok: true,
        toMembership: { customerId: toCustomerId, role: toMembership.role, isActive: toMembership.isActive },
        revokedFrom: revoked,
        grantedTo: granted,
      };
    });
  }

  async listCustomers() {
    const rows = await this.prisma.customer.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, status: true, createdAt: true },
    });

    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
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
        const row = await tx.customer.create({
          data: { code, name, status },
          select: { id: true, code: true, name: true, status: true, createdAt: true },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "CUSTOMER_CREATED",
            entityType: "customers",
            entityId: row.id,
            afterData: { id: row.id, code: row.code, name: row.name, status: row.status },
          },
        });

        return row;
      });

      return {
        id: created.id,
        code: created.code,
        name: created.name,
        status: created.status,
        createdAt: created.createdAt,
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
    const customer = await this.prisma.customer.findUnique({
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
        const row = await tx.customer.update({
          where: { id: customerId },
          data: next,
          select: { id: true, code: true, name: true, status: true, createdAt: true },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "CUSTOMER_UPDATED",
            entityType: "customers",
            entityId: customerId,
            beforeData: { id: customer.id, code: customer.code, name: customer.name, status: customer.status },
            afterData: { id: row.id, code: row.code, name: row.name, status: row.status },
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
          createdAt: updated.createdAt,
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

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { status },
        select: { id: true, status: true },
      });

      // Cascata RECOMENDADA ao desativar: trava catálogo (reversível via novo sync/reativação)
      let workspacesDeactivated = 0;
      let reportsDeactivated = 0;

      if (status === "inactive") {
        const wsRes = await tx.biWorkspace.updateMany({
          where: { customerId: customerId, isActive: true },
          data: { isActive: false },
        });
        workspacesDeactivated = wsRes.count;

        // desativa reports de workspaces desse customer
        const wsRefs = await tx.biWorkspace.findMany({
          where: { customerId: customerId },
          select: { id: true },
        });

        if (wsRefs.length) {
          const rpRes = await tx.biReport.updateMany({
            where: { workspaceRefId: { in: wsRefs.map((w) => w.id) }, isActive: true },
            data: { isActive: false },
          });
          reportsDeactivated = rpRes.count;
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "CUSTOMER_STATUS_CHANGED",
          entityType: "customers",
          entityId: customerId,
          beforeData: { status: customer.status },
          afterData: { status: updated.status, workspacesDeactivated, reportsDeactivated },
        },
      });

      return { ok: true, status: updated.status, workspacesDeactivated, reportsDeactivated };
    });
  }

  async unlinkWorkspaceFromCustomer(customerId: string, workspaceRefId: string, actorSub: string | null) {
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const ws = await tx.biWorkspace.findUnique({
        where: { id: workspaceRefId },
        select: {
          id: true,
          customerId: true,
          workspaceId: true,
          workspaceName: true,
          isActive: true,
          customer: { select: { id: true, status: true } },
        },
      });
      if (!ws) throw new NotFoundException("Workspace not found");
      if (ws.customerId !== customerId) throw new BadRequestException("Workspace does not belong to this customer");

      const before = {
        workspace: {
          workspaceRefId: ws.id,
          workspaceId: ws.workspaceId,
          name: ws.workspaceName ?? null,
          isActive: ws.isActive,
        },
      };

      // 1) Desativa workspace
      await tx.biWorkspace.update({
        where: { id: workspaceRefId },
        data: { isActive: false },
      });

      // 2) Desativa reports do workspace
      const reports = await tx.biReport.findMany({
        where: { workspaceRefId: workspaceRefId },
        select: { id: true, reportId: true, isActive: true },
      });

      const repIds = reports.map((r) => r.id);

      const repDeact = await tx.biReport.updateMany({
        where: { workspaceRefId: workspaceRefId },
        data: { isActive: false },
      });

      // 3) Descobre usuários do customer (membership ativo)
      const memberRows = await tx.userCustomerMembership.findMany({
        where: {
          customerId: customerId,
          isActive: true,
          customer: { status: "active" },
        },
        select: { userId: true },
      });

      const userIds = memberRows.map((m) => m.userId);

      let wsPermRevoked = 0;
      let rpPermRevoked = 0;

      if (userIds.length) {
        const wsPermRes = await tx.biWorkspacePermission.updateMany({
          where: {
            workspaceRefId: workspaceRefId,
            userId: { in: userIds },
          },
          data: { canView: false },
        });
        wsPermRevoked = wsPermRes.count;

        if (repIds.length) {
          const rpPermRes = await tx.biReportPermission.updateMany({
            where: {
              reportRefId: { in: repIds },
              userId: { in: userIds },
            },
            data: { canView: false },
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

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "CUSTOMER_WORKSPACE_UNLINKED",
          entityType: "bi_workspaces",
          entityId: workspaceRefId,
          beforeData: before,
          afterData: after,
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
    if (input.entityType) where.entityType = input.entityType;

    // HARDENING: entityId é @db.Uuid. Evita cast inválido no Prisma/Postgres.
    if (input.entityId) {
      const v = String(input.entityId).trim();
      if (!isUuid(v)) {
        throw new BadRequestException("entityId must be a UUID");
      }
      where.entityId = v;
    }

    if (input.actorUserId) where.actorUserId = input.actorUserId;

    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) where.createdAt.gte = new Date(input.from);
      if (input.to) where.createdAt.lte = new Date(input.to);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actorUserId: r.actorUserId,
        actor: r.actor ? { id: r.actor.id, email: r.actor.email, displayName: r.actor.displayName } : null,
        ip: r.ip,
        userAgent: r.userAgent,
        before: r.beforeData,
        after: r.afterData,
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
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
          lastLoginAt: true,
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, status: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const memberships = await this.prisma.userCustomerMembership.findMany({
      where: { userId: userId, customer: { status: "active" } },
      include: { customer: { select: { id: true, code: true, name: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });

    const activeMemberships = memberships.filter((m) => m.isActive);

    const effectiveCustomerId =
      customerId && memberships.some((m) => m.customerId === customerId)
        ? customerId
        : activeMemberships[0]?.customerId ?? memberships[0]?.customerId ?? null;

    if (!effectiveCustomerId) {
      return {
        user: { id: user.id, email: user.email, displayName: user.displayName, status: user.status },
        memberships: memberships.map((m) => ({
          customerId: m.customerId,
          role: m.role,
          isActive: m.isActive,
          customer: m.customer,
        })),
        customerId: null,
        workspaces: [],
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: effectiveCustomerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const workspaces = await this.prisma.biWorkspace.findMany({
      where: { customerId: effectiveCustomerId, isActive: true, customer: { status: "active" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, workspaceId: true, workspaceName: true },
    });

    const wsPerms = await this.prisma.biWorkspacePermission.findMany({
      where: {
        userId: userId,
        workspaceRefId: { in: workspaces.map((w) => w.id) },
      },
      select: { workspaceRefId: true, canView: true },
    });

    const reports = await this.prisma.biReport.findMany({
      where: {
        workspaceRefId: { in: workspaces.map((w) => w.id) },
        isActive: true,
        workspace: { isActive: true, customer: { status: "active" } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, workspaceRefId: true, reportId: true, reportName: true, datasetId: true },
    });

    const rpPerms = await this.prisma.biReportPermission.findMany({
      where: {
        userId: userId,
        reportRefId: { in: reports.map((r) => r.id) },
      },
      select: { reportRefId: true, canView: true },
    });

    const wsPermMap = new Map(wsPerms.map((p) => [p.workspaceRefId, p.canView]));
    const rpPermMap = new Map(rpPerms.map((p) => [p.reportRefId, p.canView]));

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, status: user.status },
      customer,
      customerId: effectiveCustomerId,
      memberships: memberships.map((m) => ({
        customerId: m.customerId,
        role: m.role,
        isActive: m.isActive,
        customer: m.customer,
      })),
      workspaces: workspaces.map((w) => ({
        workspaceRefId: w.id,
        workspaceId: w.workspaceId,
        name: w.workspaceName ?? String(w.workspaceId),
        canView: wsPermMap.get(w.id) ?? false,
        reports: reports
          .filter((r) => r.workspaceRefId === w.id)
          .map((r) => ({
            reportRefId: r.id,
            reportId: r.reportId,
            name: r.reportName ?? String(r.reportId),
            datasetId: r.datasetId,
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const ws = await this.prisma.biWorkspace.findUnique({
      where: { id: workspaceRefId },
      select: { id: true, customerId: true, isActive: true, workspaceId: true, workspaceName: true },
    });
    if (!ws) throw new NotFoundException("Workspace not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.biWorkspacePermission.findUnique({
        where: { userId_workspaceRefId: { userId: userId, workspaceRefId: workspaceRefId } },
        select: { id: true, canView: true },
      });

      const up = await tx.biWorkspacePermission.upsert({
        where: { userId_workspaceRefId: { userId: userId, workspaceRefId: workspaceRefId } },
        create: { userId: userId, workspaceRefId: workspaceRefId, canView: canView },
        update: { canView: canView },
        select: { id: true, canView: true },
      });

      let reportsAffected = 0;

      if (!canView) {
        // Desabilita também reports desse workspace
        const repIds = await tx.biReport.findMany({
          where: { workspaceRefId: workspaceRefId },
          select: { id: true },
        });
        if (repIds.length) {
          const r = await tx.biReportPermission.updateMany({
            where: { userId: userId, reportRefId: { in: repIds.map((x) => x.id) } },
            data: { canView: false },
          });
          reportsAffected = r.count;
        }
      } else if (grantReports) {
        const reps = await tx.biReport.findMany({
          where: { workspaceRefId: workspaceRefId, isActive: true },
          select: { id: true },
        });

        if (reps.length) {
          // cria novos
          const created = await tx.biReportPermission.createMany({
            data: reps.map((r) => ({ userId: userId, reportRefId: r.id, canView: true })),
            skipDuplicates: true,
          });

          // garante que existentes fiquem true
          const updated = await tx.biReportPermission.updateMany({
            where: { userId: userId, reportRefId: { in: reps.map((r) => r.id) } },
            data: { canView: true },
          });

          reportsAffected = Math.max(created.count, updated.count);
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "WORKSPACE_PERM_UPDATED",
          entityType: "bi_workspaces",
          entityId: workspaceRefId,
          beforeData: {
            userId,
            workspaceRefId,
            canView: beforePerm?.canView ?? null,
          },
          afterData: {
            userId,
            workspaceRefId,
            canView: up.canView,
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
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");

    const rep = await this.prisma.biReport.findUnique({
      where: { id: reportRefId },
      select: { id: true, isActive: true, workspaceRefId: true },
    });
    if (!rep) throw new NotFoundException("Report not found");

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.biReportPermission.findUnique({
        where: { userId_reportRefId: { userId: userId, reportRefId: reportRefId } },
        select: { id: true, canView: true },
      });

      await tx.biReportPermission.upsert({
        where: { userId_reportRefId: { userId: userId, reportRefId: reportRefId } },
        create: { userId: userId, reportRefId: reportRefId, canView: canView },
        update: { canView: canView },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "REPORT_PERM_UPDATED",
          entityType: "bi_reports",
          entityId: reportRefId,
          beforeData: { userId, reportRefId, canView: beforePerm?.canView ?? null },
          afterData: { userId, reportRefId, canView },
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

    const rows = await this.prisma.userAppRole.findMany({
      where: {
        customerId: null,
        application: { appKey: appKey },
        appRole: { roleKey: roleKey },
      },
      select: {
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true, status: true } },
        application: { select: { appKey: true } },
        appRole: { select: { roleKey: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email ?? null,
      displayName: r.user.displayName ?? null,
      status: r.user.status,
      grantedAt: r.createdAt,
      appKey: r.application.appKey,
      roleKey: r.appRole.roleKey,
    }));
  }

  private async ensureAppAndRoleTx(
    tx: Prisma.TransactionClient,
    input: { appKey: string; roleKey: string },
  ) {
    const app = await tx.application.upsert({
      where: { appKey: input.appKey },
      create: { appKey: input.appKey, name: input.appKey },
      update: { name: input.appKey },
      select: { id: true, appKey: true },
    });

    const role = await tx.appRole.upsert({
      where: { applicationId_roleKey: { applicationId: app.id, roleKey: input.roleKey } },
      create: {
        applicationId: app.id,
        roleKey: input.roleKey,
        name: input.roleKey === "platform_admin" ? "Platform Admin" : input.roleKey,
      },
      update: {
        name: input.roleKey === "platform_admin" ? "Platform Admin" : input.roleKey,
      },
      select: { id: true, roleKey: true },
    });

    return { app, role };
  }

  private async countPlatformAdminsTx(
    tx: Prisma.TransactionClient,
    input: { appKey: string; roleKey: string },
  ) {
    return tx.userAppRole.count({
      where: {
        customerId: null,
        application: { appKey: input.appKey },
        appRole: { roleKey: input.roleKey },
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
        ? await this.prisma.user.findUnique({
            where: { id: input.userId },
            select: { id: true, email: true, status: true },
          })
        : await this.prisma.user.findFirst({
            where: { email: { equals: String(input.userEmail), mode: "insensitive" } as any },
            select: { id: true, email: true, status: true },
          });

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const { app, role } = await this.ensureAppAndRoleTx(tx, { appKey, roleKey });

      // Idempotência: se já existe, no-op
      const existing = await tx.userAppRole.findFirst({
        where: {
          userId: targetUser.id,
          applicationId: app.id,
          appRoleId: role.id,
          customerId: null,
        },
        select: { id: true, createdAt: true },
      });

      if (!existing) {
        await tx.userAppRole.create({
          data: {
            userId: targetUser.id,
            applicationId: app.id,
            customerId: null,
            appRoleId: role.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "PLATFORM_ADMIN_GRANTED",
          entityType: "users",
          entityId: targetUser.id,
          beforeData: existing
            ? { alreadyHadRole: true, appKey, roleKey }
            : { alreadyHadRole: false, appKey, roleKey },
          afterData: {
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.$transaction(async (tx) => {
      // Descobre app/role (cria se não existir)
      const { app, role } = await this.ensureAppAndRoleTx(tx, { appKey, roleKey });

      const existing = await tx.userAppRole.findFirst({
        where: {
          userId: userId,
          applicationId: app.id,
          appRoleId: role.id,
          customerId: null,
        },
        select: { id: true, createdAt: true },
      });

      // Idempotente: se não existe, no-op (mas audita tentativa)
      if (!existing) {
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: "PLATFORM_ADMIN_REVOKED",
            entityType: "users",
            entityId: userId,
            beforeData: { hadRole: false, appKey, roleKey },
            afterData: { ok: true, noOp: true },
          },
        });

        return { ok: true, idempotent: true };
      }

      // Break-glass: impedir remover o último admin do app/role
      const totalAdmins = await this.countPlatformAdminsTx(tx, { appKey, roleKey });
      if (totalAdmins <= 1) {
        throw new BadRequestException({ code: "LAST_PLATFORM_ADMIN", message: "Cannot revoke the last platform admin." });
      }

      await tx.userAppRole.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: "PLATFORM_ADMIN_REVOKED",
          entityType: "users",
          entityId: userId,
          beforeData: {
            hadRole: true,
            grantedAt: existing.createdAt,
            application: appKey,
            role: roleKey,
          },
          afterData: {
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
      this.prisma.user.count({ where: { status: "pending" } }),
      this.prisma.customer.count({ where: { status: "inactive" } }),

      // conta platform admins para o app PBI_EMBED (role global customerId = null)
      this.prisma.userAppRole.count({
        where: {
          customerId: null,
          application: { appKey: "PBI_EMBED" },
          appRole: { roleKey: "platform_admin" },
          user: { status: "active" },
        },
      }),

      this.prisma.biWorkspace.count({}),
      this.prisma.biReport.count({}),

      this.prisma.auditLog.findMany({
        where: { action: { in: criticalActions } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          actor: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),

      this.prisma.auditLog.findFirst({
        where: { action: "PBI_CATALOG_SYNC_OK" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),

      this.prisma.auditLog.findFirst({
        where: { action: "PBI_CATALOG_SYNC_FAILED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const okAt = lastSyncOk?.createdAt ? new Date(lastSyncOk.createdAt).getTime() : null;
    const failAt = lastSyncFail?.createdAt ? new Date(lastSyncFail.createdAt).getTime() : null;

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
          createdAt: r.createdAt.toISOString(),
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          actorUserId: r.actorUserId,
          actor: r.actor
            ? {
                email: r.actor.email ?? null,
                displayName: r.actor.displayName ?? null,
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
      this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ id: q }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, email: true, displayName: true, status: true },
      }),

      this.prisma.customer.findMany({
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

      this.prisma.biWorkspace.findMany({
        where: {
          OR: [
            { workspaceName: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ workspaceId: q }] : []),
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          workspaceId: true,
          workspaceName: true,
          customerId: true,
          isActive: true,
        },
      }),

      this.prisma.biReport.findMany({
        where: {
          OR: [
            { reportName: { contains: q, mode: "insensitive" } },
            ...(looksLikeGuid ? [{ reportId: q }, { datasetId: q }] : []),
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reportId: true,
          reportName: true,
          datasetId: true,
          workspaceRefId: true,
          isActive: true,
        },
      }),
    ]);

    return {
      q,
      users: users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
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
          workspaceId: w.workspaceId,
          name: w.workspaceName ?? w.workspaceId,
          customerId: w.customerId,
          isActive: w.isActive,
        })),
        reports: reports.map((r) => ({
          id: r.id,
          reportId: r.reportId,
          name: r.reportName ?? r.reportId,
          datasetId: r.datasetId,
          workspaceRefId: r.workspaceRefId,
          isActive: r.isActive,
        })),
      },
    };
  }

}
