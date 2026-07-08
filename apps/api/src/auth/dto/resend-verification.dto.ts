import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

// Зеркалит ResendVerificationDtoSchema из @repo/types.
export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
