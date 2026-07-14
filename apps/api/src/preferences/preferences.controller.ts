import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../auth/guards/verified.guard';

import { PreferencesResponseDto } from './dto/preferences-response.dto';
import { SourcePreferenceResponseDto } from './dto/source-preference-response.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSourcePreferenceDto } from './dto/update-source-preference.dto';
import { PreferencesService } from './preferences.service';

@ApiTags('preferences')
@Controller('preferences')
@UseGuards(JwtAuthGuard, VerifiedGuard)
@ApiBearerAuth()
export class PreferencesController {
  constructor(private preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user preferences' })
  @ApiOkResponse({ type: PreferencesResponseDto })
  async get(@CurrentUser() user: User) {
    return this.preferencesService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user preferences' })
  @ApiOkResponse({ type: PreferencesResponseDto })
  async update(@Body() dto: UpdatePreferencesDto, @CurrentUser() user: User) {
    // Отсутствие ключа в теле запроса (партиальный PATCH) отличаем от явного null,
    // чтобы будущие поля DTO (#13/#14) не затирались при обновлении только одного из них.
    const data =
      'interestsDescription' in dto ? { interestsDescription: dto.interestsDescription } : {};

    return this.preferencesService.update(user.id, data);
  }

  @Get('sources/:sourceId')
  @ApiOperation({ summary: 'Get interests description for a specific source' })
  @ApiOkResponse({ type: SourcePreferenceResponseDto })
  async getForSource(@Param('sourceId') sourceId: string, @CurrentUser() user: User) {
    return this.preferencesService.getForSource(user.id, sourceId);
  }

  @Patch('sources/:sourceId')
  @ApiOperation({ summary: 'Update interests description for a specific source' })
  @ApiOkResponse({ type: SourcePreferenceResponseDto })
  async updateForSource(
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdateSourcePreferenceDto,
    @CurrentUser() user: User,
  ) {
    // Отсутствие ключа в теле запроса (партиальный PATCH) отличаем от явного null —
    // см. аналогичный комментарий в update() выше.
    const data =
      'interestsDescription' in dto ? { interestsDescription: dto.interestsDescription } : {};

    return this.preferencesService.updateForSource(user.id, sourceId, data);
  }
}
