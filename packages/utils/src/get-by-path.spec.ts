import { getByPath } from './get-by-path';

describe('getByPath', () => {
  it('извлекает значение верхнего уровня', () => {
    expect(getByPath({ email: 'a@b.com' }, 'email')).toBe('a@b.com');
  });

  it('извлекает вложенное значение по dot-пути', () => {
    expect(getByPath({ user: { profile: { email: 'a@b.com' } } }, 'user.profile.email')).toBe(
      'a@b.com',
    );
  });

  it('поддерживает индексы массивов', () => {
    expect(getByPath({ items: [{ id: 7 }] }, 'items.0.id')).toBe(7);
  });

  it('возвращает undefined для несуществующего пути', () => {
    expect(getByPath({ user: {} }, 'user.email')).toBeUndefined();
  });

  it('возвращает undefined, если промежуточный сегмент не объект', () => {
    expect(getByPath({ user: 'string' }, 'user.email')).toBeUndefined();
  });

  it('не бросает на null/undefined источнике', () => {
    expect(getByPath(null, 'a.b')).toBeUndefined();
    expect(getByPath(undefined, 'a.b')).toBeUndefined();
  });
});
