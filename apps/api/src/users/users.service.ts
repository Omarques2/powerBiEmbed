import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Claims } from '../auth/claims.type';

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

  async upsertFromClaims(claims: Claims) {
    const entraSub = claims.sub;
    const entraOid = claims.oid ?? null;

    const email = this.pickEmail(claims); // mantenha sua logica atual
    const displayName = claims.name ?? null;

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
          return this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              entraSub: entraSub,
              entraOid: entraOid ?? undefined,
              email: email ?? undefined,
              displayName: displayName ?? undefined,
              lastLoginAt: new Date(),
            },
          });
        }
      }
    }

    return this.prisma.user.upsert({
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
