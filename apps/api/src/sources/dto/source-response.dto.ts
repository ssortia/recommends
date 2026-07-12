import { ApiProperty } from '@nestjs/swagger';
import { SourceType } from '@prisma/client';

export class SourceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SourceType, enumName: 'SourceType' })
  type: SourceType;

  @ApiProperty()
  url: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  faviconUrl: string | null;

  @ApiProperty({ nullable: true })
  lastFetchedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class AddSourceResponseDto {
  @ApiProperty({ type: SourceDto })
  source: SourceDto;

  @ApiProperty()
  articlesCount: number;
}

export class UserSourceResponseDto {
  @ApiProperty({ type: SourceDto })
  source: SourceDto;

  @ApiProperty()
  createdAt: Date;
}
