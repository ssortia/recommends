import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditEvent, type User, type VerificationTokenType } from '@prisma/client';
import { pick } from '@repo/utils';

import { Audit } from '../audit/decorators/audit.decorator';
import { getEnv } from '../config/env';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { TestTokenStore } from './test-token.store';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private testTokenStore: TestTokenStore,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Логируем только email; пароль в metadata не попадает.
  @Audit({
    event: AuditEvent.LOGIN_SUCCESS,
    failureEvent: AuditEvent.LOGIN_FAILED,
    actor: (req) => ({ email: req.body?.['email'] as string | undefined }),
    metadata: (req) => pick(req.body, ['email']),
  })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    return this.authService.login(user);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ event: AuditEvent.EMAIL_VERIFIED })
  @ApiOperation({ summary: 'Verify email by one-time token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Логируем только email; событие не должно раскрывать, существует ли email —
  // запрос фиксируется одинаково для любого адреса.
  @Audit({
    event: AuditEvent.PASSWORD_RESET_REQUESTED,
    metadata: (req) => pick(req.body, ['email']),
  })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ event: AuditEvent.PASSWORD_RESET_COMPLETED })
  @ApiOperation({ summary: 'Set a new password by one-time token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Request() req: { user: { id: string; refreshToken: string } }) {
    return this.authService.refresh(req.user.id, req.user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Audit({ event: AuditEvent.LOGOUT })
  @ApiOperation({ summary: 'Logout current user' })
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
  }

  // Только для e2e: отдаёт последний выпущенный plain-токен (в БД лежит лишь хэш).
  // Вне NODE_ENV=test эндпоинт ведёт себя как несуществующий и скрыт из Swagger.
  @Get('__test/last-token')
  @ApiExcludeEndpoint()
  lastToken(@Query('email') email: string, @Query('type') type: VerificationTokenType) {
    if (getEnv().NODE_ENV !== 'test') {
      throw new NotFoundException();
    }
    const token = this.testTokenStore.getLast(email, type);
    if (!token) {
      throw new NotFoundException('Token not found');
    }
    return { token };
  }
}
