import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return ok status', () => {
    const result = controller.check();
    expect(result).toMatchObject({ status: 'ok' });
  });
});
