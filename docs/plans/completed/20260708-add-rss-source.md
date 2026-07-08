# Добавление RSS-ленты по URL (issue #7)

## Overview

Реализовать возможность добавить RSS/Atom-ленту по URL: пользователь вводит URL в веб-форме,
API проверяет, что по нему доступна валидная RSS/Atom-лента, создаёт (или переиспользует) запись
источника, подписывает на неё пользователя и запускает первичный парсинг — сохраняет найденные
статьи. Источник и статьи сразу видны в списке.

Это первая функциональная фича продукта Curio (см. [docs/PRODUCT.md](../PRODUCT.md),
[docs/USER_STORIES.md](../USER_STORIES.md), US-04) поверх готовой инфраструктуры auth/RBAC/audit.
Закладывает архитектуру для последующих issue (#8–#16: Telegram-источники, удаление, вкл/выкл,
список, настройки фильтрации), поэтому модель данных сразу разделяет глобальный источник и
подписку пользователя.

## Context (from discovery)

- Issue #7 (GitHub): критерии приёмки — валидация URL, проверка доступности валидного RSS/Atom,
  появление в списке, сообщение о дубликате, автозапуск первичного парсинга.
- В `apps/api/prisma/schema.prisma` пока нет ни одной модели источников/статей — заводится с нуля.
- Архитектурный ориентир — ADR-009 из `personal-rss-deprecated`: глобальный `Source` (один фетчер
  на URL) + `UserSource` (подписка пользователя, `@@id([userId, sourceId])`). Выбрано пользователем
  явно (вариант «Source + UserSource») ради дедупликации между пользователями и совместимости с
  будущими issue про per-source настройки.
- Слой репозиториев обязателен (ADR-007): `BaseRepository<TModel, TCreateInput, TUpdateInput>` в
  `apps/api/src/common/repository/base.repository.ts`, домен-специфичные методы — напрямую через
  `this.prisma.<model>` с `select`/`where`. Пример для копирования стиля — `UsersRepository`.
  `PUBLIC_SELECT` как константа `satisfies Prisma.<Model>Select` — паттерн для отдаваемых наружу
  полей.
  - **Отход от паттерна**: `UserSource` использует составной ключ (`@@id([userId, sourceId])`),
    поэтому `BaseRepository` (рассчитан на `id`) для него не подходит — репозиторий пишется без
    наследования, но в едином стиле (Prisma-вызовы, без бизнес-исключений).
- Внешние HTTP-вызовы оформляются как Gate (ADR-009 этого проекта, `docs/adr/009-gate-layer.md`):
  тонкая обёртка над транспортом, возвращает сырой результат/`null`, не бросает доменных исключений.
  `RssGate` инкапсулирует запрос+парсинг через `rss-parser`, `SourcesService` решает, что с этим
  делать (существует лента или нет → `BadRequestException`).
- DTO + `class-validator` на контроллере, доменные Zod-схемы в `packages/types` — общий паттерн
  (см. `auth.dto`, `packages/types/src/auth.ts`).
- Web: авторизованные страницы продукта живут в `apps/web/src/app/(dashboard)/`, API-клиенты —
  чистые async-функции в `apps/web/src/api/*.api.ts` поверх `api` из `lib/api.ts` (см.
  `users.api.ts`). UI — компоненты shadcn/ui из `@/components/ui/*`.
- Тесты: Jest, `pnpm --filter @repo/api test`; юнит + repository spec на каждый публичный
  метод (см. `users.repository.spec.ts`, `users.service.spec.ts`, `users.controller.spec.ts`).
- `@repo/utils`/`@repo/types` — общие пакеты, требуют пересборки в dev-Docker (уже исправлено
  ранее в этой сессии), это не влияет на план, но стоит помнить при локальном запуске.
- Аудит-лог (`@Audit(...)`, ADR-010 этого проекта) для события «добавлен источник» сознательно
  не заводится в этом плане: событие потребовало бы миграции `AuditEvent`-enum и синхронизации с
  Zod-схемой в `@repo/types`, а критерии приёмки issue #7 аудита не требуют. Решение можно
  пересмотреть, если аудит источников понадобится позже.

## Development Approach

- **testing approach**: Regular (код → тесты в той же задаче, как в остальных модулях проекта)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change
- maintain backward compatibility

## Testing Strategy

- **unit tests**: сервисы (`SourcesService`) и репозитории — Jest + `NestJS TestingModule`
  (мок `PrismaService`), как в `users.service.spec.ts` / `users.repository.spec.ts`.
- **controller tests**: HTTP-слой (guards, DTO-валидация, статус-коды) — как `users.controller.spec.ts`.
- **gate tests**: `RssGate` тестируется с замоканным `rss-parser` (успех / невалидный XML / сетевая
  ошибка) — без реальных HTTP-запросов.
- **e2e тесты**: в `apps/web` уже настроен Playwright (`apps/web/e2e/*.spec.ts`,
  `pnpm --filter @repo/web test:e2e`) — по конвенции проекта (см. Testing Strategy в
  `docs/plans/` и существующие спеки `login-error.spec.ts`, `email-verification.spec.ts`) новая
  UI-фича добавления источника получает свой e2e-сценарий: добавление валидного URL → источник
  появляется в списке; добавление дубликата → показывается ошибка.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

Модульный монолит, без очередей/Redis (BullMQ — отдельная инфраструктурная задача, не нужна для
одной синхронной операции «добавить источник и распарсить один раз»). Поток:

```
POST /sources { url }
  → SourcesService.addSource(userId, url)
      → SourcesRepository.findByUrl(url)          — Source уже существует?
          → если да: UserSourcesRepository.exists(userId, sourceId)?
              → true  → 409 ConflictException('Источник уже добавлен') — без сетевого запроса
              → false → создаём подписку на существующий Source (статьи уже есть в БД от
                         предыдущего добавления, повторный фетч не нужен)
          → если нет: RssGate.fetch(url)            — HTTP + XML-парсинг (rss-parser), сырые
                                                        данные или null
              → null → 400 BadRequestException('Не удалось получить RSS-ленту по указанному URL')
              → prisma.$transaction: создать Source → создать UserSource → upsert статей →
                обновить lastFetchedAt
  → 201 { source, articlesCount }
```

Ключевые решения:

- `Source` — глобальный, уникален по `url`; повторное добавление тем же или другим пользователем
  переиспользует запись.
- Проверка дубликата подписки идёт **до** сетевого запроса, если `Source` с таким `url` уже
  существует — не тратим внешний HTTP-вызов на заведомо конфликтный случай.
- Дубликат — это не «URL уже существует глобально» (это нормально), а «текущий пользователь уже
  подписан на этот `Source`» → `ConflictException` с понятным сообщением (соответствует критерию
  приёмки «если лента уже добавлена — показывается сообщение», в контексте конкретного пользователя).
- Первичный парсинг синхронный (в рамках HTTP-запроса `POST /sources`), только при первом
  добавлении нового `Source`. Создание `Source` + `UserSource` + upsert статей + обновление
  `lastFetchedAt` выполняются в одной `prisma.$transaction`, чтобы не оставлять источник без
  подписки/статей при сбое посреди последовательности. Планировщик/очереди для периодического
  опроса — вне объёма (будущий issue).
- `Article` дедуплицируется по `(sourceId, externalId)`, где `externalId` = `guid ?? link`; если
  оба поля отсутствуют — элемент фида пропускается (не может быть надёжно дедуплицирован).
- **SSRF**: `RssGate` делает HTTP-запрос по URL, введённому пользователем. Для этого MVP (личный
  инструмент, доверенные пользователи) валидация хоста не добавляется — риск и решение отложить
  зафиксированы явно, задача на защиту от internal/loopback/metadata-адресов — в бэклог перед
  публичным multi-tenant релизом.

## Technical Details

### Схема данных (Prisma)

```prisma
enum SourceType {
  RSS
}

model Source {
  id             String   @id @default(cuid())
  type           SourceType
  url            String   @unique
  // Часть фидов не отдаёт <title> канала — fallback на хост URL в SourcesService.
  title          String
  lastFetchedAt  DateTime?
  createdAt      DateTime @default(now())

  subscriptions UserSource[]
  articles      Article[]

  @@map("sources")
}

model UserSource {
  userId    String
  sourceId  String
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@id([userId, sourceId])
  @@map("user_sources")
}

model Article {
  id          String   @id @default(cuid())
  sourceId    String
  externalId  String
  title       String
  url         String
  // Nullable: у многих RSS/Atom-элементов нет pubDate/isoDate.
  publishedAt DateTime?
  fetchedAt   DateTime @default(now())

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@unique([sourceId, externalId])
  @@index([publishedAt])
  @@map("articles")
}
```

`User` расширяется обратной связью `userSources UserSource[]` (без миграции полей, только relation).

`SourceType` — enum с одним значением `RSS` сейчас; `TELEGRAM` добавится в issue #8 отдельной
миграцией (не создаём заранее — YAGNI, но само поле `type` заводим сразу, чтобы не мигрировать
таблицу дважды).

### Zod-схемы (`packages/types`)

Новый файл `packages/types/src/sources.ts`:

```typescript
export const AddSourceSchema = z.object({ url: z.string().url() });
export const SourceSchema = z.object({
  id: z.string(),
  type: z.enum(['RSS']),
  url: z.string(),
  title: z.string(),
  lastFetchedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Source = z.infer<typeof SourceSchema>;
export type AddSourceInput = z.infer<typeof AddSourceSchema>;
```

Экспорт добавляется в `packages/types/src/index.ts`.

### API

- `POST /sources` — body `{ url: string }`, guards `JwtAuthGuard, VerifiedGuard`, возвращает
  `SourceResponseDto` (маппинг из `Source` + агрегата `articlesCount` в теле ответа, без изменения
  схемы `Source`).
- Ошибки: `400` — невалидный URL или недоступный/невалидный фид; `409` — пользователь уже
  подписан на этот источник.

### Веб

- Новая страница `apps/web/src/app/(dashboard)/sources/page.tsx` — список источников пользователя
  (пока без индикатора last sync/toggle — это issue #10, #13) + форма добавления одного поля URL.
- `apps/web/src/api/sources.api.ts` — `sourcesApi.add(url, accessToken)`, `sourcesApi.list(accessToken)`.
- Пункт меню «Источники» в `(dashboard)/layout.tsx` (проверить и добавить, если навигация вынесена
  в отдельный компонент).

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): Prisma-схема и миграция, `RssGate`, модуль
  `sources` (repository/service/controller/dto), Zod-схемы, веб-страница и API-клиент, тесты.
- **Post-Completion**: ручная проверка формы в браузере, проверка реальных RSS-лент (например,
  publicным фидом), обновление документации.

## Implementation Steps

### Task 1: Prisma-схема Source / UserSource / Article + миграция

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_sources/migration.sql` (генерируется)

- [x] добавить `enum SourceType { RSS }`, модели `Source`, `UserSource`, `Article` в
      `schema.prisma` по разделу Technical Details
- [x] добавить обратную связь `userSources UserSource[]` в модель `User`
- [x] сгенерировать миграцию: `pnpm --filter @repo/api db:migrate` (имя `add_sources`)
- [x] сгенерировать Prisma Client: `pnpm --filter @repo/api db:generate`
- [x] проверить, что миграция применяется на чистой БД без ошибок (`docker compose down -v && docker compose up -d db && pnpm --filter @repo/api db:migrate`)
- [x] run tests - must pass before next task (`pnpm --filter @repo/api test` — существующие тесты не должны сломаться)

### Task 2: Zod-схемы источников в `@repo/types`

**Files:**

- Create: `packages/types/src/sources.ts`
- Create: `packages/types/src/sources.spec.ts`
- Modify: `packages/types/src/index.ts`

- [x] создать `AddSourceSchema`, `SourceSchema` и производные типы в `packages/types/src/sources.ts`
      (см. Technical Details)
- [x] добавить `export * from './sources'` в `packages/types/src/index.ts`
- [x] написать тесты валидации `AddSourceSchema` (валидный URL / невалидный URL / пустая строка)
- [x] написать тесты структуры `SourceSchema` (успешный parse валидного объекта)
- [x] run tests - must pass before next task (`pnpm --filter @repo/types test`)

### Task 3: `RssGate` — валидация и парсинг RSS/Atom-ленты

**Files:**

- Create: `apps/api/src/sources/rss.gate.ts`
- Create: `apps/api/src/sources/rss.gate.spec.ts`
- Modify: `apps/api/package.json` (добавить зависимость `rss-parser`)

- [x] установить `rss-parser`: `pnpm --filter @repo/api add rss-parser`
- [x] создать `RssGate` с методом `fetch(url: string): Promise<{ title: string; items: RssItem[] } | null>`
      — оборачивает `Parser.parseURL`, ловит сетевые/парсинг-ошибки, возвращает `null` вместо throw
      (по конвенции Gate из `docs/adr/009-gate-layer.md`)
- [x] `RssItem` содержит поля, нужные для `Article`: `title`, `link`, `guid`, `isoDate`/`pubDate`
- [x] написать тесты: успешный парсинг (мок `Parser.parseURL`), сетевая ошибка → `null`,
      невалидный XML → `null`
- [x] run tests - must pass before next task

### Task 4: `SourcesRepository` и `UserSourcesRepository`

**Files:**

- Create: `apps/api/src/sources/sources.repository.ts`
- Create: `apps/api/src/sources/sources.repository.spec.ts`
- Create: `apps/api/src/sources/user-sources.repository.ts`
- Create: `apps/api/src/sources/user-sources.repository.spec.ts`

- [x] `SourcesRepository extends BaseRepository<Source, Prisma.SourceCreateInput, Prisma.SourceUpdateInput>`
      с методами `findByUrl(url: string): Promise<Source | null>` и
      `createWithinTransaction(tx: Prisma.TransactionClient, data: Prisma.SourceCreateInput): Promise<Source>`
      (создание внутри `$transaction` из `SourcesService.addSource`, отдельно от унаследованного
      `create`, который работает через `this.prisma`; `data` включает `lastFetchedAt: new Date()` —
      отдельного tx-aware метода обновления не заводим, значение известно уже на момент создания,
      т.к. `RssGate.fetch` к этому шагу уже отработал)
- [x] `UserSourcesRepository` (без `BaseRepository` — составной ключ) с методами
      `exists(userId, sourceId): Promise<boolean>`,
      `create(userId, sourceId, tx?: Prisma.TransactionClient): Promise<UserSource>`,
      `findAllByUser(userId): Promise<(UserSource & { source: Source })[]>`
- [x] написать тесты `SourcesRepository.findByUrl` (найден / не найден) и `create` через мок Prisma
- [x] написать тесты `UserSourcesRepository.exists` / `create` / `findAllByUser` через мок Prisma
- [x] run tests - must pass before next task

### Task 5: `ArticlesRepository` и первичное сохранение статей

**Files:**

- Create: `apps/api/src/sources/articles.repository.ts`
- Create: `apps/api/src/sources/articles.repository.spec.ts`

- [x] `ArticlesRepository` с методом `upsertMany(tx: Prisma.TransactionClient, sourceId: string, items: RssItem[]): Promise<number>`
      — принимает транзакционный клиент (см. Task 6), пропускает элементы без `guid` и `link`
      (не могут быть дедуплицированы), дедупликация по `@@unique([sourceId, externalId])`
      (`externalId = guid ?? link`) реализована как `create` + перехват `P2002` (не `upsert`, чтобы
      точно знать, сколько статей новые), `publishedAt` = `isoDate ?? pubDate ?? null`; возвращает
      количество **новых** статей — это значение попадает в `articlesCount` ответа `POST /sources`
- [x] написать тесты: новые статьи создаются, повторный вызов с теми же `externalId` не дублирует
      записи и не увеличивает счётчик (мок Prisma `create` + `P2002`), элемент без `guid`/`link`
      пропускается, элемент без даты сохраняется с `publishedAt: null`, прочие ошибки пробрасываются
- [x] run tests - must pass before next task

### Task 6: `SourcesService` — оркестрация добавления источника

**Files:**

- Create: `apps/api/src/sources/sources.service.ts`
- Create: `apps/api/src/sources/sources.service.spec.ts`

- [x] метод `addSource(userId: string, url: string): Promise<{ source: Source; articlesCount: number }>`
      реализует поток из Solution Overview: 1. `SourcesRepository.findByUrl(url)` — если `Source` найден: `UserSourcesRepository.exists` →
      при `true` `ConflictException('Источник уже добавлен')` без сетевого запроса; при `false` —
      создать `UserSource` и вернуть `{ source, articlesCount: 0 }` (статьи уже есть от
      первого добавления) 2. если `Source` не найден: `RssGate.fetch(url)`, при `null` —
      `BadRequestException('Не удалось получить RSS-ленту по указанному URL')`; иначе —
      `this.prisma.$transaction(async (tx) => { source = await sourcesRepository.createWithinTransaction(tx, { title: feed.title ?? new URL(url).host, url, type: 'RSS', lastFetchedAt: new Date() }); await userSourcesRepository.create(userId, source.id, tx); articlesCount = await articlesRepository.upsertMany(tx, source.id, feed.items); })`
- [x] метод `listForUser(userId: string): Promise<UserSourceWithSource[]>` — обёртка над
      `UserSourcesRepository.findAllByUser`
- [x] написать тесты `addSource`: успех (новый Source, транзакция вызвана), успех (существующий
      Source, другой пользователь, без повторного `RssGate.fetch`), дубликат подписки →
      `ConflictException` (без вызова `RssGate.fetch`), невалидный фид → `BadRequestException`,
      сбой внутри транзакции (например, ошибка `upsertMany`) не оставляет частично созданных
      `Source`/`UserSource` (мок `$transaction`, пробрасывающий ошибку)
- [x] написать тесты `listForUser`
- [x] run tests - must pass before next task

### Task 7: `SourcesController` + DTO + `SourcesModule`

**Files:**

- Create: `apps/api/src/sources/dto/add-source.dto.ts`
- Create: `apps/api/src/sources/dto/source-response.dto.ts`
- Create: `apps/api/src/sources/sources.controller.ts`
- Create: `apps/api/src/sources/sources.controller.spec.ts`
- Create: `apps/api/src/sources/sources.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] `AddSourceDto` с `class-validator` (`@IsUrl()`)
- [x] `SourceDto`/`AddSourceResponseDto`/`UserSourceResponseDto` с полями `Source` + `articlesCount`
- [x] `SourcesController`: `POST /sources` (`JwtAuthGuard, VerifiedGuard`, `@CurrentUser()`),
      `GET /sources` (список подписок текущего пользователя), Swagger-аннотации по образцу
      `UsersController`
- [x] зарегистрировать `SourcesModule` (controller + оба репозитория + сервис + gate) в `app.module.ts`
- [x] написать тесты контроллера: `POST /sources` успех/400/409, `GET /sources` возвращает список
      (мок `SourcesService`)
- [x] run tests - must pass before next task

### Task 8: Web — API-клиент, страница `/sources` и e2e

**Files:**

- Create: `apps/web/src/api/sources.api.ts`
- Create: `apps/web/src/hooks/use-sources.ts`
- Create: `apps/web/src/app/(dashboard)/sources/page.tsx`
- Create: `apps/web/src/app/(dashboard)/sources/add-source-form.tsx`
- Create: `apps/web/src/app/(dashboard)/sources/sources-list.tsx`
- Modify: `apps/web/src/components/main-nav.tsx` (пункт «Источники» в `NAV_LINKS`)
- Create: `apps/web/e2e/sources.spec.ts`

- [x] `sourcesApi.add(url, accessToken)` и `sourcesApi.list(accessToken)` в стиле `users.api.ts`
- [x] `AddSourceForm` — реальная конвенция проекта оказалась `ZodForm`/`TextField` из
      `@ssortia/shadcn-zod-bridge` (`AddSourceSchema` из `@repo/types`), а не голый
      `react-hook-form` из первоначального черновика плана; `useAddSource` — мутация
      `@tanstack/react-query` по образцу `hooks/use-users.ts`; обработка 400/409 через `ApiError`
      (по аналогии с `register-form.tsx`)
- [x] `SourcesList` — клиентский компонент на `useSources` (`@tanstack/react-query`), `SourcesPage` —
      server component, компонует `AddSourceForm` + `SourcesList` в `Suspense`
- [x] добавить `{ label: 'Источники', href: '/sources', roles: ['USER', 'ADMIN'] }` в `NAV_LINKS`
      (текущие пункты все `ADMIN`-only — это первый раздел, видимый роли `USER`)
- [x] написать Playwright e2e `sources.spec.ts`: локальный HTTP-сервер отдаёт статичный RSS
      (без сетевой зависимости в CI), авторизованный верифицированный пользователь добавляет
      валидный URL → источник появляется в списке; повторное добавление того же URL → видно
      сообщение «Источник уже добавлен»
- [x] run tests - must pass before next task (`pnpm build` + `NODE_ENV=test MAIL_TRANSPORT=json`
      API + `pnpm --filter @repo/web test:e2e` — все 7 e2e-тестов проходят; при параллельном
      запуске (>1 worker) возможен ресурсно-обусловленный флейк в этой песочнице, при
      `--workers=1` стабильно зелено)

### Task 9: [Final] Verify acceptance criteria

- [x] сверить с критериями приёмки issue #7: валидация URL, проверка доступности/валидности фида,
      появление в списке, сообщение о дубликате, автозапуск первичного парсинга — все покрыты
      unit/controller-тестами и e2e (`apps/web/e2e/sources.spec.ts`)
- [x] проверить edge cases: URL без протокола (Zod на фронте отклоняет, `RssGate` безопасно
      возвращает `null` при обходе формы → 400 без падения), редирект (`rss-parser` сам следует
      редиректам через `maxRedirects`), фид с пустым `<channel>` (`parseString` возвращает
      `items: []`, источник создаётся с fallback-title), повторное добавление тем же и другим
      пользователем (покрыто тестами `SourcesService`)
- [x] run full test suite: `pnpm test` — 133 теста API + 15 тестов `@repo/types`, все зелёные
- [x] run `pnpm typecheck` и `pnpm lint` — чисто по всему монорепо
- [x] проверить, что миграция и seed воспроизводимы на чистой БД — проверено в Task 1
      (`docker compose down -v && up -d db && db:migrate:deploy`, все 6 миграций применились)

### Task 10: [Final] Обновить документацию

- [x] обновить `README.md` (добавлен пункт «RSS-источники» в список «Возможности»)
- [x] проверить/обновить `CLAUDE.md`, если обнаружен новый паттерн, требующий фиксации —
      изменений не требуется: использованы уже задокументированные паттерны (Gate из ADR-009,
      составной ключ репозитория), новых архитектурных решений не появилось
- [x] переместить этот файл плана в `docs/plans/completed/`

## Post-Completion

_Пункты, требующие ручной проверки или внешних систем — без чекбоксов, информационно_

**Ручная проверка**:

- добавить в форме реальный публичный RSS-фид (например, крупный новостной) и убедиться, что
  статьи появляются
- проверить сообщение об ошибке для битого URL и для URL, отдающего HTML вместо RSS
- проверить, что повторное добавление того же URL текущим пользователем показывает понятную ошибку
  о дубликате, а не техническую

**Внешние системы**:

- отдельный issue: периодический опрос источников (планировщик/очереди) — не входит в этот план,
  «первичный парсинг» здесь синхронный и разовый
- отдельный issue (#8): добавление Telegram-каналов — потребует расширения `SourceType`
