# Описание интересов свободным текстом (issue #12)

## Overview

Пользователь должен иметь возможность описать свои интересы произвольным текстом, чтобы в будущем (issue #13, #14 и AI-модуль оценки релевантности, которых пока нет в кодовой базе) это описание использовалось при подборе статей. В рамках этой задачи реализуется только хранение и редактирование этого текста — само применение к оценке статей выходит за рамки плана, т.к. соответствующего модуля ещё не существует.

Поле не обязательное: пустое значение означает «описание не задано», при этом фильтрация по категориям (будущий #13) продолжает работать независимо.

## Context (from discovery)

- В проекте пока нет ни модуля предпочтений (`preferences`), ни AI-модуля оценки релевантности — это отдельные issue (#13 — категории, #14 — порог релевантности) и не описанная пока функциональность.
- Модель `User` (`apps/api/prisma/schema.prisma`) не содержит preference-полей. Решено вынести описание интересов в отдельную таблицу `UserPreferences` (1:1 с `User`), под которую в будущем лягут поля из #13/#14.
- Паттерны в проекте:
  - Модуль-репозиторий-сервис-контроллер: `apps/api/src/sources/*` (`sources.module.ts`, `*.repository.ts`, `*.service.ts`, `*.controller.ts`).
  - DTO с `class-validator`: `apps/api/src/sources/dto/add-source.dto.ts`.
  - Guards на контроллере: `JwtAuthGuard` + `VerifiedGuard` (см. `apps/api/src/users/users.controller.ts`).
  - Zod-схемы и типы в `@repo/types` (`packages/types/src/sources.ts`), реэкспорт через `packages/types/src/index.ts`.
  - Frontend API-клиент: чистые функции без React (`apps/web/src/api/sources.api.ts`, `users.api.ts`).
  - React Query хуки: `apps/web/src/hooks/use-sources.ts` (useQuery + useMutation с invalidateQueries).
  - Формы: `ZodForm` + `TextField` из `@ssortia/shadcn-zod-bridge` (`apps/web/src/app/(dashboard)/sources/add-source-form.tsx`).
  - UI размещается на существующей странице `/sources` (блок сверху), по решению пользователя — без создания отдельного раздела меню.

## Development Approach

- **Testing approach**: Regular (код → тесты сразу после), как в существующих модулях (`*.spec.ts` рядом с реализацией).
- Каждая задача выполняется полностью, включая тесты, перед переходом к следующей.
- Изменения в БД — только через Prisma-миграцию, без ручных правок схемы в проде.
- Лимит длины текста: разумное ограничение (1000 символов) — защита от злоупотребления и от чрезмерно длинных промптов для будущего AI.
- Поддерживать обратную совместимость: `UserPreferences` создаётся лениво (get возвращает `null`, если записи ещё нет), без миграции существующих пользователей отдельным скриптом.

## Testing Strategy

- **unit/repository tests**: для каждой новой единицы кода backend (repository, service, controller) и для zod-схем в `@repo/types` — по аналогии с `apps/api/src/sources/*.spec.ts` и `packages/types/src/sources.spec.ts`.
- **web**: в `apps/web` нет unit/компонентного тест-раннера (`package.json` содержит только `test:e2e`, jest/vitest не подключены) — API-клиент и хуки на web не покрываются unit-тестами, проверяются typecheck/lint (Task 7) и e2e.
- **e2e тесты**: в проекте есть Playwright e2e для web (`apps/web/e2e/*.spec.ts`, например `sources.spec.ts`). Написание/запуск e2e — отдельный последний пункт плана (Task 7), выполняется после того, как вся функциональность реализована.

## Solution Overview

- Новая таблица `UserPreferences` (1:1 к `User` через уникальный `userId`), поле `interestsDescription String? @db.VarChar(1000)`.
- Backend: модуль `preferences` (repository + service + controller), паттерн идентичен `sources`.
  - `GET /preferences` — вернуть текущие настройки (или `null`-объект с пустым полем, если записи нет).
  - `PATCH /preferences` — обновить `interestsDescription` (upsert: создать запись при первом сохранении).
- DTO валидирует: строка, необязательная, `maxLength: 1000` (пустая строка/`null` — сброс поля).
- `@repo/types`: `PreferencesSchema`, `UpdatePreferencesSchema` (zod), реэкспорт из `index.ts`.
- Frontend: блок над списком источников на `/sources` — текстовое поле (textarea) с сохранением через `PATCH`, аналог `AddSourceForm`.

## Technical Details

- Модель Prisma:

  ```prisma
  model UserPreferences {
    id                  String   @id @default(cuid())
    userId              String   @unique
    user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    interestsDescription String? @db.VarChar(1000)
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

    @@map("user_preferences")
  }
  ```

  В `User` добавить обратную связь `preferences UserPreferences?`.

- Upsert через `prisma.userPreferences.upsert({ where: { userId }, create, update })` — не требует отдельной проверки "существует ли запись" в сервисе.
- Ответ API: `{ interestsDescription: string | null }`.

## What Goes Where

- **Implementation Steps** (`[ ]`): миграция БД, backend-модуль, типы, frontend UI и тесты — всё делается в рамках кодовой базы.
- **Post-Completion**: ручная проверка UI в браузере, review будущей связи с #13/#14 при их реализации.

## Implementation Steps

### Task 1: Модель данных `UserPreferences` и миграция

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_user_preferences/migration.sql` (генерируется автоматически)

- [x] добавить модель `UserPreferences` в `schema.prisma` (см. Technical Details) с уникальным `userId` и `onDelete: Cascade`
- [x] добавить обратную связь `preferences UserPreferences?` в модель `User`
- [x] сгенерировать миграцию: `pnpm --filter @repo/api db:migrate` (dev-миграция с именем `add_user_preferences`)
- [x] сгенерировать Prisma Client: `pnpm --filter @repo/api db:generate`
- [x] запустить существующий тест-сьют API, убедиться, что ничего не сломалось: `pnpm --filter @repo/api test`

### Task 2: Типы в `@repo/types`

**Files:**

- Create: `packages/types/src/preferences.ts`
- Create: `packages/types/src/preferences.spec.ts`
- Modify: `packages/types/src/index.ts`

- [ ] создать `PreferencesSchema` (`interestsDescription: z.string().nullable()`) и тип `Preferences`
- [ ] создать `UpdatePreferencesSchema` (`interestsDescription: z.string().max(1000).nullable().optional()`) и тип `UpdatePreferencesInput`
- [ ] реэкспортировать новый модуль из `packages/types/src/index.ts` (`export * from './preferences';`)
- [ ] написать тесты на валидацию схем (успешные случаи: пустая строка, `null`, обычный текст; ошибочные: текст длиннее 1000 символов), по аналогии с `sources.spec.ts`
- [ ] запустить тесты: `pnpm --filter @repo/types test`

### Task 3: Backend — репозиторий `PreferencesRepository`

**Files:**

- Create: `apps/api/src/preferences/preferences.repository.ts`
- Create: `apps/api/src/preferences/preferences.repository.spec.ts`

- [ ] реализовать `findByUserId(userId)` — `prisma.userPreferences.findUnique({ where: { userId } })`
- [ ] реализовать `upsert(userId, data)` — `prisma.userPreferences.upsert(...)` с `create`/`update` по `interestsDescription`
- [ ] написать тесты на `findByUserId` (найдена запись / записи нет)
- [ ] написать тесты на `upsert` (создание новой записи / обновление существующей)
- [ ] запустить тесты — должны пройти перед следующей задачей

### Task 4: Backend — сервис и контроллер `preferences`

**Files:**

- Create: `apps/api/src/preferences/preferences.service.ts`
- Create: `apps/api/src/preferences/preferences.service.spec.ts`
- Create: `apps/api/src/preferences/preferences.controller.ts`
- Create: `apps/api/src/preferences/preferences.controller.spec.ts`
- Create: `apps/api/src/preferences/dto/update-preferences.dto.ts`
- Create: `apps/api/src/preferences/preferences.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] создать `UpdatePreferencesDto` с `@IsOptional() @IsString() @MaxLength(1000)` для `interestsDescription` (допускает `null`/пустую строку) и `@ApiProperty`
- [ ] реализовать `PreferencesService.get(userId)` — вернуть `{ interestsDescription: null }`, если записи нет
- [ ] реализовать `PreferencesService.update(userId, dto)` — вызвать `upsert` репозитория
- [ ] реализовать `PreferencesController` с `GET /preferences` и `PATCH /preferences` под `JwtAuthGuard` + `VerifiedGuard`, со Swagger-декораторами (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiOkResponse`) и response DTO, по образцу `UsersController.me`
- [ ] зарегистрировать `PreferencesModule` в `app.module.ts`
- [ ] написать тесты сервиса (get с записью/без, update создаёт/обновляет)
- [ ] написать тесты контроллера (успешные ответы, форма запроса)
- [ ] запустить тесты — должны пройти перед следующей задачей

### Task 5: Frontend — API-клиент и хуки

**Files:**

- Create: `apps/web/src/api/preferences.api.ts`
- Create: `apps/web/src/hooks/use-preferences.ts`

- [ ] реализовать `preferencesApi.get(accessToken)` и `preferencesApi.update(interestsDescription, accessToken)` (аналог `sourcesApi`)
- [ ] реализовать `usePreferences()` (useQuery) и `useUpdatePreferences()` (useMutation с `invalidateQueries(['preferences'])`), по аналогии с `use-sources.ts`
- [ ] запустить typecheck: `pnpm --filter @repo/web typecheck` (unit-тестов на web в проекте нет — см. Testing Strategy, проверка функциональности — в e2e-шаге Task 7)

### Task 6: Frontend — форма описания интересов на странице `/sources`

**Files:**

- Create: `apps/web/src/app/(dashboard)/sources/interests-description-form.tsx`
- Modify: `apps/web/src/app/(dashboard)/sources/page.tsx`

- [ ] реализовать `InterestsDescriptionForm` (textarea через `ZodForm` + `UpdatePreferencesSchema`), с предзаполнением текущим значением из `usePreferences()`
- [ ] обработать серверные ошибки валидации (превышение длины) аналогично `AddSourceForm`
- [ ] разместить форму над `SourcesList`/`AddSourceForm` на странице `/sources`
- [ ] запустить lint и typecheck: `pnpm --filter @repo/web lint && pnpm --filter @repo/web typecheck`

### Task 7: Verify acceptance criteria и e2e-тесты

**Files:**

- Create: `apps/web/e2e/interests-description.spec.ts`

- [ ] написать e2e-тест (Playwright, по аналогии с `apps/web/e2e/sources.spec.ts`): ввод описания интересов, сохранение, проверка персистентности после перезагрузки страницы
- [ ] написать e2e-тест на пустое значение: поле необязательное, сброс текста сохраняется
- [ ] запустить e2e: `pnpm --filter @repo/web test:e2e`
- [ ] проверить: изменения сохраняются (persist в БД) и доступны при повторной загрузке страницы
- [ ] запустить полный набор unit/backend-тестов: `pnpm test`
- [ ] запустить lint и typecheck по всему монорепо: `pnpm lint && pnpm typecheck`

### Task 8: [Final] Обновить документацию

- [ ] добавить ADR `docs/adr/014-user-preferences.md` — фиксирует решение о выделении `UserPreferences` в отдельную таблицу под будущие preference-поля (#13, #14), обновить индекс в `docs/adr/README.md`
- [ ] обновить README.md, если список фич в шаблоне требует упоминания preferences
- [ ] переместить этот план в `docs/plans/completed/`

## Post-Completion

**Manual verification**:

- ручная проверка в браузере: ввод текста, сохранение, перезагрузка страницы, очистка поля
- проверка поведения при превышении лимита в 1000 символов (сообщение об ошибке)

**External system updates**:

- нет — фича полностью локальна для этого репозитория
