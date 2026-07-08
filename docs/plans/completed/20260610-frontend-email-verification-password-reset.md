# Фронтенд: верификация email и восстановление пароля

## Overview

Бэкенд email-флоу уже реализован (issue #25): эндпоинты `POST /auth/verify-email`,
`/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, таблица
одноразовых токенов `verification`, `VerifiedGuard`, рассылка писем через `mailer`
(в dev — `jsonTransport`). Письма содержат ссылки на фронтенд:

- `${WEB_URL}/verify-email?token=...`
- `${WEB_URL}/reset-password?token=...`

Этих страниц на фронте ещё нет — план закрывает фронтенд-часть флоу:

1. **/verify-email** — подтверждение email по токену из письма (авто-вызов, статусы, повтор).
2. **/forgot-password** — запрос ссылки сброса пароля по email.
3. **/reset-password** — установка нового пароля по токену из письма.
4. **Resend + баннер** — повторная отправка письма верификации и баннер «email не
   подтверждён» в дашборде с CTA на повторную отправку.

Ценность: завершённый сквозной UX регистрации/восстановления, страницы из писем
перестают вести на 404, пользователь видит статус подтверждения почты.

## Context (from discovery)

**Файлы/компоненты, вовлечённые в задачу:**

- `apps/web/src/api/auth.api.ts` — доменные функции auth (сейчас: login/register/refresh/logout) — расширяем.
- `apps/web/src/app/(auth)/` — группа публичных auth-страниц (login, register) — добавляем новые.
- `apps/web/src/components/auth/` — формы на `ZodForm`/`TextField` (login-form, register-form) — образец стиля.
- `apps/web/src/auth.ts` — next-auth, `decodeAccessToken` уже читает claims токена.
- `apps/web/src/types/next-auth.d.ts` — типы сессии.
- `apps/web/src/app/(dashboard)/layout.tsx` — серверный layout с `auth()`, место для баннера.
- `apps/api/src/auth/auth.service.ts` — `generateTokens` формирует payload `{ sub, email, role }`.
- `apps/api/src/mailer/mailer.service.ts` — формат ссылок `/verify-email`, `/reset-password`.
- `packages/types/src/auth.ts` — Zod-схемы DTO уже есть: `VerifyEmailDtoSchema`,
  `ResendVerificationDtoSchema`, `ForgotPasswordDtoSchema`, `ResetPasswordDtoSchema`.

**Найденные паттерны:**

- Формы: `<ZodForm schema={...} onSubmit={...}>` + `<TextField name=... />` из `@ssortia/shadcn-zod-bridge`.
- Карточки: `Card/CardHeader/CardTitle/CardDescription/CardContent` из `@/components/ui/card`.
- Ошибки сервера: локальный `useState<string|null>` + `<p className="text-destructive text-sm">`.
- HTTP: `api.post` из `@/lib/api`, ошибки — `ApiError` со `status`. Эндпоинты `204` возвращают `undefined`.
- Защита роутов — в layout через `auth()`, а не в middleware (в `auth.ts` нет `authorized`-callback),
  поэтому страницы группы `(auth)` публичны по построению — **изменения middleware не требуются**.

**Зависимости:**

- Schemas — единый источник правды в `@repo/types` (переиспользуем, новых не вводим).
- Для баннера нужен признак `emailVerified`, которого нет в claims токена — добавляем в payload на бэке
  и пробрасываем в сессию next-auth (контролируемое небольшое изменение).
- На фронте нет тест-раннера — Playwright настраиваем с нуля.

## Development Approach

- **testing approach**: Regular (сначала код, затем тесты) — выбрано пользователем.
- Тесты на фронте — **Playwright e2e** (юнит-инфраструктуры в `apps/web` нет и не вводим).
- Одноразовый токен в e2e получаем через **test-only эндпоинт** `GET /auth/__test/last-token`
  (доступен только при `NODE_ENV=test`): plain-токен невозможно достать из БД, там хранится только
  `sha256`-хэш (`verification.service.ts`), поэтому захватываем токен в памяти в момент выпуска письма.
- **Инфраструктура e2e bootstrap-ится в Task 8, сами тесты — в Task 9** (осознанное отступление от
  правила «e2e в той же задаче, что UI»: на фронте нет тест-раннера, его сначала нужно поднять).
- Завершать каждую задачу полностью перед переходом к следующей; маленькие сфокусированные изменения.
- **CRITICAL**: e2e-тесты, покрывающие новый UI, добавляются в той же задаче, что и UI; перед
  переходом к следующей задаче они должны проходить.
- **CRITICAL**: обновлять этот файл плана при изменении объёма работ.
- Комментарии в коде — только «почему» в неочевидных местах, код самодокументируем (правило 14 CLAUDE.md).

## Testing Strategy

- **unit tests**: фронтенд-юнитов нет (инфраструктура отсутствует) — не вводим в рамках этой задачи.
- **e2e tests (Playwright, новая инфраструктура в `apps/web`)**:
  - флоу верификации: регистрация → переход по `/verify-email?token=...` → успех → доступ к защищённому ресурсу;
  - повторная отправка письма верификации;
  - флоу сброса: `/forgot-password` → `/reset-password?token=...` → вход новым паролем;
  - негативные кейсы: невалидный/повторно использованный токен → корректный статус ошибки в UI;
  - токены берём через test-only эндпоинт `GET /auth/__test/last-token` (см. Task 8).
  - **внимание на throttling**: эндпоинты resend/forgot могут быть под `@Throttle` → в e2e не слать
    запросы залпом, иначе 429.
  - e2e проходят перед переходом к следующей задаче (тот же уровень строгости, что и юниты).
- **backend**: существующие `apps/api/test/email-flow.e2e-spec.ts` остаются зелёными; при изменении
  payload токена (Task 6) — обновить/проверить связанные backend-тесты.

## Progress Tracking

- `[x]` — выполнено; `➕` — новая задача по ходу; `⚠️` — блокер.
- Держать план в синхроне с фактической работой.

## Solution Overview

- Страницы кладём в группу `app/(auth)/` (публичная, без layout-guard) тем же стилем, что login/register.
- Логику API выносим в `api/auth.api.ts` (чистые async-функции поверх `api.post`), UI — в `components/auth/`.
- `/verify-email` и `/reset-password` читают `token` из `searchParams`; при отсутствии токена — явное
  сообщение об ошибке, без запроса к API.
- Для `/reset-password` вводим локальную форм-схему `{ password }` (поле в форме одно), а `token`
  подмешиваем при сабмите к `ResetPasswordDtoSchema`-совместимому телу.
- Признак `emailVerified` добавляем в JWT payload на бэке **на всех путях выпуска** (`login`, и через
  него `register`; `refresh` уже перечитывает юзера из БД — значит после верификации признак станет
  свежим на ближайшем refresh), читаем в `authorize`, кладём в сессию next-auth, используем для баннера.
  - **Важно про staleness**: после клика по ссылке верификации текущий access-token не перевыпускается
    мгновенно — баннер исчезнет после refresh access-токена (или повторного входа). Немедленного
    сброса баннера без re-login/`session.update()` не закладываем; это зафиксировано в критериях.
- Нейтральные формулировки для forgot/resend (не раскрываем существование email) — зеркалят поведение бэка.

## Technical Details

- **Эндпоинты (все `204 No Content`)**:
  - `POST /auth/verify-email` `{ token }`
  - `POST /auth/resend-verification` `{ email }`
  - `POST /auth/forgot-password` `{ email }`
  - `POST /auth/reset-password` `{ token, password }`
- **Схемы** (из `@repo/types`): `VerifyEmailDtoSchema`, `ResendVerificationDtoSchema`,
  `ForgotPasswordDtoSchema`, `ResetPasswordDtoSchema`.
- **Обработка ошибок UI**: бэк на любой невалидный/просроченный/использованный токен бросает
  `BadRequestException` → **только HTTP 400** (404/410 в этом флоу нет). UI ветвит по `status === 400`
  → сообщение «ссылка недействительна или устарела» + ссылка на повтор; прочее → «Что-то пошло не так».
  Различать «использован» / «просрочен» по статусу нельзя (оба 400), на текст сообщения не завязываемся.
- **Маршруты-ссылки из писем** должны совпадать с `mailer.service.ts`: `/verify-email`, `/reset-password`.

## What Goes Where

- **Implementation Steps** (`[ ]`): код страниц/форм/api, изменение payload токена, типы сессии,
  Playwright-инфраструктура и e2e-тесты, документация.
- **Post-Completion** (без чекбоксов): ручная проверка реальной доставки писем по SMTP, прогон e2e в CI.

## Implementation Steps

### Task 1: Расширить authApi функциями email-флоу

**Files:**

- Modify: `apps/web/src/api/auth.api.ts`

- [x] добавить `verifyEmail(token: string)` → `api.post<void>('/auth/verify-email', { token })`
- [x] добавить `resendVerification(email: string)` → `api.post<void>('/auth/resend-verification', { email })`
- [x] добавить `forgotPassword(email: string)` → `api.post<void>('/auth/forgot-password', { email })`
- [x] добавить `resetPassword(token: string, password: string)` → `api.post<void>('/auth/reset-password', { token, password })`
- [x] типы аргументов брать из `@repo/types` (`ResetPasswordDto` и т.п.), не дублировать формы
- [x] `pnpm --filter @repo/web typecheck` и `lint` — без ошибок (e2e появится в Task 8–9)

### Task 2: Страница и форма /forgot-password

**Files:**

- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/components/auth/forgot-password-form.tsx`
- Modify: `apps/web/src/components/auth/login-form.tsx` (ссылка «Забыли пароль?»)

- [x] `forgot-password-form.tsx`: `ZodForm` по `ForgotPasswordDtoSchema`, одно поле email
- [x] сабмит вызывает `authApi.forgotPassword`; при успехе — нейтральное сообщение
      «Если адрес зарегистрирован, мы отправили ссылку для сброса»
- [x] обработка ошибки сети/сервера через `ApiError` + `text-destructive`
- [x] `page.tsx` в стиле login/register (Card по центру), `metadata.title`
- [x] добавить ссылку «Забыли пароль?» в `login-form.tsx`
- [x] `typecheck` + `lint` зелёные

### Task 3: Страница и форма /reset-password

**Files:**

- Create: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Create: `apps/web/src/components/auth/reset-password-form.tsx`

- [x] `page.tsx` читает `searchParams.token`; при отсутствии — рендерит сообщение об ошибке без формы
- [x] `reset-password-form.tsx`: принимает `token` пропсом, форм-схема `z.object({ password: z.string().min(8) })`,
      одно поле password (тип password)
- [x] сабмит вызывает `authApi.resetPassword(token, password)`; при успехе — сообщение + ссылка на `/login`
- [x] обработка `ApiError`: `status === 400` — «ссылка недействительна или устарела», ссылка на `/forgot-password`
- [x] `metadata.title`, стиль Card как у остальных
- [x] `typecheck` + `lint` зелёные

### Task 4: Страница /verify-email с авто-подтверждением

**Files:**

- Create: `apps/web/src/app/(auth)/verify-email/page.tsx`
- Create: `apps/web/src/components/auth/verify-email-status.tsx`

- [x] `page.tsx` читает `searchParams.token` и передаёт в клиентский компонент
- [x] `verify-email-status.tsx` (`'use client'`): при монтировании вызывает `authApi.verifyEmail(token)`
- [x] **защита от двойного вызова**: `useRef`-флаг, чтобы под React StrictMode (dev двойной mount)
      запрос не ушёл дважды и не перевёл уже успешный статус в ошибку (`consume` одноразовый → 2-й = 400)
- [x] состояния: `loading` / `success` (ссылка на `/login`) / `error` (с кнопкой «Отправить письмо повторно»)
- [x] ошибка только по `status === 400` и сетевым сбоям; при отсутствии токена — сразу error, без запроса
- [x] кнопка повтора ведёт на UI resend из Task 5 (или инлайн-форма по email)
- [x] `typecheck` + `lint` зелёные

### Task 5: Повторная отправка письма верификации (resend UI)

**Files:**

- Create: `apps/web/src/components/auth/resend-verification-form.tsx`
- Modify: `apps/web/src/components/auth/verify-email-status.tsx` (использование формы при ошибке)
- Modify: `apps/web/src/components/auth/login-form.tsx` (ссылка «Не пришло письмо?») — опционально

- [x] `resend-verification-form.tsx`: `ZodForm` по `ResendVerificationDtoSchema`, поле email
- [x] сабмит вызывает `authApi.resendVerification`; нейтральное сообщение об успехе
- [x] встроить форму/CTA в состояние ошибки `verify-email-status.tsx`
- [x] `typecheck` + `lint` зелёные

### Task 6: Признак emailVerified в JWT и сессии next-auth

**Files:**

- Modify: `apps/api/src/auth/auth.service.ts` (`generateTokens` + вызовы в `login`/`refresh`)
- Modify: `apps/web/src/auth.ts` (`AccessTokenClaims`, проброс в user/jwt/session)
- Modify: `apps/web/src/types/next-auth.d.ts` (поле `emailVerified` в Session/User)
- Modify: `apps/api/test/email-flow.e2e-spec.ts` и `apps/api/src/auth/*.spec.ts` (если декодируют payload)

- [x] добавить параметр `emailVerified` в `generateTokens` и включить в payload
- [x] прокинуть `user.emailVerified` в `generateTokens` из **обоих** мест: `login` и `refresh`
      (refresh перечитывает юзера из БД → после верификации признак станет свежим на ближайшем refresh)
- [x] обновить `AccessTokenClaims` и `authorize` в `auth.ts`, прокинуть в jwt- и session-callbacks
- [x] расширить типы next-auth полем `isEmailVerified: boolean` (имя `emailVerified` зарезервировано
      next-auth под `Date | null` — слияние деклараций давало конфликт типов; читать `session.user.isEmailVerified`)
- [x] **обязательно** обновить backend-тесты, проверяющие содержимое токена/сессии
- [x] `pnpm --filter @repo/api test` и `--filter @repo/web typecheck` зелёные

### Task 7: Баннер «email не подтверждён» в дашборде

**Files:**

- Create: `apps/web/src/components/auth/email-verification-banner.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [x] компонент-баннер: показывается, если `session.user.emailVerified === false`
- [x] текст + кнопка/ссылка «Отправить письмо повторно» (переиспользует resend из Task 5)
- [x] вставить баннер в `(dashboard)/layout.tsx` над `main`
- [x] учесть staleness: баннер исчезает после refresh access-токена/повторного входа (не мгновенно
      после верификации) — это ожидаемое поведение, не баг
- [x] `typecheck` + `lint` зелёные

### Task 8: Test-only эндпоинт токена + инфраструктура Playwright e2e

**Files:**

- Create: `apps/api/src/auth/test-token.store.ts` (in-memory хранилище последнего plain-токена)
- Modify: `apps/api/src/mailer/mailer.service.ts` (при выпуске письма класть `{ to, type, token }` в store — только в test/json режиме)
- Modify: `apps/api/src/auth/auth.controller.ts` (`GET /auth/__test/last-token`, отдаётся только при `NODE_ENV=test`)
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/helpers/verification-token.ts`
- Modify: `apps/web/package.json` (devDeps `@playwright/test`, скрипт `test:e2e`)
- Modify: `turbo.json` (опционально: задача `test:e2e`)

- [x] `test-token.store.ts`: простое in-memory хранилище (Map по email+type → последний plain-токен)
- [x] записывать выпущенный токен в store в `auth.service.ts` (в `sendVerificationEmail`/`forgotPassword`),
      гейт по `NODE_ENV=test` — внутри самого store, независимо от транспорта писем
      (отступление от плана: чище держать тестовую логику в auth-домене, а не в mailer)
- [x] эндпоинт `GET /auth/__test/last-token?email=&type=`: при `NODE_ENV !== 'test'` → 404/отключён
- [x] установить `@playwright/test`, добавить скрипт `test:e2e`
- [x] `playwright.config.ts`: baseURL на web (3000); поднятие стенда web+api+postgres согласовать с
      окружением проекта (сборка через Docker, postgres на порту 5441 — host-сборка падает с EACCES)
- [x] хелпер `verification-token.ts`: HTTP-запрос к `GET /auth/__test/last-token`, возвращает plain-токен для URL
- [x] подтвердить, что инфраструктура запускается (пустой smoke-тест проходит)
- [x] зафиксировать в README/гайде команду запуска e2e и требование `NODE_ENV=test`

### Task 9: Playwright e2e-тесты email-флоу

**Files:**

- Create: `apps/web/e2e/email-verification.spec.ts`
- Create: `apps/web/e2e/password-reset.spec.ts`

- [x] верификация: регистрация → токен из `/auth/__test/last-token` → открыть `/verify-email?token=...` →
      success; verified-статус подтверждается (баннер очищается после refresh/повторного входа)
- [x] resend: `/verify-email` без/с невалидным токеном → ошибка (400) → форма повтора отправляет письмо
- [x] сброс: `/forgot-password` отправка email → токен из эндпоинта → `/reset-password?token=...` →
      новый пароль → вход новым паролем работает
- [x] негатив: повторно использованный/невалидный reset-токен → 400 → корректное сообщение об ошибке в UI
- [x] прогнать `pnpm --filter @repo/web test:e2e` — все тесты зелёные перед следующей задачей

### Task 10: Verify acceptance criteria

- [x] все 4 экрана (verify-email, forgot-password, reset-password, resend) реализованы и доступны публично
- [x] ссылки из писем (`/verify-email`, `/reset-password`) совпадают с `mailer.service.ts`
- [x] баннер корректно реагирует на `emailVerified`
- [x] обработаны краевые случаи: нет токена, невалидный/использованный токен, ошибка сети
- [x] полный прогон: per-package `@repo/api` (typecheck/lint/78 тестов) и `@repo/web` (typecheck/lint) —
      зелёные. Корневой `pnpm lint`/`typecheck` падает на `@repo/types#build` из-за env (host-сборка
      EACCES, `dist` принадлежит root — сборка через Docker); это не связано с изменениями.
- [x] e2e: `pnpm --filter @repo/web test:e2e` — 4/4 зелёные (стенд с `NODE_ENV=test`)

### Task 11: [Final] Документация

- [x] обновить `docs/guides/email-verification-and-password-reset.md` фронтенд-частью (страницы, маршруты, баннер)
- [x] обновить список фич в `README.md` (фронтенд email-флоу)
- [x] при новом паттерне (Playwright e2e в web) — отразить в `CLAUDE.md`/README команду запуска
- [x] перенести этот план в `docs/plans/completed/`

## Post-Completion

_Только информационно, без чекбоксов_

**Ручная проверка:**

- проверить реальную доставку писем через SMTP-транспорт (вне dev `jsonTransport`) и кликабельность ссылок.
- кросс-браузерная проверка форм, состояния focus/disabled при сабмите.

**Внешние системы:**

- включить Playwright e2e в `.github/workflows/ci.yml` (поднятие web+api+postgres с `NODE_ENV=test`,
  установка браузеров) — при желании держать e2e в CI; иначе оставить как локальную проверку.
- убедиться, что в окружении задан `WEB_URL`, указывающий на фронтенд.

**Безопасность:**

- `GET /auth/__test/last-token` — строго dev/test-only: эндпоинт обязан быть недоступен при
  `NODE_ENV=production` (проверить, что в проде возвращает 404 и не регистрируется в Swagger).
