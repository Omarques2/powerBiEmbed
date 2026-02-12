import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Claims } from '../auth/claims.type';

const LOGIN_AUDIT_ACTION = 'AUTH_LOGIN_SUCCEEDED';
const LOGIN_AUDIT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

type LoginAuditContext = {
  ip?: string | null;
  userAgent?: string | null;
  source?: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private pickEmail(claims: Claims): string | null {
    // varios IdPs colocam emails como array
    const emails = claims.emails;
    if (Array.isArray(emails) && emails.length) return String(emails[0]);

    const raw =
      claims.email ?? claims.preferred_username ?? claims.upn ?? undefined;
    if (!raw) return null;

    return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
  }

  async upsertFromClaims(claims: Claims, context?: LoginAuditContext) {
    const entraSub = claims.sub;
    const entraOid = claims.oid ?? null;

    const email = this.pickEmail(claims); // mantenha sua logica atual
    const displayName = claims.name ?? null;
    let user: User | null = null;

    if (email) {
      const existingBySub = await this.prisma.user.findUnique({
        where: { entraSub: entraSub },
        select: { id: true },
      });

      if (!existingBySub) {
        const existingByEmail = await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, entraSub: true },
        });

        if (existingByEmail?.entraSub?.startsWith('pre_')) {
          user = await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              entraSub: entraSub,
              entraOid: entraOid ?? undefined,
              email: email ?? undefined,
              displayName: displayName ?? undefined,
              lastLoginAt: new Date(),
            },
          });
          await this.registerLoginAuditEventIfNeeded(user.id, claims, context);
          return user;
        }
      }
    }

    user = await this.prisma.user.upsert({
      where: { entraSub: entraSub },
      create: {
        entraSub: entraSub,
        entraOid: entraOid ?? undefined,
        email: email ?? undefined,
        displayName: displayName ?? undefined,
        status: 'pending',
        lastLoginAt: new Date(),
      },
      update: {
        entraOid: entraOid ?? undefined,
        email: email ?? undefined,
        displayName: displayName ?? undefined,
        lastLoginAt: new Date(),
        // nao mexe em status aqui
      },
    });

    await this.registerLoginAuditEventIfNeeded(user.id, claims, context);
    return user;
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
            authProvider: 'entra',
            claims: {
              sub: claims.sub ?? null,
              oid: claims.oid ?? null,
              email: claims.email ?? claims.preferred_username ?? null,
            },
          },
        },
      });
    } catch {
      // best effort only: analytics event must not block auth flow.
    }
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
}
