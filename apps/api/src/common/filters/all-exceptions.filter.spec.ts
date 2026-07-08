import {
  type ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'nestjs-pino';

import { AllExceptionsFilter } from './all-exceptions.filter';

interface ReplyMock {
  reply: FastifyReply;
  status: jest.Mock;
  send: jest.Mock;
}

function createReply(sent = false): ReplyMock {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const reply = { sent, status, send } as unknown as FastifyReply;
  return { reply, status, send };
}

function createHost(reply: FastifyReply): ArgumentsHost {
  const request = { url: '/test' } as FastifyRequest;
  return {
    switchToHttp: () => ({
      getResponse: <T>() => reply as unknown as T,
      getRequest: <T>() => request as unknown as T,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: { error: jest.Mock };

  beforeEach(() => {
    logger = { error: jest.fn() };
    filter = new AllExceptionsFilter(logger as unknown as Logger);
  });

  function run(exception: unknown, sent = false): ReplyMock {
    const mock = createReply(sent);
    filter.catch(exception, createHost(mock.reply));
    return mock;
  }

  it('маппит HttpException (403) в тело', () => {
    const { status, send } = run(new ForbiddenException('Доступ запрещён'));

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Доступ запрещён',
    });
  });

  it('отдаёт ошибку валидации как generic message + details[]', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
    });

    const { status, send } = run(exception);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      details: ['email must be an email', 'password is too short'],
    });
  });

  it('маппит HttpException со строковым response в тело', () => {
    const { status, send } = run(new HttpException('Teapot', HttpStatus.I_AM_A_TEAPOT));

    expect(status).toHaveBeenCalledWith(HttpStatus.I_AM_A_TEAPOT);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.I_AM_A_TEAPOT,
      message: 'Teapot',
    });
  });

  it('фолбэчит на exception.message, если в объекте response нет строкового message', () => {
    // response — объект без поля message (например, кастомный payload).
    const { status, send } = run(
      new HttpException({ error: 'Bad Request' }, HttpStatus.BAD_REQUEST),
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Http Exception',
    });
  });

  it('маппит Prisma P2002 в 409 с generic-сообщением без утечки деталей', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Unique constraint on email', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });

    const { status, send } = run(exception);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Resource already exists',
    });
    expect(JSON.stringify(send.mock.calls[0][0])).not.toContain('email');
  });

  it('маппит Prisma P2025 в 404 с generic-сообщением', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Record to delete not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    const { status, send } = run(exception);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Resource not found',
    });
  });

  it('прочие коды Prisma (напр. P2003) отдаёт как 500 без утечки деталей и логирует', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed on users_fk',
      {
        code: 'P2003',
        clientVersion: '5.0.0',
      },
    );

    const { status, send } = run(exception);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
    expect(JSON.stringify(send.mock.calls[0][0])).not.toContain('users_fk');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: exception }),
      expect.any(String),
    );
  });

  it('неизвестную ошибку отдаёт как 500 без утечки деталей и логирует исходную ошибку', () => {
    const exception = new Error('SELECT * FROM secret_table failed');

    const { status, send } = run(exception);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = send.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret_table');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: exception }),
      expect.any(String),
    );
  });

  it('не пишет в reply, если ответ уже отправлен', () => {
    const { status, send } = run(new ForbiddenException(), true);

    expect(status).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
