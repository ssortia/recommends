FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/config/typescript/package.json ./packages/config/typescript/
COPY packages/config/eslint/package.json ./packages/config/eslint/
COPY packages/config/prettier/package.json ./packages/config/prettier/
RUN pnpm install --frozen-lockfile
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
CMD ["sh", "-c", "pnpm --filter @repo/types build && pnpm --filter @repo/web dev"]
