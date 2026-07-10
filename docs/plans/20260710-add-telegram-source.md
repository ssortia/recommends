# Добавление Telegram-канала (issue #8)

## Overview

Расширить фичу добавления источников (issue #7) поддержкой публичных Telegram-каналов:
пользователь вводит `@username` или ссылку на канал в то же поле формы, что и для RSS-URL;
бэкенд автоматически определяет тип источника, проверяет доступность канала через
HTTP-scraping публичной preview-страницы Telegram (`https://t.me/s/<username>`), создаёт
(или переиспользует) `Source` с `type: TELEGRAM`, подписывает пользователя и сохраняет
найденные посты как статьи — по аналогии с первичным парсингом RSS.

Приватные каналы (MTProto/gramjs) — вне рамок этого issue, зафиксированы в `docs/PRODUCT.md`
как отдельная будущая задача.

## Context (from discovery)

- Issue #8 (GitHub): критерии приёмки — форма принимает `@username` или ссылку на канал, сервис
  проверяет доступность канала, канал появляется в списке источников, для нового канала
  запускается первичный парсинг.
- `docs/PRODUCT.md` и `docs/adr/009-gate-layer.md` уже фиксируют архитектурное решение:
  публичные Telegram-каналы — через HTTP-scraping, `TelegramGate` — прямой пример из ADR-009.
- Существующая инфраструктура источников (issue #7, `apps/api/src/sources/`):
  - `SourcesService.addSource(userId, url)` — сейчас жёстко привязан к RSS: вызывает
    `RssGate.fetch`, создаёт `Source` с `type: 'RSS'`.
  - `SourcesRepository.findByUrl` / `createWithinTransaction` — общие для любых типов источника,
    менять не нужно.
  - `ArticlesRepository.upsertMany(tx, sourceId, items: RssItem[])` — дедупликация статей через
    `(sourceId, externalId)` + `catch(P2002)`, не завязана на RSS специфично, кроме типа `RssItem`.
  - `SourceType` enum в Prisma — сейчас только `RSS` (специально оставлено расширяемым в плане
    issue #7: «`TELEGRAM` добавится в issue #8 отдельной миграцией»).
  - Zod `SourceTypeSchema` в `packages/types/src/sources.ts` — зеркалит Prisma enum.
  - Web: `AddSourceForm` (`apps/web/src/app/(dashboard)/sources/add-source-form.tsx`) — одно
    поле `url`, `AddSourceSchema` (Zod) валидирует как URL строго (`z.string().url()`).
  - `apps/web/e2e/sources.spec.ts` — паттерн e2e с локальным HTTP-сервером вместо реальной сети.
  - `apps/api/src/config/env.ts` — Zod-схема окружения с валидацией на старте (`getEnv()`),
    паттерн для новых base-url переменных (`WEB_URL` и т.п.).
- Решения, принятые с пользователем (см. диалог планирования):
  1. **Одно поле с автоопределением типа** — то же поле ввода, что и для RSS; бэкенд по формату
     строки решает RSS это или Telegram. Не требует переделки формы.
  2. **HTTP-scraping `t.me/s/<username>`** — без токенов/авторизации, как зафиксировано в
     `docs/PRODUCT.md`.
  3. **Общий `FeedItem`** вместо отдельного репозитория — `RssItem` переименовывается/обобщается,
     `TelegramGate` возвращает данные в том же формате, `ArticlesRepository.upsertMany` не дублируется.
  4. **Testing approach**: Regular (как в issue #7) — код, затем тесты в той же задаче.
  5. **E2E** для Telegram-источника добавляется (аналог `e2e/sources.spec.ts`), через
     env-переменную `TELEGRAM_PREVIEW_BASE_URL`, которую e2e подменяет на локальный mock-сервер,
     отдающий фиксированный HTML в формате `t.me/s/`.

## Development Approach

- **testing approach**: Regular (код → тесты в той же задаче)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change
- maintain backward compatibility (RSS-флоу не должен сломаться)

## Testing Strategy

- **unit tests**: `TelegramGate`, `SourceInputParser`, `SourcesService` (юнит-тест на каждый
  публичный метод/ветвление), regression-тесты на существующий RSS-флоу.
- **e2e tests**: Playwright, локальный HTTP-сервер вместо `t.me` на **фиксированном порту**
  (не `listen(0)`) — API в этом проекте внешний процесс (см. `playwright.config.ts`: нет
  `webServer`, адреса берутся из `PLAYWRIGHT_BASE_URL`/`PLAYWRIGHT_API_URL`), `getEnv()`
  кеширует `TELEGRAM_PREVIEW_BASE_URL` один раз при старте API-процесса. Значит адрес mock-сервера
  должен быть известен **до** старта API, а не генерироваться внутри теста — см. Task 9.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix

## Solution Overview

1. **Prisma**: `SourceType` enum получает значение `TELEGRAM` — миграция `add_telegram_source_type`.
2. **`FeedItem`**: `RssItem` в `apps/api/src/sources/rss.gate.ts` обобщается до `FeedItem`
   (переносится в отдельный файл `feed-item.interface.ts`), `RssGate` и новый `TelegramGate`
   реализуют один и тот же контракт `fetch(...): Promise<{ title?: string; items: FeedItem[] } | null>`.
   `ArticlesRepository.upsertMany` меняет тип параметра `RssItem[]` → `FeedItem[]` (без изменения
   логики).
3. **`SourceInputParser`** (новый чистый модуль `source-input.parser.ts`): по строке ввода
   определяет `{ type: 'RSS', url } | { type: 'TELEGRAM', username } | null`.
   - `@username` → Telegram, `username` = без `@`.
   - `^(https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})\/?$` (regex обязательно **анкорится** `^...$` и
     экранирует точку `\.`, иначе `txme/...` или RSS-URL с `/t.me/` в пути дадут ложное
     совпадение) → Telegram, без совпадения с `/s/`, `/joinchat/`, `/addstickers/` и т.п. (у них
     после `t.me/` идёт не username, а служебный сегмент — не пройдёт по паттерну имени).
   - иначе — трактуется как RSS URL (валидность URL проверяется тем же способом, что раньше
     проверял `@IsUrl()` на DTO — через `new URL(...)`).
   - `username` должен соответствовать паттерну Telegram-имён: `^[a-zA-Z0-9_]{5,32}$`.
   - **нормализация регистра**: итоговый `username` приводится к `.toLowerCase()` — Telegram
     username регистронезависим, а `SourcesRepository.findByUrl` делает точное совпадение по
     `url`. Без нормализации `@Channel`, `@channel` и `t.me/CHANNEL` создали бы три разных
     `Source` вместо переиспользования одного.
4. **`TelegramGate`** (новый Gate, ADR-009): `fetch(username): Promise<{ title?: string; items: FeedItem[] } | null>`.
   - Строит URL `${TELEGRAM_PREVIEW_BASE_URL}/s/${username}`, делает `fetch` (глобальный, Node 22),
     парсит HTML через `cheerio`.
   - Валидность канала — по наличию `.tgme_channel_info` в разметке; при отсутствии/сетевой
     ошибке/`!res.ok` — `null` (без исключений, как того требует ADR-009).
   - `title` — текст `.tgme_channel_info_header_title`.
   - `items` — по `.tgme_widget_message`: `guid` = `data-post`, `link` = `https://t.me/${data-post}`,
     `title` = текст `.tgme_widget_message_text` (обрезанный до ~200 символов), `isoDate` = атрибут
     `datetime` внутри `time`.
5. **`SourcesService.addSource`** рефакторится: общая часть (поиск существующего `Source` по
   `url` → conflict/переиспользование → транзакция создания `Source`+`UserSource`+статей) выносится
   в приватный метод, параметризованный `type`, канонический `url`, функцией `fetchFeed()` и
   `fallbackTitle`. Публичный `addSource(userId, input)`:
   - парсит `input` через `SourceInputParser`; `null` → `BadRequestException`
     («Некорректный формат: укажите URL RSS-ленты или @username/ссылку на Telegram-канал»).
   - RSS-ветка: `canonicalUrl = url`, `fetchFeed = () => rssGate.fetch(url)`,
     `fallbackTitle = new URL(url).host` (без изменения текущего поведения).
   - Telegram-ветка: `canonicalUrl = https://t.me/${username}` (без `/s/` — так красивее для
     отображения в списке источников), `fetchFeed = () => telegramGate.fetch(username)`,
     `fallbackTitle = '@' + username`, сообщение об ошибке — «Не удалось найти публичный
     Telegram-канал по указанному имени».
6. **`env.ts`**: `TELEGRAM_PREVIEW_BASE_URL: z.string().url().default('https://t.me')`.
7. **DTO/Zod**: `AddSourceDto.url` → `@IsString() @IsNotEmpty()` вместо `@IsUrl()` (формат
   проверяется в сервисе через `SourceInputParser`, аналогично тому, как `RssGate` раньше решал
   валидность через `null`, а не через синтаксис DTO). Поле остаётся `url` — переименование в
   `input` не требуется и увеличило бы диафф без пользы (Zod/API-контракт не критичны к имени).
   `AddSourceSchema` в `packages/types` меняет `.url()` на `.min(1)`; `SourceTypeSchema` —
   `z.enum(['RSS', 'TELEGRAM'])`.
8. **Web**: `AddSourceForm` — обновить `label`/`placeholder` («Источник» / «https://... или
   @username»), обработку 400-ошибки — сообщение теперь общее («Не удалось добавить источник:
   проверьте формат»), т.к. причин 400 стало две. `SourcesList` — без изменений (карточка уже
   универсальна для `title`/`url`).

## Technical Details

### Prisma migration

```prisma
enum SourceType {
  RSS
  TELEGRAM
}
```

### `FeedItem` (общий контракт Gate → ArticlesRepository)

```typescript
export interface FeedItem {
  guid?: string;
  link?: string;
  title?: string;
  isoDate?: string;
  pubDate?: string;
}
```

### `SourceInputParser`

```typescript
export type ParsedSourceInput =
  | { type: 'RSS'; url: string }
  | { type: 'TELEGRAM'; username: string };

export function parseSourceInput(input: string): ParsedSourceInput | null;
```

### `TelegramGate`

```typescript
@Injectable()
export class TelegramGate {
  async fetch(username: string): Promise<{ title?: string; items: FeedItem[] } | null>;
}
```

## What Goes Where

- **Implementation Steps** (`[ ]`): код, тесты, миграция, документация.
- **Post-Completion**: ручная проверка на реальном публичном Telegram-канале, проверка edge-кейсов
  (несуществующий канал, приватный канал, канал без постов).

## Implementation Steps

### Task 1: Prisma-миграция — добавить `TELEGRAM` в `SourceType`

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_telegram_source_type/migration.sql` (генерируется)

- [x] добавить `TELEGRAM` в enum `SourceType` в `schema.prisma`
- [x] сгенерировать миграцию: `pnpm --filter @repo/api db:migrate`
- [x] сгенерировать Prisma Client: `pnpm --filter @repo/api db:generate`
- [x] запустить полный набор тестов API — убедиться, что существующие тесты не сломались:
      `pnpm --filter @repo/api test`

### Task 2: Обобщить `RssItem` → `FeedItem`, обновить `ArticlesRepository`

**Files:**

- Create: `apps/api/src/sources/feed-item.interface.ts`
- Modify: `apps/api/src/sources/rss.gate.ts`
- Modify: `apps/api/src/sources/articles.repository.ts`
- Modify: `apps/api/src/sources/articles.repository.spec.ts` (импорт типа, если явно ссылается на `RssItem`)

- [x] создать `feed-item.interface.ts` с интерфейсом `FeedItem` (см. Technical Details)
- [x] `rss.gate.ts`: `RssItem` заменить на импорт `FeedItem` из нового файла (тип `RssFeed.items: FeedItem[]`)
- [x] `articles.repository.ts`: параметр `items: RssItem[]` → `items: FeedItem[]`, импорт обновить
- [x] прогнать существующие тесты `rss.gate.spec.ts` и `articles.repository.spec.ts` — должны
      пройти без изменений в логике (только типы)
- [x] запустить тесты: `pnpm --filter @repo/api test`

### Task 3: `SourceInputParser` — определение типа источника по вводу

**Files:**

- Create: `apps/api/src/sources/source-input.parser.ts`
- Create: `apps/api/src/sources/source-input.parser.spec.ts`

- [x] реализовать `parseSourceInput(input: string): ParsedSourceInput | null`: `@username` и
      анкорированный `^(https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})\/?$` → `{ type: 'TELEGRAM',
username: username.toLowerCase() }`, валидный `http(s)://` URL → `{ type: 'RSS', url }`,
      иначе `null`
- [x] написать тесты: `@username`, `t.me/username`, `https://t.me/username`, обычный RSS URL
- [x] написать тест на нормализацию регистра: `@Username` и `t.me/USERNAME` дают одинаковый
      `username` в нижнем регистре
- [x] написать тесты на невалидный ввод: пустая строка, `t.me/joinchat/xxx`, `t.me/s/username`,
      RSS-URL с `/t.me/` в пути (например, `https://example.com/t.me/foo`), `txme/username`,
      случайный текст, слишком короткое/длинное имя — все должны вернуть либо `null`, либо (для
      RSS-подобных случаев) `{ type: 'RSS', url }`, но никогда ложный `TELEGRAM`-матч
- [x] запустить тесты: `pnpm --filter @repo/api test`

### Task 4: `TELEGRAM_PREVIEW_BASE_URL` в конфиге окружения

**Files:**

- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`

- [x] добавить `TELEGRAM_PREVIEW_BASE_URL: z.string().url().default('https://t.me')` в `envSchema`
- [x] добавить переменную с комментарием в `.env.example`
- [x] запустить тесты: `pnpm --filter @repo/api test`

### Task 5: `TelegramGate` — HTTP-scraping публичного канала

**Files:**

- Create: `apps/api/src/sources/telegram.gate.ts`
- Create: `apps/api/src/sources/telegram.gate.spec.ts`
- Modify: `apps/api/package.json` (добавить зависимость `cheerio`)

- [x] добавить зависимость: `pnpm --filter @repo/api add cheerio`
- [x] реализовать `TelegramGate.fetch(username)`: запрос `${baseUrl}/s/${username}` через
      глобальный `fetch`, парсинг `cheerio`, извлечение `title` и `items` (см. Technical Details
      / Solution Overview п.4)
- [x] обработать случаи: `!res.ok` → `null`; отсутствие `.tgme_channel_info` в разметке → `null`
      (канал не существует/приватный); сетевая ошибка (`catch`) → `null` + `logger.warn`
- [x] написать тесты (мокать `global.fetch`): успешный парсинг с постами, канал без постов
      (`items: []`), канал не найден (нет `.tgme_channel_info`), `!res.ok` (404), сетевая ошибка
- [x] запустить тесты: `pnpm --filter @repo/api test`

### Task 6: Рефакторинг `SourcesService.addSource` под два типа источников

**Files:**

- Modify: `apps/api/src/sources/sources.service.ts`
- Modify: `apps/api/src/sources/sources.service.spec.ts`
- Modify: `apps/api/src/sources/sources.module.ts` (зарегистрировать `TelegramGate`)

- [x] вынести общую часть addSource (поиск существующего `Source`, conflict-проверка, транзакция
      создания `Source`+`UserSource`+статей) в приватный параметризованный метод
- [x] публичный `addSource(userId, input)`: парсинг через `SourceInputParser`, ветвление
      RSS/Telegram согласно Solution Overview п.5, `BadRequestException` при `null` от парсера
- [x] зарегистрировать `TelegramGate` в `SourcesModule.providers`
- [x] обновить существующие RSS-тесты под новую сигнатуру (если изменился путь вызова) —
      поведение должно остаться прежним
- [x] написать тесты для Telegram-ветки: новый канал (создание + articlesCount), существующий
      канал (conflict / переподписка без повторного fetch), `TelegramGate.fetch` вернул `null` →
      `BadRequestException`
- [x] написать тест на `null` от `SourceInputParser` → `BadRequestException` до любых сетевых вызовов
- [x] запустить тесты: `pnpm --filter @repo/api test`

### Task 7: Zod-схемы `@repo/types`

**Files:**

- Modify: `packages/types/src/sources.ts`
- Modify: `packages/types/src/sources.spec.ts`

- [x] `SourceTypeSchema`: `z.enum(['RSS', 'TELEGRAM'])`
- [x] `AddSourceSchema`: `url: z.string().url()` → `url: z.string().min(1)`
- [x] обновить/добавить тесты: валидация `@username`, `t.me/...`, RSS URL, пустой строки,
      `SourceSchema` с `type: 'TELEGRAM'`
- [x] запустить тесты: `pnpm --filter @repo/types test`

### Task 8: Web — обновить форму добавления источника

**Files:**

- Modify: `apps/web/src/app/(dashboard)/sources/add-source-form.tsx`

- [x] ➕ исправить AddSourceDto.url: @IsUrl() → @IsString() @IsNotEmpty() (пробел плана — иначе @username отклоняется на уровне DTO)
- [x] обновить `label`/`placeholder` поля (например, «Источник» /
      «https://example.com/feed.xml или @channel»)
- [x] обновить текст ошибки 400 на общий («Не удалось добавить источник: проверьте формат ссылки
      или имени канала»)
- [x] вручную проверить в браузере (`pnpm dev`), что форма отправляет и `@username`, и RSS URL —
      частично: подтверждено, что dev-сервер работает и `/sources` доступен только после логина
      (редирект на `/login`); полноценный E2E-прогон формы с логином вынесен в Task 9,
      корректность разметки подтверждена typecheck'ом и код-ревью формы

### Task 9: E2E-тест добавления Telegram-канала

**Важно (вывод ревью плана)**: в отличие от RSS e2e (`e2e/sources.spec.ts`), где `startFeedServer`
слушает случайный порт (`listen(0)`) уже во время теста — потому что URL фида передаётся как
пользовательский ввод per-request — здесь так не сработает. `TELEGRAM_PREVIEW_BASE_URL` читается
один раз при старте API-процесса (`getEnv()` кеширует результат), а API в этом проекте — внешний
процесс, не поднимаемый Playwright'ом (`playwright.config.ts` без `webServer`). Значит адрес
mock-сервера должен быть известен **до** запуска API, т.е. использовать **фиксированный** порт,
а не случайный.

**Files:**

- Create: `apps/web/e2e/telegram-source.spec.ts`
- Modify: `.env.example` (задокументировать фиксированный порт для e2e-окружения)

- [ ] локальный HTTP-сервер в `telegram-source.spec.ts`, слушающий **фиксированный** порт (например,
      `4310` — выбрать свободный, не пересекающийся с web(3000)/api(3001)/postgres/redis), отдающий
      фиксированный HTML в формате `t.me/s/<username>` (с `.tgme_channel_info_header_title` и одним
      `.tgme_widget_message`), запускается в `test.beforeAll`
- [ ] задокументировать в `.env.example` и/или README dev-инструкции по e2e: перед прогоном e2e API
      должен быть запущен с `TELEGRAM_PREVIEW_BASE_URL=http://127.0.0.1:4310` (то есть переменная
      выставляется в окружении API-процесса заранее, аналогично `NODE_ENV=test` для
      email-verification e2e — см. комментарий в начале `playwright.config.ts`)
- [ ] тест: добавление `@username` → канал появляется в списке
- [ ] тест: повторное добавление того же канала → сообщение о дубликате
- [ ] тест: разный регистр (`@Username` при первом добавлении, `t.me/username` при повторном) →
      трактуется как один и тот же источник (проверка нормализации регистра из Task 3)
- [ ] запустить: `pnpm --filter @repo/web test:e2e` (или актуальная команда e2e из `package.json`),
      предварительно перезапустив API с `TELEGRAM_PREVIEW_BASE_URL` из шага выше

### Task 10: Verify acceptance criteria

- [x] форма принимает `@username` или ссылку на канал — проверено (Task 8/9)
- [x] сервис проверяет доступность канала — проверено (Task 5/6)
- [x] при успешном добавлении канал появляется в списке источников — проверено (Task 9)
- [x] для нового канала автоматически запускается первичный парсинг — проверено (Task 6, articlesCount)
- [x] запустить полный набор тестов: `pnpm test` (из корня, все workspace) — 27 suites / 162 tests
      passed (API), types/utils/web без изменений в тестах — все зелёные
- [x] запустить `pnpm lint` и `pnpm typecheck` — typecheck сразу зелёный; lint обнаружил 2
      ошибки `import/order` в `telegram.gate.ts`/`telegram.gate.spec.ts` (пустая строка между
      группами импортов) — исправлено, lint зелёный
- [x] запустить e2e: `pnpm --filter @repo/web test:e2e` — все 3 telegram-теста прошли; 2 теста
      `e2e/sources.spec.ts` (RSS) упали на `waiting for getByText('E2E Test Feed')` —
      воспроизводится детерминированно и на неизменённой (кроме переименования лейбла) версии
      файла; это та же гонка гидратации next-auth сессии, задокументированная в прогресс-логе
      Task 9 (`sources.spec.ts` не делает `waitForLoadState('networkidle')` после `goto('/sources')`,
      в отличие от `telegram-source.spec.ts`) — пре-существующая проблема, не регрессия от фичи
      Telegram, не исправляется в рамках Task 10

### Task 11: [Final] Обновить документацию

- [ ] обновить `docs/PRODUCT.md`, если нужно (пункт про Telegram уже есть, свериться с фактом)
- [ ] проверить, нужен ли новый ADR (архитектурное решение уже покрыто ADR-009 — новый не нужен)
- [ ] обновить README.md, если список фич не отражает добавление Telegram-источников
- [ ] переместить этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка**:

- добавить реальный публичный Telegram-канал (например, крупный новостной) по `@username` и
  убедиться, что посты появляются в списке статей
- проверить ссылку-вариант (`https://t.me/username`)
- проверить сообщение об ошибке для несуществующего/приватного канала
- проверить, что канал без постов не падает (просто `articlesCount: 0`)
- проверить, что RSS-флоу (issue #7) продолжает работать без регрессий

**Внешние системы**:

- периодический опрос Telegram-каналов (планировщик) — отдельный issue, вне рамок этого плана
- приватные каналы через MTProto/gramjs — отдельный будущий issue (см. `docs/PRODUCT.md`)
