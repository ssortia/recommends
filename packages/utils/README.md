# @repo/utils

Универсальные хелперы без зависимостей, общие для API (`apps/api`) и Web (`apps/web`).

Пакет не тянет рантайм-зависимости и собирается в CommonJS (`dist/`), поэтому подходит и для NestJS, и для Next.js.

## Использование

```ts
import { getByPath } from '@repo/utils';
```

Подключение в приложении (`package.json`):

```json
{ "dependencies": { "@repo/utils": "workspace:*" } }
```

## Хелперы

### `getByPath(source, path)`

Безопасно извлекает вложенное значение по пути в dot-нотации. Не бросает исключений — на несуществующем пути возвращает `undefined`. Поддерживает индексы массивов.

```ts
getByPath({ user: { email: 'a@b.com' } }, 'user.email'); // 'a@b.com'
getByPath({ items: [{ id: 7 }] }, 'items.0.id'); // 7
getByPath({ user: {} }, 'user.email'); // undefined
```

## Добавление нового хелпера

1. Создай файл `src/<name>.ts` с JSDoc на каждую экспортируемую функцию.
2. Реэкспортируй его из `src/index.ts`.
3. Покрой тестами в `src/<name>.spec.ts` (у пакета настроен Jest: `pnpm --filter @repo/utils test`).
4. Добавь краткое описание в этот README.
