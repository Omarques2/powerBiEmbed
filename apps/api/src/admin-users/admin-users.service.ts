import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { MembershipRole } from '@prisma/client';

const ALLOWED_ROLES = new Set<MembershipRole>([
  'owner',
  'admin',
  'member',
  'viewer',
]);
const ALLOWED_CUSTOMER_STATUS = new Set(['active', 'inactive']);
function asBool(v: unknown, def = false): boolean {
  if (v === true || v === false) return v;
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return def;
}

function normalizeCustomerCode(code: string): string {
  const v = (code ?? '').trim().toUpperCase();
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
  return (name ?? '').trim();
}

function validateCustomerName(name: string) {
  if (name.length < 2)
    throw new BadRequestException('Customer name is too short (min 2).');
  if (name.length > 120)
    throw new BadRequestException('Customer name is too long (max 120).');
}

function isUniqueConstraintError(
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Hardening: valida UUID v4/v5 (aceita v1-5), evitando cast inválido em colunas @db.Uuid.
 */
function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    return this.prisma.user.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
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

  private async resolveActorUserId(
    actorSub: string | null,
  ): Promise<string | null> {
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
    _grantCustomerWorkspaces = true,
    actorSub: string | null = null,
  ) {
    void _grantCustomerWorkspaces;
    if (!ALLOWED_ROLES.has(role as MembershipRole)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    const membershipRole = role as MembershipRole;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== 'active')
      throw new BadRequestException('Customer is not active');

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = {
        user: {
          id: userId,
          status: user.status,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
        },
        customer: {
          id: customerId,
          code: customer.code,
          name: customer.name,
          status: customer.status,
        },
      };

      await tx.user.update({
        where: { id: userId },
        data: { status: 'active' },
      });

      await tx.userCustomerMembership.upsert({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        create: {
          userId: userId,
          customerId: customerId,
          role: membershipRole,
          isActive: true,
        },
        update: { role: membershipRole, isActive: true },
      });

      const wsGranted = 0;
      const rpGranted = 0;

      // O acesso do usuário já é herdado do customer; não ativar o catálogo aqui.

      const after = {
        user: { id: userId, status: 'active' },
        membership: { customerId, role, isActive: true },
        grants: {
          workspacePermissionsGranted: wsGranted,
          reportPermissionsGranted: rpGranted,
        },
      };

      // Auditoria: ativação
      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_ACTIVATED',
          entityType: 'users',
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
            action: 'WORKSPACE_PERMS_GRANTED',
            entityType: 'users',
            entityId: userId,
            afterData: { customerId, count: wsGranted },
          },
        });
      }
      if (rpGranted > 0) {
        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: 'REPORT_PERMS_GRANTED',
            entityType: 'users',
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

    if (!u) throw new NotFoundException('User not found');

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
    if (!user) throw new NotFoundException('User not found');

    const isPlatformAdmin = await this.prisma.userAppRole.findFirst({
      where: {
        userId: userId,
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { id: true },
    });
    if (isPlatformAdmin) {
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_IMMUTABLE',
        message: 'Platform admin não pode ser desativado.',
      });
    }

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = {
        user: { id: userId, status: user.status, email: user.email ?? null },
      };

      await tx.user.update({
        where: { id: userId },
        data: { status: 'disabled' },
      });

      await tx.userCustomerMembership.updateMany({
        where: { userId: userId },
        data: { isActive: false },
      });

      const after = { user: { id: userId, status: 'disabled' } };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_DISABLED',
          entityType: 'users',
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
    if (!user) throw new NotFoundException('User not found');

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, code: true, name: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== 'active')
      throw new BadRequestException('Customer is not active');

    return { user, customer };
  }

  private async grantCustomerCatalogAccessTx(
    tx: Prisma.TransactionClient,
    customerId: string,
  ) {
    const links = await tx.biCustomerWorkspace.findMany({
      where: { customerId: customerId },
      select: { workspaceRefId: true, isActive: true },
    });

    const workspaceRefIds = links.map((l) => l.workspaceRefId);
    let wsGranted = 0;
    let rpGranted = 0;

    if (workspaceRefIds.length) {
      const wsRes = await tx.biCustomerWorkspace.updateMany({
        where: {
          customerId: customerId,
          workspaceRefId: { in: workspaceRefIds },
          isActive: false,
        },
        data: { isActive: true },
      });
      wsGranted = wsRes.count;

      const reports = await tx.biReport.findMany({
        where: {
          workspaceRefId: { in: workspaceRefIds },
          isActive: true,
        },
        select: { id: true },
      });

      if (reports.length) {
        const reportIds = reports.map((r) => r.id);
        const updated = await tx.biCustomerReportPermission.updateMany({
          where: {
            customerId: customerId,
            reportRefId: { in: reportIds },
          },
          data: { canView: true },
        });
        const created = await tx.biCustomerReportPermission.createMany({
          data: reportIds.map((reportRefId) => ({
            customerId: customerId,
            reportRefId,
            canView: true,
          })),
          skipDuplicates: true,
        });

        rpGranted = updated.count + created.count;
      }
    }

    return { wsGranted, rpGranted };
  }

  private async revokeCustomerCatalogAccessTx(
    tx: Prisma.TransactionClient,
    customerId: string,
  ) {
    const wsRes = await tx.biCustomerWorkspace.updateMany({
      where: { customerId: customerId, isActive: true },
      data: { isActive: false },
    });

    const rpRes = await tx.biCustomerReportPermission.updateMany({
      where: { customerId: customerId, canView: true },
      data: { canView: false },
    });

    return { wsRevoked: wsRes.count, rpRevoked: rpRes.count };
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
    const customerId = (input.customerId ?? '').trim();
    const role = (input.role ?? '').trim() as MembershipRole;

    if (!customerId) throw new BadRequestException('customerId is required');
    if (!ALLOWED_ROLES.has(role))
      throw new BadRequestException(`Invalid role: ${role}`);

    const isActive = asBool(input.isActive, true);
    const revokeCustomerPermissions = asBool(
      input.revokeCustomerPermissions,
      false,
    );
    const ensureUserActive = asBool(input.ensureUserActive, false);

    const { user, customer } = await this.assertUserAndCustomer(
      userId,
      customerId,
    );
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforeMembership = await tx.userCustomerMembership.findUnique({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });

      if (ensureUserActive && user.status !== 'active') {
        await tx.user.update({
          where: { id: userId },
          data: { status: 'active' },
        });
      }

      const membership = await tx.userCustomerMembership.upsert({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        create: {
          userId: userId,
          customerId: customerId,
          role: role,
          isActive: isActive,
        },
        update: { role: role, isActive: isActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
      });

      const granted = { wsGranted: 0, rpGranted: 0 };
      let revoked = { wsRevoked: 0, rpRevoked: 0 };

      // regra recomendada: se está desativando, revoga permissões do customer
      if (!isActive && revokeCustomerPermissions) {
        revoked = await this.revokeCustomerCatalogAccessTx(tx, customerId);
      }

      // se está ativando e pediu grant, aplica grant
      // O acesso do usuário é herdado do customer; não ativar o catálogo aqui.

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_MEMBERSHIP_UPSERTED',
          entityType: 'user_customer_memberships',
          entityId: membership.id, // <-- FIX: UUID válido (id da membership)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: {
              id: customerId,
              code: customer.code,
              name: customer.name,
            },
            membership: beforeMembership ?? null,
          },
          afterData: {
            membership: {
              id: membership.id,
              customerId,
              role: membership.role,
              isActive: membership.isActive,
            },
            key: { userId, customerId }, // humano/debug (não indexado)
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: {
          customerId,
          role: membership.role,
          isActive: membership.isActive,
        },
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
    const customerId = (customerIdRaw ?? '').trim();
    if (!customerId) throw new BadRequestException('customerId is required');

    const role = input.role
      ? (String(input.role).trim() as MembershipRole)
      : null;
    if (role && !ALLOWED_ROLES.has(role))
      throw new BadRequestException(`Invalid role: ${role}`);

    const isActive =
      input.isActive === undefined ? undefined : asBool(input.isActive);
    const revokeCustomerPermissions = asBool(
      input.revokeCustomerPermissions,
      false,
    );

    const { user, customer } = await this.assertUserAndCustomer(
      userId,
      customerId,
    );
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.userCustomerMembership.findUnique({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException('Membership not found');

      const nextRole = role ?? before.role;
      const nextIsActive = isActive === undefined ? before.isActive : isActive;

      const updated = await tx.userCustomerMembership.update({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        data: { role: nextRole, isActive: nextIsActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
      });

      const granted = { wsGranted: 0, rpGranted: 0 };
      let revoked = { wsRevoked: 0, rpRevoked: 0 };

      if (!nextIsActive && revokeCustomerPermissions) {
        revoked = await this.revokeCustomerCatalogAccessTx(tx, customerId);
      }
      // O acesso do usuário é herdado do customer; não ativar o catálogo aqui.

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_MEMBERSHIP_UPDATED',
          entityType: 'user_customer_memberships',
          entityId: updated.id, // <-- FIX: UUID válido (id da membership)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: {
              id: customerId,
              code: customer.code,
              name: customer.name,
            },
            membership: before,
          },
          afterData: {
            membership: {
              id: updated.id,
              customerId,
              role: updated.role,
              isActive: updated.isActive,
            },
            key: { userId, customerId }, // humano/debug
            granted,
            revoked,
          },
        },
      });

      return {
        ok: true,
        membership: {
          customerId,
          role: updated.role,
          isActive: updated.isActive,
        },
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
    const customerId = (customerIdRaw ?? '').trim();
    if (!customerId) throw new BadRequestException('customerId is required');

    const { user, customer } = await this.assertUserAndCustomer(
      userId,
      customerId,
    );
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.userCustomerMembership.findUnique({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!before) throw new NotFoundException('Membership not found');

      await tx.userCustomerMembership.delete({
        where: {
          userId_customerId: { userId: userId, customerId: customerId },
        },
      });

      const revoked = revokeCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, customerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_MEMBERSHIP_REMOVED',
          entityType: 'user_customer_memberships',
          entityId: before.id, // <-- FIX: UUID válido (id da membership removida)
          beforeData: {
            user: { id: userId, email: user.email ?? null },
            customer: {
              id: customerId,
              code: customer.code,
              name: customer.name,
            },
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
    const fromCustomerId = (input.fromCustomerId ?? '').trim();
    const toCustomerId = (input.toCustomerId ?? '').trim();
    const toRole = (input.toRole ?? '').trim() as MembershipRole;

    if (!fromCustomerId)
      throw new BadRequestException('fromCustomerId is required');
    if (!toCustomerId)
      throw new BadRequestException('toCustomerId is required');
    if (fromCustomerId === toCustomerId) {
      throw new BadRequestException(
        'fromCustomerId and toCustomerId must be different',
      );
    }
    if (!ALLOWED_ROLES.has(toRole))
      throw new BadRequestException(`Invalid role: ${toRole}`);

    const deactivateFrom = asBool(input.deactivateFrom, true);
    const revokeFromCustomerPermissions = asBool(
      input.revokeFromCustomerPermissions,
      true,
    );
    const _grantToCustomerWorkspaces = asBool(
      input.grantToCustomerWorkspaces,
      false,
    );
    const toIsActive = asBool(input.toIsActive, true);
    void _grantToCustomerWorkspaces;

    // valida usuário + customers
    const { user: usr } = await this.assertUserAndCustomer(
      userId,
      fromCustomerId,
    );
    await this.assertUserAndCustomer(userId, toCustomerId);

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const fromBefore = await tx.userCustomerMembership.findUnique({
        where: {
          userId_customerId: { userId: userId, customerId: fromCustomerId },
        },
        select: { id: true, role: true, isActive: true, createdAt: true }, // <-- inclui id
      });
      if (!fromBefore)
        throw new NotFoundException('Source membership not found');

      // 1) desativa origem
      if (deactivateFrom) {
        await tx.userCustomerMembership.update({
          where: {
            userId_customerId: { userId: userId, customerId: fromCustomerId },
          },
          data: { isActive: false },
        });
      }

      const revoked = revokeFromCustomerPermissions
        ? await this.revokeCustomerCatalogAccessTx(tx, fromCustomerId)
        : { wsRevoked: 0, rpRevoked: 0 };

      // 2) cria/ativa destino
      const toMembership = await tx.userCustomerMembership.upsert({
        where: {
          userId_customerId: { userId: userId, customerId: toCustomerId },
        },
        create: {
          userId: userId,
          customerId: toCustomerId,
          role: toRole,
          isActive: toIsActive,
        },
        update: { role: toRole, isActive: toIsActive },
        select: { id: true, customerId: true, role: true, isActive: true }, // <-- inclui id
      });

      const granted = { wsGranted: 0, rpGranted: 0 };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'USER_MEMBERSHIP_TRANSFERRED',
          entityType: 'user_customer_memberships',
          entityId: toMembership.id, // <-- FIX: UUID válido (id do membership destino)
          beforeData: {
            user: { id: userId, email: usr.email ?? null },
            from: { customerId: fromCustomerId, membership: fromBefore },
          },
          afterData: {
            to: {
              id: toMembership.id,
              customerId: toCustomerId,
              role: toMembership.role,
              isActive: toMembership.isActive,
            },
            key: { userId, fromCustomerId, toCustomerId }, // humano/debug
            revokedFrom: revoked,
            grantedTo: granted,
            deactivateFrom,
          },
        },
      });

      return {
        ok: true,
        toMembership: {
          customerId: toCustomerId,
          role: toMembership.role,
          isActive: toMembership.isActive,
        },
        revokedFrom: revoked,
        grantedTo: granted,
      };
    });
  }

  async listCustomers() {
    const rows = await this.prisma.customer.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
    }));
  }

  async createCustomer(
    input: { code: string; name: string; status?: 'active' | 'inactive' },
    actorSub: string | null,
  ) {
    const code = normalizeCustomerCode(input.code);
    const name = normalizeCustomerName(input.name);
    const status = (input.status ?? 'active').trim();

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
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            createdAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: 'CUSTOMER_CREATED',
            entityType: 'customers',
            entityId: row.id,
            afterData: {
              id: row.id,
              code: row.code,
              name: row.name,
              status: row.status,
            },
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
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        throw new BadRequestException('Customer code already exists.');
      }
      throw err;
    }
  }

  async updateCustomer(
    customerId: string,
    input: { code?: string; name?: string },
    actorSub: string | null,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== 'active')
      throw new BadRequestException('Customer is not active');

    const next: { code?: string; name?: string } = {};

    if (typeof input.code === 'string') {
      const code = normalizeCustomerCode(input.code);
      validateCustomerCode(code);
      next.code = code;
    }

    if (typeof input.name === 'string') {
      const name = normalizeCustomerName(input.name);
      validateCustomerName(name);
      next.name = name;
    }

    if (!Object.keys(next).length) {
      throw new BadRequestException('Nothing to update.');
    }

    const actorUserId = await this.resolveActorUserId(actorSub);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.customer.update({
          where: { id: customerId },
          data: next,
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            createdAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actorUserId,
            action: 'CUSTOMER_UPDATED',
            entityType: 'customers',
            entityId: customerId,
            beforeData: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
              status: customer.status,
            },
            afterData: {
              id: row.id,
              code: row.code,
              name: row.name,
              status: row.status,
            },
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
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        throw new BadRequestException('Customer code already exists.');
      }
      throw err;
    }
  }

  async setCustomerStatus(
    customerId: string,
    statusRaw: 'active' | 'inactive',
    actorSub: string | null,
  ) {
    const status = (statusRaw ?? '').trim();
    if (!ALLOWED_CUSTOMER_STATUS.has(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

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

      if (status === 'inactive') {
        const wsRes = await tx.biCustomerWorkspace.updateMany({
          where: { customerId: customerId, isActive: true },
          data: { isActive: false },
        });
        workspacesDeactivated = wsRes.count;

        const rpRes = await tx.biCustomerReportPermission.updateMany({
          where: { customerId: customerId, canView: true },
          data: { canView: false },
        });
        reportsDeactivated = rpRes.count;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_STATUS_CHANGED',
          entityType: 'customers',
          entityId: customerId,
          beforeData: { status: customer.status },
          afterData: {
            status: updated.status,
            workspacesDeactivated,
            reportsDeactivated,
          },
        },
      });

      return {
        ok: true,
        status: updated.status,
        workspacesDeactivated,
        reportsDeactivated,
      };
    });
  }

  async unlinkWorkspaceFromCustomer(
    customerId: string,
    workspaceRefId: string,
    actorSub: string | null,
  ) {
    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.biCustomerWorkspace.findUnique({
        where: {
          customerId_workspaceRefId: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
          },
        },
        select: {
          id: true,
          isActive: true,
          workspace: {
            select: {
              id: true,
              workspaceId: true,
              workspaceName: true,
              isActive: true,
            },
          },
        },
      });
      if (!link) throw new NotFoundException('Workspace link not found');

      const before = {
        workspace: {
          workspaceRefId: link.workspace.id,
          workspaceId: link.workspace.workspaceId,
          name: link.workspace.workspaceName ?? null,
          isActive: link.isActive && link.workspace.isActive,
        },
      };

      // 1) Desativa o link customer -> workspace
      await tx.biCustomerWorkspace.update({
        where: {
          customerId_workspaceRefId: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
          },
        },
        data: { isActive: false },
      });

      // 2) Revoga reports do workspace para o customer
      const reports = await tx.biReport.findMany({
        where: { workspaceRefId: workspaceRefId },
        select: { id: true, reportId: true, isActive: true },
      });

      const repIds = reports.map((r) => r.id);
      let reportPermsRevoked = 0;

      if (repIds.length) {
        reportPermsRevoked = await tx.$executeRaw(
          Prisma.sql`
            UPDATE "bi_customer_report_permissions"
               SET "last_can_view" = "can_view",
                   "can_view" = false
             WHERE "customer_id" = ${customerId}
               AND "report_ref_id" IN (${Prisma.join(repIds)})
          `,
        );
      }

      const after = {
        workspace: { workspaceRefId, isActive: false },
        reports: {
          totalFound: reports.length,
          permissionsRevoked: reportPermsRevoked,
        },
      };

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_WORKSPACE_UNLINKED',
          entityType: 'bi_workspaces',
          entityId: workspaceRefId,
          beforeData: before,
          afterData: after,
        },
      });

      return { ok: true, ...after };
    });
  }

  async setCustomerReportPermission(
    customerId: string,
    reportRefId: string,
    canView: boolean,
    actorSub: string | null,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const report = await this.prisma.biReport.findUnique({
      where: { id: reportRefId },
      select: {
        id: true,
        workspaceRefId: true,
        reportId: true,
        reportName: true,
      },
    });
    if (!report) throw new NotFoundException('Report not found');

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.biCustomerReportPermission.findUnique({
        where: {
          customerId_reportRefId: {
            customerId: customerId,
            reportRefId: reportRefId,
          },
        },
        select: { id: true, canView: true },
      });

      let workspaceActivated = false;
      if (canView) {
        const link = await tx.biCustomerWorkspace.upsert({
          where: {
            customerId_workspaceRefId: {
              customerId: customerId,
              workspaceRefId: report.workspaceRefId,
            },
          },
          create: {
            customerId: customerId,
            workspaceRefId: report.workspaceRefId,
            isActive: true,
          },
          update: { isActive: true },
          select: { isActive: true },
        });
        workspaceActivated = link.isActive;
      }

      await tx.biCustomerReportPermission.upsert({
        where: {
          customerId_reportRefId: {
            customerId: customerId,
            reportRefId: reportRefId,
          },
        },
        create: {
          customerId: customerId,
          reportRefId: reportRefId,
          canView: canView,
          lastCanView: null,
        },
        update: { canView: canView, lastCanView: null },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_REPORT_PERMISSION_UPDATED',
          entityType: 'bi_reports',
          entityId: reportRefId,
          beforeData: {
            customerId,
            reportRefId,
            canView: beforePerm?.canView ?? null,
          },
          afterData: {
            customerId,
            reportRefId,
            canView,
            workspaceActivated,
            customer: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
            },
          },
        },
      });

      return { ok: true, workspaceActivated };
    });
  }

  async setCustomerWorkspacePermission(
    customerId: string,
    workspaceRefId: string,
    canView: boolean,
    actorSub: string | null,
    restoreReports = true,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const workspace = await this.prisma.biWorkspace.findUnique({
      where: { id: workspaceRefId },
      select: { id: true, workspaceId: true, workspaceName: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const reports = await tx.biReport.findMany({
        where: { workspaceRefId: workspaceRefId },
        select: { id: true, reportId: true, reportName: true },
      });
      const reportIds = reports.map((r) => r.id);

      let reportsUpdated = 0;
      let reportsCreated = 0;

      if (canView) {
        await tx.biCustomerWorkspace.upsert({
          where: {
            customerId_workspaceRefId: {
              customerId: customerId,
              workspaceRefId: workspaceRefId,
            },
          },
          create: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
            isActive: true,
          },
          update: { isActive: true },
        });

        if (reportIds.length) {
          const existing = await tx.biCustomerReportPermission.findMany({
            where: { customerId: customerId, reportRefId: { in: reportIds } },
            select: { reportRefId: true, canView: true, lastCanView: true },
          });
          const existingMap = new Map(existing.map((p) => [p.reportRefId, p]));

          for (const perm of existing) {
            await tx.biCustomerReportPermission.update({
              where: {
                customerId_reportRefId: {
                  customerId: customerId,
                  reportRefId: perm.reportRefId,
                },
              },
              data: { canView: true, lastCanView: null },
            });
            reportsUpdated += 1;
          }

          const missing = reportIds.filter((id) => !existingMap.has(id));
          if (missing.length) {
            const created = await tx.biCustomerReportPermission.createMany({
              data: missing.map((reportRefId) => ({
                customerId: customerId,
                reportRefId,
                canView: true,
                lastCanView: null,
              })),
              skipDuplicates: true,
            });
            reportsCreated = created.count;
          }
        }
      } else {
        await tx.biCustomerWorkspace.upsert({
          where: {
            customerId_workspaceRefId: {
              customerId: customerId,
              workspaceRefId: workspaceRefId,
            },
          },
          create: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
            isActive: false,
          },
          update: { isActive: false },
        });

        if (reportIds.length) {
          reportsUpdated = await tx.$executeRaw(
            Prisma.sql`
              UPDATE "bi_customer_report_permissions"
                 SET "last_can_view" = "can_view",
                     "can_view" = false
               WHERE "customer_id" = ${customerId}
                 AND "report_ref_id" IN (${Prisma.join(reportIds)})
            `,
          );
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_WORKSPACE_PERMISSION_UPDATED',
          entityType: 'bi_customer_workspaces',
          entityId: workspaceRefId,
          beforeData: {
            customerId,
            workspaceRefId,
          },
          afterData: {
            customerId,
            workspaceRefId,
            canView,
            restoreReports,
            reportsUpdated,
            reportsCreated,
            customer: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
            },
          },
        },
      });

      return {
        ok: true,
        workspace: { workspaceRefId, canView },
        reportsUpdated,
        reportsCreated,
      };
    });
  }

  async getCustomerSummary(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true, name: true, status: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const memberships = await this.prisma.userCustomerMembership.findMany({
      where: { customerId: customerId, isActive: true },
      select: { user: { select: { status: true } } },
    });

    let usersActive = 0;
    let usersPending = 0;
    let usersDisabled = 0;
    for (const row of memberships) {
      if (row.user.status === 'active') usersActive += 1;
      if (row.user.status === 'pending') usersPending += 1;
      if (row.user.status === 'disabled') usersDisabled += 1;
    }

    const workspacesActive = await this.prisma.biCustomerWorkspace.count({
      where: { customerId: customerId, isActive: true },
    });
    const reportsActive = await this.prisma.biCustomerReportPermission.count({
      where: { customerId: customerId, canView: true },
    });
    const pageGroupsActive = await this.prisma.biCustomerPageGroup.count({
      where: { customerId: customerId, isActive: true },
    });

    return {
      customer,
      users: {
        total: memberships.length,
        active: usersActive,
        pending: usersPending,
        disabled: usersDisabled,
      },
      workspacesActive,
      reportsActive,
      pageGroupsActive,
    };
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

    let entityId: string | undefined;
    if (input.entityId) {
      const v = String(input.entityId).trim();
      if (!isUuid(v)) {
        throw new BadRequestException('entityId must be a UUID');
      }
      entityId = v;
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(input.action ? { action: input.action } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(entityId ? { entityId } : {}),
    };

    if (input.from || input.to) {
      where.createdAt = {
        ...(input.from ? { gte: new Date(input.from) } : {}),
        ...(input.to ? { lte: new Date(input.to) } : {}),
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
        actor: r.actor
          ? {
              id: r.actor.id,
              email: r.actor.email,
              displayName: r.actor.displayName,
            }
          : null,
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
  async listActiveUsers(input: {
    q?: string;
    page: number;
    pageSize: number;
    customerIds?: string[];
  }) {
    const page = Number.isFinite(input.page) && input.page > 0 ? input.page : 1;
    const pageSize = Math.max(
      1,
      Math.min(100, Number.isFinite(input.pageSize) ? input.pageSize : 25),
    );
    const q = input.q?.trim();

    const where: Prisma.UserWhereInput = { status: 'active' };

    if (q) {
      where.OR = [
        { email: { contains: q } }, // citext ajuda no case-insensitive
        { displayName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (input.customerIds?.length) {
      where.memberships = {
        some: {
          customerId: { in: input.customerIds },
          isActive: true,
          customer: { status: 'active' },
        },
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
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

    if (!rows.length) return { page, pageSize, total, rows };

    const platformAdmins = await this.prisma.userAppRole.findMany({
      where: {
        userId: { in: rows.map((row) => row.id) },
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { userId: true },
    });

    const platformAdminSet = new Set(platformAdmins.map((row) => row.userId));

    const enrichedRows = rows.map((row) => ({
      ...row,
      isPlatformAdmin: platformAdminSet.has(row.id),
    }));

    return { page, pageSize, total, rows: enrichedRows };
  }

  // =========================
  // PERMISSÕES (customer -> workspaces -> reports)
  // =========================
  async getUserPermissions(userId: string, customerId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, status: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const memberships = await this.prisma.userCustomerMembership.findMany({
      where: { userId: userId, customer: { status: 'active' } },
      include: {
        customer: {
          select: { id: true, code: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const activeMemberships = memberships.filter((m) => m.isActive);

    const effectiveCustomerId =
      customerId && memberships.some((m) => m.customerId === customerId)
        ? customerId
        : (activeMemberships[0]?.customerId ??
          memberships[0]?.customerId ??
          null);

    if (!effectiveCustomerId) {
      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
        },
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
    if (!customer) throw new NotFoundException('Customer not found');

    const links = await this.prisma.biCustomerWorkspace.findMany({
      where: { customerId: effectiveCustomerId },
      orderBy: { createdAt: 'asc' },
      select: {
        workspaceRefId: true,
        isActive: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            workspaceId: true,
            workspaceName: true,
            isActive: true,
          },
        },
      },
    });

    const workspaceRefIds = links.map((l) => l.workspaceRefId);
    const reports = workspaceRefIds.length
      ? await this.prisma.biReport.findMany({
          where: {
            workspaceRefId: { in: workspaceRefIds },
            isActive: true,
            workspace: { isActive: true },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            workspaceRefId: true,
            reportId: true,
            reportName: true,
            datasetId: true,
            isActive: true,
          },
        })
      : [];

    const reportPerms = reports.length
      ? await this.prisma.biCustomerReportPermission.findMany({
          where: {
            customerId: effectiveCustomerId,
            reportRefId: { in: reports.map((r) => r.id) },
          },
          select: { reportRefId: true, canView: true },
        })
      : [];

    const rpPermMap = new Map(
      reportPerms.map((p) => [p.reportRefId, p.canView]),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
      },
      customer,
      customerId: effectiveCustomerId,
      memberships: memberships.map((m) => ({
        customerId: m.customerId,
        role: m.role,
        isActive: m.isActive,
        customer: m.customer,
      })),
      workspaces: links.map((link) => ({
        workspaceRefId: link.workspace.id,
        workspaceId: link.workspace.workspaceId,
        name:
          link.workspace.workspaceName ?? String(link.workspace.workspaceId),
        canView: link.isActive && link.workspace.isActive,
        reports: reports
          .filter((r) => r.workspaceRefId === link.workspaceRefId)
          .map((r) => ({
            reportRefId: r.id,
            reportId: r.reportId,
            name: r.reportName ?? String(r.reportId),
            datasetId: r.datasetId,
            canView:
              link.isActive && link.workspace.isActive && r.isActive
                ? (rpPermMap.get(r.id) ?? false)
                : false,
          })),
      })),
    };
  }

  // =========================
  // SET workspace permission (com auditoria + opcional grant reports)
  // =========================
  async setWorkspacePermission(
    userId: string,
    customerId: string,
    workspaceRefId: string,
    canView: boolean,
    grantReports: boolean,
    actorSub: string | null,
  ) {
    const { user, customer } = await this.assertUserAndCustomer(
      userId,
      customerId,
    );

    const membership = await this.prisma.userCustomerMembership.findUnique({
      where: { userId_customerId: { userId: userId, customerId: customerId } },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('User is not member of customer');
    }

    const ws = await this.prisma.biWorkspace.findUnique({
      where: { id: workspaceRefId },
      select: {
        id: true,
        workspaceId: true,
        workspaceName: true,
        isActive: true,
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found');

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforeLink = await tx.biCustomerWorkspace.findUnique({
        where: {
          customerId_workspaceRefId: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
          },
        },
        select: { id: true, isActive: true },
      });

      const reports = await tx.biReport.findMany({
        where: { workspaceRefId: workspaceRefId },
        select: { id: true },
      });
      const reportIds = reports.map((r) => r.id);

      let reportsAffected = 0;

      if (canView) {
        await tx.biCustomerWorkspace.upsert({
          where: {
            customerId_workspaceRefId: {
              customerId: customerId,
              workspaceRefId: workspaceRefId,
            },
          },
          create: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
            isActive: true,
          },
          update: { isActive: true },
        });

        if (grantReports && reportIds.length) {
          const updated = await tx.biCustomerReportPermission.updateMany({
            where: { customerId: customerId, reportRefId: { in: reportIds } },
            data: { canView: true },
          });
          const created = await tx.biCustomerReportPermission.createMany({
            data: reportIds.map((reportRefId) => ({
              customerId: customerId,
              reportRefId,
              canView: true,
            })),
            skipDuplicates: true,
          });
          reportsAffected = updated.count + created.count;
        }
      } else {
        await tx.biCustomerWorkspace.updateMany({
          where: { customerId: customerId, workspaceRefId: workspaceRefId },
          data: { isActive: false },
        });

        if (reportIds.length) {
          const rpRes = await tx.biCustomerReportPermission.updateMany({
            where: { customerId: customerId, reportRefId: { in: reportIds } },
            data: { canView: false },
          });
          reportsAffected = rpRes.count;
        }
      }

      const afterLink = await tx.biCustomerWorkspace.findUnique({
        where: {
          customerId_workspaceRefId: {
            customerId: customerId,
            workspaceRefId: workspaceRefId,
          },
        },
        select: { id: true, isActive: true },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_WORKSPACE_PERMISSION_UPDATED',
          entityType: 'bi_customer_workspaces',
          entityId: afterLink?.id ?? beforeLink?.id ?? null,
          beforeData: {
            customerId,
            workspaceRefId,
            canView: beforeLink?.isActive ?? false,
          },
          afterData: {
            customerId,
            workspaceRefId,
            canView: afterLink?.isActive ?? canView,
            grantReports,
            reportsAffected,
            actorTarget: { userId: userId, email: user.email ?? null },
            customer: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
            },
          },
        },
      });

      return {
        ok: true,
        workspace: { workspaceRefId: ws.id, canView: canView },
        reportsAffected,
      };
    });
  }

  // =========================
  // SET report permission (com auditoria)
  // =========================
  async setReportPermission(
    userId: string,
    customerId: string,
    reportRefId: string,
    canView: boolean,
    actorSub: string | null,
  ) {
    const { user, customer } = await this.assertUserAndCustomer(
      userId,
      customerId,
    );

    const membership = await this.prisma.userCustomerMembership.findUnique({
      where: { userId_customerId: { userId: userId, customerId: customerId } },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('User is not member of customer');
    }

    const rep = await this.prisma.biReport.findUnique({
      where: { id: reportRefId },
      select: {
        id: true,
        workspaceRefId: true,
        reportId: true,
        reportName: true,
      },
    });
    if (!rep) throw new NotFoundException('Report not found');

    const actorUserId = await this.resolveActorUserId(actorSub);

    return this.prisma.$transaction(async (tx) => {
      const beforePerm = await tx.biCustomerReportPermission.findUnique({
        where: {
          customerId_reportRefId: {
            customerId: customerId,
            reportRefId: reportRefId,
          },
        },
        select: { id: true, canView: true },
      });

      let workspaceActivated = false;
      if (canView) {
        const link = await tx.biCustomerWorkspace.upsert({
          where: {
            customerId_workspaceRefId: {
              customerId: customerId,
              workspaceRefId: rep.workspaceRefId,
            },
          },
          create: {
            customerId: customerId,
            workspaceRefId: rep.workspaceRefId,
            isActive: true,
          },
          update: { isActive: true },
          select: { isActive: true },
        });
        workspaceActivated = link.isActive;
      }

      await tx.biCustomerReportPermission.upsert({
        where: {
          customerId_reportRefId: {
            customerId: customerId,
            reportRefId: reportRefId,
          },
        },
        create: {
          customerId: customerId,
          reportRefId: reportRefId,
          canView: canView,
        },
        update: { canView: canView },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'CUSTOMER_REPORT_PERMISSION_UPDATED',
          entityType: 'bi_reports',
          entityId: reportRefId,
          beforeData: {
            customerId,
            reportRefId,
            canView: beforePerm?.canView ?? null,
          },
          afterData: {
            customerId,
            reportRefId,
            canView,
            workspaceActivated,
            actorTarget: { userId: userId, email: user.email ?? null },
            customer: {
              id: customer.id,
              code: customer.code,
              name: customer.name,
            },
          },
        },
      });

      return { ok: true, workspaceActivated };
    });
  }

  // =============================
  // SECURITY / PLATFORM ADMINS
  // =============================

  async listPlatformAdmins(input: { appKey: string; roleKey?: string }) {
    const appKey = (input.appKey ?? 'PBI_EMBED').trim();
    const roleKey = (input.roleKey ?? 'platform_admin').trim();

    const rows = await this.prisma.userAppRole.findMany({
      where: {
        customerId: null,
        application: { appKey: appKey },
        appRole: { roleKey: roleKey },
      },
      select: {
        createdAt: true,
        user: {
          select: { id: true, email: true, displayName: true, status: true },
        },
        application: { select: { appKey: true } },
        appRole: { select: { roleKey: true } },
      },
      orderBy: { createdAt: 'asc' },
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
      where: {
        applicationId_roleKey: {
          applicationId: app.id,
          roleKey: input.roleKey,
        },
      },
      create: {
        applicationId: app.id,
        roleKey: input.roleKey,
        name:
          input.roleKey === 'platform_admin' ? 'Platform Admin' : input.roleKey,
      },
      update: {
        name:
          input.roleKey === 'platform_admin' ? 'Platform Admin' : input.roleKey,
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
    input: {
      appKey: string;
      roleKey: string;
      userId: string | null;
      userEmail: string | null;
    },
    actorSub: string | null,
  ) {
    const appKey = (input.appKey ?? 'PBI_EMBED').trim();
    const roleKey = (input.roleKey ?? 'platform_admin').trim();

    const actorUserId = await this.resolveActorUserId(actorSub);

    // Resolve user alvo
    const targetUser = input.userId
      ? await this.prisma.user.findUnique({
          where: { id: input.userId },
          select: { id: true, email: true, status: true },
        })
      : await this.prisma.user.findFirst({
          where: {
            email: {
              equals: String(input.userEmail),
              mode: 'insensitive',
            },
          },
          select: { id: true, email: true, status: true },
        });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const { app, role } = await this.ensureAppAndRoleTx(tx, {
        appKey,
        roleKey,
      });

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
          action: 'PLATFORM_ADMIN_GRANTED',
          entityType: 'users',
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
    const appKey = (input.appKey ?? 'PBI_EMBED').trim();
    const roleKey = (input.roleKey ?? 'platform_admin').trim();

    const actorUserId = await this.resolveActorUserId(actorSub);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      // Descobre app/role (cria se não existir)
      const { app, role } = await this.ensureAppAndRoleTx(tx, {
        appKey,
        roleKey,
      });

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
            action: 'PLATFORM_ADMIN_REVOKED',
            entityType: 'users',
            entityId: userId,
            beforeData: { hadRole: false, appKey, roleKey },
            afterData: { ok: true, noOp: true },
          },
        });

        return { ok: true, idempotent: true };
      }

      // Break-glass: impedir remover o último admin do app/role
      const totalAdmins = await this.countPlatformAdminsTx(tx, {
        appKey,
        roleKey,
      });
      if (totalAdmins <= 1) {
        throw new BadRequestException({
          code: 'LAST_PLATFORM_ADMIN',
          message: 'Cannot revoke the last platform admin.',
        });
      }

      await tx.userAppRole.delete({ where: { id: existing.id } });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId,
          action: 'PLATFORM_ADMIN_REVOKED',
          entityType: 'users',
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
      'PLATFORM_ADMIN_GRANTED',
      'PLATFORM_ADMIN_REVOKED',
      'PLATFORM_ADMIN_BOOTSTRAPPED',
      'USER_DISABLED',
      'CUSTOMER_STATUS_CHANGED',
      'PBI_CATALOG_SYNC_OK',
      'PBI_CATALOG_SYNC_FAILED',
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
      this.prisma.user.count({ where: { status: 'pending' } }),
      this.prisma.customer.count({ where: { status: 'inactive' } }),

      // conta platform admins para o app PBI_EMBED (role global customerId = null)
      this.prisma.userAppRole.count({
        where: {
          customerId: null,
          application: { appKey: 'PBI_EMBED' },
          appRole: { roleKey: 'platform_admin' },
          user: { status: 'active' },
        },
      }),

      this.prisma.biWorkspace.count({}),
      this.prisma.biReport.count({}),

      this.prisma.auditLog.findMany({
        where: { action: { in: criticalActions } },
        orderBy: { createdAt: 'desc' },
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
        where: { action: 'PBI_CATALOG_SYNC_OK' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),

      this.prisma.auditLog.findFirst({
        where: { action: 'PBI_CATALOG_SYNC_FAILED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const okAt = lastSyncOk?.createdAt
      ? new Date(lastSyncOk.createdAt).getTime()
      : null;
    const failAt = lastSyncFail?.createdAt
      ? new Date(lastSyncFail.createdAt).getTime()
      : null;

    const lastSyncAt =
      okAt || failAt
        ? new Date(Math.max(okAt ?? 0, failAt ?? 0)).toISOString()
        : null;

    const lastSyncStatus =
      okAt || failAt
        ? okAt !== null && okAt >= (failAt ?? 0)
          ? 'ok'
          : 'fail'
        : 'unknown';

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
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        q,
      );

    const [users, customers, workspaces, reports] =
      await this.prisma.$transaction([
        this.prisma.user.findMany({
          where: {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              ...(looksLikeGuid ? [{ id: q }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { id: true, email: true, displayName: true, status: true },
        }),

        this.prisma.customer.findMany({
          where: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              ...(looksLikeGuid ? [{ id: q }] : []),
            ],
          },
          orderBy: [{ status: 'asc' }, { code: 'asc' }],
          take: limit,
          select: { id: true, code: true, name: true, status: true },
        }),

        this.prisma.biWorkspace.findMany({
          where: {
            OR: [
              { workspaceName: { contains: q, mode: 'insensitive' } },
              ...(looksLikeGuid ? [{ workspaceId: q }] : []),
            ],
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            workspaceId: true,
            workspaceName: true,
            isActive: true,
          },
        }),

        this.prisma.biReport.findMany({
          where: {
            OR: [
              { reportName: { contains: q, mode: 'insensitive' } },
              ...(looksLikeGuid ? [{ reportId: q }, { datasetId: q }] : []),
            ],
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
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
