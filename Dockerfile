FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies including dev dependencies (needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build the application
RUN pnpm run build

# Remove devDependencies
RUN pnpm prune --prod

FROM node:22-alpine

WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000

CMD ["node", "build"]
