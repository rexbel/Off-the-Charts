# Off the Chart: production image (the Cloudflare Container behind deploy/cloudflare, or any host).
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 otc
COPY --from=build --chown=otc /app/.next/standalone ./
COPY --from=build --chown=otc /app/.next/static ./.next/static
COPY --from=build --chown=otc /app/public ./public
# SQLite database and cached audio; created and migrated on the first request.
RUN mkdir -p data && chown otc data
USER otc
EXPOSE 3000
CMD ["node", "server.js"]
