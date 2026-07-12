import { Module } from '@nestjs/common';

import { ArticlesRepository } from './articles.repository';
import { FaviconGate } from './favicon.gate';
import { RssGate } from './rss.gate';
import { SourcesController } from './sources.controller';
import { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';
import { TelegramGate } from './telegram.gate';
import { UserSourcesRepository } from './user-sources.repository';

@Module({
  controllers: [SourcesController],
  providers: [
    SourcesService,
    SourcesRepository,
    UserSourcesRepository,
    ArticlesRepository,
    RssGate,
    TelegramGate,
    FaviconGate,
  ],
})
export class SourcesModule {}
