import { Module } from "@nestjs/common";
import { PowerBiController } from "./powerbi.controller";
import { PowerBiService } from "./powerbi.service";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { BiAuthzModule } from "../bi-authz/bi-authz.module";

@Module({
  imports: [AuthModule, UsersModule, BiAuthzModule],
  controllers: [PowerBiController],
  providers: [PowerBiService],
})
export class PowerbiModule {}
