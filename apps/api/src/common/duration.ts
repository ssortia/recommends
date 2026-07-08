/**
 * Парсит строки длительности вида '15m', '7d', '1h' в секунды.
 * Возвращает 900 (15 минут) как безопасный fallback.
 *
 * Важно: на нераспарсенной строке fallback применяется молча — поэтому
 * входные env-переменные с длительностью валидируются zod-regex на старте
 * (см. `config/env.ts`), чтобы опечатка падала громко, а не сокращала срок токена.
 */
export function msDurationToSeconds(duration: string): number {
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  const matched = duration.match(/^(\d+)([smhdw])$/);
  if (!matched) return 900;
  // Группы гарантированно присутствуют после совпадения regex; unit ∈ ключам multipliers.
  return parseInt(matched[1]!, 10) * multipliers[matched[2]!]!;
}
