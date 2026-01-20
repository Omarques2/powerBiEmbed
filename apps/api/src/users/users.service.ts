import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Claims = Record<string, any>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private pickEmail(claims: Claims): string | null {
    // vários IdPs colocam emails como array
    const emails = claims.emails;
    if (Array.isArray(emails) && emails.length) return String(emails[0]);

    return (
      (claims.email && String(claims.email)) ||
      (claims.preferred_username && String(claims.preferred_username)) ||
      (claims.upn && String(claims.upn)) ||
      null
    );
  }

  async upsertFromClaims(claims: Claims) {
    const entraSub = String(claims.sub);
    const entraOid = claims.oid ? String(claims.oid) : null;

    const email = this.pickEmail(claims); // mantenha sua lógica atual
    const displayName = claims.name ? String(claims.name) : null;

    return this.prisma.user.upsert({
      where: { entraSub: entraSub },
      create: {
        entraSub: entraSub,
        entraOid: entraOid ?? undefined,
        email: email ?? undefined,
        displayName: displayName ?? undefined,
        status: "pending",                
        lastLoginAt: new Date(),
      },
      update: {
        entraOid: entraOid ?? undefined,
        email: email ?? undefined,
        displayName: displayName ?? undefined,
        lastLoginAt: new Date(),
        // NÃO mexe em status aqui
      },
    });
  }

  async listActiveMemberships(userId: string) {
    return this.prisma.userCustomerMembership.findMany({
      where: { userId: userId, isActive: true, customer: { status: "active" } },
      include: { customer: true },
    });
  }
}
