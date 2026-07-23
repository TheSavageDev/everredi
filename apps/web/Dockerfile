FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --filter @everredi/web...

FROM deps AS build
COPY . .
RUN pnpm --filter @everredi/types build \
 && pnpm --filter @everredi/validation build \
 && pnpm --filter @everredi/api-client build \
 && pnpm --filter @everredi/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
