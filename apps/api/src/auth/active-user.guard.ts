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

    const user = await this.prisma.user.findUnique({
      where: { entraSub: entraSub },
      select: { id: true, status: true },
    });

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
