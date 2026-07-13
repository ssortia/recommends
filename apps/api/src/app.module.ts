import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DocsModule } from './docs/docs.module';
import { HealthModule } from './health/health.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesModule } from './sources/sources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    DocsModule,
    HealthModule,
    SourcesModule,
    PreferencesModule,
  ],
})
export class AppModule {}
