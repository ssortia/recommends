import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetDocFileQueryDto {
  @ApiProperty({
    description: 'Относительный путь от docs/ (например adr/012-api-error-format.md)',
    example: 'adr/012-api-error-format.md',
  })
  @IsString()
  path!: string;
}
