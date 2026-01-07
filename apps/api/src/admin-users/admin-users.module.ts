// apps/api/src/admin-users/admin-users.module.ts
import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminController } from "./admin.controller";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminPermissionsController } from "./admin-permissions.controller";
import { AdminCustomersController } from "./admin-customers.controller"; // <-- ADD
import { AdminSecurityController } from "./admin-security.controller";

@Module({
  controllers: [
    AdminUsersController,
    AdminController,
    AdminAuditController,
    AdminPermissionsController,
    AdminCustomersController,      
    AdminSecurityController,
  ],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
