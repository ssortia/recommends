import { DocsFileContentSchema, DocsFileMetaSchema, DocsGroupSchema, DocsTreeSchema } from './docs';

describe('docs schemas', () => {
  it('DocsFileMetaSchema принимает валидный объект', () => {
    const meta = {
      path: 'adr/013-docs-viewer-api.md',
      name: '013-docs-viewer-api.md',
      group: 'adr',
    };
    expect(DocsFileMetaSchema.parse(meta)).toEqual(meta);
  });

  it('DocsFileMetaSchema падает при отсутствии обязательного поля', () => {
    expect(() => DocsFileMetaSchema.parse({ path: 'a.md', name: 'a.md' })).toThrow();
  });

  it('DocsGroupSchema принимает группу с файлами', () => {
    const group = {
      group: 'guides',
      files: [{ path: 'guides/x.md', name: 'x.md', group: 'guides' }],
    };
    expect(DocsGroupSchema.parse(group)).toEqual(group);
  });

  it('DocsGroupSchema падает при отсутствии group', () => {
    expect(() => DocsGroupSchema.parse({ files: [] })).toThrow();
  });

  it('DocsTreeSchema принимает дерево с группами', () => {
    const tree = {
      groups: [{ group: 'root', files: [{ path: 'README.md', name: 'README.md', group: 'root' }] }],
    };
    expect(DocsTreeSchema.parse(tree)).toEqual(tree);
  });

  it('DocsTreeSchema падает при неверном типе files', () => {
    expect(() => DocsTreeSchema.parse({ groups: [{ group: 'root', files: 'oops' }] })).toThrow();
  });

  it('DocsFileContentSchema принимает path + content', () => {
    const file = { path: 'guides/x.md', content: '# Заголовок' };
    expect(DocsFileContentSchema.parse(file)).toEqual(file);
  });

  it('DocsFileContentSchema падает при числовом content', () => {
    expect(() => DocsFileContentSchema.parse({ path: 'x.md', content: 42 })).toThrow();
  });
});
