import { FaviconGate } from './favicon.gate';

describe('FaviconGate', () => {
  let gate: FaviconGate;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    gate = new FaviconGate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('находит <link rel="icon"> и резолвит относительный URL', async () => {
    const html = `<html><head><link rel="icon" href="/static/icon.png"></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('https://example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toBe('https://example.com/static/icon.png');
  });

  it('находит <link rel="shortcut icon"> и резолвит абсолютный URL как есть', async () => {
    const html = `<html><head><link rel="shortcut icon" href="https://cdn.example.com/icon.ico"></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('https://example.com');

    expect(result).toBe('https://cdn.example.com/icon.ico');
  });

  it('делает fallback на /favicon.ico при отсутствии тега link', async () => {
    const html = `<html><head><title>Example</title></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('https://example.com');

    expect(result).toBe('https://example.com/favicon.ico');
  });

  it('возвращает null при !res.ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' });

    const result = await gate.fetch('https://example.com');

    expect(result).toBeNull();
  });

  it('возвращает null при сетевой ошибке', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await gate.fetch('https://unreachable.example.com');

    expect(result).toBeNull();
  });

  it('передаёт AbortSignal с таймаутом в fetch', async () => {
    const html = `<html><head><link rel="icon" href="/icon.png"></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    await gate.fetch('https://example.com');

    const options = fetchMock.mock.calls[0][1] as { signal?: AbortSignal };
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('отклоняет href с data: URI и возвращает null', async () => {
    const html = `<html><head><link rel="icon" href="data:image/png;base64,AAAA"></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('https://example.com');

    expect(result).toBeNull();
  });

  it('отклоняет href с javascript: URI и возвращает null', async () => {
    const html = `<html><head><link rel="icon" href="javascript:alert(1)"></head></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('https://example.com');

    expect(result).toBeNull();
  });
});
