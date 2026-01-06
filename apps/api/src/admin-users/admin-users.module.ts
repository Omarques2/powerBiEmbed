import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminController } from "./admin.controller";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminPermissionsController } from "./admin-permissions.controller";

@Module({
  controllers: [
    AdminUsersController,
    AdminController,
    AdminAuditController,
    AdminPermissionsController,
  ],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
