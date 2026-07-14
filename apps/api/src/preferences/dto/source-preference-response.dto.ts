import { ApiProperty } from '@nestjs/swagger';

export class SourcePreferenceResponseDto {
  @ApiProperty({ nullable: true })
  interestsDescription: string | null;
}
