# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
# Remove local .env so it never overrides Docker env vars
RUN rm -f .env
RUN npm run build

# ---- Stage 2: Production ----
FROM node:22-alpine

# Chromium for Puppeteer (PDF generation)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Create assets directories
RUN mkdir -p assets/system assets/avatars assets/certificates

# Docker-native health check — Coolify and docker-compose use this
# to know the container is actually serving requests
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1

EXPOSE 3333
CMD ["node", "dist/server.js"]
