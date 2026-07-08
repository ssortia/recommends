import * as path from 'node:path';

// DI-токен корня каталога docs/ — выделен в отдельный файл,
// чтобы и модуль, и сервис ссылались на одну константу без циклов импорта.
export const DOCS_ROOT = Symbol('DOCS_ROOT');

// Дефолтный корень docs/ co-located с токеном. SWC даёт плоский dist
// (dist/docs/docs.constants.js), поэтому до корня монорепо ровно 4 уровня
// вверх → <repo>/docs (в Docker-образе → /app/docs).
export const DEFAULT_DOCS_ROOT = path.resolve(__dirname, '../../../../docs');
