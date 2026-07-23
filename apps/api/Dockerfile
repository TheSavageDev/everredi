FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --filter @everredi/api...

FROM deps AS build
COPY . .
RUN pnpm --filter @everredi/types build \
 && pnpm --filter @everredi/validation build \
 && pnpm --filter @everredi/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 5051
CMD ["node", "dist/main.js"]
