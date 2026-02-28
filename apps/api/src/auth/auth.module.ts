import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ActiveUserGuard } from './active-user.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [UsersModule],
  providers: [AuthGuard, ActiveUserGuard, PlatformAdminGuard],
  exports: [AuthGuard, ActiveUserGuard, PlatformAdminGuard],
})
export class AuthModule {}
