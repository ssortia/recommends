import fs from 'node:fs/promises';
import * as path from 'node:path';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DocsFileContent, DocsFileMeta, DocsTree } from '@repo/types';

import { DOCS_ROOT } from './docs.constants';

const ROOT_GROUP = 'root';

@Injectable()
export class DocsService {
  constructor(@Inject(DOCS_ROOT) private readonly docsRoot: string) {}

  async getTree(): Promise<DocsTree> {
    const relPaths = await this.collectMarkdown(this.docsRoot, '');

    const groups = new Map<string, DocsFileMeta[]>();
    for (const relPath of relPaths) {
      const segments = relPath.split(path.sep);
      const group = segments.length > 1 ? segments[0]! : ROOT_GROUP;
      const meta: DocsFileMeta = {
        path: segments.join('/'), // наружу всегда POSIX-разделитель
        name: path.basename(relPath),
        group,
      };
      const bucket = groups.get(group);
      if (bucket) bucket.push(meta);
      else groups.set(group, [meta]);
    }

    return {
      groups: [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, files]) => ({
          group,
          files: files.sort((a, b) => a.path.localeCompare(b.path)),
        })),
    };
  }

  async getFile(relPath: string): Promise<DocsFileContent> {
    // Fastify уже декодирует query-параметры, повторный decodeURIComponent здесь
    // лишний и падал бы URIError→500 на битом percent-encoding (?path=%zz).
    const normalized = path.normalize(relPath);

    if (path.extname(normalized).toLowerCase() !== '.md') {
      throw new BadRequestException('Допустимы только .md файлы');
    }

    const absolute = path.resolve(this.docsRoot, normalized);
    // Защита от path traversal, абсолютных путей и ложного префикса (docs-secret):
    // итоговый путь обязан лежать строго внутри docsRoot.
    if (!absolute.startsWith(this.docsRoot + path.sep)) {
      throw new BadRequestException('Недопустимый путь');
    }

    let content: string;
    let realPath: string;
    try {
      content = await fs.readFile(absolute, 'utf-8');
      // realpath отдельно: symlink внутри docs/ мог бы указывать наружу корня.
      realPath = await fs.realpath(absolute);
    } catch {
      throw new NotFoundException('Файл не найден');
    }

    const realRoot = await fs.realpath(this.docsRoot);
    if (!realPath.startsWith(realRoot + path.sep)) {
      throw new BadRequestException('Недопустимый путь');
    }

    return { path: normalized.split(path.sep).join('/'), content };
  }

  private async collectMarkdown(dir: string, relDir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        result.push(...(await this.collectMarkdown(path.join(dir, entry.name), relPath)));
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
        result.push(relPath);
      }
    }

    return result;
  }
}
