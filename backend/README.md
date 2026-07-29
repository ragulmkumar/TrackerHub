# TrackerHub Backend

Indoor positioning backend service that processes BLE beacon detection reports from trackers, computes device positions using Kalman filtering, and provides real-time tracking data via WebSocket and REST APIs.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Running Locally](#running-locally)
- [Running with Docker](#running-with-docker)
- [Makefile Commands](#makefile-commands)
- [Building](#building)
- [Testing](#testing)
- [Linting](#linting)
- [Debugging](#debugging)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Dependencies](#dependencies)

## Overview

TrackerHub is designed for indoor positioning systems (IPS) using BLE beacons and tracker devices. The backend service:

- Receives tracker reports via MQTT (optional) or other inputs
- Processes BLE beacon RSSI readings to estimate device positions using trilateration
- Applies Kalman filtering for smoothing position estimates
- Exposes configuration APIs for web UI (beacon positions, map settings)
- Provides real-time tracker positions via WebSocket
- Maintains tracker state and position history in memory
- Offers REST API for configuration and status queries
- Includes auto-generated Swagger/OpenAPI documentation

## Architecture

The backend follows a Clean Architecture pattern with clear separation of concerns:

```mermaid
graph TD
    A[External Systems] -->|MQTT/HTTP| B(Interface Adapters)
    B --> C[Use Cases]
    C --> D[Entities]
    D -->|Entities| C
    C -->|Use Cases| B
    B -->|Presenters/Controllers| A

    subgraph "Interface Adapters"
        B1[MQTT Listener]
        B2[HTTP Server (Gin)]
        B3[WebSocket Handler]
    end

    subgraph "Use Cases"
        UC1[Position Calculation]
        UC2[Tracker State Management]
        UC3[Configuration Management]
        UC4[Real-time Broadcasting]
    end

    subgraph "Entities"
        E1[TrackerReport]
        E2[TrackerState]
        E3[Beacon]
        E4[MapConfig]
    end
```

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # Application entry point
├── config/
│   ├── server_runtime_config.json   # Runtime configuration (MQTT, server, Kalman)
│   └── web_config.json              # Web UI configuration (map, beacons, settings)
├── internal/
│   ├── api/
│   │   └── handler.go       # HTTP API handlers (Gin)
│   ├── config/
│   │   └── config.go        # Configuration loading/saving
│   ├── models/
│   │   ├── models.go        # Data structures and validation
│   │   └── kalman.go        # Kalman filter implementation
│   ├── mqtt/
│   │   └── mqtt.go          # MQTT client handling
│   ├── positioning/
│   │   └── positioning.go   # Position calculation logic (trilateration + Kalman)
│   └── websocket/
│       └── websocket.go     # WebSocket hub and handler
├── docs/                    # Swagger documentation (generated)
├── go.mod
├── go.sum
└── README.md
```

## Key Components

### 1. Configuration

The system uses two JSON configuration files:

#### Server Runtime Config (`config/server_runtime_config.json`)

```jsonc
{
  "MQTTHost": "localhost",
  "MQTTPort": 1883,
  "MQTTUser": "",
  "MQTTPassword": "",
  "MQTTSecure": false,
  "MQTTTopic": "tracker/+/report",
  "ServerPort": 8022,
  "KalmanProcessVariance": 0.001,
  "KalmanMeasurementVariance": 0.1,
}
```

#### Web UI Config (`config/web_config.json`)

```jsonc
{
  "mapWidth": 100.0,
  "mapHeight": 100.0,
  "mapEntities": [],
  "beacons": [],
  "signalPropagationFactor": 2.0,
}
```

### 2. Core Logic

#### Positioning Service (`internal/positioning/positioning.go`)

- Implements trilateration using at least 3 beacon RSSI values
- Converts RSSI to distance using log-distance path loss model
- Applies Kalman filter for smoothing position estimates over time
- Handles edge cases (insufficient beacons, invalid readings)

#### MQTT Handler (`internal/mqtt/mqtt.go`)

- Optional MQTT client for receiving tracker reports
- Configurable connection settings, topics, and QoS
- Parses incoming JSON payloads into `TrackerReport` structs
- Handles connection recovery and error scenarios

#### WebSocket Hub (`internal/websocket/websocket.go`)

- Manages WebSocket connections with gorilla/websocket
- Broadcasts position updates to all connected clients
- Handles connection lifecycle (open, close, error)
- Uses message broadcasting for efficient fan-out

#### API Handler (`internal/api/handler.go`)

- RESTful endpoints for configuration and status
- JSON request/response bodies
- Proper HTTP status codes and error handling
- CORS middleware for cross-origin requests

### 3. Data Models

Defined in `internal/models/models.go`:

- `TrackerReport`: Incoming data from trackers (timestamp, device ID, beacon readings)
- `TrackerState`: Current state of each tracker (position, accuracy, history, timestamp)
- `WebUIBeaconConfig`: Beacon placement information (UUID, major/minor, coordinates, TX power)
- `WebUIMapInfo`: Map dimensions and geometric entities (polygons, polylines, points)
- `ServerRuntimeConfig`: Runtime configuration (MQTT, server, Kalman parameters)
- `WebUIConfig`: Frontend configuration (map size, entities, beacons, signal propagation factor)

## API Endpoints

All API endpoints are prefixed with `/api`.

### Configuration Endpoints

| Method | Endpoint                     | Description                         |
| ------ | ---------------------------- | ----------------------------------- |
| GET    | `/api/config/web`            | Get web UI configuration            |
| POST   | `/api/config/web`            | Update web UI configuration         |
| GET    | `/api/server-runtime-config` | Get server runtime configuration    |
| POST   | `/api/server-runtime-config` | Update server runtime configuration |

### Tracker Endpoints

| Method | Endpoint            | Description                                    |
| ------ | ------------------- | ---------------------------------------------- |
| GET    | `/api/trackers`     | Get current state of all tracked devices       |
| GET    | `/api/trackers/:id` | Get state of specific tracker (if implemented) |

### WebSocket Endpoint

| Method | Endpoint | Description                                |
| ------ | -------- | ------------------------------------------ |
| GET    | `/ws`    | WebSocket connection for real-time updates |

## Running Locally

### Prerequisites

- Go 1.25.6+
- Air (for live reloading during development): `go install github.com/air-verse/air@v1.52.2`

### Steps

```bash
# Clone repository
git clone https://github.com/yourusername/trackerhub.git
cd trackerhub/backend

# Install dependencies
go mod download

# Start with hot reload
air
```

The server will be available at http://localhost:8022

## Running with Docker

### Development Mode

```bash
# From project root
docker compose -f docker-compose-dev.yml up --build

# Services will be available at:
# - Frontend: http://localhost:3716
# - Backend API: http://localhost:8023
# - API Docs: http://localhost:8023/swagger/index.html
```

### Production Mode

```bash
# From project root
docker compose -f docker-compose-prod.yml up -d

# Services will be available at:
# - Frontend: http://localhost (port 80)
# - Backend API: http://localhost:8080 (adjust based on compose file)
```

## Makefile Commands

Navigate to the backend directory and run:

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `make help`         | Show all available targets    |
| `make build`        | Build the backend binary      |
| `make run`          | Run the built binary          |
| `make dev`          | Run with air (hot reload)     |
| `make test`         | Run tests                     |
| `make coverage`     | Run tests with coverage       |
| `make lint`         | Run golangci-lint             |
| `make fmt`          | Format Go code                |
| `make tidy`         | Run go mod tidy               |
| `make docker-build` | Build Docker image            |
| `docker-build-prod` | Build production Docker image |

## Building

### Binary

```bash
cd backend
go build -o bin/trackerhub ./cmd/server
```

### Docker Image

```bash
# Development image (includes air for hot reload)
docker build -t trackerhub-dev --target development .

# Production image
docker build -t trackerhub-production --target production .
```

## Testing

### Unit Tests

```bash
cd backend
go test ./... -v
```

### Test Coverage

```bash
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Specific Package

```bash
cd backend
go test ./internal/positioning -v
```

## Linting

```bash
cd backend
golangci-lint run
```

### Fixing Issues

```bash
# Note: Not all lint issues can be auto-fixed
golangci-lint run --fix
```

## Formatting

```bash
cd backend
go fmt ./...
```

## Debugging

### Logging

The application uses standard Go `log` package. For more detailed logging:

- Modify log statements in the code
- Consider integrating a structured logging library (like zap) for production

### Profiling

The server includes basic pprof endpoints when built with debug flags:

- Access via `http://localhost:8022/debug/pprof/`

### Common Issues

#### "No usable DefaultProviderChain found"

When using AWS SDK (if applicable in future):
Ensure AWS credentials are configured via environment variables, shared config, or ECM

#### WebSocket Connection Issues

- Check browser console for specific error messages
- Verify the backend is running and accessible
- Ensure firewall allows WebSocket connections (typically same port as HTTP)

#### MQTT Connection Problems

- Verify broker address and port
- Check username/password if authentication is required
- Ensure network connectivity between the container/host and broker
- Check TLS settings if using secure connection

## Environment Variables

The following environment variables can be used to override configuration:

| Variable                      | Description                          | Default          |
| ----------------------------- | ------------------------------------ | ---------------- |
| `GO_ENV`                      | Environment (development/production) | development      |
| `MQTT_BROKER_HOST`            | MQTT broker hostname                 | from config file |
| `MQTT_BROKER_PORT`            | MQTT broker port                     | from config file |
| `MQTT_BROKER_USER`            | MQTT username                        | from config file |
| `MQTT_BROKER_PASSWORD`        | MQTT password                        | from config file |
| `SERVER_PORT`                 | HTTP server port                     | from config file |
| `KALMAN_PROCESS_VARIANCE`     | Kalman filter process variance       | from config file |
| `KALMAN_MEASUREMENT_VARIANCE` | Kalman filter measurement variance   | from config file |

Values from environment variables take precedence over configuration files.

## API Documentation

The API documentation is automatically generated using Swaggo:

- Access via browser: `http://localhost:8022/swagger/index.html`
- JSON format: `http://localhost:8022/swagger/doc.json`

To regenerate documentation after changing API comments:

```bash
# Install swag if not present
go install github.com/swaggo/swag/cmd/swag@latest

# Generate docs
swag init -g cmd/server/main.go -o docs --parseDependency --parseInternal
```

## Dependencies

### Direct Dependencies

- `github.com/gin-gonic/gin v1.12.0` - Web framework
- `github.com/gorilla/websocket v1.5.3` - WebSocket implementation
- `github.com/eclipse/paho.mqtt.golang v1.5.1` - MQTT client
- `github.com/swaggo/swag v1.16.6` - API documentation generation
- `github.com/swaggo/gin-swagger v1.6.1` - Gin middleware for Swagger UI
- `github.com/swaggo/files v0.1.1` - Static file serving for Swagger

### Indirect Dependencies

See `go.mod` and `go.sum` for complete dependency tree.

## Development Guidelines

### Code Style

- Follow [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- Use `go fmt` for formatting
- Keep lines to 100 characters or less where practical
- Add meaningful comments for complex logic

### Commit Messages

- Use conventional commits format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Keep subject line under 50 characters
- Wrap body at 72 characters

### Adding New Features

1. Create interface in appropriate internal package
2. Implement functionality following SOLID principles
3. Add unit tests covering edge cases
4. Update documentation if API changes
5. Ensure all tests pass before submitting PR

## Troubleshooting

### Service Fails to Start

1. Check logs for specific error messages
2. Verify configuration files are valid JSON
3. Ensure required ports are available (default 8022)
4. Check MQTT broker connectivity if enabled
5. Validate Go module dependencies: `go mod verify`

### High CPU Usage

1. Check for infinite loops in goroutines
2. Verify WebSocket connections are being closed properly
3. Monitor garbage collection with `GODEBUG=gctrace=1`
4. Profile CPU usage with pprof

### Memory Leak

1. Monitor memory growth over time
2. Check for unbounded slice/map growth
3. Ensure old WebSocket connections are removed
4. Use `go tool pprof` to analyze heap usage

## FAQ

**Q: Does the system require a database?**
A: No, the current implementation uses in-memory storage for simplicity. For production use with persistence requirements, a database layer would need to be added.

**Q: How many trackers can the system handle?**
A: Depends on hardware and update frequency. The current implementation is lightweight and should handle hundreds of devices with 1-second updates on modest hardware.

**Q: Can I use this without MQTT?**
A: Yes, MQTT is optional. The system can be adapted to receive tracker data via HTTP POST or other mechanisms.

**Q: How secure is the WebSocket connection?**
A: The WebSocket connection is as secure as the underlying HTTP connection. For production, consider placing behind a reverse proxy with TLS termination.

**Q: Can I run multiple instances for scaling?**
A: The current implementation uses in-memory state, so horizontal sharing would require externalizing state (e.g., Redis) or using sticky sessions. For true horizontal scaling, consider adding a message broker for state synchronization.
