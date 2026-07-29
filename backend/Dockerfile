# Base image for development and production builds
FROM golang:1.25.6-alpine AS builder

# Install git and ca-certificates (needed for Go modules)
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o trackerhub ./cmd/server

# Development stage
FROM golang:1.25.6-alpine AS development

# Install air for live reload
RUN go install github.com/air-verse/air@v1.52.2

# Set PATH to include $GOPATH/bin
ENV PATH="${PATH}:/go/bin"

WORKDIR /app
COPY . .

# Expose port
EXPOSE 8022

# Command to run the app with air for hot rebuild
CMD ["air"]

# Production stage
FROM alpine:3.20 AS production

# Install ca-certificates for HTTPS
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/trackerhub .

# Expose port
EXPOSE 8022

# Command to run the binary
CMD ["./trackerhub"]