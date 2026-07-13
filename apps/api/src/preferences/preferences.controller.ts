import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../auth/guards/verified.guard';

import { PreferencesResponseDto } from './dto/preferences-response.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
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
    return this.preferencesService.update(user.id, dto.interestsDescription);
  }
}
