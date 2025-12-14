# Multi-stage build for Cloud Run

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (Cloud Run uses PORT env var, but we expose 8080 as default)
EXPOSE 8080

# Set NODE_ENV to production
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/main.js"]
