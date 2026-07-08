# ADR-005: RBAC — ролевая модель на основе enum

**Статус:** Принято
**Дата:** 2026-03-03

---

## Контекст

Шаблон предоставляет JWT-аутентификацию, но не имеет механизма авторизации по ролям. При добавлении в приложение любой функциональности, доступной только администраторам (или другим привилегированным пользователям), разработчику нужна готовая точка расширения.

Требования к решению:
- Минимальная сложность — подходит для шаблона
- Роли видны в JWT-токене (не требуют дополнительного DB-запроса в гарде)
- Совместимость с Prisma, NestJS Guards и next-auth сессией

---

## Решение

Ввести два уровня доступа через `enum Role { USER ADMIN }` в Prisma-схеме.

### Ключевые компоненты

1. **`enum Role`** в `schema.prisma` — единственный источник истины для допустимых значений.
   Поле `role Role @default(USER)` добавлено в модель `User`.

2. **`@repo/types`** — `RoleSchema` (z.enum) и `role: RoleSchema` в `UserSchema` — шарится между API и вебом.

3. **JWT-пейлоад** — поле `role` включено в `JwtPayload` и в оба токена (access + refresh) при вызове `generateTokens()`.

4. **`@Roles()` декоратор** (`auth/decorators/roles.decorator.ts`) — устанавливает метаданные через `SetMetadata`.

5. **`RolesGuard`** (`auth/guards/roles.guard.ts`) — читает метаданные через `Reflector`, сравнивает с `req.user.role`. Должен использоваться **после** `JwtAuthGuard`, который помещает пользователя в `req.user`.

6. **`@CurrentUser()` декоратор** (`auth/decorators/current-user.decorator.ts`) — извлекает `req.user` из контекста Fastify. Заменяет `@Request() req` в контроллерах.

7. **next-auth** — `role` прокидывается через `authorize → jwt callback → session callback`, доступна в `session.user.role`.

8. **`RoleProvider` + `useRole()`** (`components/auth/role-provider.tsx`) — клиентский контекст, в который серверный layout передаёт роль из сессии. `RoleProvider` оборачивает дерево в `(dashboard)/layout.tsx` сразу после получения `session` через `auth()`. Никаких дополнительных запросов к API или БД не производится.

9. **`<Access>` компонент** (`components/auth/access.tsx`) — клиентский компонент (`'use client'`), читает роль через `useRole()`. Принимает `role: Role | Role[]` и рендерит `children` только если роль пользователя входит в список. Работает в любом контексте — серверном дереве и клиентских компонентах — без `useSession` и `SessionProvider`.

### Типовое использование

```typescript
// Серверная сторона (NestJS)
@Get('admin-only')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
adminOnly(@CurrentUser() user: User) {
  return { message: `Hello, admin ${user.email}` };
}
```

```tsx
// В серверном или клиентском компоненте — одинаково
import { Access } from '@/components/auth/access';

<Access role="ADMIN">
  <button>Удалить пользователя</button>
</Access>

<Access role={['ADMIN', 'USER']}>
  <ProfileMenu />
</Access>
```

---

## Альтернативы

| Вариант | Почему отклонён |
|---------|----------------|
| Разрешения (permissions) вместо ролей | Избыточная сложность для шаблона; роли решают 80% задач |
| Роли в отдельной таблице (Many-to-Many) | Overengineering: шаблону достаточно плоского enum |
| Проверка роли внутри каждого метода | Не масштабируется; гард декларативнее |
| Хранить роль только в JWT (без DB) | При revoke-сценариях роль устаревает; лучше брать из DB через JwtStrategy.validate |

---

## Последствия

**Плюсы:**
- Минимальный boilerplate — три файла для полноценного RBAC
- Роль видна в JWT без дополнительных запросов к БД (кешируется в токене)
- Расширяемо: добавить новую роль — одна строка в enum + миграция

**Минусы:**
- Смена роли отражается в токене только после его перевыпуска (логаут + логин или refresh)
- При необходимости fine-grained permissions придётся переходить на другую модель (новый ADR)
