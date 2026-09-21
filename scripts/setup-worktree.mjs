#!/usr/bin/env node
/**
 * Подготовка локального стенда в текущей копии репозитория: генерация `.env`
 * с уникальными портами и своей базой данных, затем сборка общих пакетов,
 * генерация Prisma Client, миграции и сид.
 *
 * Вся чистая логика живёт в `scripts/lib/worktree-env.mjs`; здесь — только
 * побочные эффекты (ФС, сеть, git, дочерние процессы).
 *
 * Запуск: `pnpm setup:worktree [--force]`
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  MAIN_SLUG,
  buildEnvContent,
  pickPortPair,
  resolveDatabaseName,
  toSlug,
} from './lib/worktree-env.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Порт общего контейнера Postgres по умолчанию (сервис `db` в docker-compose.yml). */
const DEFAULT_DB_HOST_PORT = 5444;

/** Порты основного checkout: он сохраняет исторические значения. */
const MAIN_PORTS = { webPort: 3000, apiPort: 3001 };

/** Web-порт первой пары, с которой начинается подбор для копий. */
const PORT_SEARCH_START = 3010;

/** Таймаут проверки доступности порта БД, мс. */
const DB_PROBE_TIMEOUT_MS = 1500;

async function main() {
  const force = process.argv.slice(2).includes('--force');

  const slug = toSlug(path.basename(REPO_ROOT));
  const databaseName = resolveDatabaseName(slug);
  const envPath = path.join(REPO_ROOT, '.env');
  const examplePath = path.join(REPO_ROOT, '.env.example');

  // Генерация `.env` пропускается, если файл уже есть (без --force), но
  // остальные шаги идемпотентны и выполняются всегда: иначе после падения
  // миграции повторный запуск печатал бы «успех», не доведя стенд.
  const generateEnv = !existsSync(envPath) || force;

  if (generateEnv && !existsSync(examplePath)) {
    fail(`не найден ${examplePath} — без него нечего брать за основу .env`);
  }

  const dbHostPort = resolveDbHostPort(envPath, examplePath);

  if (!(await isPortOpen(dbHostPort))) {
    fail(
      `Postgres недоступен на 127.0.0.1:${dbHostPort}.\n` +
        `Запустите общий контейнер: docker compose up -d db`,
    );
  }

  if (generateEnv) {
    const ports =
      slug === MAIN_SLUG
        ? MAIN_PORTS
        : (readOwnPorts(envPath) ??
          (await pickPortPair(isPortFree, PORT_SEARCH_START, collectReservedPorts(envPath))));

    const host = slug === MAIN_SLUG ? 'localhost' : `${slug}.localhost`;
    const webUrl = `http://${host}:${ports.webPort}`;

    const content = buildEnvContent(readFileSync(examplePath, 'utf8'), {
      DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${dbHostPort}/${databaseName}?schema=public`,
      DB_HOST_PORT: dbHostPort,
      API_PORT: ports.apiPort,
      WEB_PORT: ports.webPort,
      NEXTAUTH_URL: webUrl,
      WEB_URL: webUrl,
      NEXT_PUBLIC_API_URL: `http://${host}:${ports.apiPort}`,
      API_URL: `http://127.0.0.1:${ports.apiPort}`,
      CORS_ORIGIN: buildCorsOrigin(webUrl, ports.webPort),
    });

    writeFileSync(envPath, content, 'utf8');
    console.log(
      `Сгенерирован .env: БД ${databaseName}, порты web ${ports.webPort} / api ${ports.apiPort}`,
    );
  } else {
    console.log(`.env уже существует — файл не тронут (перегенерация: --force).`);
    printEnvSummary(readFileSync(envPath, 'utf8'));
  }

  run('pnpm', ['--filter', '@repo/types', '--filter', '@repo/utils', 'build']);
  run('pnpm', ['--filter', '@repo/api', 'db:generate']);
  run('pnpm', ['--filter', '@repo/api', 'db:migrate']);
  run('pnpm', ['--filter', '@repo/api', 'db:seed']);

  const seed = readSeedCredentials();
  const finalEnv = readFileSync(envPath, 'utf8');

  console.log('');
  console.log('Стенд готов.');
  console.log(`  Запуск:  pnpm dev`);
  console.log(`  Адрес:   ${readEnvValue(finalEnv, 'NEXTAUTH_URL')}`);
  console.log(`  API:     ${readEnvValue(finalEnv, 'API_URL')}`);
  console.log(`  Вход:    ${seed.email} / ${seed.password}`);
}

/**
 * Порт общего контейнера Postgres на хосте. Берётся из того же источника, что и
 * `${DB_HOST_PORT}` в `docker-compose.yml`, иначе генератор и compose разошлись бы.
 *
 * @param {string} envPath путь к `.env` текущей копии
 * @param {string} examplePath путь к `.env.example`
 * @returns {number}
 */
function resolveDbHostPort(envPath, examplePath) {
  const sources = [
    process.env['DB_HOST_PORT'],
    ...[envPath, examplePath]
      .filter((file) => existsSync(file))
      .map((file) => readEnvValue(readFileSync(file, 'utf8'), 'DB_HOST_PORT')),
  ];

  for (const value of sources) {
    const port = Number(value);
    if (value !== undefined && value !== '' && Number.isInteger(port) && port > 0) {
      return port;
    }
  }

  return DEFAULT_DB_HOST_PORT;
}

/**
 * Список origin'ов для CORS: адрес стенда плюс эквивалентные петлевые адреса на
 * том же порту, чтобы привычный заход на `localhost`/`127.0.0.1` не упирался в CORS.
 *
 * @param {string} webUrl адрес стенда для браузера
 * @param {number} webPort
 * @returns {string} значение `CORS_ORIGIN`
 */
function buildCorsOrigin(webUrl, webPort) {
  return [...new Set([webUrl, `http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`])].join(
    ',',
  );
}

/**
 * Возвращает пару портов, уже закреплённую за этой копией в её `.env`.
 *
 * Нужно для `--force`: если стенд копии сейчас запущен, её собственные порты
 * выглядят занятыми, и подбор увёл бы копию на новую пару. Порты копии — её
 * собственность, перегенерация их не меняет.
 *
 * @param {string} envPath путь к `.env` текущей копии
 * @returns {{ webPort: number, apiPort: number } | undefined}
 */
function readOwnPorts(envPath) {
  if (!existsSync(envPath)) {
    return undefined;
  }

  const content = readFileSync(envPath, 'utf8');
  const webPort = Number(readEnvValue(content, 'WEB_PORT'));
  const apiPort = Number(readEnvValue(content, 'API_PORT'));

  if (!Number.isInteger(webPort) || apiPort !== webPort + 1) {
    return undefined;
  }

  return { webPort, apiPort };
}

/**
 * Собирает порты, уже записанные в `.env` соседних worktree: две копии,
 * подготовленные до первого запуска, иначе получили бы одинаковую пару.
 *
 * @param {string} ownEnvPath путь к `.env` текущей копии
 * @returns {number[]}
 */
function collectReservedPorts(ownEnvPath) {
  const listing = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (listing.status !== 0) {
    console.warn('Не удалось прочитать список worktree — порты соседних копий не учитываются.');
    return [];
  }

  const ports = [];

  for (const line of listing.stdout.split('\n')) {
    if (!line.startsWith('worktree ')) {
      continue;
    }

    const envPath = path.join(line.slice('worktree '.length).trim(), '.env');
    if (envPath === ownEnvPath || !existsSync(envPath)) {
      continue;
    }

    for (const key of ['API_PORT', 'WEB_PORT']) {
      const value = readEnvValue(readFileSync(envPath, 'utf8'), key);
      if (value !== undefined && Number.isInteger(Number(value))) {
        ports.push(Number(value));
      }
    }
  }

  return ports;
}

/**
 * Читает учётные данные seed-пользователя из `prisma/seed.ts`,
 * чтобы не дублировать константы в двух местах.
 *
 * @returns {{ email: string, password: string }}
 */
function readSeedCredentials() {
  const source = readFileSync(path.join(REPO_ROOT, 'apps/api/prisma/seed.ts'), 'utf8');
  const email = /email:\s*'([^']+)'/.exec(source);
  const password = /bcrypt\.hash\(\s*'([^']+)'/.exec(source);

  if (email === null || password === null) {
    fail('не удалось извлечь учётные данные seed-пользователя из apps/api/prisma/seed.ts');
  }

  return { email: email[1], password: password[1] };
}

/**
 * @param {string} content содержимое `.env`
 * @param {string} key имя переменной
 * @returns {string | undefined} значение без кавычек
 */
function readEnvValue(content, key) {
  const match = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`, 'm').exec(content);
  if (match === null) {
    return undefined;
  }

  const raw = match[1].trim();

  // Значение в кавычках берём целиком (внутри допустим и `#`), голое — обрезаем
  // по комментарию: иначе `WEB_PORT=3010 # порт копии` прочитался бы как NaN.
  const quoted = /^(["'])(.*?)\1/.exec(raw);
  return quoted === null ? raw.split(/\s+#/)[0].trim() : quoted[2];
}

/** @param {string} content содержимое `.env` */
function printEnvSummary(content) {
  for (const key of ['DATABASE_URL', 'WEB_PORT', 'API_PORT', 'NEXTAUTH_URL']) {
    console.log(`  ${key}=${readEnvValue(content, key) ?? '(не задан)'}`);
  }
}

/**
 * Свободен ли порт: пытаемся занять его сами на всех интерфейсах.
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

/**
 * Принимает ли кто-то соединения на порту (проверка контейнера БД).
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(DB_PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });

  if (result.status !== 0) {
    fail(`команда "${command} ${args.join(' ')}" завершилась с ошибкой`);
  }
}

/** @param {string} message */
function fail(message) {
  console.error(`\nОшибка: ${message}`);
  process.exit(1);
}

await main();
