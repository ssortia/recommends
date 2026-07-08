import { ApiProperty } from '@nestjs/swagger';

// DTO для Swagger; форма соответствует контрактам из @repo/types
// (DocsFileMeta / DocsGroup / DocsTree / DocsFileContent).

export class DocsFileMetaDto {
  @ApiProperty({ description: 'Относительный путь от docs/' })
  path: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Первый сегмент пути (adr/guides/plans) или root' })
  group: string;
}

export class DocsGroupDto {
  @ApiProperty()
  group: string;

  @ApiProperty({ type: [DocsFileMetaDto] })
  files: DocsFileMetaDto[];
}

export class DocsTreeDto {
  @ApiProperty({ type: [DocsGroupDto] })
  groups: DocsGroupDto[];
}

export class DocsFileContentDto {
  @ApiProperty()
  path: string;

  @ApiProperty()
  content: string;
}
