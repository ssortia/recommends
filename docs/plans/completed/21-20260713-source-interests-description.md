# Указание интересов для источника индивидуально

## Overview

Пользователь может задать отдельное текстовое описание интересов для конкретного источника
(в дополнение к общему описанию из #12). Пустое значение означает «используется только общее
описание интересов»; при наличии значения оно имеет приоритет над общим при будущей AI-оценке
релевантности статей.

Issue #12 (общее описание интересов, модель `UserPreferences`, модуль `preferences`, форма на
`/sources`) уже смёржена в `main` (PR #20) — этот план строится поверх неё.

Фактическая AI-оценка релевантности статей в кодовой базе пока не существует (нет ни одного
scoring/relevance-модуля). Поэтому в рамках этого плана реализуется только хранение, API и UI
редактирования описания; правило приоритета «источник → иначе общие интересы» фиксируется как
поведение на будущее (в ADR и комментарии в коде), без реальной логики оценки.

## Context (from discovery)

- Файлы/компоненты, задействованные в #12 (уже в `main`):
  - `apps/api/prisma/schema.prisma` — модель `UserPreferences` (1:1 с `User`, `interestsDescription String? @db.VarChar(1000)`)
  - `apps/api/src/preferences/` — `preferences.module.ts`, `preferences.controller.ts`, `preferences.service.ts`, `preferences.repository.ts`, `dto/`
  - `packages/types/src/preferences.ts` — `PreferencesSchema`, `UpdatePreferencesSchema`
  - `apps/web/src/api/preferences.api.ts`, `apps/web/src/hooks/use-preferences.ts`
  - `apps/web/src/app/(dashboard)/sources/interests-description-form.tsx` — форма общего описания на `/sources`
  - `docs/adr/014-user-preferences.md` — обоснование отдельной таблицы `user_preferences`
- Файлы модуля `sources` (уже в main):
  - `apps/api/src/sources/user-sources.repository.ts` — репозиторий подписок, составной ключ `(userId, sourceId)`, паттерн «только Prisma-вызовы, без бизнес-исключений»
  - `apps/api/src/sources/sources.module.ts` — на данный момент не экспортирует `UserSourcesRepository`
  - `apps/web/src/app/(dashboard)/sources/sources-list.tsx` — карточки источников (`Card`/`CardContent`), нет ни одного disclosure/accordion-компонента в `apps/web/src/components/ui/`
- Паттерн, который используется во всём проекте: репозиторий → сервис → контроллер → DTO (NestJS), Zod-схема в `@repo/types` → `ZodForm`/`TextareaField` (`@ssortia/shadcn-zod-bridge`) на фронте, TanStack Query хуки в `src/hooks/`.
- В проекте нет ни одного AI/scoring/relevance-модуля — правило приоритета не на что «подключать» прямо сейчас.

## Development Approach

- **testing approach**: Regular (код сначала, тесты после каждой задачи)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- e2e-тесты — отдельный последний пункт (после всех unit/API задач), выполняется в самом конце реализации
- run tests after each change
- maintain backward compatibility

## Testing Strategy

- **unit tests**: обязательны для каждой задачи (repository/service/controller — Jest, по образцу `preferences.*.spec.ts`)
- **e2e tests**: Playwright — отдельная, последняя задача перед верификацией критериев приёмки (см. правило проекта)

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

Архитектурное решение (по итогам обсуждения с пользователем): описание интересов источника
хранится **не** на `UserSource` (модуль `sources`) и **не** как колонка в `user_preferences`
(там 1 запись = 1 пользователь, а тут нужна пара «пользователь + источник»), а в **новой таблице
того же домена preferences** — `source_preferences`, по образцу `UserPreferences` из ADR-014:
изолированная таблица, лениво создаваемая при первом сохранении, без backfill-миграций.

Модуль `preferences` расширяется: `SourcePreferencesRepository` + новые методы
`PreferencesService`/эндпоинты `PreferencesController`. Модуль читает `UserSourcesRepository` из
`SourcesModule` только для проверки, что пользователь подписан на источник (иначе 404) — без
циклической зависимости (`sources` не будет знать о `preferences`).

Ключевые решения:

- Составной первичный ключ `(userId, sourceId)` — как у `UserSource`, отдельный `id` не нужен.
- `interestsDescription String? @db.VarChar(1000)` — тот же лимит, что и у общего описания.
- `onDelete: Cascade` на оба FK (`User`, `Source`) — при отписке пользователя от источника
  (`UserSourcesRepository.delete`) запись `source_preferences` **не** удаляется автоматически
  (FK на `Source`, не на `UserSource`) и это нормально: если пользователь подпишется на тот же
  источник снова, его прежнее индивидуальное описание восстановится. Это решение фиксируется в ADR.
- Эндпоинты: `GET /preferences/sources/:sourceId`, `PATCH /preferences/sources/:sourceId` —
  под теми же `JwtAuthGuard` + `VerifiedGuard`, 404 если пользователь не подписан на `sourceId`.
- UI: инлайн-раскрытие в карточке источника в `SourcesList` (кнопка «Интересы» → текстовое поле),
  без новых shadcn-компонентов (просто условный рендер + локальный `useState`).

## Technical Details

### Данные

```prisma
model SourcePreference {
  userId    String
  sourceId  String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  source    Source   @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  interestsDescription String? @db.VarChar(1000)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@id([userId, sourceId])
  @@map("source_preferences")
}
```

`User` получает `sourcePreferences SourcePreference[]`, `Source` — `preferences SourcePreference[]`.

### API

- `GET /preferences/sources/:sourceId` → `{ interestsDescription: string | null }`, 404 если нет подписки на источник
- `PATCH /preferences/sources/:sourceId` body `{ interestsDescription?: string | null }` (партиальный PATCH, как у общего эндпоинта) → тот же формат ответа, 404 если нет подписки

### Zod-схемы (`@repo/types`)

```ts
export const SourcePreferenceSchema = z.object({
  interestsDescription: z.string().nullable(),
});
export type SourcePreference = z.infer<typeof SourcePreferenceSchema>;

export const UpdateSourcePreferenceSchema = z.object({
  interestsDescription: z.string().max(1000).nullable().optional(),
});
export type UpdateSourcePreferenceInput = z.infer<typeof UpdateSourcePreferenceSchema>;
```

## What Goes Where

- **Implementation Steps**: модель + миграция, репозиторий, сервис, контроллер+DTO, типы,
  API-клиент/хуки, UI, e2e, ADR
- **Post-Completion**: мёрж #12 в main (если ещё не выполнен), ручная проверка UI

## Implementation Steps

### Task 1: Prisma-модель SourcePreference + миграция

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_source_preferences/migration.sql` (генерируется)

- [x] добавить модель `SourcePreference` в `schema.prisma` (см. Technical Details)
- [x] добавить обратные связи `sourcePreferences`/`preferences` в модели `User` и `Source`
- [x] сгенерировать миграцию: `pnpm --filter @repo/api db:migrate`
- [x] сгенерировать Prisma Client: `pnpm --filter @repo/api db:generate`
- [x] проверить, что миграция применяется на чистой БД без ошибок

### Task 2: SourcePreferencesRepository

**Files:**

- Create: `apps/api/src/preferences/source-preferences.repository.ts`
- Create: `apps/api/src/preferences/source-preferences.repository.spec.ts`

- [x] реализовать `findByUserAndSource(userId, sourceId)` — `findUnique` по составному ключу
- [x] реализовать `upsert(userId, sourceId, data)` — партиальный PATCH, по образцу `PreferencesRepository.upsert` (наличие ключа `interestsDescription` в `data` отличаем от его отсутствия)
- [x] написать тесты на `findByUserAndSource` (найдена/не найдена)
- [x] написать тесты на `upsert` (создание записи, обновление, partial-семантика — data без ключа не трогает существующее значение)
- [x] run tests - must pass before next task

### Task 3: Расширение SourcesModule для экспорта UserSourcesRepository

**Files:**

- Modify: `apps/api/src/sources/sources.module.ts`

- [x] добавить `exports: [UserSourcesRepository]` в `SourcesModule`
- [x] проверить существующие тесты `sources.module` (если есть) не сломались — иначе smoke: `pnpm --filter @repo/api build` (спека `sources.module` в проекте нет, выполнен smoke-build)
- [x] run tests - must pass before next task

### Task 4: PreferencesService — методы для per-source описания

**Files:**

- Modify: `apps/api/src/preferences/preferences.module.ts`
- Modify: `apps/api/src/preferences/preferences.service.ts`
- Modify: `apps/api/src/preferences/preferences.service.spec.ts`

- [x] импортировать `SourcesModule` в `PreferencesModule`, зарегистрировать `SourcePreferencesRepository` в providers
- [x] добавить `getForSource(userId, sourceId)`: проверить подписку через `UserSourcesRepository.exists` (иначе `NotFoundException`), затем прочитать `SourcePreferencesRepository.findByUserAndSource` (лениво → `null`)
- [x] добавить `updateForSource(userId, sourceId, data)`: та же проверка подписки, затем `SourcePreferencesRepository.upsert`
- [x] написать тесты на `getForSource` (есть подписка + запись, есть подписка без записи → null, нет подписки → 404)
- [x] написать тесты на `updateForSource` (успешное сохранение, partial-семантика, нет подписки → 404)
- [x] run tests - must pass before next task

### Task 5: PreferencesController — эндпоинты + DTO

**Files:**

- Create: `apps/api/src/preferences/dto/source-preference-response.dto.ts`
- Create: `apps/api/src/preferences/dto/update-source-preference.dto.ts`
- Modify: `apps/api/src/preferences/preferences.controller.ts`
- Modify: `apps/api/src/preferences/preferences.controller.spec.ts`

- [x] `UpdateSourcePreferenceDto` — `interestsDescription?: string | null`, `@MaxLength(1000)`, `class-validator`, по образцу `UpdatePreferencesDto`
- [x] `SourcePreferenceResponseDto` — `{ interestsDescription: string | null }`
- [x] `GET /preferences/sources/:sourceId` — вызывает `preferencesService.getForSource`
- [x] `PATCH /preferences/sources/:sourceId` — вызывает `preferencesService.updateForSource`; перенести guard `'interestsDescription' in dto ? { interestsDescription: dto.interestsDescription } : {}` из `preferences.controller.ts` перед вызовом сервиса — без него partial-семантика (тесты Task 2/4) не будет работать на границе контроллера
- [x] написать тесты на оба эндпоинта (успех, 404 при отсутствии подписки, 400 при превышении длины — 400 покрывается на уровне DTO/ValidationPipe, unit-тестами контроллера покрыта делегирование в сервис и partial-семантика)
- [x] run tests - must pass before next task

### Task 6: Zod-схемы в @repo/types

**Files:**

- Modify: `packages/types/src/preferences.ts`

- [x] добавить `SourcePreferenceSchema`/`SourcePreference` и `UpdateSourcePreferenceSchema`/`UpdateSourcePreferenceInput` (см. Technical Details)
- [x] проверить, что схемы экспортируются из `packages/types/src/index.ts` (там `export * from './preferences'` — явного списка нет, новые схемы экспортируются автоматически)
- [x] пересобрать пакет: `pnpm --filter @repo/types build`
- [x] typecheck пакета: `pnpm --filter @repo/types typecheck`

### Task 7: Web API-клиент и хуки

**Files:**

- Modify: `apps/web/src/api/preferences.api.ts`
- Modify: `apps/web/src/hooks/use-preferences.ts`

- [x] `preferencesApi.getForSource(sourceId, accessToken)` → `GET /preferences/sources/:sourceId`
- [x] `preferencesApi.updateForSource(sourceId, interestsDescription, accessToken)` → `PATCH /preferences/sources/:sourceId`
- [x] `useSourcePreference(sourceId)` — `useQuery`, `queryKey: ['preferences', 'source', sourceId]`, `enabled` по наличию `accessToken` и `sourceId`
- [x] `useUpdateSourcePreference(sourceId)` — `useMutation`, инвалидация `['preferences', 'source', sourceId]` в `onSuccess`
- [x] unit-тестов для web нет по конвенции проекта (в `apps/web` отсутствует test-инфраструктура — только Playwright e2e), покрытие даёт Task 9
- [x] run tests - must pass before next task (typecheck и lint пройдены; отдельного unit test suite для web нет)

### Task 8: UI — инлайн-описание интересов в карточке источника

**Files:**

- Modify: `apps/web/src/app/(dashboard)/sources/sources-list.tsx`
- Create: `apps/web/src/app/(dashboard)/sources/source-interests-form.tsx`

- [x] `SourceInterestsForm({ sourceId })` — по образцу `InterestsDescriptionForm`: `ZodForm` + `TextareaField` + `Button`, использует `useSourcePreference`/`useUpdateSourcePreference`
- [x] в `SourcesList` добавить кнопку-переключатель «Интересы» на каждой карточке источника, раскрывающую `SourceInterestsForm` для этого `source.id` (локальный `useState<Set<string>>` открытых карточек)
- [x] обработка ошибок сохранения (400 «слишком длинное описание», иное — общая ошибка), как в `InterestsDescriptionForm`
- [x] unit-тестов для web нет по конвенции проекта (в `apps/web` отсутствует test-инфраструктура — только Playwright e2e), покрытие даёт Task 9
- [x] run tests - must pass before next task (typecheck и lint пройдены; `next build` падает только на отсутствующем `NEXTAUTH_SECRET` в окружении песочницы — не связано с изменениями)

### Task 9: E2E-тесты (последний пункт)

**Files:**

- Create: `apps/web/e2e/source-interests-description.spec.ts`

- [x] тест: добавить источник, открыть «Интересы» в карточке, сохранить описание, проверить что значение сохраняется после перезагрузки страницы
- [x] тест: очистка описания (пустое значение) сохраняется и не ломает общее описание интересов (#12)
- [x] тест: описание не пересекается между двумя разными источниками одного пользователя
- [x] run e2e: `pnpm --filter @repo/web test:e2e` (или актуальная команда проекта) — запущено точечно для `source-interests-description.spec.ts` с `E2E_RSS_FEED_HOST=172.22.0.1` (адрес docker-моста хоста в текущем окружении, см. комментарий в `sources.spec.ts`), все 3 теста прошли
- [x] run full unit test suite: `pnpm test` — все тесты проходят (5/5 задач Turborepo, 223 API-теста)

### Task 10: ADR и документация

**Files:**

- Create: `docs/adr/015-source-preferences.md`
- Modify: `docs/adr/README.md`
- Modify: `README.md` (если там перечислены фичи preferences/sources)

- [x] написать ADR-015 по шаблону `docs/adr/README.md`: контекст (зависимость от ADR-014), рассмотренные варианты (колонка в `user_preferences` vs поле на `UserSource` vs отдельная таблица `source_preferences`), решение, последствия (в т.ч. поведение при отписке/повторной подписке); отдельно зафиксировать осознанный выбор единственного числа `SourcePreference` (вместо множественного `UserPreferences` у эталона #12) — так естественнее читается тип связи `SourcePreference[]`
- [x] добавить строку в индекс `docs/adr/README.md`
- [x] обновить список фич в `README.md`, если там отражены preferences-возможности
- [x] переместить этот файл в `docs/plans/completed/`

## Post-Completion

**Внешние действия:**

- ручная проверка UI: раскрытие/сворачивание формы в карточках нескольких источников одновременно, отсутствие визуальных регрессий в `SourcesList`

**На будущее (не в рамках этого плана):**

- когда появится AI-модуль оценки релевантности статей, реализовать фактическое правило приоритета «описание источника → иначе общее описание интересов» (сейчас зафиксировано только в ADR-015 и комментариях)
