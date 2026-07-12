import { getEnv } from '../config/env';

import { TelegramGate } from './telegram.gate';

jest.mock('../config/env', () => ({
  getEnv: jest.fn(),
}));

const getEnvMock = getEnv as jest.Mock;

describe('TelegramGate', () => {
  let gate: TelegramGate;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    getEnvMock.mockReset();
    getEnvMock.mockReturnValue({ TELEGRAM_PREVIEW_BASE_URL: 'https://t.me' });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    gate = new TelegramGate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает title и items при успешном парсинге', async () => {
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header_title">Example Channel</div>
      </div>
      <div class="tgme_widget_message" data-post="example/123">
        <div class="tgme_widget_message_text">Hello world</div>
        <time datetime="2026-07-10T10:00:00+00:00"></time>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('example');

    expect(fetchMock).toHaveBeenCalledWith('https://t.me/s/example');
    expect(result).toEqual({
      title: 'Example Channel',
      items: [
        {
          guid: 'example/123',
          link: 'https://t.me/example/123',
          title: 'Hello world',
          isoDate: '2026-07-10T10:00:00+00:00',
        },
      ],
    });
  });

  it('возвращает photoUrl из src аватарки канала', async () => {
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header">
          <i class="tgme_page_photo_image"><img src="https://cdn4.telesco.pe/file/avatar.jpg"></i>
          <div class="tgme_channel_info_header_title">Photo Channel</div>
        </div>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('withphoto');

    expect(result?.photoUrl).toBe('https://cdn4.telesco.pe/file/avatar.jpg');
  });

  it('photoUrl отсутствует, если у канала нет аватарки (нет <img> внутри .tgme_page_photo_image)', async () => {
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header">
          <i class="tgme_page_photo_image bgcolor0" data-content="NP"></i>
          <div class="tgme_channel_info_header_title">No Photo Channel</div>
        </div>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('nophoto');

    expect(result?.photoUrl).toBeUndefined();
  });

  it('игнорирует нестандартный протокол в src аватарки (data:/javascript:)', async () => {
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header">
          <i class="tgme_page_photo_image"><img src="javascript:alert(1)"></i>
          <div class="tgme_channel_info_header_title">Malicious Channel</div>
        </div>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('malicious');

    expect(result?.photoUrl).toBeUndefined();
  });

  it('возвращает items: [] когда у канала нет постов', async () => {
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header_title">Empty Channel</div>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('empty');

    expect(result).toEqual({ title: 'Empty Channel', items: [] });
  });

  it('возвращает null когда канал не найден (нет .tgme_channel_info)', async () => {
    const html = `<div class="tgme_page_wrap">Channel not found</div>`;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('nonexistent');

    expect(result).toBeNull();
  });

  it('возвращает null при !res.ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' });

    const result = await gate.fetch('missing');

    expect(result).toBeNull();
  });

  it('возвращает null при сетевой ошибке', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await gate.fetch('unreachable');

    expect(result).toBeNull();
  });

  it('обрезает title поста до ~200 символов', async () => {
    const longText = 'a'.repeat(300);
    const html = `
      <div class="tgme_channel_info">
        <div class="tgme_channel_info_header_title">Long Channel</div>
      </div>
      <div class="tgme_widget_message" data-post="long/1">
        <div class="tgme_widget_message_text">${longText}</div>
        <time datetime="2026-07-10T10:00:00+00:00"></time>
      </div>
    `;
    fetchMock.mockResolvedValue({ ok: true, text: async () => html });

    const result = await gate.fetch('long');

    expect(result?.items[0]?.title).toHaveLength(200);
  });
});
