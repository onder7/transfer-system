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
COPY apps/admin/      ./apps/admin/

# shared önce derlenmeli
RUN npm run build -w packages/shared
RUN npm run build -w apps/admin

# ── Stage 2: nginx ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ || exit 1
