import { msDurationToSeconds } from './duration';

describe('msDurationToSeconds', () => {
  it('парсит секунды (s)', () => {
    expect(msDurationToSeconds('30s')).toBe(30);
  });

  it('парсит минуты (m)', () => {
    expect(msDurationToSeconds('15m')).toBe(900);
  });

  it('парсит часы (h)', () => {
    expect(msDurationToSeconds('1h')).toBe(3600);
  });

  it('парсит дни (d)', () => {
    expect(msDurationToSeconds('7d')).toBe(604800);
  });

  it('парсит недели (w)', () => {
    expect(msDurationToSeconds('2w')).toBe(1209600);
  });

  it('обрабатывает ноль', () => {
    expect(msDurationToSeconds('0h')).toBe(0);
  });

  it('возвращает fallback 900 на нераспарсенной строке', () => {
    expect(msDurationToSeconds('abc')).toBe(900);
    expect(msDurationToSeconds('10')).toBe(900);
    expect(msDurationToSeconds('10y')).toBe(900);
    expect(msDurationToSeconds('')).toBe(900);
    expect(msDurationToSeconds('1.5h')).toBe(900);
  });
});
