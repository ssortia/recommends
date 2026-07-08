# Добавление нового типа события аудита

Механизм аудита описан в [ADR-010](../adr/010-audit-log.md). Чтобы зафиксировать новое действие в журнале, нужно пройти 3 шага: завести тип события, добавить его в общие типы и навесить декоратор на эндпоинт.

## 1. Завести тип в Prisma-enum

`@repo/types` — source of truth для типов событий, но Prisma-enum не может импортировать из пакета, поэтому значения зеркалятся вручную.

В `apps/api/prisma/schema.prisma` добавьте значение в enum `AuditEvent`:

```prisma
enum AuditEvent {
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  USER_ROLE_CHANGED
  USER_CREATED // ← новое событие
}
```

Сгенерируйте миграцию и Prisma Client:

```bash
pnpm --filter @repo/api db:migrate   # имя, например, add_user_created_event
pnpm --filter @repo/api db:generate
```

## 2. Добавить значение в Zod-схему

В `packages/types/src/audit.ts` добавьте то же значение в `AuditEventSchema` (порядок и набор значений должны совпадать с Prisma-enum):

```ts
export const AuditEventSchema = z.enum([
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'USER_ROLE_CHANGED',
  'USER_CREATED', // ← новое событие
]);
```

> В monorepo с docker-окружением каталог `dist/` пакета может принадлежать root.
> Если пересборка на хосте падает с EACCES, пересоберите внутри контейнера:
> `docker compose exec api pnpm --filter @repo/types build`.

## 3. Навесить декоратор `@Audit` на эндпоинт

В нужном контроллере импортируйте `AuditEvent` из `@prisma/client` и декоратор `@Audit`:

```ts
import { AuditEvent } from '@prisma/client';
import { Audit } from '../audit/decorators/audit.decorator';

@Post()
@Audit({
  event: AuditEvent.USER_CREATED,
  targetType: 'User',
  target: (req) => req.params?.['id'],
  // ⚠️ metadata — ТОЛЬКО безопасные поля. Никогда не возвращайте пароли/токены.
  metadata: (req) => ({ email: req.body?.['email'] }),
})
async create(/* ... */) {
  /* ... */
}
```

### Опции `@Audit`

| Опция          | Назначение                                                            |
| -------------- | --------------------------------------------------------------------- |
| `event`        | Событие при успешном выполнении хендлера (обязательно)                |
| `failureEvent` | Событие при ошибке (например, `LOGIN_FAILED`). По умолчанию — `event` |
| `targetType`   | Тип целевой сущности, например `'User'`                               |
| `target`       | Резолвер id целевой сущности из запроса                               |
| `actor`        | Переопределение актора (например, для login до аутентификации)        |
| `metadata`     | Резолвер доп. метаданных — **только whitelisted безопасные поля**     |

Актор по умолчанию берётся из `req.user` (полный `User`, проставленный `JwtAuthGuard`). Для эндпоинтов без guard (например, login) задайте `actor`, читающий данные из тела запроса.

## Как это работает

Глобальный `AuditInterceptor` (`apps/api/src/audit/audit.interceptor.ts`) читает метаданные `@Audit` через `Reflector`. На успехе пишет `event`, на ошибке — `failureEvent ?? event` (и пробрасывает ошибку дальше). Запись идёт через `AuditService.record()` в режиме fire-and-forget: сбой аудита логируется и не ломает основной запрос.

Никакой ручной интеграции в бизнес-логику не требуется — достаточно декоратора.
