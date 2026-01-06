// apps/api/src/admin-users/admin-users.module.ts
import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminController } from "./admin.controller";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminPermissionsController } from "./admin-permissions.controller";
import { AdminCustomersController } from "./admin-customers.controller"; // <-- ADD

@Module({
  controllers: [
    AdminUsersController,
    AdminController,
    AdminAuditController,
    AdminPermissionsController,
    AdminCustomersController, // <-- ADD
  ],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
