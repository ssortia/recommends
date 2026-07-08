import { pick } from './pick';

describe('pick', () => {
  it('берёт только указанные поля верхнего уровня', () => {
    expect(pick({ email: 'a@b.com', password: 'secret' }, ['email'])).toEqual({
      email: 'a@b.com',
    });
  });

  it('не включает неперечисленные поля (whitelist)', () => {
    const result = pick({ email: 'a@b.com', password: 'secret', token: 'x' }, ['email']);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('token');
  });

  it('сохраняет структуру вложенности при dot-пути', () => {
    expect(pick({ user: { email: 'a@b.com', password: 'x' } }, ['user.email'])).toEqual({
      user: { email: 'a@b.com' },
    });
  });

  it('собирает несколько путей, включая вложенные', () => {
    expect(pick({ role: 'ADMIN', user: { id: '1', secret: 'x' } }, ['role', 'user.id'])).toEqual({
      role: 'ADMIN',
      user: { id: '1' },
    });
  });

  it('пропускает отсутствующие пути', () => {
    expect(pick({ email: 'a@b.com' }, ['email', 'missing.path'])).toEqual({ email: 'a@b.com' });
  });

  it('возвращает пустой объект для undefined-источника', () => {
    expect(pick(undefined, ['email'])).toEqual({});
  });
});
