import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './authed-request.type';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const sub = req.user?.sub ? String(req.user.sub) : null;
    if (!sub) throw new ForbiddenException({ code: 'NO_SUBJECT' });

    const user = await this.prisma.user.findUnique({
      where: { entraSub: sub },
      select: { id: true, status: true },
    });

    if (!user) throw new ForbiddenException({ code: 'USER_NOT_FOUND' });
    if (user.status !== 'active')
      throw new ForbiddenException({ code: 'ADMIN_NOT_ACTIVE' });

    const adminRole = await this.prisma.userAppRole.findFirst({
      where: {
        userId: user.id,
        customerId: null,
        application: { appKey: 'PBI_EMBED' },
        appRole: { roleKey: 'platform_admin' },
      },
      select: { id: true },
    });

    if (!adminRole) {
      throw new ForbiddenException({ code: 'NOT_PLATFORM_ADMIN' });
    }

    return true;
  }
}
