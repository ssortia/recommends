import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class AddSourceDto {
  @ApiProperty({ example: 'https://example.com/feed.xml' })
  @IsUrl()
  url: string;
}
