import { ApiProperty } from '@nestjs/swagger';
import { AuditEvent } from '@prisma/client';

export class AuditResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AuditEvent, enumName: 'AuditEvent' })
  event: AuditEvent;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ nullable: true })
  actorId: string | null;

  @ApiProperty({ nullable: true })
  actorEmail: string | null;

  @ApiProperty({ nullable: true })
  targetId: string | null;

  @ApiProperty({ nullable: true })
  targetType: string | null;

  @ApiProperty({ nullable: true, type: Object })
  metadata: unknown;

  @ApiProperty({ nullable: true })
  ip: string | null;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditResponseDto] })
  items: AuditResponseDto[];

  @ApiProperty()
  total: number;
}
