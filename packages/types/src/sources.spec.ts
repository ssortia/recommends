import { AddSourceResponseSchema, AddSourceSchema, SourceSchema } from './sources';

describe('sources schemas', () => {
  it('AddSourceSchema принимает валидный URL', () => {
    const input = { url: 'https://example.com/feed.xml' };
    expect(AddSourceSchema.parse(input)).toEqual(input);
  });

  it('AddSourceSchema принимает @username Telegram-канала', () => {
    const input = { url: '@channel' };
    expect(AddSourceSchema.parse(input)).toEqual(input);
  });

  it('AddSourceSchema принимает t.me/username', () => {
    const input = { url: 't.me/channel' };
    expect(AddSourceSchema.parse(input)).toEqual(input);
  });

  it('AddSourceSchema принимает произвольную непустую строку (формат проверяется на бэкенде)', () => {
    expect(() => AddSourceSchema.parse({ url: 'not-a-url' })).not.toThrow();
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
      faviconUrl: null,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source)).toMatchObject({ id: source.id, title: source.title });
  });

  it('SourceSchema принимает faviconUrl со значением URL', () => {
    const source = {
      id: 'src_1',
      type: 'RSS',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      faviconUrl: 'https://example.com/favicon.ico',
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source).faviconUrl).toBe('https://example.com/favicon.ico');
  });

  it('SourceSchema принимает lastFetchedAt = null', () => {
    const source = {
      id: 'src_1',
      type: 'RSS',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      faviconUrl: null,
      lastFetchedAt: null,
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source).lastFetchedAt).toBeNull();
  });

  it('SourceSchema принимает type: TELEGRAM', () => {
    const source = {
      id: 'src_1',
      type: 'TELEGRAM',
      url: 'https://t.me/channel',
      title: '@channel',
      faviconUrl: null,
      lastFetchedAt: null,
      createdAt: new Date().toISOString(),
    };
    expect(SourceSchema.parse(source)).toMatchObject({ type: 'TELEGRAM' });
  });

  it('SourceSchema падает при неизвестном type', () => {
    const source = {
      id: 'src_1',
      type: 'UNKNOWN',
      url: 'https://example.com/feed.xml',
      title: 'Example Feed',
      faviconUrl: null,
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
        faviconUrl: null,
        lastFetchedAt: null,
        createdAt: new Date().toISOString(),
      },
      articlesCount: 5,
    };
    expect(AddSourceResponseSchema.parse(response).articlesCount).toBe(5);
  });
});
