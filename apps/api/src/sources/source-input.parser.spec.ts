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

    it('t.me/joinchat/xxx → не Telegram-матч (служебный путь, не URL)', () => {
      const result = parseSourceInput('t.me/joinchat/xxx');
      expect(result?.type).not.toBe('TELEGRAM');
    });

    it('t.me/s/username → не Telegram-матч (служебный путь, не URL)', () => {
      const result = parseSourceInput('t.me/s/username');
      expect(result?.type).not.toBe('TELEGRAM');
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

    it('t.me/addstickers/pack → не Telegram-матч (служебный путь, не URL)', () => {
      const result = parseSourceInput('t.me/addstickers/pack');
      expect(result?.type).not.toBe('TELEGRAM');
    });
  });
});
