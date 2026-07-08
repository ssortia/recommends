import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditEvent } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAuditQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по актору: email (частичное) или точный id' })
  @IsOptional()
  @IsString()
  actor?: string;

  @ApiPropertyOptional({ enum: AuditEvent, enumName: 'AuditEvent', description: 'Тип события' })
  @IsOptional()
  @IsEnum(AuditEvent)
  event?: AuditEvent;

  @ApiPropertyOptional({ description: 'Дата от (ISO)', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional({ description: 'Дата до (ISO)', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Сортировка по дате' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Размер страницы (1..100)', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Смещение', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
