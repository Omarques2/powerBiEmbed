import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";

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
    @Param("userId") userId: string,
    @Body() body: { customerId: string; role: string; grantCustomerWorkspaces?: boolean },
  ) {
    return this.svc.activateUser(
      userId,
      body.customerId,
      body.role,
      body.grantCustomerWorkspaces ?? true,
    );
  }

  @Post(":userId/disable")
  disable(@Param("userId") userId: string) {
    return this.svc.disableUser(userId);
  }
}
