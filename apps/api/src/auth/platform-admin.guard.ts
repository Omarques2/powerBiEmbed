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

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async findUserBySubject(sub: string) {
    if (this.isUuid(sub)) {
      const byIdentity = await this.prisma.user.findUnique({
        where: { identityUserId: sub },
        select: { id: true, status: true },
      });
      if (byIdentity) return byIdentity;
    }

    return this.prisma.user.findUnique({
      where: { entraSub: sub },
      select: { id: true, status: true },
    });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const claims = req.user;
    const sub = claims?.sub ? String(claims.sub) : null;
    if (!sub) throw new ForbiddenException({ code: 'NO_SUBJECT' });
    if (claims?.globalStatus === 'disabled') {
      throw new ForbiddenException({ code: 'GLOBAL_USER_DISABLED' });
    }

    const user = await this.findUserBySubject(sub);

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
