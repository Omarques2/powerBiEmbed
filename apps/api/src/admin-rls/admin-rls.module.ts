import { Module } from "@nestjs/common";
import { AdminRlsController } from "./admin-rls.controller";
import { AdminRlsService } from "./admin-rls.service";

@Module({
  controllers: [AdminRlsController],
  providers: [AdminRlsService],
})
export class AdminRlsModule {}
