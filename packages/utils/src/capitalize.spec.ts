import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('делает первую букву слова заглавной', () => {
    expect(capitalize('guides')).toBe('Guides');
  });

  it('оставляет уже заглавную строку без изменений', () => {
    expect(capitalize('ADR')).toBe('ADR');
  });

  it('возвращает пустую строку как есть', () => {
    expect(capitalize('')).toBe('');
  });

  it('обрабатывает строку из одного символа', () => {
    expect(capitalize('a')).toBe('A');
  });
});
