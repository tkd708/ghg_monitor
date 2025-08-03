# Multi-stage build for GHG Monitor
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd frontend && npm ci
RUN cd backend && npm ci

# Copy source code
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy built backend
COPY --from=builder /app/backend/dist ./backend/dist

# Copy built frontend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy data directory structure
COPY data/ ./data/

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "backend/dist/index.js"]