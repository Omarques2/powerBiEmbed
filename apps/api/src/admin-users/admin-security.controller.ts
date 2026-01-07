// apps/api/src/admin-users/admin-security.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import type { AuthedRequest } from "../auth/authed-request.type";
import { AdminUsersService } from "./admin-users.service";

type GrantPlatformAdminBody = {
  appKey?: string; // default PBI_EMBED
  roleKey?: string; // default platform_admin (mantém futuro aberto)
  userId?: string;
  userEmail?: string;
};

@Controller("admin/security")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminSecurityController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get("platform-admins")
  async list(@Query("appKey") appKey?: string) {
    return this.svc.listPlatformAdmins({ appKey: appKey ?? "PBI_EMBED" });
  }

  @Post("platform-admins")
  async grant(@Req() req: AuthedRequest, @Body() body: GrantPlatformAdminBody) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;

    const appKey = (body.appKey ?? "PBI_EMBED").trim();
    const roleKey = (body.roleKey ?? "platform_admin").trim();

    const userId = body.userId?.trim();
    const userEmail = body.userEmail?.trim();

    if (!userId && !userEmail) {
      throw new BadRequestException("Provide userId or userEmail.");
    }

    return this.svc.grantPlatformAdmin(
      { appKey, roleKey, userId: userId ?? null, userEmail: userEmail ?? null },
      actorSub,
    );
  }

  @Delete("platform-admins/:userId")
  async revoke(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Query("appKey") appKey?: string,
    @Query("roleKey") roleKey?: string,
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;

    return this.svc.revokePlatformAdmin(
      { userId, appKey: (appKey ?? "PBI_EMBED").trim(), roleKey: (roleKey ?? "platform_admin").trim() },
      actorSub,
    );
  }
}
