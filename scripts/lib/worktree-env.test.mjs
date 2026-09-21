import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildEnvContent, pickPortPair, resolveDatabaseName, toSlug } from './worktree-env.mjs';

describe('toSlug', () => {
  it('оставляет обычное имя без изменений', () => {
    assert.equal(toSlug('sandworm'), 'sandworm');
  });

  it('приводит к нижнему регистру и сохраняет дефисы', () => {
    assert.equal(toSlug('31-Worktree-Local-Dev'), '31-worktree-local-dev');
  });

  it('заменяет недопустимые символы на дефис и схлопывает повторы', () => {
    assert.equal(toSlug('My_Feature  Branch!!'), 'my-feature-branch');
  });

  it('обрезает разделители по краям', () => {
    assert.equal(toSlug('__feature__'), 'feature');
  });

  it('ограничивает длину меткой имени хоста', () => {
    const slug = toSlug('a'.repeat(80));
    assert.equal(slug.length, 63);
  });

  it('бросает ошибку, если slug получился пустым', () => {
    assert.throws(() => toSlug('!!!'), /не удалось получить slug/);
  });
});

describe('resolveDatabaseName', () => {
  it('добавляет префикс для копии и заменяет дефисы на подчёркивания', () => {
    assert.equal(resolveDatabaseName('31-worktree-local-dev'), 'recommends_31_worktree_local_dev');
  });

  it('сохраняет имя БД по умолчанию для основного checkout', () => {
    assert.equal(resolveDatabaseName('recommends'), 'recommends');
  });
});

describe('pickPortPair', () => {
  const allFree = () => true;

  it('возвращает первую пару, когда она свободна', async () => {
    assert.deepEqual(await pickPortPair(allFree, 3010), { webPort: 3010, apiPort: 3011 });
  });

  it('пропускает пары, занятые в системе', async () => {
    const busy = new Set([3010, 3021]);
    const isPortFree = (port) => !busy.has(port);

    assert.deepEqual(await pickPortPair(isPortFree, 3010), { webPort: 3030, apiPort: 3031 });
  });

  it('пропускает пару, свободную в системе, но занятую соседним .env', async () => {
    assert.deepEqual(await pickPortPair(allFree, 3010, [3011]), { webPort: 3020, apiPort: 3021 });
  });

  it('поддерживает асинхронную проверку порта', async () => {
    const isPortFree = async (port) => port >= 3020;

    assert.deepEqual(await pickPortPair(isPortFree, 3010), { webPort: 3020, apiPort: 3021 });
  });

  it('бросает ошибку, когда свободных пар не осталось', async () => {
    await assert.rejects(() => pickPortPair(() => false, 3010), /не найдено свободной пары портов/);
  });
});

describe('buildEnvContent', () => {
  const example = [
    '# Database',
    'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recommends?schema=public"',
    '',
    '# API',
    'NEXT_PUBLIC_API_URL="http://localhost:3001"',
    'MAIL_FROM="no-reply@example.com"',
    '',
  ].join('\n');

  it('подставляет значения и сохраняет прочие ключи и комментарии', () => {
    const content = buildEnvContent(example, {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5444/recommends_copy?schema=public',
      NEXT_PUBLIC_API_URL: 'http://copy.localhost:3011',
    });

    assert.equal(
      content,
      [
        '# Database',
        'DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5444/recommends_copy?schema=public"',
        '',
        '# API',
        'NEXT_PUBLIC_API_URL="http://copy.localhost:3011"',
        'MAIL_FROM="no-reply@example.com"',
        '',
      ].join('\n'),
    );
  });

  it('дописывает ключи, которых нет в примере', () => {
    const content = buildEnvContent(example, { WEB_PORT: 3010, API_PORT: 3011 });

    assert.match(content, /\nWEB_PORT="3010"\nAPI_PORT="3011"\n$/);
    assert.match(content, /^# Database\n/);
  });

  it('учитывает префикс export и пробелы вокруг знака равенства', () => {
    const content = buildEnvContent('export API_PORT = "3001"', { API_PORT: 3011 });

    assert.equal(content, 'export API_PORT="3011"');
  });

  it('экранирует кавычки и обратные слэши в значении', () => {
    const content = buildEnvContent('SMTP_PASS=""', { SMTP_PASS: 'a"b\\c' });

    assert.equal(content, 'SMTP_PASS="a\\"b\\\\c"');
  });
});
