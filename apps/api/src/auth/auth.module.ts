import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { MailerModule } from '../mailer/mailer.module';
import { UsersModule } from '../users/users.module';
import { VerificationModule } from '../verification/verification.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TestTokenStore } from './test-token.store';

@Module({
  imports: [UsersModule, MailerModule, VerificationModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtRefreshGuard,
    RolesGuard,
    TestTokenStore,
  ],
  exports: [RolesGuard],
})
export class AuthModule {}
