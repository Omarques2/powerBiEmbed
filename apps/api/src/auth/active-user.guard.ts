import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './authed-request.type';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  private pickEmail(claims: AuthedRequest['user']): string | null {
    const emails = claims?.emails;
    if (Array.isArray(emails) && emails.length) return String(emails[0]);

    const raw =
      claims?.email ?? claims?.preferred_username ?? claims?.upn ?? undefined;
    if (!raw) return null;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const claims = req.user;
    if (!claims?.sub) {
      throw new ForbiddenException({
        code: 'NO_SUBJECT',
        message: 'Missing subject claim',
      });
    }

    const entraSub = String(claims.sub);

    let user = await this.prisma.user.findUnique({
      where: { entraSub: entraSub },
      select: { id: true, status: true, entraSub: true },
    });

    if (!user) {
      const email = this.pickEmail(claims);
      if (email) {
        const existingByEmail = await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, status: true, entraSub: true },
        });

        if (existingByEmail?.entraSub?.startsWith('pre_')) {
          user = await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              entraSub: entraSub,
              entraOid: claims.oid ? String(claims.oid) : undefined,
              lastLoginAt: new Date(),
            },
            select: { id: true, status: true, entraSub: true },
          });
        }
      }
    }

    // Se por algum motivo ainda não existe no DB, trate como pending
    if (!user) {
      await this.prisma.user.create({
        data: {
          entraSub: entraSub,
          status: 'pending',
          lastLoginAt: new Date(),
        },
      });

      throw new ForbiddenException({
        code: 'PENDING_APPROVAL',
        message: 'User created as pending; waiting approval',
      });
    }

    if (user.status === 'disabled') {
      throw new ForbiddenException({
        code: 'USER_DISABLED',
        message: 'User disabled',
      });
    }

    if (user.status !== 'active') {
      throw new ForbiddenException({
        code: 'PENDING_APPROVAL',
        message: 'User pending approval',
      });
    }

    const isPlatformAdmin = await this.prisma.userAppRole.findFirst({
      where: {
        userId: user.id,
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { id: true },
    });

    if (isPlatformAdmin) {
      return true;
    }

    // Exigir pelo menos 1 customer ativo (opcional mas altamente recomendado)
    const hasMembership = await this.prisma.userCustomerMembership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        customer: { status: 'active' },
      },
      select: { id: true },
    });

    if (!hasMembership) {
      throw new ForbiddenException({
        code: 'PENDING_CUSTOMER_LINK',
        message: 'User has no active customer membership',
      });
    }

    return true;
  }
}
