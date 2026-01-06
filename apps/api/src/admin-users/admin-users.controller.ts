import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import type { AuthedRequest } from "../auth/authed-request.type";

@Controller("admin/users")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get("pending")
  listPending() {
    return this.svc.listPending();
  }

  @Post(":userId/activate")
  activate(
    @Req() req: AuthedRequest,
    @Param("userId") userId: string,
    @Body() body: { customerId: string; role: string; grantCustomerWorkspaces?: boolean },
  ) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;

    return this.svc.activateUser(
      userId,
      body.customerId,
      body.role,
      body.grantCustomerWorkspaces ?? true,
      actorSub,
    );
  }

  @Post(":userId/disable")
  disable(@Req() req: AuthedRequest, @Param("userId") userId: string) {
    const actorSub = req.user?.sub ? String(req.user.sub) : null;
    return this.svc.disableUser(userId, actorSub);
  }
}
