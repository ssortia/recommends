import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { DocsController } from './docs.controller';
import type { DocsService } from './docs.service';

describe('DocsController', () => {
  let service: { getTree: jest.Mock; getFile: jest.Mock };
  let controller: DocsController;

  beforeEach(() => {
    service = {
      getTree: jest.fn().mockResolvedValue({ groups: [] }),
      getFile: jest.fn().mockResolvedValue({ path: 'adr/x.md', content: '# x' }),
    };
    controller = new DocsController(service as unknown as DocsService);
  });

  it('getTree делегирует в DocsService.getTree', async () => {
    const result = await controller.getTree();
    expect(service.getTree).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ groups: [] });
  });

  it('getFile передаёт path из query в DocsService.getFile', async () => {
    const result = await controller.getFile({ path: 'adr/x.md' });
    expect(service.getFile).toHaveBeenCalledWith('adr/x.md');
    expect(result).toEqual({ path: 'adr/x.md', content: '# x' });
  });

  it.each(['getTree', 'getFile'] as const)(
    '%s защищён JwtAuthGuard + RolesGuard и ролью ADMIN',
    (method) => {
      const handler = DocsController.prototype[method];

      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);

      const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
      expect(roles).toEqual([Role.ADMIN]);
    },
  );
});
