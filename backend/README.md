# TrackerHub Backend

Indoor positioning backend service that processes BLE beacon detection reports from trackers, computes device positions using Kalman filtering, and provides real-time tracking data via WebSocket and REST APIs.

## Overview

TrackerHub is designed for indoor positioning systems (IPS) using BLE beacons and tracker devices. The backend service:

- Receives tracker reports via MQTT (optional)
- Processes BLE beacon RSSI readings to estimate device positions
- Exposes configuration APIs for web UI (beacon positions, map settings)
- Provides real-time tracker positions via WebSocket
- Maintains tracker state and position history
- Configurable Kalman filter parameters for smoothing

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # Entry point
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
│   │   └── positioning.go   # Position calculation logic
│   └── websocket/
│       └── websocket.go     # WebSocket hub and handler
├── docs/                    # Swagger documentation
├── go.mod
├── go.sum
└── README.md
```

## Key Components

### 1. Configuration

- **Server Runtime Config** (`config/server_runtime_config.json`):
  - MQTT broker settings (host, port, credentials, topic pattern)
  - Server port (HTTP/WebSocket)
  - Kalman filter parameters (process variance, measurement variance)
- **Web UI Config** (`config/web_config.json`):
  - Map dimensions and optional map entities (polygons, polylines)
  - Beacon positions (UUID, major/minor, coordinates, TX power)
  - Signal propagation factor (path loss exponent)

### 2. Core Logic

- **Positioning Service** (`internal/positioning/positioning.go`):
  - Implements trilateration using beacon RSSI values
  - Applies Kalman filtering for smoothing position estimates
- **MQTT Handler** (`internal/mqtt/mqtt.go`):
  - Connects to MQTT broker (if enabled)
  - Subscribes to tracker report topics
  - Processes incoming `TrackerReport` messages
- **WebSocket Hub** (`internal/websocket/websocket.go`):
  - Manages WebSocket connections
  - Broadcasts tracker position updates to all connected clients
- **API Handler** (`internal/api/handler.go`):
  - REST endpoints for configuration management
  - Endpoints to retrieve tracker states

### 3. Data Models

Refer to `internal/models/models.go` for detailed struct definitions:

- `TrackerReport`: Incoming tracker data with detected beacons
- `TrackerState`: Current state of each tracker (position, history)
- `WebUIBeaconConfig`: Beacon placement information
- `WebUIMapInfo`: Map dimensions and geometric entities
- `ServerRuntimeConfig`: Runtime configuration (MQTT, server, Kalman)

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

| Method | Endpoint        | Description                       |
| ------ | --------------- | --------------------------------- |
| GET    | `/api/trackers` | Get current state of all trackers |

### WebSocket

- **Endpoint**: `/ws`
- **Message Format**: JSON broadcast containing tracker updates:
  ```json
  {
    "type": "tracker_update",
    "data": {
      "trackerId1": {
        "trackerId": "trackerId1",
        "position": { "x": 1.2, "y": 3.4 },
        "timestamp": 1690000000000
      }
    }
  }
  ```

### Swagger Documentation

- Access Swagger UI at `http://localhost:8022/swagger/index.html` when running.

## Configuration Files

### server_runtime_config.json

```json
{
  "mqtt": {
    "brokerHost": "127.0.0.1",
    "brokerPort": 1883,
    "applicationID": "",
    "topicPattern": "",
    "username": "",
    "password": "",
    "clientID": "",
    "enabled": false,
    "live_mqtt_status": ""
  },
  "server": {
    "port": 8022
  },
  "kalman": {
    "processVariance": 1.0,
    "measurementVariance": 10.0
  }
}
```

### web_config.json

```json
{
  "beacons": [
    {
      "uuid": "1234567890abcdef1234567890abcdef",
      "major": 1,
      "minor": 1,
      "x": 0.0,
      "y": 0.0,
      "txPower": -59,
      "displayName": "Beacon 1",
      "macAddress": "AAaa:"
}
}
```

{
"beacons": {
2.5actor": {
"Beacon "c.
s": 1.0,
"Proe": 1.0,
"ius
}
}
}

```
{
  "beacon
    "UUID": "1234567890abcdef1234567890abcdef",
    "major": 1,
    "minor": 1,
    "x": 0.0,
    "y": 0.0,
    "txPower": -59,
    "displayName": "Beacon 1",
    "macAddress": "AA:BB:CC:DD:EE:FF"
  }
}
```

{
"version": "1.0.0",
"description": "TrackerHub Backend - Indoor Positioning System",
"main": "cmd/server/main.go",
"scripts": {
"start": "go run cmd/server/main.go",
"build": "go build -o trackerhub cmd/server/main.go"
},
"dependencies": {
"github.com/gin-gonic/gin": "^1.9.0",
"github.com/gorilla/websocket": "^1.5.0",
"github.com/swaggo/gin-swagger": "^1.4.0",
"github.com/swaggo/files": "^1.0.0",
"github.com/eclipse/paho.mqtt.golang": "^1.5.0"
}
}

````

## Building and Running

### Prerequisites
- Go 1.20 or higher
- MQTT broker (optional, e.g., Mosquitto) if using MQTT input

### Build
```sh
go build -o trackerhub cmd/server/main.go
````

### Run

```sh
./trackerhub
```

or

```sh
go run cmd/server/main.go
```

The server will start on port 8022 (configurable via `server_runtime_config.json`).

### Configuration

1. Edit `config/server_runtime_config.json` to set MQTT broker details (if using MQTT) and server port.
2. Edit `config/web_config.json` to define your map dimensions, beacon positions, and signal propagation factor.
3. Ensure the MQTT topic pattern matches the format used by your tracker devices.

## Development

### API Documentation

Swagger annotations are embedded in the code. To regenerate the `docs/` folder:

```sh
swag init -g cmd/server/main.go -o docs
```

### Running Tests

```sh
go test ./...
```

## Architecture Overview

```
Tracker Devices --> [MQTT Broker] --> [TrackerHub Backend] --> [Web UI]
                         (Optional)          |  ^                     |
                                              |  | REST API            | WebSocket
                                              v  |                     |
                                        [Config APIs]           [Real-time Updates]
                                              |                     |
                                      [Web UI Config]    [Tracker Positions/History]
```

### Data Flow

1. Tracker devices scan for BLE beacons and publish RSSI measurements to MQTT topics (or via other means).
2. TrackerHub backend receives `TrackerReport` messages via MQTT subscriber.
3. For each report, the positioning service:
   - Filters beacons based on known UUID/major/minor from web config
   - Computes distance estimates using RSSI and TX power (log-distance path loss model)
   - Performs trilateration to estimate (x, y) position
   - Applies Kalman filter to smooth position estimates over time
4. Updated tracker states are broadcast via WebSocket to connected clients.
5. Web UI can fetch/update configuration via REST APIs and display real-time positions via WebSocket.

## Configuration Details

### Beacon Configuration

Each beacon in `web_config.json` requires:

- `uuid`: 32-character iBeacon UUID (without hyphens)
- `major`: Integer 0-65535
- `minor`: Integer 0-65535
- `x`, `y`: Beacon position in meters (relative to map origin)
- `txPower`: Expected RSSI at 1 meter (typically -59 to -65)
- `displayName`: Optional human-readable name
- `macAddress`: Optional physical MAC address for validation

### Map Configuration

- `width`, `height`: Map dimensions in meters
- `entities`: Optional array of map objects (currently only `polyline` type supported)
  - Each entity defines a list of `[x, y]` points in meters
  - Styling options: `strokeColor`, `lineWidth`, `fillColor`, `closed`

### Signal Processing

- `signalPropagationFactor`: Path loss exponent `n` in the log-distance model (typically 2.0-4.0 for indoor environments)

## Kalman Filter

The system uses a simple Kalman filter for each tracker's position (x, y) with:

- State vector: [x, y, velocity_x, velocity_y]
- Process noise: configurable via `processVariance`
- Measurement noise: configurable via `measurementVariance`
- Constant velocity motion model

## Environment Variables

None currently; all configuration is via JSON files.

## License

This project is licensed under the Apache 2.0 License - see the LICENSE file for details.

## Acknowledgments

- Gin web framework
- Gorilla WebSocket
- Swaggo for API documentation
- Eclipse Paho MQTT client
