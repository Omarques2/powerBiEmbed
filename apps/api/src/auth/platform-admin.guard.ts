import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthedRequest } from "./authed-request.type";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const sub = req.user?.sub ? String(req.user.sub) : null;
    if (!sub) throw new ForbiddenException({ code: "NO_SUBJECT" });

    const user = await this.prisma.users.findUnique({
      where: { entra_sub: sub },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException({ code: "USER_NOT_FOUND" });

    const adminRole = await this.prisma.user_app_roles.findFirst({
      where: {
        user_id: user.id,
        customer_id: null,
        applications: { app_key: "PBI_EMBED" },
        app_roles: { role_key: "platform_admin" },
      },
      select: { id: true },
    });

    if (!adminRole) {
      throw new ForbiddenException({ code: "NOT_PLATFORM_ADMIN" });
    }

    return true;
  }
}
