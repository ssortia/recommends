import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { DocsFileContent, DocsTree } from '@repo/types';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { DocsService } from './docs.service';
import { DocsFileContentDto, DocsTreeDto } from './dto/docs-response.dto';
import { GetDocFileQueryDto } from './dto/get-doc-file-query.dto';

@ApiTags('docs')
@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Дерево файлов документации, сгруппированное по подпапкам (admin only)',
  })
  @ApiOkResponse({ type: DocsTreeDto })
  async getTree(): Promise<DocsTree> {
    return this.docsService.getTree();
  }

  @Get('file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Содержимое .md файла документации (admin only)' })
  @ApiOkResponse({ type: DocsFileContentDto })
  async getFile(@Query() query: GetDocFileQueryDto): Promise<DocsFileContent> {
    return this.docsService.getFile(query.path);
  }
}
