import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PowerbiModule } from './powerbi/powerbi.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminRlsModule } from './admin-rls/admin-rls.module';
import { validateEnv } from './config/config.schema';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    PrismaModule,
    PowerbiModule,
    AdminUsersModule,
    AdminRlsModule,
    HealthModule,
  ],
})
export class AppModule {}
