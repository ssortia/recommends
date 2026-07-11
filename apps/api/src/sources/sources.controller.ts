import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../auth/guards/verified.guard';

import { AddSourceDto } from './dto/add-source.dto';
import { AddSourceResponseDto, UserSourceResponseDto } from './dto/source-response.dto';
import { SourcesService } from './sources.service';

@ApiTags('sources')
@Controller('sources')
@UseGuards(JwtAuthGuard, VerifiedGuard)
@ApiBearerAuth()
export class SourcesController {
  constructor(private sourcesService: SourcesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Add an RSS/Atom source by URL or a Telegram channel by @username/link, and subscribe the current user',
  })
  @ApiOkResponse({ type: AddSourceResponseDto })
  async addSource(@Body() dto: AddSourceDto, @CurrentUser() user: User) {
    return this.sourcesService.addSource(user.id, dto.url);
  }

  @Get()
  @ApiOperation({ summary: 'List sources the current user is subscribed to' })
  @ApiOkResponse({ type: [UserSourceResponseDto] })
  async listSources(@CurrentUser() user: User) {
    return this.sourcesService.listForUser(user.id);
  }

  @Delete(':sourceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unsubscribe current user from a source' })
  @ApiParam({ name: 'sourceId' })
  @ApiNoContentResponse({ description: 'Successfully unsubscribed' })
  async removeSource(@Param('sourceId') sourceId: string, @CurrentUser() user: User) {
    await this.sourcesService.removeSource(user.id, sourceId);
  }
}
