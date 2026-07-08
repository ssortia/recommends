import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@repo/types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'nestjs-pino';

/**
 * Глобальный фильтр: приводит любой источник ошибки к единому shape ApiErrorBody.
 * Safety net поверх явных исключений в коде — нормализует HttpException,
 * известные ошибки Prisma и неизвестные сбои (без утечки деталей в тело).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { statusCode, message, details } = this.resolve(exception);

    // Полную ошибку (включая stack/детали Prisma) пишем только в лог.
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ err: exception, path: request.url, statusCode }, 'Unhandled exception');
    }

    if (reply.sent) {
      return;
    }

    const body: ApiErrorBody = { statusCode, message };
    if (details) {
      body.details = details;
    }
    void reply.status(statusCode).send(body);
  }

  private resolve(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      return this.resolveHttp(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrisma(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private resolveHttp(exception: HttpException): ApiErrorBody {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { statusCode, message: response };
    }

    const message = (response as { message?: unknown }).message;

    // ValidationPipe (BadRequestException) кладёт message массивом строк:
    // отдаём generic message + сами сообщения в details[].
    if (exception instanceof BadRequestException && this.isStringArray(message)) {
      return { statusCode, message: 'Validation failed', details: message };
    }

    if (typeof message === 'string') {
      return { statusCode, message };
    }

    return { statusCode, message: exception.message };
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private resolvePrisma(exception: Prisma.PrismaClientKnownRequestError): ApiErrorBody {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        };
    }
  }
}
