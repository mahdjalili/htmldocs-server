# Use official Bun image
FROM oven/bun:1.3 as base

WORKDIR /app

# Install Playwright dependencies and Chromium
FROM base as playwright-deps
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM playwright-deps as deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the application
FROM deps as build
COPY tsconfig.json ./
COPY src ./src
RUN bun run build

# Production image
FROM playwright-deps as production
WORKDIR /app

# Copy built files and dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Install Playwright browsers (Chromium only for PDF generation)
RUN bun x playwright install chromium --with-deps || \
    bun x playwright install chromium

# Create directory for volume-mounted templates
# Templates will be mounted at /templates by default
# Users can override via HTMDOCS_TEMPLATES_ROOT env var
RUN mkdir -p /templates

# Expose the server port
EXPOSE 4000

# Set default environment variables
ENV PORT=4000
ENV NODE_ENV=production
# Default templates location - can be overridden via volume mount and env var
ENV HTMDOCS_TEMPLATES_ROOT=/templates

# Run the server
CMD ["bun", "./dist/server.js"]