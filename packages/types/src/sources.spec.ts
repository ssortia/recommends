import { AddSourceResponseSchema, AddSourceSchema, SourceSchema } from './sources';

describe('sources schemas', () => {
  it('AddSourceSchema принимает валидный URL', () => {
    const input = { url: 'https://example.com/feed.xml' };
    expect(AddSourceSchema.parse(input)).toEqual(input);
  });

  it('AddSourceSchema падает на невалидном URL', () => {
    expect(() => AddSourceSchema.parse({ url: 'not-a-url' })).toThrow();
  });

  it('AddSourceSchema падает на пустой строке', () => {
    expect(() => AddSourceSchema.parse({ url: '' })).toThrow();
  });

  it('SourceSchema принимает валидный объект источника', () => {
    const source = {
      id: 'src_1',
      type: 'RSS',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source)).toMatchObject({ id: source.id, title: source.title });
  });

  it('SourceSchema принимает lastFetchedAt = null', () => {
    const source = {
      id: 'src_1',
      type: 'RSS',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      lastFetchedAt: null,
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source).lastFetchedAt).toBeNull();
  });

  it('SourceSchema падает при неизвестном type', () => {
    const source = {
      id: 'src_1',
      type: 'TELEGRAM',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      lastFetchedAt: null,
      createdAt: new Date().toISOString(),
    };
    expect(() => SourceSchema.parse(source)).toThrow();
  });

  it('AddSourceResponseSchema принимает source + articlesCount', () => {
    const response = {
      source: {
        id: 'src_1',
        type: 'RSS',
        url: 'https://example.com/feed.xml',
        title: 'Example Feed',
        lastFetchedAt: null,
        createdAt: new Date().toISOString(),
      },
      articlesCount: 5,
    };
    expect(AddSourceResponseSchema.parse(response).articlesCount).toBe(5);
  });
});
