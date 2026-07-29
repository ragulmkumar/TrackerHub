# Project configuration
APP_NAME=trackerhub
BACKEND_DIR=backend
FRONTEND_DIR=client
DOCKER_COMPOSE_DEV=docker-compose-dev.yml
DOCKER_COMPOSE_PROD=docker-compose-prod.yml

# Go specific
GO=go
GOFLAGS=-mod=readonly
GOLANGCI_LINT=golangci-lint

# Node specific
NPM=npm

# Docker
DOCKER=docker
DOCKER_COMPOSE=docker-compose

.PHONY: all help

# Default target
all: help

# Show help
help:
	@echo "Available targets:"
	@echo "  build                 - Build backend and frontend binaries/assets"
	@echo "  run                   - Run the application locally"
	@echo "  dev                   - Run development mode with hot reload"
	@echo "  clean                 - Remove build artifacts"
	@echo "  test                  - Run tests"
	@echo "  test-coverage         - Run tests with coverage"
	@echo "  lint                  - Run linters"
	@echo "  fmt                   - Format code"
	@echo "  vet                   - Run Go vet"
	@echo "  tidy                  - Go mod tidy"
	@echo "  generate              - Generate code (swagger, etc.)"
	@echo "  migrate-up            - Run database migrations up"
	@echo "  migrate-down          - Rollback database migrations"
	@echo "  migrate-create name   - Create new migration"
	@echo ""
	@echo "  Docker targets:"
	@echo "  docker-build          - Build Docker images"
	@echo "  docker-dev            - Start development environment with docker-compose"
	@echo "  docker-prod           - Start production environment with docker-compose"
	@echo "  docker-up             - Alias for docker-dev"
	@echo "  docker-down           - Stop and remove containers"
	@echo "  docker-logs           - View container logs"
	@echo "  docker-clean          - Remove containers, networks, images, and volumes"
	@echo ""
	@echo "  Frontend targets:"
	@echo "  frontend-install      - Install frontend dependencies"
	@echo "  frontend-build        - Build frontend for production"
	@echo "  frontend-dev          - Start frontend development server"
	@echo ""
	@echo "  Backend targets:"
	@echo "  backend-build         - Build backend binary"
	@echo "  backend-run           - Run backend server"
	@echo ""

# Build targets
build: backend-build frontend-build

backend-build:
	@echo "Building backend..."
	cd $(BACKEND_DIR) && $(GO) build -o bin/$(APP_NAME) ./cmd/server

frontend-build:
	@echo "Building frontend..."
	cd $(FRONTEND_DIR) && $(NPM) run build

# Run targets
run: backend-run
	@echo "Starting application..."

backend-run: backend-build
	@echo "Starting backend..."
	cd $(BACKEND_DIR) && ./bin/$(APP_NAME)

dev: backend-dev frontend-dev
	@echo "Starting development servers..."

backend-dev:
	@echo "Starting backend in development mode..."
	cd $(BACKEND_DIR) && air

frontend-dev:
	@echo "Starting frontend development server..."
	cd $(FRONTEND_DIR) && $(NPM) run dev

# Clean targets
clean: backend-clean frontend-clean

backend-clean:
	@echo "Cleaning backend..."
	cd $(BACKEND_DIR) && rm -rf bin/

frontend-clean:
	@echo "Cleaning frontend..."
	cd $(FRONTEND_DIR) && rm -rf dist/ .vite/

# Test targets
test:
	@echo "Running tests..."
	cd $(BACKEND_DIR) && $(GO) test ./... -v
	cd $(FRONTEND_DIR) && $(NPM) test

test-coverage:
	@echo "Running tests with coverage..."
	cd $(BACKEND_DIR) && $(GO) test ./... -coverprofile=coverage.out -v
	cd $(FRONTEND_DIR) && $(NPM) test -- --coverage

# Linting
lint:
	@echo "Running linters..."
	cd $(BACKEND_DIR) && $(GOLANGCI_LINT) run ./...
	cd $(FRONTEND_DIR) && $(NPM) run lint

# Formatting
fmt:
	@echo "Formatting code..."
	cd $(BACKEND_DIR) && $(GO) fmt ./...
	cd $(FRONTEND_DIR) && $(NPM) run format

# Vet
vet:
	@echo "Running go vet..."
	cd $(BACKEND_DIR) && $(GO) vet ./...

# Tidy
tidy:
	@echo "Running go mod tidy..."
	cd $(BACKEND_DIR) && $(GO) mod tidy

# Generate
generate:
	@echo "Generating code..."
	cd $(BACKEND_DIR) && go install github.com/swaggo/swag/cmd/swag@latest
	cd $(BACKEND_DIR) && ~/go/bin/swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal

# Migration helpers (placeholders - adjust based on your migration tool)
migrate-up:
	@echo "Running database migrations up..."
	# Add your migration command here, e.g.:
	# migrate -path db/migrations -database "postgres://user:pass@localhost:5432/db?sslmode=disable" up

migrate-down:
	@echo "Rolling back database migrations..."
	# Add your migration command here

migrate-create:
	@if [ -z "$(name)" ]; then \
		echo "Error: migration name required. Usage: make migrate-create name=migration_name"; \
		exit 1; \
	fi
	@echo "Creating migration $(name)..."
	# Add your migration creation command here

# Docker targets
docker-build:
	@echo "Building Docker images..."
	docker compose -f $(DOCKER_COMPOSE_PROD) build

docker-dev:
	@echo "Starting development environment...
	docker compose -f $(DOCKER_COMPOSE_DEV) up

docker-prod:
	@echo "Starting production environment..."
	docker compose -f $(DOCKER_COMPOSE_PROD) up -d

docker-up: docker-dev

docker-down:
	@echo "Stopping and removing containers..."
	docker compose -f $(DOCKER_COMPOSE_DEV) down -v

docker-logs:
	@echo "Showing logs..."
	docker compose -f $(DOCKER_COMPOSE_DEV) logs -f

docker-clean:
	@echo "Cleaning up Docker resources..."
	docker compose -f $(DOCKER_COMPOSE_DEV) down -v --rmi all --remove-orphans
	docker system prune -f

# Test individual components
backend-test:
	@echo "Running backend tests..."
	cd $(BACKEND_DIR) && $(GO) test ./... -v

frontend-test:
	@echo "Running frontend tests..."
	cd $(FRONTEND_DIR) && $(NPM) test

# Help target with more details
help-detail:
	@echo "Makefile for $(APP_NAME)"
	@echo ""
	@echo "BUILD TARGETS:"
	@echo "  make build           - Build both backend and frontend"
	@echo "  make backend-build   - Build backend binary only"
	@echo "  make frontend-build  - Build frontend assets only"
	@echo ""
	@echo "RUN TARGETS:"
	@echo "  make run             - Run the built application"
	@echo "  make backend-run     - Run backend server only"
	@echo ""
	@echo "DEVELOPMENT TARGETS:"
	@echo "  make dev             - Start both backend and frontend in dev mode"
	@echo "  make backend-dev     - Start backend with hot reload (air)"
	@echo "  make frontend-dev    - Start frontend dev server (Vite)"
	@echo ""
	@echo "TESTING TARGETS:"
	@echo "  make test            - Run all tests"
	@echo "  make test-coverage   - Run tests with coverage report"
	@echo "  make backend-test    - Run backend tests only"
	@echo "  make frontend-test   - Run frontend tests only"
	@echo ""
	@echo "CODE QUALITY TARGETS:"
	@echo "  make lint            - Run linters (golangci-lint + eslint)"
	@echo "  make fmt             - Format code (go fmt + prettier)"
	@echo "  make vet             - Run Go vet"
	@echo "  make tidy            - Run go mod tidy"
	@echo ""
	@echo "DOCKER TARGETS:"
	@echo "  make docker-build    - Build production Docker images"
	@echo "  make docker-dev      - Start development environment (docker-compose)"
	@echo "  make docker-prod     - Start production environment (docker-compose)"
	@echo "  make docker-down     - Stop containers"
	@echo "  make docker-logs     - Follow container logs"
	@echo "  make docker-clean    - Remove all Docker resources"
	@echo ""
	@echo "UTILITY TARGETS:"
	@echo "  make clean           - Remove build artifacts"
	@echo "  make generate        - Generate code (Swagger docs, etc.)"

.SILENT: