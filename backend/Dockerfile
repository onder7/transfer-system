# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Workspace manifest'leri (layer cache için önce kopyala)
COPY package*.json ./
COPY packages/shared/package*.json  ./packages/shared/
COPY apps/web/package*.json          ./apps/web/
COPY apps/admin/package*.json        ./apps/admin/
COPY backend/package*.json           ./backend/

RUN npm ci

# Kaynak kodu kopyala
COPY packages/shared/ ./packages/shared/
COPY backend/         ./backend/

# Prisma client tiplerini üret
RUN cd backend && npx prisma generate

# shared → backend sırası önemli
RUN npm run build -w packages/shared
RUN npm run build -w backend

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prisma schema (generate için npm ci'dan önce gerekli)
COPY backend/prisma ./backend/prisma

# Workspace manifest'leri
COPY package*.json ./
COPY packages/shared/package*.json  ./packages/shared/
COPY apps/web/package*.json          ./apps/web/
COPY apps/admin/package*.json        ./apps/admin/
COPY backend/package*.json           ./backend/

# Prod bağımlılıkları — prisma artık dep olduğu için generate çalışır
RUN npm ci --omit=dev

# Build çıktıları
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/backend/dist         ./backend/dist

# Prisma client üret (schema backend/prisma'da zaten var)
RUN cd backend && npx prisma generate

# Entrypoint (migrate → start)
COPY backend/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
