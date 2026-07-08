import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AuditService } from './audit.service';
import { AuditPageDto } from './dto/audit-response.dto';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List audit log entries (admin only)' })
  @ApiOkResponse({ type: AuditPageDto })
  async findPage(@Query() query: ListAuditQueryDto): Promise<AuditPageDto> {
    return this.auditService.findPage(query);
  }
}
