# Начало работы

**Цель:** развернуть проект локально с нуля — от клонирования до работающего логина.

## Предварительные требования

| Инструмент | Минимальная версия | Проверить   |
| ---------- | ------------------ | ----------- |
| Node.js    | 22                 | `node -v`   |
| pnpm       | 9                  | `pnpm -v`   |
| Docker     | 24                 | `docker -v` |
| Git        | любая              | `git -v`    |

Установить pnpm, если не установлен:

```bash
npm install -g pnpm
```

## Шаги

### 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd recommends
```

### 2. Установить зависимости

```bash
pnpm install
```

### 3. Запустить базу данных

```bash
docker compose up -d db
```

Контейнер Postgres публикует порт **5444** на хосте (внутри контейнера — стандартный 5432).

Проверить, что контейнер запустился:

```bash
docker compose ps
# db должен быть в статусе "healthy"
```

### 4. Подготовить стенд

```bash
pnpm setup:worktree
```

Команда генерирует корневой `.env` из `.env.example`, собирает общие пакеты (`@repo/types`,
`@repo/utils`), выполняет `db:generate`, `db:migrate` и `db:seed`, а в конце печатает адрес
стенда и учётные данные seed-пользователя:

```
Стенд готов.
  Запуск:  pnpm dev
  Адрес:   http://localhost:3000
  API:     http://127.0.0.1:3001
  Вход:    admin@example.com / 123123123
```

Что важно знать:

- **`.env` обязателен.** Dev-скрипты обоих приложений читают его явно через `dotenv-cli`; без
  `.env` API падает на валидации переменных окружения. Автоматически файл не подхватывается.
- **Существующий `.env` команда не трогает** — печатает текущие параметры и выходит.
  Перегенерация: `pnpm setup:worktree --force` (перезапишет файл и заново прогонит миграции и seed).
- **Секреты** в сгенерированном `.env` — dev-заглушки из `.env.example`. Для любого не-локального
  окружения их нужно заменить (`openssl rand -base64 32`); при `NODE_ENV=production` API
  отклоняет известные заглушки `JWT_SECRET`/`JWT_REFRESH_SECRET` на старте.
- **Порты** берутся из `.env` (`WEB_PORT` / `API_PORT`). В основном checkout это 3000 и 3001.
- Для работы в нескольких копиях репозитория одновременно — см.
  [worktree-dev.md](./worktree-dev.md).

> ⚠️ Seed создаёт пользователя `admin@example.com` / `123123123`. Перед деплоем обязательно
> измени пароль или удали seed-пользователя.

### 5. Запустить проект

```bash
pnpm dev
```

Ожидаемый результат:

- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs
- Health check: http://localhost:3001/health
- Web: http://localhost:3000
- Логин: http://localhost:3000/login

## Проверка

1. Открой http://localhost:3000/login
2. Введи `admin@example.com` / `123123123`
3. После успешного входа должен произойти редирект на `/` (дашборд)
4. Открой http://localhost:3001/api/docs — Swagger должен отображаться
5. В Swagger выполни `POST /auth/login` — должен вернуться объект с `accessToken` и `refreshToken`

Страницы `/sources` и `/preferences` закрыты `VerifiedGuard` и до подтверждения email отдают
`403` — как подтвердить почту seed-пользователя локально, описано в
[worktree-dev.md](./worktree-dev.md#как-подтвердить-email-seed-пользователя-локально).

## Частые проблемы

| Проблема                                                       | Причина                                                  | Решение                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Error: Cannot connect to database`                            | PostgreSQL не запущен                                    | `docker compose up -d db`, проверить `docker compose ps`                                             |
| API падает на старте с ошибками валидации env                  | Нет корневого `.env` — автоматически он не создаётся     | `pnpm setup:worktree`                                                                                |
| `pnpm: command not found`                                      | pnpm не установлен                                       | `npm install -g pnpm`                                                                                |
| `Prisma Client not generated`                                  | Пропущен `db:generate`                                   | `pnpm --filter @repo/api db:generate`                                                                |
| Порт 3001 занят                                                | Другой процесс на порту                                  | `lsof -i :3001`, остановить процесс или изменить `API_PORT` в `.env`                                 |
| `docker compose up -d db` падает с `port is already allocated` | Порт 5444 занят другим контейнером Postgres              | Использовать уже запущенный контейнер либо задать `DB_HOST_PORT` в `.env` и поправить `DATABASE_URL` |
| Логин не работает, ошибка 401                                  | Не применены миграции или не запущен seed                | Повторить шаг 4 (`pnpm setup:worktree --force`)                                                      |
| `403` на `/sources` и `/preferences`                           | Email seed-пользователя не подтверждён (`VerifiedGuard`) | См. [worktree-dev.md](./worktree-dev.md#как-подтвердить-email-seed-пользователя-локально)            |
| `NEXTAUTH_SECRET` ошибка                                       | Пустая или короткая строка в `.env`                      | Сгенерировать: `openssl rand -base64 32`                                                             |
