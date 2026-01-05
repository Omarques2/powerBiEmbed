import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.enableCors({
    origin: ['http://localhost:5173'], // Vue dev
    credentials: false,
  });

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
