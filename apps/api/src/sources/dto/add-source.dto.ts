import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddSourceDto {
  // Формат (RSS URL или Telegram @username/ссылка) проверяется в сервисе через SourceInputParser,
  // а не на уровне DTO — см. Solution Overview п.7 плана.
  @ApiProperty({ example: 'https://example.com/feed.xml или @channel' })
  @IsString()
  @IsNotEmpty()
  url: string;
}
