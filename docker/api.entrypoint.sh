#!/bin/sh
set -e
apps/api/node_modules/.bin/prisma migrate deploy \
  --schema apps/api/prisma/schema.prisma
exec node apps/api/dist/main
