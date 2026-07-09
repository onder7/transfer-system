# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Tüm workspace manifest'leri
COPY package*.json ./
COPY packages/shared/package*.json  ./packages/shared/
COPY apps/web/package*.json          ./apps/web/
COPY apps/admin/package*.json        ./apps/admin/
COPY backend/package*.json           ./backend/

RUN npm ci

# Kaynak kopyala
COPY packages/shared/ ./packages/shared/
COPY apps/web/        ./apps/web/

# shared önce derlenmeli — Vite exports'dan dist/index.js'i bulacak
RUN npm run build -w packages/shared
RUN npm run build -w apps/web

# ── Stage 2: nginx ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ || exit 1
