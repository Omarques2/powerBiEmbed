import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminController } from "./admin.controller";

@Module({
  controllers: [AdminUsersController, AdminController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}