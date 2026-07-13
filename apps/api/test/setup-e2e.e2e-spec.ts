import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadRootEnv } from './setup-e2e';

/**
 * Регресс-тест на приоритет принудительного MAIL_TRANSPORT=json (setup-e2e.ts)
 * над значением из .env. Использует фейковый .env вместо реального, чтобы не
 * зависеть от его содержимого — только проверяет ??=-механизм loadRootEnv.
 */
describe('setup-e2e: MAIL_TRANSPORT override', () => {
  it('не даёт .env с MAIL_TRANSPORT=smtp перезаписать уже выставленный json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'setup-e2e-'));
    const fakeEnvPath = join(dir, '.env');
    writeFileSync(fakeEnvPath, 'MAIL_TRANSPORT=smtp\n');

    // setupFiles (setup-e2e.ts) уже выставил MAIL_TRANSPORT=json до этого теста.
    expect(process.env['MAIL_TRANSPORT']).toBe('json');

    loadRootEnv(fakeEnvPath);

    expect(process.env['MAIL_TRANSPORT']).toBe('json');
  });
});
