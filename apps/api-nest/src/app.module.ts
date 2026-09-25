import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { SchemaValidationPipe } from './common/schema-validation.pipe.js';
import { AppConfig } from './config/app-config.js';
import { AppConfigModule } from './config/config.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { HealthModule } from './health/health.module.js';
import { PolicyDocumentModule } from './policy-document/policy-document.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

const ONE_MINUTE_MS = 60_000;

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    // Named per-IP limits; each throttled route skips the limit that is not its own.
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: 'verify', ttl: ONE_MINUTE_MS, limit: config.rateLimitVerifyPerMinute },
          { name: 'messages', ttl: ONE_MINUTE_MS, limit: config.rateLimitMessagesPerMinute },
        ],
      }),
    }),
    CustomersModule,
    ConversationsModule,
    AdminModule,
    HealthModule,
    PolicyDocumentModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: SchemaValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
