● ---
  Code Review: NexST Template

  Честно. Как сеньор смотрю на это.

  ---
  TL;DR

  Структура монорепо — хорошая. Инфра и тулинг — нормальные. Реализация auth — критически небезопасная для продакшена. Есть несколько мест,
  где молча глотаются ошибки, а парочка решений вызывает вопросы к архитектуре. Ниже — по порядку.

  ---
  🔴 Критические проблемы

  1. Нет revocation access-токенов при logout

  apps/api/src/auth/auth.service.ts:57-62

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  Logout чистит refreshToken в базе, но уже выданные access-токены продолжают работать ещё 15 минут. Если у атакующего есть access-токен —
  выход пользователя его не останавливает. Стандартное решение: Redis-блеклист по JTI или очень короткий TTL (<2 минут) + ротация.

  ---
  2. Нет ротации refresh-токенов

  apps/api/src/auth/auth.service.ts

  При каждом вызове /auth/refresh выдаётся новый refreshToken, но старый не инвалидируется в разрезе сессии. Это означает: если токен утёк —
  атакующий может рефрешить параллельно с легитимным пользователем, и никто не узнает. OWASP требует ротации: один refresh → один новый токен
   → старый сгорает.

  ---
  3. CORS с fallback на localhost

  apps/api/src/main.ts:24-27

  app.enableCors({
    origin: process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000',
    credentials: true,
  });

  Если NEXTAUTH_URL не задан — API молча открывается для localhost:3000 с credentials: true. В продакшене это потенциальная дыра. Нужно: при
  отсутствии переменной — throw на старте, а не fallback.

  ---
  4. Access-токен и refresh-токен хранятся в NextAuth JWT

  apps/web/src/auth.ts:54-66

  token['accessToken'] = (user as { accessToken?: string }).accessToken;
  token['refreshToken'] = (user as { refreshToken?: string }).refreshToken;

  JWT от NextAuth — это ещё один JWT поверх уже существующего JWT. refreshToken особенно опасно хранить в client-side JWT: при утечке
  NEXTAUTH_SECRET атакующий получает рабочий refresh-токен API. Refresh-токен должен жить либо в httpOnly cookie, либо только server-side.

  ---
  5. Хардкод пароля в seed-файле

  packages/database/prisma/seed.ts:5

  const password = await bcrypt.hash('admin123456', 10);

  Пароль admin123456 теперь навсегда в git-истории. Любой, кто клонирует репо, знает дефолтный пароль. В шаблонах особенно важно читать
  ADMIN_PASSWORD из env или требовать его явной передачи при первом запуске.

  ---
  🟠 Высокий приоритет

  6. Нет rate limiting на auth-эндпоинтах

  apps/api/src/auth/auth.controller.ts

  POST /auth/login — открытый эндпоинт без ограничений. Брутфорс в лоб, без усилий. @nestjs/throttler подключается за 10 минут.

  ---
  7. Молчаливое проглатывание ошибок в NextAuth

  apps/web/src/auth.ts:48-50

  } catch {
    return null;
  }

  Любая ошибка — таймаут, 500 от API, сетевой сбой — превращается в null, что NextAuth интерпретирует как «неверные credentials».
  Пользователь видит «Неверный email или пароль» вместо «Сервис недоступен». Дебажить — боль. Минимум: console.error(e) в catch, в идеале —
  разделять типы ошибок.

  ---
  8. Два HTTP-запроса на каждый логин

  apps/web/src/auth.ts:23-46

  POST /auth/login → получаем токены
  GET  /users/me   → получаем профиль

  Chatty pattern. Можно было вернуть профиль прямо в ответе /auth/login и сэкономить RTT. Особенно заметно при высокой латентности.

  ---
  9. Unsafe type assertions вместо валидации

  apps/web/src/auth.ts:31, 40

  const data = (await res.json()) as { accessToken: string; refreshToken: string };

  as не гарантирует форму данных — это просто указание компилятору заткнуться. Если API вернёт что-то другое, получим runtime-ошибку без
  внятного сообщения. Здесь нужен Zod-парсинг с явной обработкой ошибки.

  ---
  10. NestJS tsconfig отключает важные проверки

  packages/config/typescript/nestjs.json

  "strictPropertyInitialization": false,
  "noUncheckedIndexedAccess": false,
  "exactOptionalPropertyTypes": false

  NestJS прекрасно работает со строгим TS. Эти отключения — не требование фреймворка, а удобство. В результате самый security-критичный слой
  (API) имеет более слабые гарантии типизации, чем UI.

  ---
  🟡 Средний приоритет

  11. msDurationToSeconds — тихий fallback

  apps/api/src/auth/auth.service.ts:96-108

  if (!matched) return 900; // 15 минут

  Опечатка в JWT_REFRESH_EXPIRES_IN → токен живёт 15 минут вместо 7 дней → пользователей выбивает из сессии каждые 15 минут. Ошибка
  обнаружится не на старте, а в продакшене. Нужно валидировать формат в getEnv() через zod-regex и падать при старте.

  ---
  12. JWT Strategy делает запрос в БД на каждый запрос

  apps/api/src/auth/strategies/jwt.strategy.ts:22-28

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

  Каждый защищённый эндпоинт = +1 запрос в БД для валидации токена. При 100 RPS — 100 лишних запросов. Доверяй подписи токена для identity,
  обращайся в БД только когда нужны свежие данные. Либо in-memory cache с TTL = время жизни access-токена.

  ---
  13. Нет graceful shutdown

  apps/api/src/main.ts

  Нет обработчика SIGTERM. Kubernetes при деплое посылает SIGTERM → ждёт 30 секунд → SIGKILL. Без обработки: активные запросы обрываются,
  соединения с БД не закрываются. Это 2 строки кода.

  ---
  14. Нет глобального exception filter

  apps/api/src/main.ts

  Необработанные исключения (DB connection error, unexpected throw) могут вернуть stack trace в ответе. Нужен AllExceptionsFilter который
  логирует + возвращает безопасный ответ.

  ---
  15. Docker-контейнер запускается от root

  docker/api.Dockerfile

  FROM node:20-alpine AS runner
  # нет: USER
  CMD ["node", "dist/main"]

  Процесс запускается от root внутри контейнера. Если есть RCE-уязвимость — атакующий получает root. Web Dockerfile это исправляет (создаёт
  nextjs пользователя), API Dockerfile — нет. Несогласованность.

  ---
  16. Middleware pattern — негативный lookahead

  apps/web/src/middleware.ts:4-6

  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],

  Негативный lookahead в matcher — хрупкая конструкция. Добавишь /register — забудешь в matcher — получишь защищённую регистрацию. Лучше явно
   перечислять защищённые маршруты или структурировать через route groups и проверять auth() в layout.
