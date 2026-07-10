import { parseSourceInput } from './source-input.parser';

describe('parseSourceInput', () => {
  describe('Telegram', () => {
    it('распознаёт @username', () => {
      expect(parseSourceInput('@channel')).toEqual({ type: 'TELEGRAM', username: 'channel' });
    });

    it('распознаёт t.me/username без протокола', () => {
      expect(parseSourceInput('t.me/channel')).toEqual({ type: 'TELEGRAM', username: 'channel' });
    });

    it('распознаёт https://t.me/username', () => {
      expect(parseSourceInput('https://t.me/channel')).toEqual({
        type: 'TELEGRAM',
        username: 'channel',
      });
    });

    it('распознаёт http://t.me/username', () => {
      expect(parseSourceInput('http://t.me/channel')).toEqual({
        type: 'TELEGRAM',
        username: 'channel',
      });
    });

    it('распознаёт t.me/username с завершающим слэшем', () => {
      expect(parseSourceInput('https://t.me/channel/')).toEqual({
        type: 'TELEGRAM',
        username: 'channel',
      });
    });

    it('нормализует регистр: @Username и t.me/USERNAME дают одинаковый lowercase username', () => {
      const fromAt = parseSourceInput('@Username');
      const fromLink = parseSourceInput('t.me/USERNAME');
      expect(fromAt).toEqual({ type: 'TELEGRAM', username: 'username' });
      expect(fromLink).toEqual({ type: 'TELEGRAM', username: 'username' });
    });

    it('распознаёт домен в верхнем регистре: https://T.me/channel', () => {
      expect(parseSourceInput('https://T.me/channel')).toEqual({
        type: 'TELEGRAM',
        username: 'channel',
      });
    });
  });

  describe('RSS', () => {
    it('распознаёт обычный RSS URL', () => {
      expect(parseSourceInput('https://example.com/feed.xml')).toEqual({
        type: 'RSS',
        url: 'https://example.com/feed.xml',
      });
    });

    it('трактует RSS URL с /t.me/ в пути как RSS, а не Telegram', () => {
      expect(parseSourceInput('https://example.com/t.me/foo')).toEqual({
        type: 'RSS',
        url: 'https://example.com/t.me/foo',
      });
    });
  });

  describe('невалидный ввод', () => {
    it('пустая строка → null', () => {
      expect(parseSourceInput('')).toBeNull();
    });

    it('строка из пробелов → null', () => {
      expect(parseSourceInput('   ')).toBeNull();
    });

    it('t.me/joinchat/xxx → null (служебный путь, без протокола — не URL и не канал)', () => {
      expect(parseSourceInput('t.me/joinchat/xxx')).toBeNull();
    });

    it('t.me/s/username → null (служебный путь, без протокола — не URL и не канал)', () => {
      expect(parseSourceInput('t.me/s/username')).toBeNull();
    });

    it('https://t.me/s/username → null, а не ложный RSS-матч (служебный preview-путь)', () => {
      expect(parseSourceInput('https://t.me/s/username')).toBeNull();
    });

    it('https://t.me/joinchat/xxx → null, а не ложный RSS-матч', () => {
      expect(parseSourceInput('https://t.me/joinchat/xxx')).toBeNull();
    });

    it('txme/username → null, не ложный Telegram-матч', () => {
      const result = parseSourceInput('txme/username');
      expect(result).toBeNull();
    });

    it('случайный текст → null', () => {
      expect(parseSourceInput('просто текст')).toBeNull();
    });

    it('слишком короткое имя (@abcd, 4 символа) → null', () => {
      expect(parseSourceInput('@abcd')).toBeNull();
    });

    it('слишком длинное имя (33 символа) → null', () => {
      const longUsername = 'a'.repeat(33);
      expect(parseSourceInput(`@${longUsername}`)).toBeNull();
    });

    it('t.me/addstickers/pack → null (служебный путь, без протокола — не URL и не канал)', () => {
      expect(parseSourceInput('t.me/addstickers/pack')).toBeNull();
    });

    it('username с ведущей цифрой → null (реальные Telegram-username начинаются с буквы)', () => {
      expect(parseSourceInput('@1channel')).toBeNull();
    });

    it('не-http(s) протокол (ftp://) → null', () => {
      expect(parseSourceInput('ftp://example.com/feed.xml')).toBeNull();
    });

    it('не-http(s) протокол (mailto:) → null', () => {
      expect(parseSourceInput('mailto:foo@bar.com')).toBeNull();
    });
  });
});
