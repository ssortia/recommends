# Добавление нового модуля

**Цель:** добавить новую бизнес-сущность в монорепо по всем слоям — от Prisma-модели до UI.

В качестве примера — добавляем модуль `Post` (посты пользователя).

---

## Предварительные требования

- Проект запущен (см. [getting-started.md](./getting-started.md))
- Понимание структуры NestJS-модулей

---

## Шаги

### 1. Обновить Prisma-схему

Файл: `packages/database/prisma/schema.prisma`

```prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  body      String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}
```

Не забудь добавить связь в модель `User`:
```prisma
model User {
  // ...существующие поля...
  posts Post[]
}
```

### 2. Создать и применить миграцию

```bash
pnpm --filter @repo/api db:migrate
# Имя миграции: add-posts
```

Prisma Client обновится автоматически после миграции.

### 3. Добавить общие типы в `@repo/types`

Файл: `packages/types/src/post.ts`

```typescript
import { z } from 'zod';

export const CreatePostDtoSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
});

export type CreatePostDto = z.infer<typeof CreatePostDtoSchema>;

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  authorId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Post = z.infer<typeof PostSchema>;
```

Добавить реэкспорт в `packages/types/src/index.ts`:

```typescript
export * from './post';
```

Пересобрать пакет:
```bash
pnpm --filter @repo/types build
```

### 4. Создать NestJS-модуль

#### 4.1 DTO

Файл: `apps/api/src/posts/dto/create-post.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Мой первый пост' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Содержимое поста...' })
  @IsString()
  @MinLength(1)
  body: string;
}
```

#### 4.2 Service

Файл: `apps/api/src/posts/posts.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: { ...dto, authorId },
    });
  }

  async findByAuthor(authorId: string) {
    return this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

#### 4.3 Controller

Файл: `apps/api/src/posts/posts.controller.ts`

```typescript
import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @Get('my')
  findMy(@Request() req: { user: { id: string } }) {
    return this.postsService.findByAuthor(req.user.id);
  }
}
```

#### 4.4 Module

Файл: `apps/api/src/posts/posts.module.ts`

```typescript
import { Module } from '@nestjs/common';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

#### 4.5 Зарегистрировать в AppModule

Файл: `apps/api/src/app.module.ts`

```typescript
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    // ...существующие модули...
    PostsModule,
  ],
})
export class AppModule {}
```

### 5. Использовать в Web-приложении

Новый эндпоинт доступен через `src/lib/api.ts`:

```typescript
import type { CreatePostDto, Post } from '@repo/types';

import { api } from '@/lib/api';

// В Server Component или Server Action:
const posts = await api.get<Post[]>('/posts/my', { accessToken });
const newPost = await api.post<Post>('/posts', dto, { accessToken });
```

### 6. Проверить

```bash
pnpm typecheck   # нет ошибок типов
pnpm lint        # нет lint-ошибок
pnpm build       # всё собирается
```

В Swagger (http://localhost:3001/api/docs) должны появиться эндпоинты в группе `posts`.

---

## Чеклист нового модуля

- [ ] Prisma-модель в `schema.prisma`
- [ ] Миграция создана и применена
- [ ] Zod-схемы в `@repo/types`
- [ ] DTO с декораторами class-validator
- [ ] Service с Prisma-запросами
- [ ] Controller с Swagger-декораторами
- [ ] Module создан и зарегистрирован в AppModule
- [ ] Тест для Service или Controller (минимум один)
- [ ] `pnpm typecheck` и `pnpm lint` без ошибок
