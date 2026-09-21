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

/** Порт общего контейнера Postgres (сервис `db` в docker-compose.yml). */
const DB_HOST_PORT = 5444;

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

  if (existsSync(envPath) && !force) {
    console.log(`.env уже существует — файл не тронут (перегенерация: --force).`);
    printEnvSummary(readFileSync(envPath, 'utf8'));
    return;
  }

  if (!existsSync(examplePath)) {
    fail(`не найден ${examplePath} — без него нечего брать за основу .env`);
  }

  if (!(await isPortOpen(DB_HOST_PORT))) {
    fail(
      `Postgres недоступен на 127.0.0.1:${DB_HOST_PORT}.\n` +
        `Запустите общий контейнер: docker compose up -d db`,
    );
  }

  const ports =
    slug === MAIN_SLUG
      ? MAIN_PORTS
      : await pickPortPair(isPortFree, PORT_SEARCH_START, collectReservedPorts(envPath));

  const host = slug === MAIN_SLUG ? 'localhost' : `${slug}.localhost`;
  const webUrl = `http://${host}:${ports.webPort}`;

  const content = buildEnvContent(readFileSync(examplePath, 'utf8'), {
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${DB_HOST_PORT}/${databaseName}?schema=public`,
    DB_HOST_PORT,
    API_PORT: ports.apiPort,
    WEB_PORT: ports.webPort,
    NEXTAUTH_URL: webUrl,
    WEB_URL: webUrl,
    NEXT_PUBLIC_API_URL: `http://${host}:${ports.apiPort}`,
    API_URL: `http://127.0.0.1:${ports.apiPort}`,
    CORS_ORIGIN: `${webUrl},http://localhost:${ports.webPort}`,
  });

  writeFileSync(envPath, content, 'utf8');
  console.log(
    `Сгенерирован .env: БД ${databaseName}, порты web ${ports.webPort} / api ${ports.apiPort}`,
  );

  run('pnpm', ['--filter', '@repo/types', '--filter', '@repo/utils', 'build']);
  run('pnpm', ['--filter', '@repo/api', 'db:generate']);
  run('pnpm', ['--filter', '@repo/api', 'db:migrate']);
  run('pnpm', ['--filter', '@repo/api', 'db:seed']);

  const seed = readSeedCredentials();

  console.log('');
  console.log('Стенд готов.');
  console.log(`  Запуск:  pnpm dev`);
  console.log(`  Адрес:   ${webUrl}`);
  console.log(`  API:     http://127.0.0.1:${ports.apiPort}`);
  console.log(`  Вход:    ${seed.email} / ${seed.password}`);
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

  return match[1].trim().replace(/^["']|["']$/g, '');
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
