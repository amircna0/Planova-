import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './logging/all-exceptions.filter';
import { HttpLoggingInterceptor } from './logging/http-logging.interceptor';
import { LoggingService } from './logging/logging.service';
import { getPort, validateEnvironment } from './config/environment';

validateEnvironment();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const loggingService = app.get(LoggingService);
  app.useLogger(loggingService);
  
  // Enable CORS for frontend requests
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(loggingService));
  app.useGlobalInterceptors(new HttpLoggingInterceptor(loggingService));

  // Serve static files from public folder
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = getPort();
  await app.listen(port, '127.0.0.1');
  loggingService.log(`Planova backend running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
