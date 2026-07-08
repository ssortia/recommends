import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { DocsService } from './docs.service';

describe('DocsService', () => {
  let docsRoot: string;
  let service: DocsService;

  beforeEach(async () => {
    // Временный каталог-фикстура — не зависим от __dirname/реального docs/.
    docsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-fixture-'));

    await fs.mkdir(path.join(docsRoot, 'adr'), { recursive: true });
    await fs.mkdir(path.join(docsRoot, 'guides'), { recursive: true });
    // Вложенный каталог второго уровня — проверяет рекурсивный обход.
    await fs.mkdir(path.join(docsRoot, 'plans', 'completed'), { recursive: true });

    await fs.writeFile(path.join(docsRoot, 'README.md'), '# root readme');
    await fs.writeFile(path.join(docsRoot, 'DOCUMENTATION.md'), '# docs meta');
    await fs.writeFile(path.join(docsRoot, 'adr', '012-error.md'), '# adr 12');
    await fs.writeFile(path.join(docsRoot, 'adr', '001-init.md'), '# adr 1');
    await fs.writeFile(path.join(docsRoot, 'guides', 'audit.md'), '# guide');
    await fs.writeFile(path.join(docsRoot, 'plans', 'completed', 'x.md'), '# nested plan');
    // Не-.md рядом — не должен попасть в дерево.
    await fs.writeFile(path.join(docsRoot, 'guides', 'image.png'), 'binary');

    service = new DocsService(docsRoot);
  });

  afterEach(async () => {
    await fs.rm(docsRoot, { recursive: true, force: true });
  });

  describe('getTree', () => {
    it('группирует по первому сегменту (корень → root) и детерминированно сортирует', async () => {
      const tree = await service.getTree();

      expect(tree.groups.map((g) => g.group)).toEqual(['adr', 'guides', 'plans', 'root']);

      const adr = tree.groups.find((g) => g.group === 'adr')!;
      expect(adr.files.map((f) => f.path)).toEqual(['adr/001-init.md', 'adr/012-error.md']);
      expect(adr.files[0]).toEqual({ path: 'adr/001-init.md', name: '001-init.md', group: 'adr' });

      const root = tree.groups.find((g) => g.group === 'root')!;
      expect(root.files.map((f) => f.path)).toEqual(['DOCUMENTATION.md', 'README.md']);
    });

    it('рекурсивно обходит вложенные каталоги (depth-2) и группирует по первому сегменту', async () => {
      const tree = await service.getTree();
      const plans = tree.groups.find((g) => g.group === 'plans')!;
      // Файл лежит на втором уровне, но группа — первый сегмент, путь POSIX.
      expect(plans.files).toEqual([{ path: 'plans/completed/x.md', name: 'x.md', group: 'plans' }]);
    });

    it('игнорирует не-.md файлы', async () => {
      const tree = await service.getTree();
      const guides = tree.groups.find((g) => g.group === 'guides')!;
      expect(guides.files.map((f) => f.path)).toEqual(['guides/audit.md']);
    });

    it('возвращает пустой список групп для каталога без .md', async () => {
      const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-empty-'));
      try {
        const tree = await new DocsService(empty).getTree();
        expect(tree).toEqual({ groups: [] });
      } finally {
        await fs.rm(empty, { recursive: true, force: true });
      }
    });
  });

  describe('getFile', () => {
    it('возвращает содержимое валидного .md', async () => {
      const file = await service.getFile('adr/012-error.md');
      expect(file).toEqual({ path: 'adr/012-error.md', content: '# adr 12' });
    });

    it('возвращает вложенный файл с POSIX-нормализацией пути', async () => {
      // На входе системный разделитель — наружу всегда '/'.
      const file = await service.getFile(path.join('plans', 'completed', 'x.md'));
      expect(file).toEqual({ path: 'plans/completed/x.md', content: '# nested plan' });
    });

    it('бросает BadRequestException на не-.md', async () => {
      await expect(service.getFile('guides/image.png')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает NotFoundException на отсутствующий файл', async () => {
      await expect(service.getFile('adr/999-missing.md')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('бросает ошибку на относительный traversal .md (доходит до startsWith-гарда)', async () => {
      // Расширение .md проходит первый чек — защита держится именно на startsWith.
      await expect(service.getFile('../secret.md')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает ошибку на АБСОЛЮТНЫЙ .md путь вне корня (доходит до startsWith-гарда)', async () => {
      // Расширение .md проходит первый чек — защита держится именно на startsWith.
      const absoluteOutside = `${docsRoot}-secret/leak.md`;
      await expect(service.getFile(absoluteOutside)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['../package.json', 'не-.md отбивается проверкой расширения'],
      ['/etc/passwd', 'абсолютный путь без .md — проверка расширения'],
    ])('бросает BadRequest на не-.md ввод: %s', async (input) => {
      await expect(service.getFile(input)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает ошибку на ложный префикс каталога (docs-secret)', async () => {
      // Каталог-сосед с похожим префиксом не должен проходить проверку startsWith(root + sep).
      const sibling = `${docsRoot}-secret`;
      await fs.mkdir(sibling, { recursive: true });
      await fs.writeFile(path.join(sibling, 'leak.md'), 'secret');
      try {
        const rel = path.join('..', `${path.basename(docsRoot)}-secret`, 'leak.md');
        await expect(service.getFile(rel)).rejects.toBeInstanceOf(BadRequestException);
      } finally {
        await fs.rm(sibling, { recursive: true, force: true });
      }
    });

    it('не следует за symlink, указывающим за пределы корня', async () => {
      const sibling = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-target-'));
      await fs.writeFile(path.join(sibling, 'target.md'), 'secret');
      try {
        await fs.symlink(path.join(sibling, 'target.md'), path.join(docsRoot, 'link.md'));
        await expect(service.getFile('link.md')).rejects.toBeInstanceOf(BadRequestException);
      } finally {
        await fs.rm(sibling, { recursive: true, force: true });
      }
    });
  });
});
