# 003. Аутентификация на фронте: next-auth v5 + Credentials

**Статус:** Принято

**Дата:** 2026-02-28

## Контекст

Веб-приложение на Next.js 15 должно поддерживать аутентификацию пользователей. Токены (access/refresh) выдаёт NestJS API. Фронту нужно:
- Хранить сессию между запросами (SSR и client)
- Защищать маршруты без round-trip к API на каждый запрос
- Обеспечить работу `auth()` в Server Components

## Рассмотренные варианты

**Вариант A: Самописный auth (cookie + middleware)**
- ✅ Полный контроль, без внешних зависимостей
- ❌ Нужно самостоятельно реализовать: хранение сессии, CSRF-защиту, refresh-логику
- ❌ Много boilerplate, высокий риск ошибок безопасности

**Вариант B: next-auth v4 (stable)**
- ✅ Стабильная версия, большая кодовая база решений
- ❌ Плохая поддержка App Router / Server Components
- ❌ Версия v4 фактически в maintenance mode

**Вариант C: next-auth v5 (beta) + Credentials** ✓
- ✅ Нативная поддержка App Router и Server Components
- ✅ Работает в Edge Runtime (middleware без Node.js)
- ✅ `auth()` доступна в Server Components, Route Handlers, Middleware
- ✅ JWT-сессии без серверного хранилища
- ❌ Версия beta — возможны breaking changes до stable
- ❌ Credentials provider не поддерживает автоматический refresh токенов

**Вариант D: Clerk / Auth0 / Supabase Auth**
- ✅ Managed решение, меньше кода
- ❌ Vendor lock-in
- ❌ Платная при масштабировании
- ❌ Не интегрируется с собственным NestJS API нативно

## Решение

Выбран **Вариант C: next-auth v5 (beta) с Credentials provider**.

Credentials provider используется потому что API-аутентификация (JWT от NestJS) не вписывается в OAuth-поток. Next-auth v5 выбран как единственный вариант с полноценной поддержкой App Router.

Сессия хранится в подписанном JWT (NEXTAUTH_SECRET), access-токен от API кладётся в сессию для использования в Server Components.

## Последствия

### Положительные
- `auth()` работает в Server Components без дополнительных запросов
- Middleware защищает маршруты на уровне Edge, без обращения к БД
- JWT-сессии не требуют Redis или БД на стороне Next.js

### Отрицательные / компромиссы
- Beta-статус: при обновлении next-auth возможны breaking changes — нужно проверять CHANGELOG
- Access-токен хранится в JWT сессии — при утечке NEXTAUTH_SECRET компрометируются и API-токены
- Credentials provider не поддерживает автоматический refresh: истёкший access-токен не обновляется автоматически

### Риски
- Версия 5.0 stable может потребовать миграции при выходе
- Хранение API access-токена в сессионном JWT — потенциальная проблема безопасности, требует проработки при production-использовании
