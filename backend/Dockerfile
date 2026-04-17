FROM node:18-alpine AS builder
WORKDIR /app

# Dependências nativas do Chromium (necessárias para Puppeteer compilar bindings)
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine
WORKDIR /app

# Chromium e dependências nativas para Puppeteer em produção
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont curl

# Informa ao Puppeteer para não baixar Chromium próprio e onde está o do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3333
CMD ["node", "dist/server.js"]
