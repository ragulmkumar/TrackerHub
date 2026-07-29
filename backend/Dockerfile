# Build stage
FROM golang:1.25.6-alpine AS builder

# Install necessary build tools
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum first for better caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Generate Swagger docs
RUN go install github.com/swaggo/swag/cmd/swag@latest
RUN /go/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o trackerHub ./cmd/server

# Development stage
FROM golang:1.25.6-alpine AS development

# Install air for live reload
RUN go install github.com/air-verse/air@v1.52.2

WORKDIR /app
COPY . .

# Expose port
EXPOSE 8022

# Command to run the app with air for hot rebuild
CMD ["air"]

# Production stage
FROM alpine:latest AS production

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/trackerHub .

# Copy config directory (create if needed)
COPY --from=builder /app/config ./config

# Expose port
EXPOSE 8022

# Run as non-root user for security
RUN adduser -D -u 1000 appuser
USER appuser

# Run the application
CMD ["./trackerHub"]