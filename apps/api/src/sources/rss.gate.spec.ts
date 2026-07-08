import { RssGate } from './rss.gate';

const parseURLMock = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: parseURLMock,
  }));
});

describe('RssGate', () => {
  let gate: RssGate;

  beforeEach(() => {
    parseURLMock.mockReset();
    gate = new RssGate();
  });

  it('возвращает title и items при успешном парсинге', async () => {
    parseURLMock.mockResolvedValue({
      title: 'Example Feed',
      items: [{ title: 'Post 1', link: 'https://example.com/1', guid: 'guid-1' }],
    });

    const result = await gate.fetch('https://example.com/feed.xml');

    expect(result).toEqual({
      title: 'Example Feed',
      items: [{ title: 'Post 1', link: 'https://example.com/1', guid: 'guid-1' }],
    });
  });

  it('возвращает items: [] когда фид не содержит items', async () => {
    parseURLMock.mockResolvedValue({ title: 'Empty Feed' });

    const result = await gate.fetch('https://example.com/empty.xml');

    expect(result).toEqual({ title: 'Empty Feed', items: [] });
  });

  it('возвращает null при сетевой ошибке', async () => {
    parseURLMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await gate.fetch('https://unreachable.example.com/feed.xml');

    expect(result).toBeNull();
  });

  it('возвращает null при невалидном XML', async () => {
    parseURLMock.mockRejectedValue(new Error('Invalid XML'));

    const result = await gate.fetch('https://example.com/not-a-feed.html');

    expect(result).toBeNull();
  });
});
