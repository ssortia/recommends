.PHONY: install dev build lint typecheck test db-migrate db-seed db-studio docker-up docker-down

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

db-migrate:
	pnpm --filter @repo/api db:migrate

db-seed:
	pnpm --filter @repo/api db:seed

db-studio:
	pnpm --filter @repo/api db:studio

docker-up:
	docker compose up -d

docker-down:
	docker compose down
