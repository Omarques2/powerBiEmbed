import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PowerbiModule } from './powerbi/powerbi.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminRlsModule } from './admin-rls/admin-rls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PowerbiModule,
    AdminUsersModule,
    AdminRlsModule,
  ],
})
export class AppModule {}
