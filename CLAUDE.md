# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Придерживайся следующих правил:

1. Описывай что ты делаешь
2. Используй для ответов РУССКИЙ язык
3. Делай все качественно архитектурно (и в соответствии с общепринятыми стандартами применяемых технологий)
4. Комментарии к коду пиши на русском языке
5. Когда предлагаешь внести какое-то изменение в код кратко пиши что делаешь и для чего
6. В commit message всегда указывай номер GitHub issue (кроме коммитов с редактированием файла CLAUDE.md), в рамках которого делается коммит — через `(refs #N)` или `(closes #N)` в конце первой строки. Это нужно чтобы коммит отображался в issue на GitHub.
7. После завершения реализации задачи — не коммитить сразу. Сообщи пользователю, что реализация готова и дождаться его подтверждения перед коммитом.
8. Когда пользователь говорит «создай задачу», «поставь задачу», «добавь задачу» или подобные фразы — создавать GitHub issue через `gh issue create`, а не TaskCreate.
9. Пользователь тоже может ошибаться. Если замечаешь нелогичное решение, потенциальную проблему или явно плохую практику — сообщи об этом прямо и предложи альтернативные варианты. Не молчи из вежливости.
10. Когда пользователь просит «сохранить план в файл» — сохранять в файл внутри проекта (например, в `docs/guides/`), а не во внутреннюю память Claude.
11. Когда предлагаешь несколько вариантов на выбор, для обозначения вариантов используй нумерацию, а не буквы латинского алфавита.
12. Не добавляй в commit message свое соавторство
13. Добавляй номер issue в начало имени ветки при ее создании
14. Пиши только максимально необходимые комментарии в местах с неочевидным поведением. В остальном код должен быть самодокументируемым.

## Project Overview

This is a **monorepo template** for full-stack projects using NestJS (API) + Next.js (web) with shadcn/ui. It is a starter template — the goal is to scaffold a production-ready foundation, not a running application.

## Monorepo Tooling

- **Package manager**: pnpm with workspaces (`pnpm-workspace.yaml`)
- **Build orchestration**: Turborepo (`turbo.json`)
- **Node version**: defined in `.nvmrc` / `package.json#engines`

## Common Commands

```bash
# Install all dependencies
pnpm install

# Start all apps in dev mode
pnpm dev

# Build all packages and apps
pnpm build

# Lint entire monorepo
pnpm lint

# Type-check entire monorepo
pnpm typecheck

# Run all tests
pnpm test

# Run tests for a single package (from root)
pnpm --filter @repo/web test
pnpm --filter @repo/api test

# Database
pnpm --filter @repo/api db:generate  # generate Prisma Client
pnpm --filter @repo/api db:migrate   # apply migrations
pnpm --filter @repo/api db:seed      # seed the database
pnpm --filter @repo/api db:studio    # open Prisma Studio

# Docker (local infrastructure: postgres, redis)
docker compose up -d
docker compose down
```

## Repository Structure

Полная структура проекта описана в `README.md`. Краткий обзор:

- `apps/api` — NestJS backend (Fastify, SWC, JWT auth, Swagger)
- `apps/web` — Next.js 15 frontend (App Router, next-auth v5, shadcn/ui)
- `packages/` — общие пакеты: `ui`, `types`, `utils`, `config/{eslint,typescript,prettier}`
- `docker/` — Dockerfile-ы и nginx.conf
- `.github/workflows/ci.yml` — CI: lint → typecheck → test → build

## Architecture Decisions

### API (`apps/api`)

- Uses **Fastify** adapter (not Express) for performance
- Uses **SWC** compiler (not `tsc`) for faster builds
- Global `ValidationPipe` with `class-validator` + `class-transformer`
- Swagger docs at `/api/docs`
- Health check at `/health`
- Structured logging via `nestjs-pino`
- Env validation via `zod` at startup
- Module structure: `auth`, `users`, `prisma`, `audit`, `mailer`, `verification`, `docs` (core modules pre-configured)
- Audit logging: declarative `@Audit(...)` decorator on controller handlers + a global `AuditInterceptor` (see ADR-010 and `docs/guides/adding-audit-event.md`)
- Email flow: email verification + password reset on one-time tokens (`mailer` module over nodemailer with transport-by-env, `verification` token table, `VerifiedGuard`) — see ADR-011 and `docs/guides/email-verification-and-password-reset.md`
- Error format: global `AllExceptionsFilter` (`common/filters/`) normalizes every error source to a single `ApiErrorBody` shape `{ statusCode, message, details? }` (HttpException, validation, Prisma `P2002`→409/`P2025`→404, unknown→500 without leaking internals) — see ADR-012
- Docs viewer: `docs` module serves the repo's `docs/` Markdown (tree + file content) for an admin-only `/admin/docs` section (ADMIN RBAC via `RolesGuard`, path-traversal protected, `docs/` shipped into the image) — see ADR-013

### Web (`apps/web`)

- Next.js 15 with **App Router** and `src/` directory
- `@/*` path alias resolves to `src/`
- Turbopack enabled in dev mode
- Typesafe env via `@t3-oss/env-nextjs`
- Server state: `@tanstack/react-query`
- Client state: `zustand`
- Forms: `react-hook-form` + `zod`
- Auth: `next-auth` v5
- UI components: shadcn/ui in `src/components/ui/`, utilities in `src/lib/utils.ts`

### Shared Packages

- `@repo/types` — Zod schemas and TypeScript interfaces shared between API and web; the source of truth for data shapes

### TypeScript

- `packages/config/typescript/base.json` is the root tsconfig; each app/package extends it
- Strict mode enabled everywhere

### ESLint

- ESLint v9 flat config
- Separate rule sets for NestJS (Node) and Next.js (browser/React) contexts
- `eslint-plugin-import` enforces import order

## Environment Variables

See `.env.example` at the root. Each app reads its own subset:

| Variable                          | Used by |
| --------------------------------- | ------- |
| `DATABASE_URL`                    | api     |
| `REDIS_URL`                       | api     |
| `JWT_SECRET`, `JWT_EXPIRES_IN`    | api     |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | web     |
| `NEXT_PUBLIC_API_URL`             | web     |

## Документация

Авторитетный источник правил ведения документации — [`docs/DOCUMENTATION.md`](./docs/DOCUMENTATION.md).

Ключевые правила:

- **Новое архитектурное решение** → создать ADR в `docs/adr/` по шаблону из `docs/adr/README.md` и добавить строку в индекс.
- **Новый гайд или фича** → добавить/обновить соответствующий файл в `docs/guides/`.
- **Список фич в README.md** должен отражать реальное состояние шаблона — обновлять при добавлении/удалении возможностей.
- **Комментарии в коде** — только «почему», не «что». JSDoc только на публичном API пакетов.

Расположение документации:

```
docs/
  DOCUMENTATION.md   # мета-правила ведения доков
  adr/               # Architecture Decision Records
  guides/            # практические руководства
```
