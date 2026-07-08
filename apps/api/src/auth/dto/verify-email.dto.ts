import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

// Зеркалит VerifyEmailDtoSchema из @repo/types.
export class VerifyEmailDto {
  @ApiProperty({ description: 'Одноразовый токен из письма верификации' })
  @IsString()
  token: string;
}
