# Used only as a source of static files, not as a running service.
FROM ghcr.io/ranuts/document@sha256:5e71d767e15d3c7b056eb7bf75f6f1fedf389095cd463de442c01d384d29336b AS office-assets

FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm (pinned to v9 to match lockfileVersion: '9.0')
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies including dev dependencies (needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

COPY --from=office-assets /public /office-assets
RUN node scripts/prepare-office.mjs /office-assets

# Generate .svelte-kit/ (needed so tsconfig.json can resolve its extends)
RUN pnpm exec svelte-kit sync

# Build the application
RUN pnpm run build

# Remove devDependencies
RUN pnpm prune --prod

FROM node:22-alpine

WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/.office ./.office
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Allow document uploads plus multipart overhead (per-file validation is 25 MiB).
ENV BODY_SIZE_LIMIT=27262976

EXPOSE 3000

CMD ["node", "build"]
