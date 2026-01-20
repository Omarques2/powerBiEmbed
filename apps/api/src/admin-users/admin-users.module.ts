// apps/api/src/admin-users/admin-users.module.ts
import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminSecurityController } from './admin-security.controller';
import { AdminBootstrapController } from './admin-bootstrap.controller';
import { UsersModule } from '../users/users.module';

// NOVOS
import { AdminOverviewController } from './admin-overview.controller';
import { AdminSearchController } from './admin-search.controller';

@Module({
  imports: [UsersModule],
  controllers: [
    AdminUsersController,
    AdminController,
    AdminAuditController,
    AdminPermissionsController,
    AdminCustomersController,
    AdminSecurityController,
    AdminBootstrapController,

    // NOVOS
    AdminOverviewController,
    AdminSearchController,
  ],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
