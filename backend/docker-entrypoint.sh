#!/bin/sh
set -e

echo "→ Prisma migration çalıştırılıyor..."
cd /app/backend
npx prisma migrate deploy

echo "→ Sunucu başlatılıyor..."
exec node /app/backend/dist/index.js
