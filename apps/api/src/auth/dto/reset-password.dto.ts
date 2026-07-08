import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Зеркалит ResetPasswordDtoSchema из @repo/types.
export class ResetPasswordDto {
  @ApiProperty({ description: 'Одноразовый токен из письма сброса пароля' })
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8, description: 'Новый пароль' })
  @IsString()
  @MinLength(8)
  password: string;
}
