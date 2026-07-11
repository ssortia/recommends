# Удаление источника

## Overview

Пользователь должен иметь возможность удалить (отписаться от) источник из списка на странице `/sources`. После удаления:

- источник пропадает из списка пользователя;
- статьи из этого источника больше не попадают в его фид пользователя;
- сам `Source` и его `Article` в БД не удаляются, если на источник подписаны другие пользователи (данные общие между пользователями — см. `SourcesService.addSourceByType`, который переиспользует существующий `Source`).

Реализует issue #9.

## Context (from discovery)

- **API**: `apps/api/src/sources/` — `SourcesController`, `SourcesService`, `SourcesRepository` (наследует `BaseRepository`), `UserSourcesRepository` (составной PK `userId+sourceId`, без бизнес-исключений — только Prisma-вызовы).
- **Модель данных**: `UserSource` (userId, sourceId, `onDelete: Cascade` от `User`/`Source`) — «фид» пользователя определяется через его подписки; отдельного `Feed`-модуля в проекте пока нет.
- **Web**: `apps/web/src/app/(dashboard)/sources/sources-list.tsx` — рендерит список через `useSources()` (`apps/web/src/hooks/use-sources.ts`), `sourcesApi` (`apps/web/src/api/sources.api.ts`) — тонкий слой без React, `api.get/api.post` (`apps/web/src/lib/api.ts`).
- **UI-компоненты**: есть только `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx` в `apps/web/src/components/ui/`. Компонента диалога подтверждения нет — понадобится добавить shadcn `AlertDialog` (пакет `@radix-ui/react-alert-dialog` пока не установлен).
- **Паттерны**: репозитории — только Prisma-доступ, бизнес-исключения (`ConflictException`, `BadRequestException`) — в сервисе. Контроллер тонкий, делегирует в сервис. Хуки на React Query с `invalidateQueries` после мутаций (см. `useAddSource`).
- **Тесты**: `sources.controller.spec.ts`, `sources.service.spec.ts`, `sources.repository.spec.ts`, `user-sources.repository.spec.ts` — юнит-тесты Jest на каждый слой. E2e-тесты на добавление источника есть в web (Playwright) — по аналогии нужен e2e на удаление.

## Development Approach

- **Testing approach**: Regular (код → тесты)
- Выполнять задачи последовательно, каждую полностью до перехода к следующей
- Каждая задача включает написание/обновление тестов для изменённого кода
- Все тесты должны проходить перед началом следующей задачи
- Обновлять этот файл плана при изменении объёма работ по ходу реализации

## Solution Overview

- **API**: добавить `DELETE /sources/:sourceId` в `SourcesController`, метод `removeSource(userId, sourceId)` в `SourcesService`, метод `delete(userId, sourceId)` в `UserSourcesRepository` (удаление строки `UserSource` по составному ключу). Если подписки не существует — 404 (`NotFoundException`). Отдельного удаления `Source`/`Article` не делаем: они остаются в БД для других подписчиков (упрощение согласовано с пользователем — YAGNI, т.к. подсчёт «последний ли это подписчик» и каскадная очистка добавляют сложность без явной пользовательской ценности сейчас).
- **Web**: добавить `AlertDialog` в `components/ui/` (shadcn-паттерн, на основе `@radix-ui/react-alert-dialog`), кнопку удаления с иконкой в каждой карточке `SourcesList`, хук `useDeleteSource()` в `use-sources.ts` с инвалидацией `['sources']` после успеха, метод `sourcesApi.remove(sourceId, accessToken)`.
- **Типы**: параметр `sourceId` в DTO не нужен (path param), но для консистентности со Swagger добавить `@ApiParam`.

## Technical Details

- Path param `sourceId: string` (cuid) — валидация форматом не требуется (Prisma сам вернёт `null`/`P2025`, что уже обрабатывается глобальным `AllExceptionsFilter`, ADR-012).
- `UserSourcesRepository.delete(userId, sourceId, tx?)`:
  ```ts
  delete(userId: string, sourceId: string): Promise<UserSource> {
    return this.prisma.userSource.delete({
      where: { userId_sourceId: { userId, sourceId } },
    });
  }
  ```
- `SourcesService.removeSource`:
  - проверить существование подписки через `userSourcesRepository.exists` → если нет, `NotFoundException('Подписка на источник не найдена')`;
  - удалить подписку через `userSourcesRepository.delete`.
- Контроллер: `@Delete(':sourceId')`, `@HttpCode(204)` (нет тела ответа), `ApiOperation({ summary: 'Unsubscribe current user from a source' })`.
- Web API: `remove: (sourceId: string, accessToken: string) => api.delete<void>(\`/sources/${sourceId}\`, { accessToken })`— проверить наличие`api.delete`в`lib/api.ts`, при отсутствии добавить по аналогии с `api.get`/`api.post`.
- `AlertDialog` компонент — стандартный shadcn-набор: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`.
- Кнопка удаления — `variant="ghost"` или `variant="destructive"` с иконкой из `lucide-react` (уже установлен в `apps/web/package.json`).

## What Goes Where

- Implementation Steps (`[ ]`) — все ниже перечисленные задачи выполнимы в этом репозитории.
- Post-Completion — ручная UX-проверка диалога подтверждения (уже покрыта e2e, но полезно визуально проверить в браузере).

## Implementation Steps

### Task 1: Добавить метод отписки в UserSourcesRepository

**Files:**

- Modify: `apps/api/src/sources/user-sources.repository.ts`
- Modify: `apps/api/src/sources/user-sources.repository.spec.ts`

- [x] добавить метод `delete(userId: string, sourceId: string): Promise<UserSource>` — удаление по составному ключу `userId_sourceId`
- [x] написать тест: успешное удаление вызывает `prisma.userSource.delete` с правильным `where`
- [x] написать тест: если записи нет — Prisma бросает `P2025`, репозиторий не перехватывает (ошибка пробрасывается наверх, обработка — в сервисе через предварительный `exists`)
- [x] запустить тесты — должны пройти перед следующей задачей

### Task 2: Добавить SourcesService.removeSource и эндпоинт DELETE /sources/:sourceId

**Files:**

- Modify: `apps/api/src/sources/sources.service.ts`
- Modify: `apps/api/src/sources/sources.controller.ts`
- Modify: `apps/api/src/sources/sources.service.spec.ts`
- Modify: `apps/api/src/sources/sources.controller.spec.ts`

- [x] в `SourcesService` добавить `removeSource(userId: string, sourceId: string): Promise<void>` — проверка `userSourcesRepository.exists`, при отсутствии `NotFoundException('Подписка на источник не найдена')`, иначе `userSourcesRepository.delete`
- [x] в `SourcesController` добавить `@Delete(':sourceId')` с `@HttpCode(204)`, `@ApiOperation`, `@ApiParam({ name: 'sourceId' })`, вызывающий `sourcesService.removeSource(user.id, sourceId)`
- [x] написать тест сервиса: успешное удаление подписки
- [x] написать тест сервиса: `NotFoundException`, если подписки не существует
- [x] написать тест контроллера: вызов с правильными аргументами, ожидаемый статус
- [x] запустить тесты — должны пройти перед следующей задачей

### Task 3: Добавить shadcn AlertDialog компонент

**Files:**

- Create: `apps/web/src/components/ui/alert-dialog.tsx`
- Modify: `apps/web/package.json` (добавить `@radix-ui/react-alert-dialog`)

- [x] установить `@radix-ui/react-alert-dialog` в `apps/web`
- [x] создать `alert-dialog.tsx` по стандартному shadcn-паттерну (Root, Trigger, Portal, Overlay, Content, Header, Footer, Title, Description, Action, Cancel), используя `cn` из `@/lib/utils` и стиль, аналогичный `button.tsx`
- [x] проверить `pnpm typecheck` для `apps/web` — компонент должен компилироваться без ошибок

### Task 4: Добавить sourcesApi.remove и useDeleteSource

**Files:**

- Modify: `apps/web/src/api/sources.api.ts`
- Modify: `apps/web/src/hooks/use-sources.ts`
- Modify: `apps/web/src/lib/api.ts` (если отсутствует метод `delete`)

- [x] `api.delete` уже есть в `lib/api.ts` (обрабатывает `204 → undefined`); потребовалась точечная правка — заголовок `Content-Type: application/json` теперь ставится только при наличии `body` (иначе Fastify падает с 400 на бестелых запросах вроде DELETE)
- [x] добавить `sourcesApi.remove(sourceId: string, accessToken: string): Promise<void>`
- [x] добавить хук `useDeleteSource()` — `useMutation`, `mutationFn: (sourceId) => sourcesApi.remove(sourceId, session!.accessToken!)`, `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] })`
- [x] написать unit-тест (если в проекте есть тесты хуков/api-слоя по аналогии с существующими — проверить наличие) или, если для web-слоя юнит-тестов на хуки нет в проекте, ограничиться типами и e2e-покрытием в Task 5 — в проекте нет юнит-тестов на web-хуки/api-слой (только Playwright e2e в `apps/web/e2e/`), поэтому ограничились типами; покрытие добавится в Task 5
- [x] запустить `pnpm typecheck`/имеющиеся тесты — должны пройти перед следующей задачей

### Task 5: Добавить кнопку удаления с подтверждением в SourcesList + e2e-тест

**Files:**

- Modify: `apps/web/src/app/(dashboard)/sources/sources-list.tsx`
- Modify (или Create, если e2e для sources лежат в отдельном файле): e2e-тест удаления источника (см. существующий e2e-тест добавления Telegram-канала для расположения директории)

- [x] добавить в каждую карточку `SourcesList` кнопку удаления (иконка/текст), открывающую `AlertDialog` с описанием источника и вопросом подтверждения
- [x] по подтверждению (`AlertDialogAction`) вызывать `useDeleteSource().mutate(entry.source.id)`
- [x] обработать состояние загрузки/ошибки мутации (например, задизейблить кнопку на время запроса, показать сообщение об ошибке)
- [x] написать e2e-тест: добавить источник → удалить его → подтвердить в диалоге → убедиться, что источник исчез из списка
- [x] написать e2e-тест (или шаг в том же тесте): открыть диалог и отменить — источник остаётся в списке
- [x] запустить e2e-тесты — должны пройти перед следующей задачей

### Task 6: Verify acceptance criteria

- [x] проверить: кнопка удаления доступна для каждого источника в списке
- [x] проверить: перед удалением запрашивается подтверждение (AlertDialog)
- [x] проверить: после удаления источник исчезает из списка (инвалидация React Query)
- [x] критерий «статьи из источника больше не попадают в фид» выполняется по построению: в проекте нет отдельного модуля/страницы фида, весь пользовательский контент определяется через подписки (`UserSource`) — после удаления подписки строка исчезает, отдельно проверять нечего
- [x] добавить API-тест (сервис или e2e), подтверждающий, что при отписке одного пользователя от общего `Source` другой подписанный пользователь сохраняет и источник, и его статьи (ключевое свойство корректности решения — не удалять `Source`/`Article`) — добавлен `apps/api/test/sources-shared-subscription.e2e-spec.ts` (реальный Postgres, два пользователя, общий Source)
- [x] запустить полный набор тестов: `pnpm test`
- [x] запустить e2e-тесты (Playwright) для web
- [x] `pnpm typecheck` и `pnpm lint` без ошибок

### Task 7: [Final] Обновить документацию

- [x] обновить README.md, если список фич требует изменений (добавлена возможность удаления источника) — обновлена строка про RSS/Telegram-источники: добавлено упоминание отписки с подтверждением и сохранения общих Source/Article
- [x] проверить, нужен ли новый ADR — решение «не удалять общий Source/Article при отписке» достаточно локально и не требует отдельного ADR (это деталь реализации, а не архитектурное решение уровня системы); подтверждено — согласно `docs/DOCUMENTATION.md` ADR фиксирует архитектурные решения системного уровня, а не детали одного метода репозитория/сервиса
- [x] переместить этот файл плана в `docs/plans/completed/`

## Post-Completion

**Manual verification**:

- визуально проверить в браузере вид кнопки удаления и AlertDialog (светлая/тёмная тема, если поддерживается)
