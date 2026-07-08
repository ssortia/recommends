/**
 * Безопасно извлекает вложенное значение из объекта по пути в dot-нотации.
 *
 * Универсальный хелпер без зависимостей — пригоден и для бэкенда (NestJS),
 * и для фронтенда (Next.js). Не бросает исключений: если любой сегмент пути
 * отсутствует или промежуточное значение не объект, возвращает `undefined`.
 *
 * Работает и с массивами — числовой сегмент трактуется как индекс
 * (`'items.0.id'`).
 *
 * @param source Исходный объект (любого типа; `null`/`undefined` допустимы).
 * @param path   Путь в dot-нотации, например `'user.email'` или `'items.0.id'`.
 * @returns Значение по пути либо `undefined`, если путь не разрешился.
 *
 * @example
 * getByPath({ user: { email: 'a@b.com' } }, 'user.email'); // 'a@b.com'
 * getByPath({ items: [{ id: 7 }] }, 'items.0.id');         // 7
 * getByPath({ user: {} }, 'user.email');                   // undefined
 * getByPath(null, 'user.email');                           // undefined
 */
export function getByPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) return undefined;

  let value: unknown = source;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
