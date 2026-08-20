# deal-engine — production image.
#
# Two stages. The first exists only to build web/dist (Vite + React); the
# second is what runs, with dev dependencies pruned. tsx lives in regular
# dependencies because it IS the runtime: tsconfig is noEmit, nothing is ever
# compiled to JS, and `npm start` runs the TypeScript directly. That keeps the
# image build identical to how dev runs the code — no separate compile step to
# drift out of sync.
#
# The container does NOT run migrations on boot. Run them as a one-off before
# (or as the host's release phase):
#
#   docker run --rm --env-file <prod env> <image> npm run migrate
#
# Deliberate: a migration is a schema change to irreplaceable data and belongs
# under the operator's control, not as a side effect of every restart — and a
# failed migration should fail one visible command, not crash-loop the server.

# ---------------------------------------------------------------------------
# Stage 1: build the dashboard bundle.
# ---------------------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY web ./web
RUN npm run web:build

# ---------------------------------------------------------------------------
# Stage 2: runtime.
# ---------------------------------------------------------------------------
FROM node:20-slim
ENV NODE_ENV=production
# Cap the heap: Railway bills memory by actual usage ($10/GB/mo), and an
# uncapped Node heap drifts toward the 0.5GB plan credit all by itself.
ENV NODE_OPTIONS=--max-old-space-size=256
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
COPY --from=build /app/web/dist ./web/dist

# The server reads PORT from the host (API_PORT is a dev-only override).
# 8787 is only the fallback; EXPOSE is documentation, not a binding.
EXPOSE 8787

USER node
CMD ["npm", "start"]
