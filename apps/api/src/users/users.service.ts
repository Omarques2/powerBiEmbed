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

    return this.prisma.users.upsert({
      where: { entra_sub: entraSub },
      create: {
        entra_sub: entraSub,
        entra_oid: entraOid ?? undefined,
        email: email ?? undefined,
        display_name: displayName ?? undefined,
        status: "pending",                
        last_login_at: new Date(),
      },
      update: {
        entra_oid: entraOid ?? undefined,
        email: email ?? undefined,
        display_name: displayName ?? undefined,
        last_login_at: new Date(),
        // NÃO mexe em status aqui
      },
    });
  }

  async listActiveMemberships(userId: string) {
    return this.prisma.user_customer_memberships.findMany({
      where: { user_id: userId, is_active: true, customers: { status: "active" } },
      include: { customers: true },
    });
  }
}
