import './instrument'
import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { AuthService } from './auth/auth.service'
import { loadEnv } from './config/env'
import { createOpenApiDocument } from './openapi'

async function bootstrap() {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true })
  app.enableShutdownHooks()
  // Better Auth lit lui-même le corps : monté après CORS mais avant le body parser que Nest ajoute à l'init
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', app.get(AuthService).handler)
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
      jsonDocumentUrl: 'openapi.json',
    })
  }
  await app.listen(env.API_PORT)
  Logger.log(`API Lucko sur http://localhost:${env.API_PORT} (docs : /docs)`, 'Bootstrap')
}

void bootstrap()
