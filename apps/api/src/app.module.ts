import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PowerbiModule } from './powerbi/powerbi.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PowerbiModule,PrismaModule,
  ],
})
export class AppModule {}
