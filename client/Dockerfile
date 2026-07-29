# Base stage
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Development stage
FROM base AS development
# Copy source code
COPY . .
# Expose port
EXPOSE 3715
# Start development server
CMD ["npm", "run", "dev"]

# Builder stage for production build
FROM base AS builder
# Copy source code
COPY . .
# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine AS production
# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*
# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html
# Ensure nginx user owns the static files
RUN chown -R nginx:nginx /usr/share/nginx/html
# Expose port
EXPOSE 80
# Use nginx user (non-root)
USER nginx
# Start nginx
CMD ["nginx", "-g", "daemon off;"]