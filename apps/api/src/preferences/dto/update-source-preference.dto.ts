import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSourcePreferenceDto {
  // Пустая строка/null трактуются сервисом как сброс поля — см. Solution Overview плана.
  @ApiProperty({ example: 'только новости про космос', nullable: true, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  interestsDescription?: string | null;
}
