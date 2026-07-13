import { ApiProperty } from '@nestjs/swagger';

export class PreferencesResponseDto {
  @ApiProperty({ nullable: true })
  interestsDescription: string | null;
}
