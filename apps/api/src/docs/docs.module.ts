import { Module } from '@nestjs/common';

import { RolesGuard } from '../auth/guards/roles.guard';

import { DEFAULT_DOCS_ROOT, DOCS_ROOT } from './docs.constants';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({
  controllers: [DocsController],
  providers: [
    RolesGuard,
    DocsService,
    // Корень docs внедряется через токен, чтобы тесты задавали путь к фикстурам,
    // а не зависели от __dirname (дефолт — DEFAULT_DOCS_ROOT рядом с токеном).
    { provide: DOCS_ROOT, useValue: DEFAULT_DOCS_ROOT },
  ],
})
export class DocsModule {}
