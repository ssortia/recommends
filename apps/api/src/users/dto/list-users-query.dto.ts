import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по email (частичное совпадение)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: Role, enumName: 'Role', description: 'Фильтр по роли' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: ['email', 'role', 'createdAt'],
    description: 'Поле для сортировки',
  })
  @IsOptional()
  @IsIn(['email', 'role', 'createdAt'])
  sortBy?: 'email' | 'role' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Направление сортировки' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
