# Начало работы

**Цель:** развернуть проект локально с нуля — от клонирования до работающего логина.

## Предварительные требования

| Инструмент | Минимальная версия | Проверить |
|---|---|---|
| Node.js | 22 | `node -v` |
| pnpm | 9 | `pnpm -v` |
| Docker | 24 | `docker -v` |
| Git | любая | `git -v` |

Установить pnpm, если не установлен:
```bash
npm install -g pnpm
```

## Шаги

### 1. Клонировать репозиторий

```bash
git clone <url-репозитория>
cd nexst-template
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Открыть `.env` и заполнить секреты:

```env
# Генерировать случайные строки: openssl rand -base64 32
JWT_SECRET=<случайная строка, минимум 32 символа>
JWT_REFRESH_SECRET=<другая случайная строка>
NEXTAUTH_SECRET=<ещё одна случайная строка>
```

Остальные значения оставить как есть для локальной разработки.

### 3. Запустить базу данных

```bash
docker compose up -d
```

Проверить, что контейнер запустился:
```bash
docker compose ps
# db должен быть в статусе "healthy"
```

### 4. Установить зависимости

```bash
pnpm install
```

### 5. Применить миграции и сгенерировать Prisma Client

```bash
pnpm --filter @repo/api db:generate
pnpm --filter @repo/api db:migrate
```

При первом запуске Prisma попросит имя миграции — введи, например, `init`.

### 6. Заполнить базу тестовыми данными

```bash
pnpm --filter @repo/api db:seed
```

Создаётся пользователь: `admin@example.com` / `admin123456`

> ⚠️ Перед деплоем обязательно измени пароль или удали seed-пользователя.

### 7. Запустить проект

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
2. Введи `admin@example.com` / `admin123456`
3. После успешного входа должен произойти редирект на `/` (дашборд)
4. Открой http://localhost:3001/api/docs — Swagger должен отображаться
5. В Swagger выполни `POST /auth/login` — должен вернуться объект с `accessToken` и `refreshToken`

## Частые проблемы

| Проблема | Причина | Решение |
|---|---|---|
| `Error: Cannot connect to database` | PostgreSQL не запущен | `docker compose up -d`, проверить `docker compose ps` |
| `pnpm: command not found` | pnpm не установлен | `npm install -g pnpm` |
| `Prisma Client not generated` | Пропущен `db:generate` | `pnpm --filter @repo/api db:generate` |
| Порт 3001 занят | Другой процесс на порту | `lsof -i :3001`, остановить процесс или изменить `PORT` в `.env` |
| Логин не работает, ошибка 401 | Не применены миграции или не запущен seed | Шаги 5-6 выше |
| `NEXTAUTH_SECRET` ошибка | Пустая или короткая строка в `.env` | Сгенерировать: `openssl rand -base64 32` |
