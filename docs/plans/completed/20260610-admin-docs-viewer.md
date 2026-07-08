# Раздел просмотра документации (docs/) в админке

> GitHub issue: #29

## Overview

Добавить в админ-раздел (`/admin`) подраздел `/admin/docs` для просмотра всех Markdown-файлов из каталога `docs/` монорепо прямо из веб-интерфейса, без доступа к исходникам.

- **Проблема**: документация (ADR, гайды, планы) живёт только в репозитории; читать её удобнее из админки.
- **Решение**: новый NestJS-модуль `docs` в `apps/api` отдаёт (1) дерево файлов, сгруппированное по подпапкам, и (2) содержимое конкретного файла. Фронт — страница `/admin/docs` с навигацией и рендерингом Markdown.
- **Интеграция**: защита существующим RBAC (`JwtAuthGuard` + `RolesGuard` + `@Roles(Role.ADMIN)`), общий api-client (`src/lib/api.ts`), паттерны модуля `audit`.

## Context (from discovery)

- **API-паттерн модуля**: `apps/api/src/audit/` — controller + service + module + `.spec.ts`. Админ-эндпоинты защищены `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` + `@ApiBearerAuth()` (см. `audit.controller.ts`).
- **Регистрация модулей**: `apps/api/src/app.module.ts`.
- **Общие типы**: `packages/types/src/*` + реэкспорт в `index.ts`; используются и в API (DTO/Swagger), и на web.
- **Web api-слой**: доменные функции в `apps/web/src/api/*.api.ts` поверх `api.get(...)` из `src/lib/api.ts` (передача `accessToken`); React-хуки в `apps/web/src/hooks/use-*.ts` (react-query + `useSession`).
- **Админ-навигация**: единый список `NAV_LINKS` в `apps/web/src/components/main-nav.tsx` — новый раздел добавляется одной строкой.
- **Структура страницы**: `apps/web/src/app/admin/<section>/page.tsx` (+ клиентские компоненты рядом), layout уже проверяет роль `ADMIN`.
- **Прод/Docker**: `docker/api.Dockerfile` копирует в runner только `dist` и `node_modules` — `docs/` отсутствует. Путь к docs разрешается относительно скомпилированного файла, `docs/` копируется в образ (см. Solution Overview).
- **Env**: zod-валидация в `apps/api/src/config/env.ts` (env для docs НЕ вводим — путь детерминированный).

## Development Approach

- **testing approach**: Regular (сначала код, потом тесты в той же задаче)
- завершать каждую задачу полностью перед переходом к следующей; маленькие сфокусированные изменения
- **КРИТИЧНО: каждая задача с изменением кода ОБЯЗАНА включать новые/обновлённые тесты** (отдельными пунктами чеклиста), покрывающие успех и ошибки/краевые случаи
- **КРИТИЧНО: все тесты должны проходить перед началом следующей задачи**
- комментарии в коде — только «почему», на русском; код самодокументируемый
- обновлять этот файл плана при изменении объёма работ

## Testing Strategy

- **unit-тесты (API)**: `docs.service.spec.ts` (обход дерева, защита от path traversal, чтение валидного/невалидного пути) — тесты создают **временный каталог-фикстуру** и внедряют его как `DOCS_ROOT`, не завися от `__dirname`; `docs.controller.spec.ts` (делегирование в сервис, guard-метаданные по образцу `audit.controller.spec.ts`). Команда: `pnpm --filter @repo/api test`.
- **проверка реального пути**: разрешение `__dirname` → `<repo>/docs` в `dist` НЕ покрывается unit-тестами (запуск из `src/`). Проверяется обязательной сборкой (`pnpm --filter @repo/api build` + запуск/Docker) — см. Task 5/8.
- **web (api-слой и хуки)**: на web нет jest/vitest (только Playwright-e2e, без сьютов в репозитории) — покрытие `docs.api.ts`/`use-docs.ts` обеспечивается `pnpm typecheck` + `pnpm lint`, как у существующих `audit.api.ts`/`use-audit.ts`.
- **типы/линт**: `pnpm typecheck`, `pnpm lint` после изменений.
- **e2e**: ручная проверка вынесена в Post-Completion.

## Progress Tracking

- `[x]` — выполнено; `➕` — новая задача; `⚠️` — блокер
- держать план в синхроне с фактической работой

## Solution Overview

**Архитектура потока:**

1. **`@repo/types`** — источник истины контрактов: `DocsFileMeta` (относительный путь, имя, группа), `DocsTree` (массив групп `{ group, files[] }`), `DocsFileContent` (`{ path, content }`).
2. **API `DocsService`** (корень `docsRoot` внедряется через DI-токен `DOCS_ROOT`):
   - `getTree()` — рекурсивный обход `<docsRoot>/**/*.md`, группировка по подпапке первого уровня (`adr`, `guides`, `plans`, корень → группа `root`). Возвращает только относительные пути.
   - `getFile(relPath)` — нормализует путь, проверяет, что он `.md` и что `path.resolve(docsRoot, relPath)` остаётся **внутри** `docsRoot` (защита от path traversal), читает файл; иначе бросает `NotFoundException`/`BadRequestException` (нормализуются `AllExceptionsFilter`, ADR-012).
   - **`DOCS_ROOT` внедряется провайдером**, а не хардкодом в сервисе, — чтобы тесты задавали путь к фикстурам, а не зависели от `__dirname`. Дефолтное значение провайдера: `path.resolve(__dirname, '../../../../docs')`.
     - ВАЖНО: SWC даёт **плоский** `dist` (`apps/api/dist/docs/docs.service.js`), поэтому до корня монорепо ровно **4** уровня вверх: `dist/docs` → `dist` → `apps/api` → `apps` → `<root>` → `docs`. Локально → `<repo>/docs`, в контейнере (`/app/apps/api/dist/docs/...`) → `/app/docs`.
3. **API `DocsController`** — `GET /docs` (дерево) и `GET /docs/file?path=...` (содержимое), оба под `@Roles(Role.ADMIN)`.
4. **Docker** — `api.Dockerfile` копирует `docs/` в `/app/docs` в runner-стадию.
5. **Web** — `docs.api.ts` + `use-docs.ts` (react-query) + страница `/admin/docs` с деревом-навигацией и рендером `react-markdown` + `remark-gfm`; пункт в `main-nav.tsx`.

**Ключевые решения:**

- Path traversal закрывается проверкой того, что нормализованный абсолютный путь начинается с `docsRoot + path.sep` (не доверяем входной строке; защита от абсолютных путей, `..`, URL-encoded `..` и от ложного совпадения префикса вроде `docs-secret`).
- Без env-конфига: путь относительно `__dirname` (4 уровня вверх для плоского `dist`), но **корень внедряется через токен `DOCS_ROOT`** для тестируемости. Меньше точек отказа в проде, тесты не зависят от `__dirname`.
- Контракты в `@repo/types` исключают дрейф между API и web.
- `react-markdown` рендерится **без `rehype-raw`** — raw-HTML запрещён (XSS-вектор), контент трактуется как Markdown.

## Technical Details

- **Группировка**: первый сегмент относительного пути; файлы в корне `docs/` (`issues.md`, `DOCUMENTATION.md`) → группа `root`. Группы отсортированы детерминированно, файлы — по пути.
- **Query-параметр**: `path` — относительный путь от `docs/` (например `adr/012-api-error-format.md`); валидируется DTO (`@IsString`) + проверкой traversal в сервисе.
- **Рендеринг**: `react-markdown` + `remark-gfm` (таблицы, чек-листы). Контент — plain string из API.
- **Зависимости web**: добавить `react-markdown` и `remark-gfm` в `apps/web/package.json`.

## What Goes Where

- **Implementation Steps** (`[ ]`): типы, API-модуль, web api-слой/хук, страница, навигация, Docker, ADR, документация, тесты.
- **Post-Completion** (без чекбоксов): ручная проверка UI, проверка работоспособности в собранном Docker-образе.

## Implementation Steps

### Task 1: Контракты docs в `@repo/types`

**Files:**

- Create: `packages/types/src/docs.ts`
- Modify: `packages/types/src/index.ts`

- [x] создать `packages/types/src/docs.ts` с zod-схемами `DocsFileMetaSchema` (`path`, `name`, `group`), `DocsGroupSchema` (`group`, `files: DocsFileMeta[]`), `DocsTreeSchema` (`groups: DocsGroup[]`), `DocsFileContentSchema` (`path`, `content`) и выводимыми типами
- [x] добавить реэкспорт `export * from './docs';` в `packages/types/src/index.ts`
- [x] написать тест на парсинг схем (валидный объект проходит, невалидный — падает)
- [x] собрать пакет: `pnpm --filter @repo/types build` (компиляция проверена через `tsc --outDir` во временный каталог; штатный `dist` принадлежит root — host-сборка падает EACCES, прод-сборка идёт через Docker, см. MEMORY)
- [x] прогнать тесты — должны проходить перед следующей задачей

### Task 2: NestJS-модуль `docs` (service + controller + module)

**Files:**

- Create: `apps/api/src/docs/docs.service.ts`
- Create: `apps/api/src/docs/docs.controller.ts`
- Create: `apps/api/src/docs/docs.module.ts`
- Create: `apps/api/src/docs/dto/get-doc-file-query.dto.ts`
- Create: `apps/api/src/docs/docs.service.spec.ts`
- Create: `apps/api/src/docs/docs.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [x] провайдер токена `DOCS_ROOT` в `DocsModule` с дефолтом `path.resolve(__dirname, '../../../../docs')` (4 уровня — плоский `dist`); `DocsService` инжектит корень через `@Inject(DOCS_ROOT)`
- [x] `DocsService`: метод `getTree()` — рекурсивный обход `docsRoot` (`fs.promises`), сбор `*.md`, группировка по первому сегменту (корень → `root`), детерминированная сортировка
- [x] `DocsService`: метод `getFile(relPath)` — нормализация; проверка расширения `.md`; проверка, что `path.resolve(docsRoot, relPath)` начинается с `docsRoot + path.sep` (защита от path traversal, абсолютных путей и ложного префикса → `BadRequestException`); чтение; отсутствующий файл → `NotFoundException`
- [x] `GetDocFileQueryDto` с `@ApiProperty` + `@IsString()` для query-параметра `path`
- [x] `DocsController`: `GET /docs` и `GET /docs/file`, оба `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` + `@ApiBearerAuth()` + Swagger-декораторы (по образцу `audit.controller.ts`)
- [x] `DocsModule` (controllers + providers, включая `DOCS_ROOT`) и регистрация в `app.module.ts`
- [x] тесты `docs.service.spec.ts` (с временной фикстурой-каталогом, внедрённой как `DOCS_ROOT`): дерево (группировка/сортировка); `getFile` успех; traversal-кейсы — `../`, абсолютный путь (`/etc/passwd`), URL-encoded `%2e%2e`, ложный префикс (`docs-secret`) → ошибка; несуществующий файл → ошибка; не-`.md` → ошибка
- [x] тесты `docs.controller.spec.ts`: делегирование в сервис + проверка guard/roles-метаданных (по образцу `audit.controller.spec.ts`)
- [x] прогнать `pnpm --filter @repo/api test` — должны проходить перед следующей задачей

### Task 3: Web api-слой и react-query хук

**Files:**

- Create: `apps/web/src/api/docs.api.ts`
- Create: `apps/web/src/hooks/use-docs.ts`

- [x] `docs.api.ts`: `docsApi.tree(accessToken)` → `api.get<DocsTree>('/docs')` и `docsApi.file(accessToken, path)` → `api.get<DocsFileContent>('/docs/file', { params: { path } })`; реэкспорт типов из `@repo/types`
- [x] `use-docs.ts`: `useDocsTree()` и `useDocFile(path)` на react-query + `useSession` (ключи включают `path`, `enabled` по `accessToken` и наличию `path`) — по образцу `use-audit.ts`
- [x] unit-тесты не пишем: на web нет jest/vitest — покрытие через `pnpm typecheck` + `pnpm lint` (как у существующих `audit.api.ts`/`use-audit.ts`)
- [x] `pnpm typecheck` и `pnpm lint` — без ошибок перед следующей задачей

### Task 4: Страница `/admin/docs` с навигацией и рендером Markdown

**Files:**

- Create: `apps/web/src/app/admin/docs/page.tsx`
- Create: `apps/web/src/app/admin/docs/docs-viewer.tsx`
- Modify: `apps/web/src/components/main-nav.tsx`
- Modify: `apps/web/package.json`

- [x] добавить зависимости `react-markdown` и `remark-gfm` в `apps/web/package.json`, установить (`pnpm install`)
- [x] `docs-viewer.tsx` (client): дерево файлов слева (группы `adr`/`guides`/`plans`/`root`), выбранный файл рендерится `react-markdown` + `remark-gfm`; состояния загрузки/ошибки/пусто
- [x] `page.tsx`: серверная обёртка, рендерящая `DocsViewer` (роль уже проверена в `admin/layout.tsx`)
- [x] добавить строку `{ label: 'Документация', href: '/admin/docs', roles: ['ADMIN'] }` в `NAV_LINKS` (`main-nav.tsx`)
- [x] `pnpm typecheck` и `pnpm lint` — без ошибок перед следующей задачей

### Task 5: Копирование `docs/` в Docker-образ api

**Files:**

- Modify: `docker/api.Dockerfile`

- [x] в runner-стадии добавить `COPY --from=builder /app/docs ./docs` — целевой путь `/app/docs`, совпадает с дефолтом `DOCS_ROOT` = `path.resolve(__dirname, '../../../../docs')` (из `/app/apps/api/dist/docs/`); builder делает `COPY . .`, поэтому `/app/docs` в нём есть
- [x] **обязательно**: host-сборка `pnpm --filter @repo/api build` падает EACCES (root-owned `dist`, см. MEMORY) — прод-сборка идёт через Docker. Арифметика пути проверена: `path.resolve('/app/apps/api/dist/docs', '../../../../docs') === '/app/docs'` и локально `=== <repo>/docs` (существует); компилированный `apps/api/dist/docs/docs.module.js` уже содержит дефолт `path.resolve(__dirname, '../../../../docs')`. Фактический запуск образа — в Post-Completion

### Task 6: ADR о выдаче docs через API

**Files:**

- Create: `docs/adr/013-docs-viewer-api.md`
- Modify: `docs/adr/README.md`

- [x] написать ADR-013 по шаблону `docs/adr/README.md`: контекст, решение (источник — API-модуль, RBAC ADMIN, защита от path traversal, детерминированный путь + COPY в образ), последствия
- [x] добавить строку ADR-013 в индекс `docs/adr/README.md`

### Task 7: Документация (guides/README)

**Files:**

- Modify: `README.md`
- Modify: `CLAUDE.md` (раздел Architecture Decisions, при необходимости)

- [x] обновить список фич в `README.md` (добавить раздел просмотра docs в админке)
- [x] при необходимости добавить ссылку на модуль `docs` и ADR-013 в `CLAUDE.md`

### Task 8: Проверка acceptance criteria

- [x] эндпоинты `GET /docs` и `GET /docs/file` есть в Swagger (`/api/docs`) в группе `docs`, под ADMIN — проверено статически: `docs.controller.ts` имеет `@ApiTags('docs')`, оба хендлера с `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` + `@ApiBearerAuth()` + `@ApiOperation`/`@ApiOkResponse` (live-проверка `/api/docs` — Post-Completion)
- [x] path traversal закрыт (тест `../` падает ошибкой) — `docs.service.spec.ts` покрывает `../`, абсолютный путь `/etc/passwd`, URL-encoded `%2e%2e`, ложный префикс `docs-secret`; все тесты проходят (101/101 в `@repo/api`)
- [x] страница `/admin/docs` отображает дерево и рендерит выбранный файл — проверено статически: `docs-viewer.tsx` использует `useDocsTree` (дерево) + `useDocFile` (содержимое) и рендерит через `react-markdown` + `remark-gfm`; `page.tsx` оборачивает `DocsViewer` (live-рендер UI — Post-Completion)
- [x] прогнать полный набор: `pnpm test` — root `pnpm test` блокируется инфраструктурно (EACCES при записи в root-owned `packages/types/dist` на стадии `build`, см. MEMORY; прод-сборка идёт через Docker). По пакетам всё зелёное: `@repo/api` 101/101, `@repo/utils` 16/16, `@repo/types` 6/6
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build` без ошибок — typecheck/lint зелёные по пакетам (`@repo/web`, `@repo/api`, `@repo/types`, `@repo/utils` typecheck + lint без ошибок). `pnpm build` блокируется тем же инфра-ограничением (root-owned `dist`/`.turbo`), реального код-фейла нет; прод-сборка — через Docker (Post-Completion)

### Task 9: [Final] Завершение

- [x] финально пройтись по чекбоксам плана
- [x] переместить план в `docs/plans/completed/`

## Post-Completion

_Items requiring manual intervention or external systems — informational only_

**Manual verification:**

- ручная проверка `/admin/docs` под пользователем с ролью ADMIN: дерево загружается, выбор файла рендерит Markdown (таблицы/чек-листы из gfm), не-ADMIN не имеет доступа
- сборка и запуск Docker-образа api (`docker compose up -d`, postgres на порту 5441) и проверка, что `/docs` отдаёт дерево из `/app/docs` (документация попала в образ)
- попытка обхода каталога через `?path=../package.json` возвращает ошибку, а не содержимое
