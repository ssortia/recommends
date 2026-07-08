# Email-флоу: верификация почты и сброс пароля (#25)

## Overview

Добавить в `apps/api` два auth-сценария на одноразовых токенах + абстракцию отправки писем:

1. **Верификация email** — при регистрации генерируется одноразовый токен с TTL, письмо отправляется на почту; endpoint подтверждения переводит пользователя в верифицированное состояние. Неподтверждённый пользователь логинится, но ограничен `VerifiedGuard` на защищённых эндпоинтах.
2. **Сброс пароля** — endpoint запроса сброса по email (не раскрывает существование email) и endpoint установки нового пароля по токену.
3. **Mailer-модуль** — абстракция на `nodemailer`; в dev отправка не требует реального SMTP (jsonTransport + лог в pino), в prod — SMTP из env.

**Проблема:** регистрация не проверяет владение почтой, механизма сброса пароля нет. Это базовая auth-функциональность, без которой шаблон неполон.

**Интеграция:** новые модули `mailer` и `verification` (токены) подключаются в `AuthModule`/`AppModule`; модель `User` получает поле `emailVerified`; `@repo/types` пополняется DTO-схемами (source of truth, зеркалятся в Prisma как с `AuditEvent`).

## Context (from discovery)

- **Файлы/компоненты:**
  - `apps/api/prisma/schema.prisma` — модель `User`, паттерн enum-зеркала (`AuditEvent`).
  - `apps/api/src/auth/{auth.service,auth.controller,auth.module}.ts` — `register` сразу логинит; bcryptjs для паролей.
  - `apps/api/src/users/{users.service,users.repository}.ts` — `PUBLIC_SELECT`, `BaseRepository`, `findByEmail`.
  - `apps/api/src/config/env.ts` — zod-валидация env.
  - `apps/api/src/audit/` — образец структуры модуля (module/service/repository/controller + spec + dto + decorators) и `@Audit(...)`.
  - `packages/types/src/auth.ts` — Zod-DTO, `index.ts` ре-экспорт.
  - `apps/api/test/*.e2e-spec.ts` — e2e через supertest.
- **Паттерны:** репозитории наследуют `BaseRepository`; публичная выдача через `PUBLIC_SELECT`; DTO-классы NestJS со Swagger-декораторами; аудит-логирование декоратором.
- **Зависимости:** `nodemailer` (+ `@types/nodemailer`) — новая зависимость в `apps/api`.

## Development Approach

- **Testing approach:** Regular (код, затем тесты) — выбрано пользователем.
- Завершать каждую задачу полностью перед переходом к следующей.
- Маленькие, сфокусированные изменения.
- **CRITICAL: каждая задача ОБЯЗАНА включать новые/обновлённые тесты** для изменённого кода (unit для новых/изменённых методов, success + error сценарии).
- **CRITICAL: все тесты должны проходить перед началом следующей задачи.**
- **CRITICAL: обновлять этот файл плана при изменении скоупа.**
- Запускать тесты после каждого изменения; сохранять обратную совместимость.

## Testing Strategy

- **unit-тесты:** обязательны для каждой задачи (`*.spec.ts` рядом с кодом, Jest).
- **e2e-тесты:** проект имеет `apps/api/test/*.e2e-spec.ts` (supertest). Новый сквозной флоу (регистрация → верификация, запрос сброса → установка пароля) покрыть e2e в `apps/api/test/email-flow.e2e-spec.ts`. Mailer мокается/работает в jsonTransport-режиме, токен извлекается из перехваченного письма или из БД.
- Команды: unit — `pnpm --filter @repo/api test`; e2e — `pnpm --filter @repo/api test:e2e`.

## Progress Tracking

- `[x]` — выполнено; `➕` — новая задача; `⚠️` — блокер.
- Держать план в синхроне с реальной работой.

## Solution Overview

- **Mailer** (`apps/api/src/mailer/`): `MailerService` поверх `nodemailer`. Транспорт выбирается по env: `MAIL_TRANSPORT=json` (dev, default) → `jsonTransport`, письмо логируется через pino; `smtp` → реальный SMTP из env. Сервис предоставляет типизированные методы `sendVerificationEmail(to, url)` и `sendPasswordResetEmail(to, url)`; ссылки строятся из `WEB_URL`.
- **Verification** (`apps/api/src/verification/`): модель `VerificationToken` с `type` (EMAIL_VERIFICATION | PASSWORD_RESET), хэшем токена (sha256), `expiresAt`, `userId`. `VerificationService` генерирует криптослучайный токен (`crypto.randomBytes`), хранит **хэш**, при выпуске нового инвалидирует старые токены того же типа для пользователя; `consume(token, type)` валидирует, проверяет TTL, удаляет (одноразовость) и возвращает userId.
- **User.emailVerified** (`Boolean @default(false)`): отражается в `PUBLIC_SELECT` и профиле. `VerifiedGuard` (403, если не verified) для эндпоинтов, требующих верификации — демонстрируется на одном защищённом маршруте.
- **Auth-интеграция:** `register` создаёт пользователя, выпускает verification-токен, отправляет письмо (по-прежнему возвращает токены — логин разрешён). Новые эндпоинты: `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`.
- **Аудит:** новые auth-события логируются `@Audit(...)` (как `login`/`logout`) — новые значения `AuditEvent`: `EMAIL_VERIFIED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, зеркалятся в Zod `AuditEventSchema` (`@repo/types`) и в Prisma-enum (паттерн как у существующих событий). `forgot-password` логируется без раскрытия существования email (metadata только whitelisted email).
- **Безопасность:** `forgot-password` всегда отвечает одинаково (204/200) независимо от существования email; хранится только хэш токена; токен инвалидируется сразу после использования и по TTL; `reset-password` сбрасывает `refreshToken` (разлогин всех сессий).

## Technical Details

- **Prisma:**
  - `User`: `+ emailVerified Boolean @default(false)`.
  - `enum VerificationTokenType { EMAIL_VERIFICATION PASSWORD_RESET }`.
  - `model VerificationToken { id, userId, type, tokenHash @unique, expiresAt, createdAt; @@index([userId, type]) }` — без FK-каскада обсуждаемо; используем relation на User с `onDelete: Cascade`.
- **TTL:** из env (`EMAIL_VERIFICATION_TTL` default `24h`, `PASSWORD_RESET_TTL` default `1h`); парсинг длительности вынести из `auth.service` (`msDurationToSeconds`) в `common/duration.ts`. **Важно:** `msDurationToSeconds` тихо возвращает fallback 900с на нераспарсенной строке — поэтому TTL-переменные валидировать zod-regex (`/^\d+[smhdw]$/`) на старте, чтобы опечатка падала громко, а не сокращала срок токена молча.
- **Токен:** `randomBytes(32).toString('hex')` — отдаётся пользователю; в БД `sha256(token)`.
- **env (новые):** `MAIL_TRANSPORT` (`json`|`smtp`, default `json`), `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (опц. при `json`), `WEB_URL`, `EMAIL_VERIFICATION_TTL`, `PASSWORD_RESET_TTL`. Условная валидация: при `MAIL_TRANSPORT=smtp` SMTP-поля обязательны (zod `superRefine`).
- **DTO в @repo/types:** `VerifyEmailDtoSchema { token }`, `ForgotPasswordDtoSchema { email }`, `ResetPasswordDtoSchema { token, password>=8 }`, `ResendVerificationDtoSchema { email }`; `UserSchema += emailVerified: boolean`.

## What Goes Where

- **Implementation Steps** (`[ ]`): код, миграции, тесты, документация в репозитории.
- **Post-Completion** (без чекбоксов): ручная проверка письма в реальном SMTP, обновление web-приложения (UI страниц верификации/сброса) — вне скоупа этой задачи (только API).

## Implementation Steps

### Task 1: Prisma-схема — emailVerified и VerificationToken

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [x] добавить `emailVerified Boolean @default(false)` в модель `User`
- [x] добавить enum `VerificationTokenType { EMAIL_VERIFICATION PASSWORD_RESET }`
- [x] добавить модель `VerificationToken` (userId+relation onDelete: Cascade, type, tokenHash @unique, expiresAt, createdAt, индексы)
- [x] добавить значения `EMAIL_VERIFIED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` в Prisma-enum `AuditEvent` (синхронно с `AuditEventSchema` из Task 2)
- [x] сгенерировать миграцию: `pnpm --filter @repo/api db:migrate` (имя `email_flow`) — создана `20260609073948_email_flow`
- [x] `pnpm --filter @repo/api db:generate` и убедиться, что типы Prisma собираются (`pnpm --filter @repo/api typecheck`)

### Task 2: DTO-схемы в @repo/types

**Files:**

- Modify: `packages/types/src/auth.ts`

- [x] добавить `emailVerified: z.boolean()` в `UserSchema`
- [x] добавить `VerifyEmailDtoSchema`, `ResendVerificationDtoSchema`, `ForgotPasswordDtoSchema`, `ResetPasswordDtoSchema` (+ выведенные типы)
- [x] добавить новые значения в `AuditEventSchema` (`EMAIL_VERIFIED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`) в `packages/types/src/audit.ts`
- [x] убедиться в ре-экспорте из `packages/types/src/index.ts`
- [x] в `@repo/types` нет test-раннера — гейтом служит `pnpm --filter @repo/types typecheck`
- [x] run typecheck — must pass before next task

### Task 3: Mailer-модуль

**Files:**

- Create: `apps/api/src/mailer/mailer.module.ts`
- Create: `apps/api/src/mailer/mailer.service.ts`
- Create: `apps/api/src/mailer/mailer.service.spec.ts`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/package.json` (dep: `nodemailer`, `@types/nodemailer`)
- Modify: `.env.example`

- [x] добавить `nodemailer` + `@types/nodemailer` в `apps/api`
- [x] расширить `env.ts` (MAIL*TRANSPORT, MAIL_FROM, SMTP*_, WEB_URL, _\_TTL) с условной валидацией SMTP при `smtp`
- [x] реализовать `MailerService` (выбор транспорта по env; jsonTransport+pino в dev; методы `sendVerificationEmail`, `sendPasswordResetEmail`)
- [x] создать `MailerModule` (экспортирует `MailerService`)
- [x] обновить `.env.example` новыми переменными
- [x] написать тесты `MailerService` (json-режим логирует письмо; формирование ссылок; success + ошибка транспорта)
- [x] run tests — must pass before next task

### Task 4: Verification-модуль (токены)

**Files:**

- Create: `apps/api/src/verification/verification.module.ts`
- Create: `apps/api/src/verification/verification.service.ts`
- Create: `apps/api/src/verification/verification.repository.ts`
- Create: `apps/api/src/verification/verification.service.spec.ts`
- Create: `apps/api/src/verification/verification.repository.spec.ts`
- Create: `apps/api/src/common/duration.ts` (вынести `msDurationToSeconds`)
- Modify: `apps/api/src/auth/auth.service.ts` (использовать общий duration-хелпер)

- [x] вынести `msDurationToSeconds` в `common/duration.ts`, переиспользовать в `auth.service`
- [x] `VerificationRepository` (create, findByTokenHash, deleteById, deleteByUserAndType) на базе `PrismaService`/`BaseRepository`
- [x] `VerificationService.issue(userId, type)` — генерация токена, хэш, инвалидация старых того же типа, возврат plain-токена
- [x] `VerificationService.consume(token, type)` — поиск по хэшу, проверка TTL, удаление, возврат userId (throw при invalid/expired)
- [x] `VerificationModule` (экспортирует `VerificationService`)
- [x] написать тесты сервиса (issue инвалидирует старые; consume success; expired; invalid; повторное использование) и репозитория
- [x] run tests — must pass before next task

### Task 5: Users — emailVerified в выдаче и сервисные методы

**Files:**

- Modify: `apps/api/src/users/users.repository.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/dto/user-response.dto.ts`
- Modify: `apps/api/src/users/users.controller.spec.ts`

- [x] добавить `emailVerified: true` в `PUBLIC_SELECT`
- [x] добавить методы `markEmailVerified(userId)` и `updatePassword(userId, hash)` (+ сброс refreshToken) в repository/service; `updatePassword` принимает **уже захэшированный** пароль (контракт как у `create(email, hashedPassword)` — хэширование остаётся в auth-слое)
- [x] добавить `emailVerified` в `UserResponseDto` (Swagger)
- [x] обновить тесты users (выдача содержит emailVerified; новые методы)
- [x] run tests — must pass before next task

### Task 6: VerifiedGuard

**Files:**

- Create: `apps/api/src/auth/guards/verified.guard.ts`
- Create: `apps/api/src/auth/guards/verified.guard.spec.ts`

- [x] реализовать `VerifiedGuard` (403 `EmailNotVerified`, если `user.emailVerified === false`)
- [x] написать тесты (verified → pass; not verified → 403)
- [x] run tests — must pass before next task

### Task 7: Auth — интеграция верификации в регистрацию + эндпоинты

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/dto/verify-email.dto.ts`
- Create: `apps/api/src/auth/dto/resend-verification.dto.ts`
- Create: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`

- [x] подключить `MailerModule`, `VerificationModule` в `AuthModule`
- [x] `register`: после создания юзера выпустить EMAIL_VERIFICATION-токен и отправить письмо (логин сохраняется)
- [x] `verifyEmail(token)`: consume → `markEmailVerified`
- [x] `resendVerification(email)`: повторный выпуск+письмо (тихо, без раскрытия существования)
- [x] эндпоинты `POST /auth/verify-email`, `POST /auth/resend-verification` + DTO + Swagger + `@Audit(EMAIL_VERIFIED)` на verify-email
- [x] обновить unit-тесты auth (register шлёт письмо; verify-email success/invalid)
- [x] run tests — must pass before next task

### Task 8: Auth — сброс пароля

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/dto/forgot-password.dto.ts`
- Create: `apps/api/src/auth/dto/reset-password.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`

- [x] `forgotPassword(email)`: если юзер есть — выпустить PASSWORD_RESET-токен и письмо; ответ одинаковый всегда (204/200)
- [x] `resetPassword(token, password)`: consume → хэш нового пароля → `updatePassword` (+ сброс refreshToken)
- [x] эндпоинты `POST /auth/forgot-password`, `POST /auth/reset-password` + DTO + Swagger + `@Audit(PASSWORD_RESET_REQUESTED / PASSWORD_RESET_COMPLETED)` (forgot — без раскрытия существования email)
- [x] обновить unit-тесты (forgot не раскрывает существование; reset success/invalid/expired; старые сессии разлогинены)
- [x] run tests — must pass before next task

### Task 9: e2e сквозной флоу

**Files:**

- Create: `apps/api/test/email-flow.e2e-spec.ts`

- [x] e2e: регистрация → перехват токена (json-транспорт/БД) → verify-email → профиль показывает `emailVerified: true`
- [x] e2e: forgot-password (несуществующий и существующий email дают одинаковый ответ) → reset-password по токену → логин новым паролем
- [x] e2e: повторное использование токена отклоняется
- [x] run e2e: `pnpm --filter @repo/api test:e2e` — must pass before next task (3 suites / 9 tests passed; требует Postgres на :5441 через docker compose или CI)

### Task 10: Verify acceptance criteria

- [x] регистрация инициирует письмо с верификацией
- [x] подтверждение и сброс пароля работают end-to-end через одноразовые токены
- [x] mailer не требует реального SMTP в dev
- [x] состояние верификации в модели User и в выдаче профиля
- [x] безопасность: одинаковый ответ forgot-password; хранится хэш токена; инвалидация после использования и по TTL
- [x] полный прогон: `pnpm --filter @repo/api test` (15 suites / 68 tests passed) и `pnpm --filter @repo/api test:e2e` (3 suites / 9 tests passed)
- [x] `pnpm --filter @repo/api typecheck` (passed); lint API+web чисто (после авто-fix import/order в 3 spec-файлах). ⚠️ `pnpm lint` целиком падает на `@repo/types#build` из-за root-owned `dist` (EACCES) — известная инфра-проблема, не связана с кодом

### Task 11: [Final] Документация

**Files:**

- Create: `docs/adr/NNN-email-flow.md`
- Modify: `docs/adr/README.md` (индекс)
- Create: `docs/guides/email-verification-and-password-reset.md`
- Modify: `README.md` (список фич)
- Modify: `CLAUDE.md` (если появились новые паттерны/модули)

- [x] ADR с решениями: nodemailer+транспорт по env, отдельная таблица токенов, политика VerifiedGuard
- [x] гайд по флоу и env-переменным
- [x] обновить список фич в README.md и модули в CLAUDE.md
- [x] переместить этот план в `docs/plans/completed/`

## Post-Completion

_Требует ручного вмешательства или внешних систем — без чекбоксов._

**Ручная проверка:**

- Проверить реальную доставку письма через настоящий SMTP (`MAIL_TRANSPORT=smtp`).
- Проверить корректность ссылок верификации/сброса при заданном `WEB_URL`.

**Обновления внешних систем:**

- Web-приложение (`apps/web`): страницы подтверждения email и сброса пароля, обработка ссылок из писем — отдельная задача (этот план покрывает только API).
