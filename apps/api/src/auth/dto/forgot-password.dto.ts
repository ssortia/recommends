import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

// Зеркалит ForgotPasswordDtoSchema из @repo/types.
export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
