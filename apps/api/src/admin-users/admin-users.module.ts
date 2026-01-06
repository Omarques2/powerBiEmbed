import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminController } from "./admin.controller";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminPermissionsController } from "./admin-permissions.controller";
import { AdminCustomersController } from "./admin-customers.controller";
import { UsersModule } from "../users/users.module";
import { AdminBootstrapController } from "./admin-bootstrap.controller";

@Module({
  imports: [UsersModule],
  controllers: [
    AdminUsersController,
    AdminController,
    AdminAuditController,
    AdminPermissionsController,
    AdminCustomersController,
    AdminBootstrapController,
  ],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
