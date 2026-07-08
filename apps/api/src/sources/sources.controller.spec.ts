import { BadRequestException, ConflictException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { SourcesController } from './sources.controller';
import type { SourcesService } from './sources.service';

describe('SourcesController', () => {
  let sourcesService: { addSource: jest.Mock; listForUser: jest.Mock };
  let controller: SourcesController;
  const user = { id: 'u1' } as User;

  beforeEach(() => {
    sourcesService = { addSource: jest.fn(), listForUser: jest.fn() };
    controller = new SourcesController(sourcesService as unknown as SourcesService);
  });

  describe('addSource', () => {
    it('делегирует userId и url в SourcesService.addSource', async () => {
      const result = { source: { id: 's1' }, articlesCount: 2 };
      sourcesService.addSource.mockResolvedValue(result);

      const response = await controller.addSource({ url: 'https://example.com/feed.xml' }, user);

      expect(response).toEqual(result);
      expect(sourcesService.addSource).toHaveBeenCalledWith('u1', 'https://example.com/feed.xml');
    });

    it('пробрасывает BadRequestException из сервиса', async () => {
      sourcesService.addSource.mockRejectedValue(new BadRequestException('bad feed'));

      await expect(controller.addSource({ url: 'https://bad.example.com' }, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('пробрасывает ConflictException из сервиса', async () => {
      sourcesService.addSource.mockRejectedValue(new ConflictException('already subscribed'));

      await expect(
        controller.addSource({ url: 'https://example.com/feed.xml' }, user),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listSources', () => {
    it('делегирует userId в SourcesService.listForUser', async () => {
      const rows = [{ userId: 'u1', sourceId: 's1' }];
      sourcesService.listForUser.mockResolvedValue(rows);

      const response = await controller.listSources(user);

      expect(response).toEqual(rows);
      expect(sourcesService.listForUser).toHaveBeenCalledWith('u1');
    });
  });
});
