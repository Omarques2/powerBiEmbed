import { Global, Module } from "@nestjs/common";
import { EntraJwtService } from "./entra-jwt.service";
import { AuthGuard } from "./auth.guard";

@Global()
@Module({
  providers: [EntraJwtService, AuthGuard],
  exports: [EntraJwtService, AuthGuard],
})
export class AuthModule {}
