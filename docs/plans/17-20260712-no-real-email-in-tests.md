# Исключить реальную отправку email в тестах (issue #17)

## Overview

Убедиться, что ни unit-, ни e2e-тесты не могут отправить реальное письмо через nodemailer, и устранить найденную уязвимость в конфигурации транспорта.

Найдена конкретная проблема: `MAIL_TRANSPORT=json` жёстко прописан только в начале `apps/api/test/email-flow.e2e-spec.ts` (единственный e2e-сьют, который явно задаёт переменную до импорта `AppModule`). Остальные e2e-сьюты (`app.e2e-spec.ts`, `audit.e2e-spec.ts`, `sources-shared-subscription.e2e-spec.ts`) поднимают `AppModule` через общий `test/setup-e2e.ts`, который просто подгружает переменные из корневого `.env`. В текущем `.env` стоит `MAIL_TRANSPORT="smtp"` с реальными SMTP-креды от Resend. Сегодня эти сьюты не вызывают auth-эндпоинты, отправляющие письма, поэтому реальной отправки не происходит, но защита держится только на том, что каждый новый e2e-файл не забудет продублировать переопределение переменной у себя в начале файла — это хрупко и является корневой причиной риска, описанного в issue #17.

Unit-тесты (`mailer.service.spec.ts`, `auth.service.spec.ts`, `verification.service.spec.ts`, `auth.controller.spec.ts`, `verified.guard.spec.ts`) уже безопасны: они либо мокируют `MailerService` целиком, либо явно выставляют `MAIL_TRANSPORT=json` перед импортом сервиса. Задача — подтвердить это и централизовать защиту e2e-тестов.

Отдельный регресс-тест на «дефолтное безопасное поведение `MailerService`» в план не включается: `MAIL_TRANSPORT` — enum-поле с `.default('json')` в zod-схеме (`apps/api/src/config/env.ts:19`), поэтому сценарий «переменная не задана» гарантированно резолвится в `'json'` ещё до того, как до неё доберётся `MailerService`, а сама json-ветка уже покрыта существующими тестами в `mailer.service.spec.ts`.

## Context (from discovery)

- `apps/api/src/mailer/mailer.service.ts` — `onModuleInit` создаёт `nodemailer` транспорт: `smtp` (реальный) при `MAIL_TRANSPORT=smtp`, иначе `jsonTransport` (письма не уходят наружу).
- `apps/api/test/setup-e2e.ts` — общий `setupFiles` для всех e2e-сьютов (`jest-e2e.json`), подгружает корневой `.env`, не переопределяет `MAIL_TRANSPORT`.
- `apps/api/test/email-flow.e2e-spec.ts` — единственный файл, который явно ставит `process.env['MAIL_TRANSPORT'] = 'json'` до импортов, и дополнительно мокирует `sendVerificationEmail`/`sendPasswordResetEmail` через `jest.spyOn`.
- `apps/api/test/app.e2e-spec.ts`, `audit.e2e-spec.ts`, `sources-shared-subscription.e2e-spec.ts` — не переопределяют `MAIL_TRANSPORT`, полагаются на `.env` (сейчас `smtp` с реальными Resend-креды).
- `apps/api/src/mailer/mailer.service.spec.ts` — unit-тест, вручную задаёт env (`MAIL_TRANSPORT=json`) и создаёт `MailerService` напрямую, минуя DI.
- `apps/api/src/auth/auth.service.spec.ts` — мокирует `MailerService` целиком (не вызывает реальный nodemailer).
- Корневой `.env` в `.gitignore`, реальные креды не попадают в git — по решению пользователя, файл не трогаем.

## Development Approach

- **Testing approach**: Regular (сначала фикс, затем тесты)
- Изменения точечные: правка одного общего setup-файла + ревизия существующих тестов
- Все существующие тесты (unit + e2e) должны оставаться зелёными
- **CRITICAL: обновлять этот файл по ходу работы, если объём меняется**

## Testing Strategy

- **unit тесты**: ревизия существующих auth/verification unit-тестов на предмет реальных вызовов nodemailer (без нового кода — уже безопасны за счёт моков)
- **e2e тесты**: убедиться, что все существующие e2e-сьюты проходят с централизованным json-транспортом; убрать дублирующее переопределение из `email-flow.e2e-spec.ts`, так как оно становится избыточным
- UI/frontend не затрагивается — e2e Playwright-тестов для этой задачи не требуется

## Solution Overview

Централизовать принудительный `MAIL_TRANSPORT=json` в `test/setup-e2e.ts`, выставляя переменную **до** загрузки `.env` (т.к. `loadRootEnv` использует `??=` — уже заданная переменная не будет перезаписана значением из `.env`). Это защищает все текущие и будущие e2e-сьюты без необходимости помнить про ручное переопределение в каждом файле.

`email-flow.e2e-spec.ts` продолжит явно мокировать `sendVerificationEmail`/`sendPasswordResetEmail` через `jest.spyOn` (это отдельный механизм — перехват токена для тестов флоу, а не защита от реальной отправки), но локальное переопределение `MAIL_TRANSPORT` в начале файла станет избыточным дублированием и будет убрано.

## Technical Details

- `test/setup-e2e.ts`: добавить `process.env['MAIL_TRANSPORT'] = 'json';` в начало файла, до вызова `loadRootEnv()`
- `test/email-flow.e2e-spec.ts`: убрать строку `process.env['MAIL_TRANSPORT'] = 'json';` и поясняющий комментарий про неё (защита теперь на уровне `setup-e2e.ts`), оставить остальной код без изменений

## What Goes Where

- **Implementation Steps**: правки `setup-e2e.ts`, `email-flow.e2e-spec.ts`, ревизия существующих unit-тестов, прогон полного тестового набора
- **Post-Completion**: ничего внешнего — задача полностью решается внутри кодовой базы

## Implementation Steps

### Task 1: Централизовать json-транспорт для e2e-тестов

**Files:**

- Modify: `apps/api/test/setup-e2e.ts`
- Modify: `apps/api/test/email-flow.e2e-spec.ts`

- [x] в `apps/api/test/setup-e2e.ts` добавить `process.env['MAIL_TRANSPORT'] = 'json';` перед вызовом `loadRootEnv()`, с кратким комментарием почему (единая защита от реальной отправки писем во всех e2e-сьютах)
- [x] убрать `process.env['MAIL_TRANSPORT'] = 'json';` и связанный комментарий из шапки `apps/api/test/email-flow.e2e-spec.ts` (стал избыточным дублированием)
- [x] прогнать `pnpm --filter @repo/api test:e2e` — все существующие e2e-сьюты должны остаться зелёными
- [x] run tests — must pass before next task

### Task 2: Ревизия unit-тестов auth/verification на реальные вызовы nodemailer

**Files:**

- (только чтение/верификация, без изменений — либо точечные правки, если найдутся проблемы)

- [ ] перепроверить `mailer.service.spec.ts`, `auth.service.spec.ts`, `verification.service.spec.ts`, `auth.controller.spec.ts`, `verified.guard.spec.ts` — убедиться, что ни один из них не инстанцирует реальный `MailerService` без мока и без `MAIL_TRANSPORT=json`
- [ ] если найдётся тест, инстанцирующий реальный `MailerService` без защиты — исправить (замокать зависимость либо явно выставить `MAIL_TRANSPORT=json`)
- [ ] запустить полный unit test-сьют `pnpm --filter @repo/api test` — все тесты зелёные
- [ ] run tests — must pass before next task

### Task 3: Верификация приёмочных критериев

- [ ] убедиться, что ни один тестовый прогон (unit + e2e) не может создать реальный SMTP-транспорт без явного `MAIL_TRANSPORT=smtp`
- [ ] прогнать полный набор: `pnpm --filter @repo/api test` и `pnpm --filter @repo/api test:e2e`
- [ ] убедиться, что за время работы над задачей не произошло реальной отправки писем (проверить логи/дашборд Resend, если есть доступ — иначе полагаться на код-ревью транспорт-логики)

### Task 4: [Final] Обновить документацию и завершить план

- [ ] проверить, требуется ли обновление `docs/guides/email-verification-and-password-reset.md` (упоминание тестовой изоляции транспорта) — обновить при необходимости
- [ ] CLAUDE.md не требует изменений (новых паттернов не вводится)
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

_Пункты, требующие ручного вмешательства — без чекбоксов, информационно_

**Ручная проверка**:

- при желании — вручную прогнать `pnpm --filter @repo/api test:e2e` локально и убедиться, что в логах Resend (https://resend.com, если есть доступ к аккаунту) не появилось новых писем за время тестового прогона

**Отдельный риск вне рамок этой задачи** (зафиксировано по решению пользователя — не трогать в этом плане):

- реальные `SMTP_USER`/`SMTP_PASS` от Resend лежат как дефолт в незакоммиченном `.env` и используются, если разработчик локально запустит e2e без централизованной защиты из Task 1 (после этого плана риск уже закрыт, но сам факт хранения боевых кредов в dev-окружении стоит поднять отдельно — например, завести отдельный dev/test-аккаунт в Resend или использовать sandbox-режим)
