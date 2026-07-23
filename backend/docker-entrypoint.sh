#!/bin/sh
set -e

echo "→ Prisma db push & migration..."
cd /app/backend
npx prisma migrate deploy || npx prisma db push --accept-data-loss
npx prisma db seed || true

echo "→ Sunucu başlatılıyor..."
exec node /app/backend/dist/index.js
