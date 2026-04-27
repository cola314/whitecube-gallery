FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi

FROM base AS runner
RUN apk add --no-cache libstdc++
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs server/ ./server/
COPY --chown=nodejs:nodejs public/ ./public/
COPY --chown=nodejs:nodejs package.json ./

RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

USER nodejs
EXPOSE 3000
ENV DATA_DIR=/app/data
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "server/index.js"]
