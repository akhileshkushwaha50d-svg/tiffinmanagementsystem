# =================================================================
# Production Dockerfile for Tiffin Management & Delivery Web App
# Multi-Tenant Express.js + Prisma ORM + Frontend SPA
# =================================================================

FROM node:20-alpine AS runner

# Install OpenSSL required by Prisma engine on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Set Production Environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency manifests and Prisma schema first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy application source code and static assets
COPY server.js ./
COPY index.html ./
COPY static ./static/

# Expose server port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start production server
CMD ["node", "server.js"]
