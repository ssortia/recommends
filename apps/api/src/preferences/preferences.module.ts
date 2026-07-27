import { Module } from '@nestjs/common';

import { SourcesModule } from '../sources/sources.module';

import { PreferencesController } from './preferences.controller';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';
import { SourcePreferencesRepository } from './source-preferences.repository';

@Module({
  imports: [SourcesModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, PreferencesRepository, SourcePreferencesRepository],
})
export class PreferencesModule {}
