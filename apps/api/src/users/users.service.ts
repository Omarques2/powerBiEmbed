import { ConflictException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Claims } from '../auth/claims.type';

const LOGIN_AUDIT_ACTION = 'AUTH_LOGIN_SUCCEEDED';
const LOGIN_AUDIT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LoginAuditContext = {
  ip?: string | null;
  userAgent?: string | null;
  source?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private pickEmail(claims: Claims): string | null {
    const raw = claims.email;
    if (!raw) return null;

    return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
  }

  private pickLegacyOid(claims: Claims): string | null {
    const raw = (claims as unknown as { oid?: unknown }).oid;
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private pickDisplayName(claims: Claims): string | null {
    const raw = (claims as unknown as { name?: unknown }).name;
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private legacyEntraSub(identityUserId: string): string {
    return identityUserId;
  }

  private isUuid(value: string): boolean {
    return UUID_RE.test(value);
  }

  private async findByIdentitySubject(subject: string): Promise<User | null> {
    if (this.isUuid(subject)) {
      const byIdentity = await this.prisma.user.findUnique({
        where: { identityUserId: subject },
      });
      if (byIdentity) return byIdentity;
    }

    return this.prisma.user.findUnique({
      where: { entraSub: subject },
    });
  }

  async upsertFromClaims(claims: Claims, context?: LoginAuditContext) {
    const identityUserId = claims.sub;
    const legacyEntraSub = this.legacyEntraSub(identityUserId);
    const entraOid = this.pickLegacyOid(claims);
    const canPersistIdentity = this.isUuid(identityUserId);
    const email = this.pickEmail(claims);
    const displayName = this.pickDisplayName(claims);

    let user = await this.findByIdentitySubject(identityUserId);
    if (!user && email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          identityUserId: true,
          entraSub: true,
        },
      });

      if (existingByEmail) {
        if (
          existingByEmail.identityUserId &&
          existingByEmail.identityUserId !== identityUserId
        ) {
          throw new ConflictException({
            code: 'IDENTITY_USER_ID_CONFLICT',
            message: 'Email already linked to another identity',
          });
        }

        const isPreRegistered =
          typeof existingByEmail.entraSub === 'string' &&
          existingByEmail.entraSub.startsWith('pre_');
        const canLinkLegacy =
          !existingByEmail.identityUserId || isPreRegistered;

        if (canLinkLegacy) {
          user = await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              identityUserId: canPersistIdentity ? identityUserId : undefined,
              entraSub: legacyEntraSub,
              entraOid: entraOid ?? undefined,
              email: email ?? undefined,
              displayName: displayName ?? undefined,
              lastLoginAt: new Date(),
            },
          });
        }
      }
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          identityUserId: canPersistIdentity ? identityUserId : undefined,
          entraSub: legacyEntraSub,
          entraOid: entraOid ?? undefined,
          email: email ?? undefined,
          displayName: displayName ?? undefined,
          status: 'pending',
          lastLoginAt: new Date(),
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          identityUserId:
            canPersistIdentity && !user.identityUserId
              ? identityUserId
              : undefined,
          entraSub: user.entraSub.startsWith('pre_')
            ? legacyEntraSub
            : undefined,
          entraOid: entraOid ?? undefined,
          email: email ?? undefined,
          displayName: displayName ?? undefined,
          lastLoginAt: new Date(),
          // nao mexe em status aqui
        },
      });
    }

    await this.registerLoginAuditEventIfNeeded(user.id, claims, context);
    return user;
  }

  async listActiveMemberships(userId: string) {
    return this.prisma.userCustomerMembership.findMany({
      where: { userId: userId, isActive: true, customer: { status: 'active' } },
      include: { customer: true },
    });
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const row = await this.prisma.userAppRole.findFirst({
      where: {
        userId: userId,
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  private async registerLoginAuditEventIfNeeded(
    userId: string,
    claims: Claims,
    context?: LoginAuditContext,
  ): Promise<void> {
    const dedupeSince = new Date(Date.now() - LOGIN_AUDIT_DEDUPE_WINDOW_MS);

    try {
      const recent = await this.prisma.auditLog.findFirst({
        where: {
          action: LOGIN_AUDIT_ACTION,
          actorUserId: userId,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });
      if (recent) return;

      await this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: LOGIN_AUDIT_ACTION,
          entityType: 'USER',
          entityId: userId,
          ip: context?.ip ?? undefined,
          userAgent: context?.userAgent ?? undefined,
          afterData: {
            source: context?.source ?? 'users/me',
            authProvider: 'sigfarm_auth_platform',
            claims: {
              sub: claims.sub ?? null,
              globalStatus: claims.globalStatus ?? null,
              email: claims.email ?? null,
            },
          },
        },
      });
    } catch {
      // best effort only: analytics event must not block auth flow.
    }
  }
}
