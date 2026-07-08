import { getByPath } from './get-by-path';

/**
 * Возвращает новый объект только с указанными путями исходного — whitelist полей.
 *
 * Универсальный хелпер: пригоден везде, где нужно отобрать безопасное подмножество
 * полей (например, метаданные аудита без паролей/токенов).
 *
 * Поддерживает dot-нотацию для вложенных полей и сохраняет структуру вложенности:
 *   pick({ user: { email: 'a', password: 'x' } }, ['user.email'])
 *     → { user: { email: 'a' } }
 *
 * Отсутствующие или undefined-пути просто пропускаются.
 *
 * @param source Исходный объект (`undefined` допустим — вернётся `{}`).
 * @param paths  Список путей в dot-нотации.
 * @returns Новый объект только с найденными путями.
 */
export function pick(
  source: Record<string, unknown> | undefined,
  paths: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!source) return result;

  for (const path of paths) {
    const value = getByPath(source, path);
    if (value === undefined) continue;

    // Реконструируем вложенную структуру в result по сегментам пути.
    const keys = path.split('.');
    let target = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i] as string;
      const next = target[key];
      if (typeof next !== 'object' || next === null) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    target[keys[keys.length - 1] as string] = value;
  }

  return result;
}
