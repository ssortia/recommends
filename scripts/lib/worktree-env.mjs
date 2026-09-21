/**
 * Чистая логика подготовки окружения worktree: slug, имя БД, выбор пары портов
 * и сборка содержимого `.env`. Без побочных эффектов — всё, что требует ФС, сети
 * или git, передаётся аргументами (см. `scripts/setup-worktree.mjs`).
 */

/** Имя папки основного checkout: он сохраняет поведение по умолчанию. */
export const MAIN_SLUG = 'recommends';

/** Префикс имени базы данных — совпадает с именем БД основного checkout. */
export const DATABASE_PREFIX = 'recommends';

/** Максимальная длина метки имени хоста (RFC 1035). */
const MAX_SLUG_LENGTH = 63;

/** Шаг между парами портов: пара занимает web-порт и следующий за ним api-порт. */
const PORT_PAIR_STEP = 10;

/** Сколько пар просматривать, прежде чем считать, что свободных портов нет. */
const PORT_PAIR_ATTEMPTS = 100;

/**
 * Нормализует имя папки worktree в slug: нижний регистр, любые символы кроме
 * латиницы и цифр схлопываются в дефис.
 *
 * Дефис выбран как единственный разделитель, потому что slug должен быть
 * валидной меткой имени хоста (`<slug>.localhost`); для имени БД дефисы
 * заменяются на подчёркивания в `resolveDatabaseName`.
 *
 * @param {string} dirName имя папки worktree
 * @returns {string} slug вида `my-feature-1`
 */
export function toSlug(dirName) {
  if (typeof dirName !== 'string') {
    throw new TypeError('toSlug: ожидается строка с именем папки');
  }

  const slug = dirName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  if (slug === '') {
    throw new Error(`toSlug: из имени папки "${dirName}" не удалось получить slug`);
  }

  return slug;
}

/**
 * Возвращает имя базы данных для копии репозитория.
 * Основной checkout сохраняет исходное имя `recommends`.
 *
 * @param {string} slug результат `toSlug`
 * @returns {string} имя БД
 */
export function resolveDatabaseName(slug) {
  if (slug === MAIN_SLUG) {
    return DATABASE_PREFIX;
  }

  return `${DATABASE_PREFIX}_${slug.replace(/-/g, '_')}`;
}

/**
 * Подбирает первую пару портов (web, api = web + 1), свободную и в системе,
 * и среди пар, уже записанных в `.env` соседних worktree.
 *
 * @param {(port: number) => boolean | Promise<boolean>} isPortFree проверка занятости порта в системе
 * @param {number} startFrom web-порт первой проверяемой пары
 * @param {Iterable<number>} [reserved] порты, занятые соседними копиями
 * @returns {Promise<{ webPort: number, apiPort: number }>}
 */
export async function pickPortPair(isPortFree, startFrom, reserved = []) {
  if (typeof isPortFree !== 'function') {
    throw new TypeError('pickPortPair: isPortFree должен быть функцией');
  }
  if (!Number.isInteger(startFrom) || startFrom <= 0) {
    throw new TypeError('pickPortPair: startFrom должен быть положительным целым числом');
  }

  const reservedPorts = new Set(reserved);

  for (let attempt = 0; attempt < PORT_PAIR_ATTEMPTS; attempt += 1) {
    const webPort = startFrom + attempt * PORT_PAIR_STEP;
    const apiPort = webPort + 1;

    if (reservedPorts.has(webPort) || reservedPorts.has(apiPort)) {
      continue;
    }

    // Проверки последовательные: занятый web-порт делает проверку api-порта лишней.
    if (!(await isPortFree(webPort))) {
      continue;
    }
    if (!(await isPortFree(apiPort))) {
      continue;
    }

    return { webPort, apiPort };
  }

  const lastPort = startFrom + (PORT_PAIR_ATTEMPTS - 1) * PORT_PAIR_STEP;
  throw new Error(
    `pickPortPair: не найдено свободной пары портов в диапазоне ${startFrom}–${lastPort + 1}`,
  );
}

/**
 * Подставляет значения в содержимое `.env.example`, сохраняя порядок строк,
 * комментарии и не упомянутые ключи. Ключи, которых нет в примере,
 * дописываются в конец файла.
 *
 * @param {string} example содержимое `.env.example`
 * @param {Record<string, string | number>} params значения переменных
 * @returns {string} содержимое `.env`
 */
export function buildEnvContent(example, params) {
  if (typeof example !== 'string') {
    throw new TypeError('buildEnvContent: ожидается строка с содержимым .env.example');
  }

  const pending = new Set(Object.keys(params));

  const lines = example.split('\n').map((line) => {
    const match = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match === null) {
      return line;
    }

    const [, prefix, key] = match;
    if (!Object.hasOwn(params, key)) {
      return line;
    }

    pending.delete(key);
    return `${prefix}${key}=${quote(params[key])}`;
  });

  if (pending.size > 0) {
    const tail = [...pending].map((key) => `${key}=${quote(params[key])}`);
    // Отделяем добавленные ключи пустой строкой от последней значимой строки примера.
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    lines.push('', ...tail, '');
  }

  return lines.join('\n');
}

/**
 * @param {string | number} value
 * @returns {string} значение в двойных кавычках
 */
function quote(value) {
  return `"${String(value).replace(/(["\\])/g, '\\$1')}"`;
}
