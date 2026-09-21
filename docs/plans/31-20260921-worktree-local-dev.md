# Локальный запуск проекта в параллельных worktree

## Overview

Issue #31. Сейчас проект нельзя поднять в свежем worktree: `pnpm dev` падает, потому что ни
`nest start --watch`, ни `next dev` не читают корневой `.env` (его подхватывают только скрипты
`db:*` через `dotenv-cli`). Плюс порты Postgres захардкожены в `docker-compose.yml`, из-за чего
`docker compose up` во второй копии падает с `Bind for 0.0.0.0:5444 failed: port is already
allocated`.

Цель — одна команда подготовки (`pnpm setup:worktree`), после которой в любой копии репозитория
`pnpm dev` поднимает рабочий стенд, и несколько копий работают одновременно, не мешая друг другу.

Схема стенда:

- **Postgres** — один общий контейнер на порту `5444`, у каждой копии своя БД
  `recommends_<slug>` (`slug` — имя папки worktree).
- **Порты** — своя пара на копию: основной checkout остаётся на 3000/3001, копии получают
  первую свободную пару начиная с 3010/3011.
- **Адрес в браузере** — `http://<slug>.localhost:<WEB_PORT>`. Cookies не изолируются по порту,
  поэтому на общем `localhost` вход в одной копии ломает сессию в другой; разные имена хостов
  это решают.
- **Серверные адреса** — `http://127.0.0.1:<PORT>`, см. «Адресация» ниже.
- **Процессы** — API и web запускаются локально через `pnpm dev`, в Docker остаётся только БД.

## Context (from discovery)

- `apps/api/package.json` — `dev: nest start --watch` без `dotenv`; `dotenv-cli` уже в
  devDependencies и используется в скриптах `db:*` (`dotenv -e ../../.env -- …`).
- `apps/web/package.json` — `dev: next dev --turbopack --port 3000`, порт захардкожен,
  `dotenv-cli` в зависимостях нет.
- `apps/api/src/config/env.ts` — zod-схема + `getEnv()`; `PORT` с дефолтом 3001, секреты
  `min(32)`, `process.exit(1)` при ошибке валидации. Тесты рядом: `*.spec.ts` (Jest + ts-jest,
  конфиг в `package.json`, `rootDir: src`).
- `apps/api/src/main.ts` — CORS-origin из `CORS_ORIGIN ?? NEXTAUTH_URL`, порт из `PORT`,
  `app.listen(port, '0.0.0.0')` (строка 61) — только IPv4.
- **Резолв `*.localhost`**: `getent hosts sandworm.localhost` возвращает `::1`, а `getent ahosts` —
  и `::1`, и `127.0.0.1`. Поскольку API слушает только IPv4, серверные запросы по slug-хосту
  зависели бы от порядка выбора семейства адресов. Поэтому серверные адреса фиксируются на
  `127.0.0.1`, а slug-хост используется только браузером.
- `apps/web/src/lib/env.ts` — `@t3-oss/env-nextjs`, `NEXTAUTH_SECRET` обязателен (`min(32)`),
  `API_URL` используется для server-side запросов.
- `apps/web/next.config.ts` — `output: 'standalone'`, `transpilePackages`; `allowedDevOrigins`
  отсутствует. Установлен Next **15.5.12** (в `package.json` указано `^15.1.6`), опция
  поддерживается.
- `next dev` читает порт из флага `--port` и из переменной `PORT` (commander `.env('PORT')`) —
  ту же переменную читает API, поэтому в `.env` нужны раздельные `API_PORT` и `WEB_PORT`.
- `docker-compose.yml` — сервис `db` (postgres:16-alpine, `5444:5432`, БД `recommends`), а также
  `api` и `web` с захардкоженными `3001:3001` и `3000:3000`; у `api` жёстко задан
  `DATABASE_URL: …@db:5432/recommends`. Compose автоматически читает корневой `.env`.
- `.env.example` — `DATABASE_URL` указывает на порт 5432 (реальный — 5444), `POSTGRES_DB="nexst"`
  расходится с `recommends` в compose.
- `packages/types` и `packages/utils` — точки входа указывают на `dist/`, у обоих есть
  `dev: tsc --watch`, и `turbo run dev` их запускает. Проблема не в отсутствии сборки, а в гонке:
  API стартует раньше первой эмиссии watch-сборки, и на чистом checkout падает на отсутствующем
  `dist/`. Задача `dev` в `turbo.json` не имеет `dependsOn: ["^build"]`.
- `apps/web/playwright.config.ts` и `e2e/helpers/api.ts` — адреса читаются из
  `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL`, `E2E_RSS_FEED_HOST`; менять тесты не нужно.
  Mock Telegram слушает фиксированный порт 4310, поэтому параллельный прогон e2e в двух копиях
  невозможен.
- `.github/workflows/ci.yml` — шаги lint → typecheck → test → build на `node-version: '20'`, при
  этом `.nvmrc` и `engines` требуют 22. Корневой `test` — `turbo run test`, то есть работает
  только по workspace-пакетам.
- Каталога `scripts/` в проекте нет — создаётся этим планом; он вне `turbo run lint/test`, и
  корневого flat-конфига ESLint тоже нет.
- `.gitignore` игнорирует `.env` и `.env.*`, кроме `.env.example`.
- `docs/DOCUMENTATION.md` задаёт структуру guide: Название → Предварительные требования → Шаги →
  Проверка → Частые проблемы; и требует обновлять `CLAUDE.md` при изменении команд и составе
  workspace.

## Development Approach

- **testing approach**: Regular (код сначала, тесты после)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- e2e-тесты — отдельный последний пункт (после всех остальных задач), выполняется в самом конце
- конфигурационные задачи (package.json, compose, next.config, CI) автотестами не покрываются —
  для них в чеклисте явная ручная проверка запуском
- обёртка `scripts/setup-worktree.mjs` автотестами не покрывается сознательно: вся чистая логика
  вынесена в `scripts/lib/` и протестирована, в обёртке остаются только побочные эффекты
- run tests after each change
- maintain backward compatibility

## Testing Strategy

- **unit tests**: Jest + ts-jest для `apps/api` (по образцу существующих `*.spec.ts`);
  для скриптов — встроенный раннер `node --test` по явному шаблону файлов
- **e2e tests**: Playwright — отдельная последняя задача: прогон существующего набора на
  нестандартных портах, чтобы подтвердить работоспособность стенда

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

1. **Загрузка `.env` в dev** — оба приложения запускаются через `dotenv-cli`, как уже сделано в
   скриптах `db:*`. Единый источник переменных — корневой `.env`.
2. **Раздельные порты** — в `.env` появляются `API_PORT` и `WEB_PORT`; dev-скрипты подставляют
   их каждому приложению (`PORT=${API_PORT:-3001}` для Nest, `--port ${WEB_PORT:-3000}` для Next).
3. **Скрипт подготовки** — `scripts/setup-worktree.mjs` на чистом Node без зависимостей. Чистая
   логика (slug, выбор портов, сборка содержимого `.env`) вынесена в `scripts/lib/` и покрыта
   тестами; побочные эффекты остаются в тонкой обёртке.
4. **Фиксированные dev-секреты** — генерируемый `.env` содержит те же заглушки, что и
   `.env.example`. Чтобы они не уехали в продакшен, `env.ts` при `NODE_ENV=production`
   отклоняет известные dev-значения секретов API.
5. **Изоляция сессий** — браузерный адрес `<slug>.localhost`; `allowedDevOrigins` в
   `next.config.ts` разрешает dev-запросы с этих адресов.
6. **Параметризация compose** — порты через переменные с текущими значениями по умолчанию.

### Ключевые решения

- **Адресация раздельная.** Браузерные переменные (`NEXTAUTH_URL`, `WEB_URL`,
  `NEXT_PUBLIC_API_URL`) указывают на `<slug>.localhost`, серверные (`API_URL`,
  `PLAYWRIGHT_API_URL`) — на `127.0.0.1`. Причина в Context: slug-хост резолвится в `::1`, а API
  слушает `0.0.0.0`. Альтернатива «слушать `::` в `main.ts`» отвергнута: меняет прод-поведение
  ради удобства разработки.
- **CORS.** `CORS_ORIGIN` генерируется списком из двух адресов (`<slug>.localhost` и `localhost`
  на том же порту), иначе привычный заход на `localhost:<WEB_PORT>` даёт молчаливые ошибки CORS.
- **Первая свободная пара портов**, а не хеш от имени: гарантирует отсутствие конфликтов.
  Свободной считается пара, которая и не слушается в системе, и не записана в `.env` соседних
  worktree (их список даёт `git worktree list`) — иначе две копии, подготовленные до первого
  запуска, получили бы одинаковые порты.
- **Границы worktree-схемы.** Она распространяется только на локальный запуск и на сервис `db` в
  compose. Полный стек `docker compose up` (сервисы `api`/`web`) остаётся на своей БД `recommends`
  и своих дефолтных портах — это фиксируется в ADR и гайде, чтобы сгенерированный `.env` не
  создавал ложных ожиданий.
- **`.env` не перезаписывается** при повторном запуске: скрипт сообщает текущие параметры и
  выходит; перегенерация — только по явному флагу `--force`.
- **БД создаёт `prisma migrate dev`**, отдельный вызов `psql` не нужен.
- **Скрипт не поднимает Postgres сам**: проверяет доступность порта БД и подсказывает
  `docker compose up -d db`, если контейнера нет. Так исключён случайный второй контейнер.

## Technical Details

Переменные, которые скрипт пишет в `.env` (остальные копируются из `.env.example`):

| Переменная                | Значение                                                                                   | Комментарий                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `DATABASE_URL`            | `postgresql://postgres:postgres@127.0.0.1:${DB_HOST_PORT}/recommends_<slug>?schema=public` | своя БД на копию                                               |
| `DB_HOST_PORT`            | `5444`                                                                                     | порт общего контейнера Postgres                                |
| `API_PORT` / `WEB_PORT`   | первая свободная пара                                                                      | основной checkout — 3001/3000, копии — 3011/3010, 3021/3020, … |
| `NEXTAUTH_URL`, `WEB_URL` | `http://<slug>.localhost:${WEB_PORT}`                                                      | адрес для браузера                                             |
| `NEXT_PUBLIC_API_URL`     | `http://<slug>.localhost:${API_PORT}`                                                      | запросы из браузера                                            |
| `API_URL`                 | `http://127.0.0.1:${API_PORT}`                                                             | server-side запросы Next                                       |
| `CORS_ORIGIN`             | `http://<slug>.localhost:${WEB_PORT},http://localhost:${WEB_PORT}`                         | оба варианта захода                                            |

`slug` — имя папки worktree, приведённое к нижнему регистру, с заменой недопустимых для имени БД
и имени хоста символов на `_` и `-` соответственно. Для основного checkout (`recommends`)
сохраняется поведение по умолчанию: БД `recommends`, хост `localhost`, порты 3000/3001.

## What Goes Where

- **Implementation Steps** — изменения в кодовой базе: скрипты, конфиги, CI, тесты, документация.
- **Post-Completion** — действия вне репозитория: ручная проверка в браузере, уборка контейнеров.

## Implementation Steps

### Task 1: Загрузка `.env` и раздельные порты в dev-скриптах

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `turbo.json`

- [x] в `apps/api/package.json` заменить `dev` на `dotenv -e ../../.env -- sh -c 'PORT=${API_PORT:-3001} nest start --watch'`
- [x] добавить `dotenv-cli` в devDependencies `apps/web` и заменить `dev` на `dotenv -e ../../.env -- sh -c 'next dev --turbopack --port ${WEB_PORT:-3000}'`
- [x] в `turbo.json` добавить задаче `dev` зависимость `dependsOn: ["^build"]` и проверить, что turbo не конфликтует с persistent-задачами `tsc --watch` в пакетах
- [x] проверить вручную: `pnpm dev` поднимает API и web на портах из `.env`, а без `.env` — на дефолтных 3001/3000
- [x] проверить вручную, что `dotenv-cli` не затирает переменные, заданные в шелле (важно для прогона с `NODE_ENV=test`)
- [x] прогнать `pnpm test` — существующие тесты должны проходить

⚠️ Уточнение по факту проверки: с временным `.env` (3011/3010) поднялись оба приложения
(`/health` → 200, web → 307 на `/login`). Без `.env` web стартует на дефолтном 3000, а API
падает на валидации `env.ts` (нет `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) — это
ожидаемое поведение и причина существования `pnpm setup:worktree` из Task 4; подстановка
дефолтного порта 3001 при этом работает.

### Task 2: Защита от dev-секретов в продакшене

**Files:**

- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/config/env.spec.ts`

- [x] вынести список известных dev-заглушек (значения секретов из `.env.example`) в константу
- [x] в `superRefine` добавить правило: при `NODE_ENV=production` значения `JWT_SECRET` и `JWT_REFRESH_SECRET` из списка заглушек невалидны
- [x] написать тесты: заглушка при `production` отклоняется, при `development` проходит
- [x] написать тесты: реальный секрет проходит при любом `NODE_ENV`
- [x] проверить вручную, что dev-стек `docker compose up` с дефолтными заглушками продолжает работать (проверено статически через `docker-compose.yml` и `docker/api.dev.Dockerfile`: реальный `docker compose up` пропущен — порт 5444 занят чужим контейнером и `.env` ещё не сгенерирован, он появится в Task 4)
- [x] запустить `pnpm --filter @repo/api test` — тесты должны пройти

⚠️ Границы: guard покрывает только секреты API. `NEXTAUTH_SECRET` в `apps/web/src/lib/env.ts`
остаётся без проверки, а `docker-compose.prod.yml` и так требует все секреты через `${VAR:?…}` —
реальная зона действия guard'а это прямой запуск `node dist/main`. Не переоценивать эффект в ADR.

⚠️ Уточнение по факту реализации: dev-стек `docker compose up` не затронут — сервис `api` в
`docker-compose.yml` не выставляет `NODE_ENV`, а `docker/api.dev.Dockerfile` не содержит
`NODE_ENV=production`, поэтому заглушки там продолжают проходить валидацию. Значение
`NODE_ENV=production` встречается только в `docker-compose.prod.yml` и `docker/api.Dockerfile`,
где секреты и так обязательны через `${VAR:?…}`.

### Task 3: Чистая логика подготовки worktree

**Files:**

- Create: `scripts/lib/worktree-env.mjs`
- Create: `scripts/lib/worktree-env.test.mjs`

- [ ] реализовать `toSlug(dirName)` — нормализация имени папки для имени БД и имени хоста
- [ ] реализовать `resolveDatabaseName(slug)` с особым случаем для основного checkout
- [ ] реализовать `pickPortPair(isPortFree, startFrom, reserved)` — первая пара, свободная и в системе, и среди занятых соседними копиями
- [ ] реализовать `buildEnvContent(example, params)` — подстановка значений в содержимое `.env.example` без потери остальных ключей и комментариев
- [ ] написать тесты на `toSlug` (обычное имя, дефисы и заглавные, недопустимые символы)
- [ ] написать тесты на `resolveDatabaseName` (копия и основной checkout)
- [ ] написать тесты на `pickPortPair`: первая пара свободна; первые две заняты в системе; пара свободна в системе, но занята соседним `.env`; порты кончились
- [ ] написать тесты на `buildEnvContent` (значения подставлены, прочие ключи и комментарии сохранены)
- [ ] запустить `node --test scripts/lib/*.test.mjs` — тесты должны пройти

### Task 4: Команда `pnpm setup:worktree` и её место в CI

**Files:**

- Create: `scripts/setup-worktree.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] реализовать обёртку: определить имя worktree, собрать занятые порты из `.env` соседних копий (`git worktree list`), проверить доступность порта БД и подсказать `docker compose up -d db`
- [ ] сгенерировать `.env` из `.env.example` через `buildEnvContent`; при существующем `.env` — вывести текущие параметры и выйти без изменений, перегенерация по `--force`
- [ ] последовательно выполнить: сборку `@repo/types` и `@repo/utils`, `db:generate`, `db:migrate`, `db:seed`
- [ ] по завершении напечатать адрес стенда и учётные данные seed-пользователя, взяв их из `apps/api/prisma/seed.ts` (не дублировать константы)
- [ ] добавить в корневой `package.json` скрипты `setup:worktree` и `test:scripts` (`node --test scripts/lib/*.test.mjs`)
- [ ] в `.github/workflows/ci.yml` поднять `node-version` до 22 (совпадает с `.nvmrc` и `engines`) и добавить шаг запуска `pnpm test:scripts`
- [ ] подключить `scripts/` к проверкам: минимальный корневой ESLint flat-config либо явная фиксация отказа в ADR-016
- [ ] проверить вручную: в чистой копии команда доводит стенд до рабочего состояния, повторный запуск ничего не ломает
- [ ] запустить `pnpm test:scripts` — тесты должны пройти

### Task 5: Изоляция сессий и параметризация окружения

**Files:**

- Modify: `apps/web/next.config.ts`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] добавить в `next.config.ts` опцию `allowedDevOrigins` с адресами `*.localhost`
- [ ] вынести порты в `docker-compose.yml` в переменные (`DB_HOST_PORT`, `API_PORT`, `WEB_PORT`) с текущими значениями по умолчанию
- [ ] привести `.env.example` в соответствие: порт БД 5444, `POSTGRES_DB="recommends"` вместо `"nexst"`, новые переменные (`API_PORT`, `WEB_PORT`, `DB_HOST_PORT`, `CORS_ORIGIN`) с комментариями
- [ ] проверить вручную: две копии работают одновременно, вход в одной не сбрасывает сессию в другой
- [ ] проверить вручную: `docker compose up -d db` работает и без `.env`, и со сгенерированным `.env` копии
- [ ] проверить вручную: заход на `localhost:<WEB_PORT>` не упирается в CORS благодаря списку в `CORS_ORIGIN`
- [ ] прогнать `pnpm test` — существующие тесты должны проходить

### Task 6: Документация

**Files:**

- Create: `docs/adr/016-worktree-local-dev.md`
- Create: `docs/guides/worktree-dev.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/guides/development.md`
- Modify: `docs/guides/getting-started.md`
- Modify: `README.md`

- [ ] написать ADR-016 по формату из `docs/DOCUMENTATION.md`: схема стенда, рассмотренные варианты (общая БД против контейнера на копию, хеш портов против первой свободной пары, slug-хост против правки `listen`), последствия и границы (compose-стек `api`/`web` вне схемы)
- [ ] добавить ADR-016 в таблицу-индекс `docs/adr/README.md`
- [ ] написать гайд `worktree-dev.md` строго по структуре из `docs/DOCUMENTATION.md` (Название → Предварительные требования → Шаги → Проверка → **Частые проблемы**)
- [ ] в разделе «Частые проблемы» описать: CORS при заходе на неожиданный хост, занятый порт БД, отсутствие контейнера, одновременный прогон e2e (общий mock-порт 4310)
- [ ] в разделе «Проверка» описать ручной сценарий: логин seed-пользователем, ссылки из писем в логах API при `MAIL_TRANSPORT=json`
- [ ] исправить в `README.md` и `getting-started.md` неверные утверждения про автоматическую загрузку `.env` и порт БД, добавить шаг `pnpm setup:worktree`
- [ ] в `development.md` обновить раздел «Запуск» (порты берутся из `.env`) и сослаться на новый гайд

### Task 7: E2E-проверка стенда

**Files:**

- Modify: `docs/guides/worktree-dev.md` (при расхождении инструкции с фактическим прогоном)

- [ ] поднять стенд в текущей копии на нестандартных портах
- [ ] прогнать `pnpm --filter @repo/web test:e2e` с `PLAYWRIGHT_BASE_URL` (slug-хост) и `PLAYWRIGHT_API_URL` (`127.0.0.1`)
- [ ] убедиться, что тесты с mock-серверами проходят с учётом `NODE_ENV=test`, `TELEGRAM_PREVIEW_BASE_URL` и `E2E_RSS_FEED_HOST`
- [ ] зафиксировать в гайде фактические команды прогона и ограничение «не гонять e2e в двух копиях одновременно»
- [ ] при падениях — исправить причину и повторить прогон до полного прохождения

### Task 8: Verify acceptance criteria

- [ ] сверить реализацию с критериями приёмки issue #31
- [ ] обновить в issue #31 критерий про «новые секреты»: принято решение использовать фиксированные dev-заглушки плюс guard из Task 2 — зафиксировать отклонение там же и в ADR-016
- [ ] проверить краевые случаи: нет `.env.example`, порты кончились, контейнер БД не запущен, повторный запуск скрипта, соседняя копия заняла пару портов
- [ ] запустить полный набор: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:scripts`
- [ ] запустить e2e: `pnpm --filter @repo/web test:e2e`
- [ ] проверить, что основной checkout продолжает работать без изменений в своём `.env`

### Task 9: [Final] Update documentation

- [ ] обновить `CLAUDE.md`: раздел Common Commands (`pnpm setup:worktree`, `pnpm test:scripts`) и Repository Structure (каталог `scripts/`)
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

_Действия вне репозитория — без чекбоксов, информационно_

**Ручная проверка:**

- открыть стенд в браузере по адресу `http://<slug>.localhost:<WEB_PORT>`, войти под
  `admin@example.com` / `admin123456`, пройти основные сценарии (источники, настройки интересов)
- запустить вторую копию параллельно и убедиться, что сессии независимы

**Уборка Docker:**

- остановить неудавшийся запуск в соседней копии: `docker compose down` из папки `oystercatcher`
- удалить давно остановленные контейнеры прошлых проектов (`nexst-template*`, `personal-rss*`,
  `flashlang-*`) — по решению разработчика

**На будущее:**

- динамический порт для mock-сервера Telegram (сейчас фиксированный 4310) — снимет запрет на
  параллельный прогон e2e
- если копии начнут запускаться на удалённых хостах или в контейнерах, рассмотреть
  per-workspace environment recipes в Orca (`orca.yaml`, `environmentRecipes`)
