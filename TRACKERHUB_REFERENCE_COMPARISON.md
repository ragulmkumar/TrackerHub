# TrackerHub vs IndoorPositioning

## Fresh Functional Audit

**Date:** 2026-08-31
**Type:** Read-only comparison audit
**Scope:** Functional & core-workflow comparison only. No source code was modified during this audit.

---

## 1. Executive Summary

TrackerHub is a **Go + React** indoor positioning system that has been built as a modern port/reimplementation of the **IndoorPositioning** reference solution (a **Python FastAPI + Vue 3** SenseCAP solution). The audit confirms TrackerHub has **functionally implemented** the core map workflow (image upload, dimensions, coordinate calibration, beacon placement/persistence) and the positioning pipeline (MQTT → RSSI → multilateration → WebSocket → LiveMap). All four completed phases are verified from the actual source code.

Key findings:

- **Core live-tracking workflow is COMPLETE and test-verified.** TrackerHub builds, all 151 frontend tests pass, all backend packages build and pass, and `go vet` is clean.
- TrackerHub intentionally uses a **different tech stack** (Go/Gin + React/Vite) — this is a deliberate design choice, **not a gap**.
- **Image-based floor plans** are implemented in TrackerHub but **NOT in the reference** (the reference uses vector entities / a dashboard-format image reference only).
- **Kalman filtering** is implemented in the reference's live MQTT pipeline but **defined-but-not-wired** in TrackerHub — this is the most significant _functional_ divergence.
- **Alarm settings** exist only as a placeholder in TrackerHub; the reference has no alarm feature at all.
- **Personal/Local Mode** (client-side positioning via a Node BLE scanner) exists in the reference but **not in TrackerHub**. It is assessed as **OPTIONAL/FUTURE**, not a core requirement.
- The reference project has **essentially no project tests**; TrackerHub has a substantial, passing test suite.

---

## 2. Current TrackerHub Status

**Tech stack:** Go (Gin) backend + React (Vite) frontend + REST + WebSocket + MQTT.

### What is genuinely implemented and verified (from source)

| Area                                              | Status                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Floor-plan JPG/PNG upload                         | ✅ Implemented (`MapConfigurationTab.jsx` reads image as base64 data URL) |
| Floor-plan image rendering                        | ✅ Implemented (`useMapCanvas.js` `drawMapBase` + `backgroundImage`)      |
| Map dimensions (meters)                           | ✅ Implemented + validated (`MapConfigurationTab.jsx`)                    |
| Meter ↔ pixel coordinate conversion               | ✅ Implemented (`useMapCanvas.js` `toCanvas`/`toMap`, Y-flip)             |
| Beacon placement (click)                          | ✅ Implemented (`MapEditor.jsx` two-click confirm)                        |
| Beacon dragging                                   | ✅ Implemented (`MapEditor.jsx` mouse drag handlers)                      |
| Beacon metadata & list edit                       | ✅ Implemented (`MapConfigurationTab.jsx`)                                |
| Beacon/config persistence                         | ✅ Implemented (JSON files + `WebUIConfigStore` live update, no restart)  |
| MQTT ingestion (SenseCAP + legacy)                | ✅ Implemented (`mqtt_handler.go` `parseTrackerReport`)                   |
| RSSI → distance (log-distance)                    | ✅ Implemented (`positioning.go` `CalculateDistance`)                     |
| Multilateration (≥3 beacons)                      | ✅ Implemented (`MultilaterationLeastSquares`, gradient descent)          |
| Weighted centroid fallback (1–2 beacons)          | ✅ Implemented (`WeightedCentroid`) — **beyond** reference                |
| Outlier rejection                                 | ✅ Implemented (`RejectOutliers`) — **beyond** reference                  |
| WebSocket live push / initial state / MQTT status | ✅ Implemented (`websocket.go` + `main.go`)                               |
| REST API + Auth (JWT-style tokens, login)         | ✅ Implemented                                                            |
| Tracker access allow-list                         | ✅ Implemented                                                            |
| Docker / Compose / Makefile deployment            | ✅ Implemented                                                            |

### What is partial / placeholder

- **Kalman filter** — defined (`kalman.go`) but **not wired** into the live MQTT pipeline.
- **Restart service** — endpoint is a stub (returns a message, no real restart).
- **Webhook** — config UI + model exist, but **no outbound delivery engine**.
- **Area location** — config toggle exists, but no area-location positioning logic.
- **Alarm settings** — frontend placeholder only ("Coming Soon").
- **Redis / Postgres** — declared in docker-compose but **not consumed** by any Go code (state is in-memory).

### What is missing

- **Personal / Local Mode** (client-side positioning via BLE scanner) — not present.
- **Beacon scanning/discovery** (BLE) — not present (TrackerHub ingests beacons only via MQTT).
- **Alarm engine** backend + frontend.

---

## 3. Reference Project Overview

**Tech stack:** Python **FastAPI** backend (uvicorn, paho-mqtt, numpy/scipy) + **Vue 3** frontend + a separate **Node.js BLE service** (`@abandonware/noble`).

The reference solution supports two primary modes plus configuration views:

| View / Mode                  | Route / Purpose                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Tracker Mode                 | `/` and `/config-tracker` — server-side positioning of LoRaWAN/BLE trackers via MQTT        |
| Local Mode (≈ Personal Mode) | `/config-local` — client-side positioning of the user's own device via the Node BLE scanner |
| Master Config                | `/config-master` — map/beacon/settings editing                                              |
| Configuration Suite          | `/config` — combined configuration UI                                                       |

**Notable reference traits:**

- The actual `server/web_config.json` models the map as **meter dimensions + vector polyline entities** (no embedded image).
- A root `config/dashboard_config.json` references a background image (`/uploads/Indoor_77285.png`) and uses a **different coordinate model** (`width:150, height:80, minX/maxX/minY/maxY`) — this is a parent-app/SenseCraft format, **not** consumed by the FastAPI backend.
- MQTT consumes the **SenseCAP** format (`value[].mac/rssi`) — verified against `test/example_mqtt_data.json`.
- A `test/LoRaWANTracker Payload.json` shows a ChirpStack envelope, but the active handler only parses the `/device_sensor_data/` topic.
- **No project tests** exist (the only `_test.py` files are inside `.venv` site-packages).

---

## 4. Architecture Comparison

| Aspect                     | IndoorPositioning (Reference)                   | TrackerHub (Current)                             | Verdict                                       |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Backend                    | Python + FastAPI + paho-mqtt + numpy/scipy      | Go + Gin + paho.mqtt.golang                      | ⚠️ DIFFERENT DESIGN — functionally equivalent |
| Frontend                   | Vue 3 + Vite + Axios + Canvas                   | React + Vite + Services + Canvas                 | ⚠️ DIFFERENT DESIGN — functionally equivalent |
| BLE scanning               | Separate Node.js `local-beacon-service` (noble) | None                                             | ❌ MISSING in TrackerHub                      |
| State                      | In-memory (`tracker_states`, `kalman_filters`)  | In-memory (`trackerStates` map in `handler.go`)  | ✅ COMPLETE (both in-memory)                  |
| Config                     | JSON files + Pydantic models                    | JSON files + typed Go structs + in-memory stores | ✅ COMPLETE                                   |
| Multilateration            | scipy `least_squares` (Levenberg-Marquardt)     | Gradient descent                                 | ⚠️ DIFFERENT DESIGN — functionally equivalent |
| Kalman                     | Wired into live pipeline                        | Defined, not wired                               | 🟡 PARTIAL in TrackerHub                      |
| Weighted centroid fallback | Not present (needs ≥3 beacons)                  | Present (1–2 beacons)                            | ✅ COMPLETE (TrackerHub is more capable)      |
| Auth                       | Not present                                     | JWT-style tokens + login + middleware            | ✅ COMPLETE (TrackerHub is more capable)      |
| REST API                   | Yes                                             | Yes + Swagger                                    | ✅ COMPLETE                                   |

---

## 5. Map / Floor Plan Workflow — SPECIAL AUDIT

Factory/Floor Plan → Upload Layout → Display Map → Configure Dimensions → Place Beacons → Save Config → Start Tracking → Receive Tracker Data → Calculate Position → Display User/Tracker on Map.

| Step                           | IndoorPositioning                                                                          | TrackerHub                                                                    | Status                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------- |
| Upload JPG/PNG                 | ❌ Not implemented (reference uses vector entities; image only in unused dashboard format) | ✅ `MapConfigurationTab.jsx` `handleImageImport` reads JPG/PNG → base64       | ✅ COMPLETE (TrackerHub)                 |
| Image renders on map           | ❌ Not in reference web/src                                                                | ✅ `useMapCanvas.js` `drawMapBase` backgroundImage                            | ✅ COMPLETE (TrackerHub)                 |
| JSON layout import             | ✅ `MasterConfigView.vue`, `MapEditorTab.vue`                                              | ✅ `MapConfigurationTab.jsx` `handleImportLayout` + `validateLayoutStructure` | ✅ COMPLETE both                         |
| Dimensions calibrated          | ✅ `width`/`height` meters                                                                 | ✅ `validateMapDimension`                                                     | ✅ COMPLETE both                         |
| Beacons placed visually        | ✅ click-to-place (`MapEditorTab.vue`)                                                     | ✅ click-to-place (`MapEditor.jsx`)                                           | ✅ COMPLETE both                         |
| Beacons draggable              | ❌ No drag                                                                                 | ✅ drag (`MapEditor.jsx` mouse handlers)                                      | ✅ COMPLETE (TrackerHub) / N/A reference |
| Coordinates in meters          | ✅                                                                                         | ✅                                                                            | ✅ COMPLETE both                         |
| Coordinates persisted          | ✅ `web_config.json` + localStorage                                                        | ✅ `web_config.json` + `WebUIConfigStore`                                     | ✅ COMPLETE both                         |
| Positioning consumes coords    | ✅ `positioning.py`                                                                        | ✅ `positioning.go` `CalculatePosition` + Phase 4/5 tests                     | ✅ COMPLETE both                         |
| LiveMap uses same coord system | ✅ `MapView.vue` (Y-flip)                                                                  | ✅ `LiveMap.jsx` + `useMapCanvas.js` `toCanvas` (Y-flip)                      | ✅ COMPLETE both                         |
| Tracker appears on floor plan  | ✅ (vector map)                                                                            | ✅ (image map)                                                                | ✅ COMPLETE both                         |

### Explicit answers to the Map Workflow audit

1. **Can TrackerHub upload JPG/PNG?** ✅ YES — `MapConfigurationTab.jsx` reads the file as a data URL and stores it as `backgroundImage`.
2. **Does the image render?** ✅ YES — `drawMapBase` draws the `backgroundImage` onto the canvas.
3. **Can JSON layouts be imported?** ✅ YES — `handleImportLayout` with validation.
4. **Are dimensions calibrated?** ✅ YES — width/height in meters, validated positive.
5. **Can beacons be placed visually?** ✅ YES — two-click on `MapEditor.jsx`.
6. **Can beacons be dragged?** ✅ YES — drag handlers in `MapEditor.jsx`.
7. **Are coordinates stored in meters?** ✅ YES — `WebUIBeaconConfig.x/y` are meters.
8. **Are coordinates persisted?** ✅ YES — saved to `web_config.json` and applied live via the store.
9. **Does positioning consume those coordinates?** ✅ YES — `CalculatePosition` maps detected MACs → config beacon x/y (verified by Phase 4 tests).
10. **Does LiveMap use the same coordinate system?** ✅ YES — `toCanvas`/`toMap` with Y-axis flip, matching backend meters.
11. **Does tracker position appear on the uploaded floor plan?** ✅ YES — `LiveMap.jsx` renders tracker at `toCanvas(position.x, position.y)` over the background image.

---

## 6. Image Upload

| Aspect                             | IndoorPositioning                                           | TrackerHub                                   |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| JPG/PNG input                      | ❌ Not implemented (only JSON accept in `MapEditorTab.vue`) | ✅ Implemented                               |
| Base64 background storage          | ❌                                                          | ✅ `backgroundImage` field in `WebUIMapInfo` |
| Rendering                          | ❌                                                          | ✅ `drawMapBase`                             |
| Dimensions auto-derived from image | ❌                                                          | ✅ `backgroundImageWidth/Height`             |

**Status: ✅ COMPLETE (TrackerHub only — reference lacks this).**

---

## 7. JSON Layout Import

| Aspect                   | IndoorPositioning                                                      | TrackerHub                   |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| Upload `.json`           | ✅ `MapEditorTab.vue`                                                  | ✅ `MapConfigurationTab.jsx` |
| Paste JSON               | ✅ `MasterConfigView.vue`                                              | ✅ (via import)              |
| Validation               | ✅ `validateFullConfigStructure` (map.width/height, beacons, settings) | ✅ `validateLayoutStructure` |
| Persistence after import | ✅                                                                     | ✅                           |

**Status: ✅ COMPLETE (both).**

---

## 8. Map Calibration

| Aspect                             | IndoorPositioning                      | TrackerHub                              |
| ---------------------------------- | -------------------------------------- | --------------------------------------- |
| Map width/height (meters)          | ✅                                     | ✅ `validateMapDimension`               |
| Pixels-per-meter (ppm) calibration | ❌ Only in placeholder/README text     | ✅ implied by `useMapCanvas` scale calc |
| Origin handling                    | Bottom-left (Y-up), inverted on canvas | Bottom-left, inverted via `toCanvas`    |
| Auto-scale to canvas               | ✅                                     | ✅ `Math.min(availW/mapW, availH/mapH)` |

**Status: ✅ COMPLETE (both). TrackerHub exposes the calibration through `useMapCanvas`.**

---

## 9. Coordinate System

Both projects use a **metric coordinate system with origin at bottom-left (0,0), Y-axis up**, and invert Y when drawing to a top-left-origin canvas. TrackerHub centralizes this in `useMapCanvas.js` (`toCanvas`/`toMap`/`clampToMap`), which is shared by both `MapEditor` and `LiveMap`.

**Status: ✅ COMPLETE (both).** The reference `dashboard_config.json` suggests an alternate coordinate model but the active backend/web code uses the meter system.

---

## 10. Map Editor

| Aspect              | IndoorPositioning           | TrackerHub                         |
| ------------------- | --------------------------- | ---------------------------------- |
| Canvas grid         | ✅ `MapEditorTab.vue`       | ✅ `MapEditor.jsx` + `drawMapBase` |
| Beacon click-place  | ✅                          | ✅                                 |
| Beacon drag         | ❌                          | ✅                                 |
| Entity/wall drawing | ✅ (editor, grid, entities) | ✅ (entities from config)          |
| Background image    | ❌                          | ✅                                 |

**Status: ✅ COMPLETE (both core editing; TrackerHub adds drag + images).**

---

## 11. Beacon Management

| Aspect             | IndoorPositioning                            | TrackerHub                   |
| ------------------ | -------------------------------------------- | ---------------------------- |
| Beacon list        | ✅ `BeaconManagerTab.vue`                    | ✅ `MapConfigurationTab.jsx` |
| Add/edit modal     | ✅ (UUID, Major, Minor, X, Y, TxPower, name) | ✅ (name, x, y, txPower)     |
| "Place on map"     | ✅                                           | ✅                           |
| BLE scan & add     | ✅ (via local-beacon-service)                | ❌ (no BLE)                  |
| Drag to reposition | ❌                                           | ✅                           |

**Status: ✅ COMPLETE (core). BLE scan is reference-only.**

---

## 12. Beacon Placement

| Aspect                      | IndoorPositioning          | TrackerHub                          |
| --------------------------- | -------------------------- | ----------------------------------- |
| Click-to-place on canvas    | ✅                         | ✅                                  |
| Confirm placement           | ✅ (modal)                 | ✅ (two-click confirm + ESC cancel) |
| Coordinate conversion       | ✅ (CSS→buffer→map meters) | ✅ (`toMap`)                        |
| Update config beacon coords | ✅                         | ✅                                  |

**Status: ✅ COMPLETE (both).**

---

## 13. Beacon Persistence

| Aspect                  | IndoorPositioning           | TrackerHub                                  |
| ----------------------- | --------------------------- | ------------------------------------------- |
| Backend file            | ✅ `server/web_config.json` | ✅ `backend/config/web_config.json`         |
| Live store (no restart) | ✅ (in-memory `web_ui_cfg`) | ✅ `WebUIConfigStore` + `UpdateWebUIConfig` |
| localStorage (frontend) | ✅ `localStorageService.js` | ✅ (config service)                         |
| Test coverage           | ❌                          | ✅ Phase 3/4 tests                          |

**Status: ✅ COMPLETE (both). TrackerHub has explicit test coverage of persistence + live-update.**

---

## 14. Configuration UI

- **IndoorPositioning:** Configuration Suite (`/config`) with tabs for map/beacon/settings; Master Config; Local Mode config.
- **TrackerHub:** `ConfigurationPage.jsx` with **3 tabs**: **Map Configuration**, **App Configuration**, **Alarm Settings**.

**Status: ⚠️ DIFFERENT DESIGN — functionally equivalent for core config; TrackerHub adds App + Alarm tabs.**

---

## 15. Map Configuration

- **IndoorPositioning:** map name, width/height, entities (polylines), beacons, signal propagation factor (`MapEditorTab.vue`).
- **TrackerHub:** map name, width/height (validated), signal propagation factor, **image/template upload**, beacon list, "Place on Map" (`MapConfigurationTab.jsx`).

**Status: ✅ COMPLETE (both). TrackerHub adds image upload.**

---

## 16. App Configuration

- **IndoorPositioning:** **minimal** — only signal propagation factor is exposed (`GeneralSettingsTab.vue`); server/MQTT/Kalman live in `server_runtime_config.json`.
- **TrackerHub:** `AppConfigurationTab.jsx` launches **7 config cards**:
  1. `AuthenticationCard` — admin username/password change
  2. `ServerRuntimeCard` — server port, MQTT broker/credentials, Kalman params, restart
  3. `SenseCapConfigCard` — SenseCAP OpenStream MQTT
  4. `ChirpStackConfigCard` — ChirpStack MQTT
  5. `WebhookConfigCard` — webhook enable/URL/headers
  6. `TrackerAccessControlCard` — tracker EUI allow-list
  7. `AreaLocationConfigCard` — `allowAreaLocation` toggle

**Status: ✅ COMPLETE (TrackerHub) — significantly richer than reference.**

---

## 17. Alarm Settings

- **IndoorPositioning:** ❌ **No alarm feature** exists in the reference code (grep found nothing).
- **TrackerHub:** 🟡 **Placeholder only** — `AlarmSettingsTab.jsx` renders "Coming Soon" text; no backend alarm engine.

**Status: 🟡 PARTIAL (TrackerHub) / ❌ N/A (reference). Alarm engine is a P1-P2 enhancement for TrackerHub.**

---

## 18. MQTT

| Aspect             | IndoorPositioning                                                                        | TrackerHub                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Client             | paho-mqtt (Python)                                                                       | paho.mqtt.golang                                                  |
| Topic pattern      | `/device_sensor_data/{AppID}/+/+/+/+` + `application/{appId}/device/+/event/up` (config) | `/device_sensor_data/{ApplicationID}/+/+/+/+`                     |
| Measurement filter | `measurement_id == "5002"`                                                               | `measurementID == "5002"`                                         |
| SenseCAP payload   | ✅ `value[].mac/rssi`                                                                    | ✅ `parseTrackerReport`                                           |
| Legacy payload     | ❌                                                                                       | ✅ `beacons[].macAddress/rssi`                                    |
| MAC normalization  | case-insensitive match                                                                   | uppercase-no-colons normalization                                 |
| Reconnect / status | ✅                                                                                       | ✅ `Connect`, `IsConnected`, `GetConnectionStatus`, error handler |

**Status: ✅ COMPLETE (both); TrackerHub additionally supports the legacy payload format.**

---

## 19. Tracker Data

- **IndoorPositioning:** `TrackerReport` from MQTT → `process_tracker_report()` → `tracker_states` → Kalman → `manager.broadcast({'type':'tracker_update'})`. `/api/trackers` returns state.
- **TrackerHub:** `TrackerReport` → `CalculatePosition` → `UpsertTrackerStateWithData` → `wsHub.BroadcastMessage`. `/api/trackers` + manual `POST /api/trackers`.

**Status: ✅ COMPLETE (both).**

---

## 20. Positioning Pipeline

| Stage               | IndoorPositioning                        | TrackerHub                                                           |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Input               | `DetectedBeacon[]` + `MiniprogramConfig` | `DetectedBeacon[]` + `WebUIConfig`                                   |
| Beacon measurement  | MAC + RSSI (SenseCAP)                    | MAC + RSSI (SenseCAP + legacy)                                       |
| RSSI processing     | filter RSSI ≤0 & ≥-120                   | filter RSSI ≤0 & ≥-120                                               |
| Distance calc       | `10^((tx-RSSI)/(10n))` log-distance      | same `CalculateDistance`                                             |
| Positioning         | scipy `least_squares` (LM), ≥3 beacons   | gradient-descent multilateration, ≥3 beacons                         |
| Fallback (<3)       | ❌ returns None                          | ✅ weighted centroid (1–2 beacons)                                   |
| Outlier rejection   | ❌                                       | ✅ `RejectOutliers` (50m)                                            |
| Filtering/smoothing | ✅ Kalman2D wired in pipeline            | 🟡 Kalman defined, **not wired**                                     |
| Output              | filtered (x,y)                           | PositionResult (position, accuracy, confidence, method, beaconCount) |

**Status:** Position calc **IMPLEMENTED (both)**; fallback **DIFFERENT/DIVERGENT** (TrackerHub better); Kalman **PARTIALLY IMPLEMENTED in TrackerHub** (defined, not wired).

---

## 21. RSSI Processing

Both use the **log-distance path loss model** `distance = 10^((txPower - RSSI) / (10 * n))` with identical implausible-RSSI filtering (RSSI > 0 or < -120 rejected) and distance bounds (0.1 m – 100 m).

**Status: ✅ IMPLEMENTED (both, functionally equivalent).**

---

## 22. Filtering / Smoothing

| Aspect                               | IndoorPositioning                                                            | TrackerHub                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- |
| 2D Kalman filter (constant velocity) | ✅ `KalmanFilter2D` **wired** in `process_tracker_report`                    | ✅ `kalman.go` `KalmanFilter2D` **defined** |
| Applied in live pipeline             | ✅ YES                                                                       | ❌ NO (dead code in live path)              |
| Frontend smoothing                   | ✅ `positionManager.js` (`POSITION_SMOOTHING_FACTOR=0.3`), `kalmanFilter.js` | ❌ not present                              |

**Status: 🟡 PARTIALLY IMPLEMENTED in TrackerHub.** The Kalman filter `models/kalman.go` exists and is parameterized (from `ServerRuntimeConfig.kalman`) but is **not called** in `main.go`'s MQTT → `CalculatePosition` → broadcast flow. This is the most meaningful _functional_ gap versus the reference. **Recommend wiring it in** (with the constraint of not redesigning architecture).

---

## 23. WebSocket

| Aspect                    | IndoorPositioning               | TrackerHub                          |
| ------------------------- | ------------------------------- | ----------------------------------- |
| Server                    | `ConnectionManager` + `/api/ws` | `Hub` + `/ws` (token-authenticated) |
| Message: `tracker_update` | ✅                              | ✅                                  |
| Message: `initial_state`  | ✅                              | ✅                                  |
| Message: `mqtt_status`    | ✅ `mqtt_status_update`         | ✅ `mqtt_status_update`             |
| Message: `config_update`  | ✅                              | (via REST reload)                   |
| Binary/JSON               | JSON via broadcast              | JSON via broadcast                  |
| Auth on WS                | ❌                              | ✅ token validation                 |

**Status: ✅ COMPLETE (both). TrackerHub adds WS auth.**

---

## 24. LiveMap

| Aspect                  | IndoorPositioning | TrackerHub                                |
| ----------------------- | ----------------- | ----------------------------------------- |
| Component               | `MapView.vue`     | `LiveMap.jsx`                             |
| Map background          | vector entities   | **image + entities**                      |
| Beacon rendering        | ✅ orange circles | ✅ `drawBeacons`                          |
| Tracker rendering       | ✅ blue circles   | ✅ 10px circle + label                    |
| Accuracy circle         | ❌                | ✅ clamped accuracy circle                |
| Trails                  | ✅                | ✅ `position_history`                     |
| Shared coord conversion | ❌ (inline)       | ✅ `useMapCanvas.js` (shared with editor) |

**Status: ✅ COMPLETE (both). TrackerHub adds accuracy circles, image background, and shared coordinate utilities.**

---

## 25. Tracker Mode

Both projects implement **Tracker Mode** — live positioning of external trackers via the MQTT pipeline, displayed on a live map.

- **IndoorPositioning:** `TrackerModeConfigView.vue` (routes `/`, `/config-tracker`).
- **TrackerHub:** `TrackerModePage.jsx` + `Dashboard.jsx` + `MonitorPage.jsx`.

**Status: ✅ COMPLETE (both).**

---

## 26. Personal Mode

- **IndoorPositioning:** ✅ **"Local Mode"** (`LocalModeConfigView.vue`, `/config-local`) — connects to a Node `local-beacon-service` WebSocket, scans BLE iBeacons, and computes position **client-side** via `positionCalculator.js` + `localPositioningService.js`. This effectively serves "Personal Mode" (locating a user's own device).
- **TrackerHub:** ❌ **Not present.** No BLE scanner, no local positioning, no Personal/Local mode route; TrackerHub only ingests beacons via MQTT from external trackers.

**Classification: OPTIONAL / FUTURE.** Personal Mode is a distinct consumer use-case (a phone/laptop locating itself). It is **not required** to achieve the core TrackerHub goal of server-side MQTT tracker positioning. It would require a new BLE scanning subsystem (e.g., a port of the reference's Node `local-beacon-service` or a Go equivalent) and a client-side positioning path.

**Status: ❌ MISSING in TrackerHub — assessed as OPTIONAL / FUTURE, not P0/P1.**

---

## 27. Testing

### TrackerHub — Backend (10 Go test files)

| File                                     | Package                | Focus                                 |
| ---------------------------------------- | ---------------------- | ------------------------------------- |
| `handler_test.go`                        | `internal/api`         | REST handlers                         |
| `auth_test.go`                           | `internal/auth`        | auth/tokens                           |
| `mqtt_handler_test.go`                   | `internal/mqtt`        | payload parsing                       |
| `websocket_test.go`                      | `internal/websocket`   | hub/broadcast                         |
| `positioning_test.go`                    | `internal/positioning` | algorithm units                       |
| `positioning_integration_test.go`        | `internal/positioning` | integration                           |
| `config_positioning_integration_test.go` | `internal/positioning` | config→positioning                    |
| `phase4_config_pipeline_test.go`         | `internal/positioning` | config pipeline (Phase 4)             |
| `phase4_positioning_integration_test.go` | `internal/positioning` | positioning integration (Phase 4)     |
| `phase5_mqtt_to_livemap_test.go`         | `internal/positioning` | MQTT→positioning→WS→LiveMap (Phase 5) |

### TrackerHub — Frontend (10 test files, 151 tests)

- `MapEditor.test.jsx`, `LiveMap.test.jsx`, `TrackerList.test.jsx`
- `MapConfigurationTab.phase2.test.js`, `MapEditor.phase3.test.js`
- `useMapCanvas.test.js`, `useMapCanvas.coordinate.test.js` (coordinate conversion)
- `websocketService.test.js`, `authService.test.js`
- `ConfigurationPage.test.jsx`

### IndoorPositioning — Tests

- **Zero project tests.** The `.venv` site-packages contains only pip's vendored tests; there are **no** `server/*_test.py`, frontend `*.test.*`, or test runner config in the project source.

**Status: TrackerHub ✅ COMPLETE (10 backend + 10 frontend files / 151 frontend tests); IndoorPositioning ❌ NONE.**

---

## 28. Build / Deployment

### TrackerHub

- **Backend:** `go build ./...` ✅ OK; `go test ./...` ✅ all pass; `go vet ./...` ✅ clean.
- **Frontend:** `npm run build` ✅ success (only lottie `eval` + chunk-size warnings, non-failing); `vitest run` ✅ **151/151 pass**.
- **Deployment:** `backend/Dockerfile` (multi-stage: Go builder → dev air → prod alpine), `client/Dockerfile` (node → nginx), `docker-compose-dev.yml`, `docker-compose-prod.yml`, `Makefile` (build, run, dev, test, lint, vet, tidy, generate swag, docker-\*).

### IndoorPositioning

- **Backend:** Python FastAPI; `start.sh` sets up `.venv`, installs, runs uvicorn on port 8022.
- **Frontend:** Vite dev server via `npm run dev`.
- **BLE service:** `local-beacon-service/start_service.sh` (noble).
- No CI/automated test harness verified.

**Status: ✅ COMPLETE (TrackerHub has a richer, verified build/test/deploy posture).**

---

## 29. Feature Comparison Matrix

| #   | Feature                     | IndoorPositioning   | TrackerHub          | Status                       | Evidence (TrackerHub)                       |
| --- | --------------------------- | ------------------- | ------------------- | ---------------------------- | ------------------------------------------- |
| 1   | Map/floor-plan config       | ✅                  | ✅                  | ✅ COMPLETE                  | `WebUIMapInfo`, `MapConfigurationTab`       |
| 2   | Floor-plan upload (JPG/PNG) | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `MapConfigurationTab.jsx handleImageImport` |
| 3   | JSON layout import          | ✅                  | ✅                  | ✅ COMPLETE                  | `handleImportLayout`                        |
| 4   | Image handling              | ⚠️ (dashboard only) | ✅                  | ✅ COMPLETE (TH)             | `backgroundImage` + `drawMapBase`           |
| 5   | Map dimensions              | ✅                  | ✅                  | ✅ COMPLETE                  | `validateMapDimension`                      |
| 6   | Coordinate system           | ✅                  | ✅                  | ✅ COMPLETE                  | `useMapCanvas.js`                           |
| 7   | Map rendering               | ✅                  | ✅                  | ✅ COMPLETE                  | `LiveMap.jsx`                               |
| 8   | Map editing                 | ✅                  | ✅                  | ✅ COMPLETE                  | `MapEditor.jsx`                             |
| 9   | Beacon creation             | ✅                  | ✅                  | ✅ COMPLETE                  | `MapConfigurationTab`                       |
| 10  | Beacon placement            | ✅                  | ✅                  | ✅ COMPLETE                  | `MapEditor handleCanvasClick`               |
| 11  | Beacon movement/drag        | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `MapEditor drag handlers`                   |
| 12  | Beacon metadata             | ✅                  | ✅                  | ✅ COMPLETE                  | `WebUIBeaconConfig`                         |
| 13  | Beacon persistence          | ✅                  | ✅                  | ✅ COMPLETE                  | `SaveWebUIConfig` + store                   |
| 14  | Configuration management    | ✅                  | ✅                  | ✅ COMPLETE                  | `config.go`, `handler.go`                   |
| 15  | App configuration           | ⚠️ minimal          | ✅                  | ✅ COMPLETE (TH)             | `AppConfigurationTab` + 7 cards             |
| 16  | Alarm configuration         | ❌                  | 🟡 placeholder      | 🟡 PARTIAL (TH)              | `AlarmSettingsTab.jsx`                      |
| 17  | Tracker/device config       | ⚠️ config-only      | ✅                  | ✅ COMPLETE (TH)             | `TrackerAccessControlCard`                  |
| 18  | MQTT/BLE                    | ✅ MQTT + BLE       | ✅ MQTT only        | ⚠️ DIFFERENT (TH: MQTT only) | `mqtt_handler.go`                           |
| 19  | Beacon scanning             | ✅ (BLE)            | ❌                  | ❌ MISSING (TH)              | —                                           |
| 20  | Position calculation        | ✅                  | ✅                  | ✅ COMPLETE                  | `positioning.go`                            |
| 21  | RSSI processing             | ✅                  | ✅                  | ✅ COMPLETE                  | `CalculateDistance`                         |
| 22  | Filtering/smoothing         | ✅ Kalman wired     | 🟡 Kalman not wired | 🟡 PARTIAL (TH)              | `kalman.go`                                 |
| 23  | Personal Mode               | ✅ Local Mode       | ❌                  | ❌ MISSING (TH, OPTIONAL)    | —                                           |
| 24  | Tracker Mode                | ✅                  | ✅                  | ✅ COMPLETE                  | `TrackerModePage.jsx`                       |
| 25  | Live tracking               | ✅                  | ✅                  | ✅ COMPLETE                  | WebSocket + LiveMap                         |
| 26  | WebSocket/frontend updates  | ✅                  | ✅                  | ✅ COMPLETE                  | `websocket.go`, `websocketService.js`       |
| 27  | Map + tracker rendering     | ✅                  | ✅                  | ✅ COMPLETE                  | `LiveMap.jsx`                               |
| 28  | Config import/export        | ✅                  | ✅                  | ✅ COMPLETE                  | Config API                                  |
| 29  | Runtime configuration       | ✅                  | ✅                  | ✅ COMPLETE                  | `RuntimeConfigStore`, runtime-config API    |
| 30  | Deployment/runtime          | ✅                  | ✅                  | ✅ COMPLETE                  | Dockerfiles, compose, Makefile              |
| 31  | Auth                        | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `auth.go`, middleware                       |
| 32  | Accuracy/confidence metrics | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `PositionResult`                            |
| 33  | Outlier rejection           | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `RejectOutliers`                            |
| 34  | Weighted-centroid fallback  | ❌                  | ✅                  | ✅ COMPLETE (TH)             | `WeightedCentroid`                          |
| 35  | Automated tests             | ❌                  | ✅                  | ✅ COMPLETE (TH)             | 10 backend + 151 frontend                   |

---

## 30. P0 / P1 / P2 / P3 Gaps

### P0 — BLOCKS CORE TRACKING

**None identified.** The core live-tracking workflow is fully implemented and test-verified.

### P1 — IMPORTANT FOR PRODUCTION

| Gap                                            | Why it matters                                                                                                                       | Reference behavior                                                                              | TrackerHub current                                                            | Recommended solution                                                                                                                                                                                          | Complexity   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Kalman filter not wired into live pipeline** | Tracker positions are unsmoothed (noisy RSSI produces jitter). Reference smooths positions in real time, improving UX and stability  | Kalman2D applied in `process_tracker_report()` (`predict`/`update`, params from runtime config) | `kalman.go` defined but unused; `CalculatePosition` result broadcast directly | Wire `KalmanFilter2D.Predict/Update` into `main.go` MQTT callback, storing per-tracker filter (matching reference), using `runtime_cfg.kalman` params. Preserve `CalculatePosition` as the measurement source | Medium       |
| **Alarm engine (backend + frontend)**          | Placeholder UI implies alarms; production needs real threshold/notification logic. Reference has none, but TrackerHub signals intent | Not present in reference                                                                        | `AlarmSettingsTab.jsx` is "Coming Soon" only; no backend                      | Implement alarm thresholds + notification engine (WebSocket notification, optionally webhook/email), wire to `AlarmSettingsTab`                                                                               | Medium–Large |
| **Webhook outbound delivery**                  | Config exists but never fires; users lose third-party notifications                                                                  | Reference models webhook but Python backend doesn't consume it either                           | `WebhookConfigCard` + model, no delivery engine                               | Add async outbound delivery on tracker events (per config headers/URL)                                                                                                                                        | Medium       |
| **Restart service is a stub**                  | In production the restart action should actually restart the process/service                                                         | N/A                                                                                             | `RestartService` returns message only                                         | Implement actual graceful restart (e.g., signal-based supervisor or exec re-exec)                                                                                                                             | Small–Medium |

### P2 — NICE TO HAVE

| Gap                                   | Why it matters                                                                     | Reference behavior                                     | TrackerHub current                                 | Recommended solution                                                                           | Complexity   |
| ------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| **Redis/Postgres ignored**            | State is in-memory, lost on restart; persistence/history for production would help | Reference also in-memory                               | Compose declares PG/Redis but no Go code uses them | Optionally persist `TrackerState` / position history to Postgres, or cache live state in Redis | Medium–Large |
| **Beacon scanning/discovery (BLE)**   | Manual MAC entry is tedious in the field                                           | Node `local-beacon-service` scans iBeacons             | No BLE; MACs entered manually                      | Port a Go BLE scanner + discovery UI (like reference's `BeaconManagerTab` scan)                | Large        |
| **Frontend smoothing**                | Client-side visual smoothing improves perceived quality                            | `positionManager.js` (`POSITION_SMOOTHING_FACTOR=0.3`) | None                                               | Add lightweight client smoothing                                                               | Small        |
| **LiveMap tests for accuracy/trails** | More coverage                                                                      | —                                                      | base LiveMap tests exist                           | Extend `LiveMap.test.jsx`                                                                      | Small        |

### P3 — REFERENCE-ONLY / OPTIONAL

| Gap                       | Why it matters                                                                                                                 | Reference behavior                           | TrackerHub current | Recommended                                              | Complexity |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------ | -------------------------------------------------------- | ---------- |
| **Personal / Local Mode** | Distinct consumer use-case (device self-location). Not part of the core server-side tracker requirement. **OPTIONAL / FUTURE** | `LocalModeConfigView.vue` + Node BLE service | Not present        | Only if product goal expands to personal device tracking | Large      |

---

## 31. Recommended Implementation Order

Assuming the product goal is a **production-grade server-side tracker positioning system**, recommended order:

1. **P1 — Wire Kalman filter into the live pipeline.** Highest functional value/smallest risk; matches reference behavior; keeps architecture unchanged.
2. **P1 — Implement the alarm engine** (thresholds + notifications) and replace the placeholder UI.
3. **P1 — Implement webhook outbound delivery** (honor the existing config).
4. **P1 — Make the restart endpoint functional**.
5. **P2 — Persist tracker state/history** (leveraging the dormant Postgres/Redis).
6. **P2 — (Optional) client-side smoothing; [Large] BLE beacon scanning/discovery.**
7. **P3 — (Optional/Future) Personal/Local Mode.**

---

## 32. Files / Evidence Examined

### IndoorPositioning (Reference)

- `Solution_IndoorPositioning_H5/server/main.py` — MQTT client, `process_tracker_report`, Kalman wiring, WebSocket `ConnectionManager`
- `Solution_IndoorPositioning_H5/server/positioning.py` — `calculate_distance`, `multilateration_least_squares` (scipy LM), `calculate_position`, `KalmanFilter2D`
- `Solution_IndoorPositioning_H5/server/models.py` — `WebUIMapInfo`, `WebUIBeaconConfig`, `MiniprogramConfig`
- `Solution_IndoorPositioning_H5/server/web_config.json`, `server_runtime_config.json`
- `Solution_IndoorPositioning_H5/web/src/components/MapView.vue`, `configuration/MapEditorTab.vue`, `BeaconManagerTab.vue`, `GeneralSettingsTab.vue`
- `Solution_IndoorPositioning_H5/web/src/views/LocalModeConfigView.vue`, `TrackerModeConfigView.vue`, `MasterConfigView.vue`, `ConfigurationSuiteView.vue`
- `Solution_IndoorPositioning_H5/web/src/services/localPositioningService.js`, `utils/positioning/*`
- `Solution_IndoorPositioning_H5/local-beacon-service/service.js`
- `config/dashboard_config.json`, `config/server_runtime_config.json`
- `test/example_mqtt_data.json`, `test/LoRaWANTracker Payload.json`
- `start.sh`, `start_service.sh`

### TrackerHub (Current)

- `backend/cmd/server/main.go` — wiring, routes, WS/MQTT integration
- `backend/internal/models/models.go`, `kalman.go`
- `backend/internal/api/handler.go`, `auth_handler.go`
- `backend/internal/mqtt/mqtt_handler.go`
- `backend/internal/positioning/positioning.go`, `service.go`
- `backend/internal/websocket/websocket.go`
- `backend/internal/config/config.go`, `runtime_config_store.go`
- `backend/internal/auth/auth.go`, `middleware.go`
- `backend/config/web_config.json`, `server_runtime_config.json`, `auth_config.json`
- `client/src/App.jsx`, `pages/*`, `components/*` (MapEditor, LiveMap, MapConfigurationTab, AppConfigurationTab, AlarmSettingsTab, cards)
- `client/src/hooks/useMapCanvas.js`, `services/*`, `contexts/AuthContext.jsx`
- Test files (backend `*_test.go`, frontend `*.test.jsx/js`)
- `backend/Dockerfile`, `client/Dockerfile`, `docker-compose-dev/prod.yml`, `Makefile`

---

## 33. Final Conclusion

TrackerHub is a **functionally sound, test-verified reimplementation** of the IndoorPositioning reference for the **core live-tracking workflow**. The map workflow (image upload → dimensions → beacons → persistence → positioning → LiveMap) is **complete** and covered by a passing test suite. TrackerHub is arguably **more complete** than the reference in several areas (image floor plans, weighted-centroid fallback, outlier rejection, accuracy/confidence metrics, auth, and automated tests).

The primary **functional gap** versus the reference is the **Kalman filter not being wired into the live positioning pipeline** (P1). The main **feature gap** versus the reference is **Personal/Local Mode** (P3, OPTIONAL/FUTURE). Minor production gaps exist around **alarms** (placeholder), **webhook delivery** (config only), and the **restart stub** (P1).

**No architecture redesign is needed.** The existing architecture cleanly supports the recommended P1 enhancements (wiring Kalman, alarm engine, webhook delivery, restart) without changing the design.

---

# Recommended Next Phase

**Phase 6: Wire the Kalman filter into the live MQTT → positioning → WebSocket pipeline.**

### Why it should be next

The Kalman filter (`backend/internal/models/kalman.go`) is fully implemented and parameterized (its params come from `ServerRuntimeConfig.kalman.processVariance/measurementVariance`), but it is **dead code in the live path** — `main.go`'s MQTT callback feeds `CalculatePosition()` output directly to the WebSocket broadcast. The reference project runs the exact same filter through `predict()/update()` in its MQTT handler. Wiring it in delivers the single biggest functional-equivalence improvement with the **lowest risk**, because the algorithm and architecture already exist — no redesign is needed.

### What exact problem it solves

It smooths/generates stable tracker positions in real time: each new `CalculatePosition` measurement is passed through a per-tracker constant-velocity Kalman filter (with time-delta `predict` via message timestamps), removing RSSI-induced jitter and providing reasonable position continuity even when a measurement is momentarily missing (predict-only).

### What files are likely involved

- `backend/cmd/server/main.go` — MQTT callback: add per-tracker `KalmanFilter2D` state, call `Predict(dt)` then `Update(calculatedPosition)` before building the `tracker_update` message (mirroring the reference's `process_tracker_report`).
- `backend/internal/models/kalman.go` — likely only minor helper additions (e.g., a `Reset`/getter) if needed; may require **no changes**.
- `backend/internal/api/handler.go` — `UpsertTrackerStateWithData` may need a small signature/plumbing adjustment so the filtered position and raw position are both tracked (value + last timestamp for `dt`).
- New test: `backend/internal/positioning/phase6_kalman_pipeline_test.go` to verify filtering is applied end-to-end.
- Possibly a small frontend toggle/status if exposed, but **not required** for a first pass.

### What should NOT be changed

- The **positioning algorithm** (`positioning.go` `CalculatePosition`, `MultilaterationLeastSquares`, `WeightedCentroid`, `RejectOutliers`, `CalculateDistance`) must remain the **measurement source**, unchanged.
- The **MQTT handler** and its payload parsing must not change.
- The **WebSocket message schema** (`tracker_update`) must not change.
- The **configuration schema** and `KalmanParams` model must not change.
- Do **not** redesign the architecture or introduce a new framework/DB.

### Acceptance criteria

1. `go build ./...` succeeds.
2. All existing backend tests pass, including Phase 4 and Phase 5 suites (no regressions).
3. New Phase 6 test verifies that, given identical `CalculatePosition` outputs, the **filtered** position path is invoked and produces (a) a stable, smoothed trajectory and (b) functional `predict-only` continuity when a measurement is missing — distinct from the raw/unsmoothed output.
4. `tracker_update` messages continue to carry all required fields (`position`, `accuracy`, `confidence`, `method`, `beaconCount`), with `position` being the filtered value.
5. A config change to `kalman.processVariance/measurementVariance` takes effect **without restart** (consistent with the live-store design).
6. Documentation note added to `README` describing the Kalman smoothing behavior.

---

## FINAL RESPONSE

**1. Report path:** `/home/ragul/office/projects/testProjects/trackerHub/TRACKERHUB_REFERENCE_COMPARISON.md`

**2. Current COMPLETE features:**

- Floor-plan JPG/PNG upload + image rendering
- Map dimensions/calibration (meters) + coordinate system (Y-flip)
- Map editor (click-place + **drag**) + background image
- Beacon management, placement, persistence, live config store (no restart)
- JSON layout import
- MQTT ingestion (SenseCAP + legacy), measurementID 5002 filter
- RSSI → distance (log-distance), multilateration, weighted-centroid fallback, outlier rejection
- WebSocket live push (+ initial_state + mqtt_status + auth)
- Tracker Mode live tracking + LiveMap rendering
- Auth (login, tokens, middleware), tracker access allow-list
- App Configuration (7 cards), SenseCAP/ChirpStack MQTT config
- Docker/Compose/Makefile deployment

**3. Current PARTIAL features:**

- **Kalman filtering** — defined but **not wired** into the live pipeline
- **Alarm settings** — frontend placeholder, no backend engine
- **Webhook** — config only, no outbound delivery
- **Restart service** — stub
- **Area location** — config toggle only, no logic
- **Redis/Postgres** — declared but unused
- **Frontend smoothing** — none

**4. Current MISSING features:**

- **Personal / Local Mode** (client-side BLE positioning) — OPTIONAL/FUTURE
- **BLE beacon scanning/discovery** — MACs entered manually
- **Alarm/notification engine**

**5. P0/P1 gaps:**

- **P0:** None (core tracking works).
- **P1:** Wire Kalman filter into live pipeline; implement alarm engine; implement webhook delivery; make restart endpoint functional.

**6. Recommended Next Phase:**

- **Phase 6 — Wire the Kalman filter into the live MQTT → positioning → WebSocket pipeline.** Lowest-risk, highest-value functional-equivalence improvement; no architecture change.

**7. Test/build status:**

- Backend: `go build ./...` ✅ OK; `go test ./...` ✅ all packages pass; `go vet ./...` ✅ clean.
- Frontend: `vitest run` ✅ **151/151 pass** (10 test files); `npm run build` ✅ succeeds (only non-failing lottie-eval & chunk-size warnings).

---

# Beacon Workflow Comparison

## 1. Reference Workflow (IndoorPositioning)

### Beacon Fields

**File:** `Solution_IndoorPositioning_H5/server/models.py` — `WebUIBeaconConfig` and `MiniprogramBeaconConfig`

| Field                     | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `uuid`                    | iBeacon UUID (required)                        |
| `major`                   | iBeacon Major value (required, 0–65535)        |
| `minor`                   | iBeacon Minor value (required, 0–65535)        |
| `x`, `y`                  | Position in meters (required)                  |
| `txPower`                 | RSSI at 1m for distance calculation (required) |
| `displayName`             | User-friendly display name (optional)          |
| `macAddress` / `deviceId` | Physical MAC address or device ID (optional)   |

### Add/Create Beacon

- **Explicit "Add New Beacon" button** in `BeaconManagerTab.vue` (disabled if no map or not connected to local service)
- **Modal form** with all fields editable: Display Name, UUID, Major, Minor, MAC/Device ID, X, Y, TxPower
- **Scan via Local Service** button connects to Node.js `local-beacon-service` (port 8081), discovers iBeacons via BLE, and can "Add This Beacon" to pre-fill the form

### Beacon Details & Identity

- **Primary identity**: `(uuid, major, minor)` tuple — uniqueness enforced in UI (`saveBeacon` checks this triple + deviceId)
- **Physical join key**: `macAddress` / `deviceId` — used for BLE scan matching and MQTT positioning
- **UUID case-normalized** to uppercase on save

### X/Y Coordinates

- Stored in **meters** (`WebUIBeaconConfig.x`, `y` in `WebUIBeaconConfig`)
- Map dimensions also in meters; canvas rendering inverts Y (bottom-left origin)

### Place Beacon on Map

- User clicks **"Place on Map"** button in `BeaconManagerTab` → emits `beacon-selected-for-placement` → parent switches to `MapEditorTab` which shows crosshair cursor
- **Two-click confirm + ESC cancel** in `MapEditorTab.vue` (`handleMapClick`, `confirmBeaconPlacement`, `cancelBeaconPlacement`)
- Coordinates emitted back as `beacon-coordinates-updated` event with `{...beacon, x, y}`

### Move Beacon

- **No drag support** in reference. Beacon is repositioned by re-selecting "Place on Map" and clicking a new location.

### Save / Load

- **Config emitted up** via `beacons-updated` to parent (`MasterConfigView.vue`, `ConfigurationSuiteView.vue`)
- Parent handles **JSON import/export** (file upload or paste) and persists to `server/web_config.json` via `config_manager.py` + `main.py` POST `/api/configuration/web`
- Server loads on startup via `load_web_ui_config()` (no live in-memory store — full reload on save)

### Physical Beacon Identity Mapping (MQTT → Config)

- **MQTT handler** (`main.py` `on_message` → `parse_sensecap_payload`) extracts MAC from SenseCAP `value[].mac`
- **Positioning** (`positioning.py` `calculate_position`) matches by **case-insensitive MAC**: `cfg_beacon.macAddress.lower() == detected.macAddress.lower()`
- Config beacon's `x`, `y`, `txPower` used directly

---

## 2. TrackerHub Workflow

### Beacon Fields

**File:** `backend/internal/models/models.go` — `WebUIBeaconConfig`

| Field         | JSON          | Required     | Notes                 |
| ------------- | ------------- | ------------ | --------------------- |
| `UUID`        | `uuid`        | yes (len=32) | iBeacon UUID string   |
| `Major`       | `major`       | yes          | 0–65535               |
| `Minor`       | `minor`       | yes          | 0–65535               |
| `X`           | `x`           | yes          | meters                |
| `Y`           | `y`           | yes          | meters                |
| `TXPower`     | `txPower`     | yes          | RSSI at 1m            |
| `DisplayName` | `displayName` | no           | optional label        |
| `MACAddress`  | `macAddress`  | no           | **physical join key** |

### Add/Create Beacon

- **No explicit "Add" button** in current UI — beacons come from:
  1. **JSON layout import** (`MapConfigurationTab.jsx` `handleImportLayout`)
  2. **Default fixture** (hard-coded `"AA11BB22CC33"` in `defaultFormState`)
  3. **Direct `web_config.json` editing**

### Beacon Details & Form

- **Inline editing** in `MapConfigurationTab.jsx` beacon list cards: `displayName`, `x`, `y`, `txPower`
- **NOT editable in UI**: `MACAddress`, `UUID`, `Major`, `Minor`
- "Place on Map" button per beacon

### Beacon Identity

- **Config list identity**: UUID + index (React key `${uuid}-${index}`)
- **Physical join key**: `MACAddress` — **the only field used for MQTT→config matching** in `CalculatePosition`

### X/Y Coordinates

- **Meters** (`float64`), stored in `WebUIBeaconConfig.X`, `Y`
- Map dimensions in meters; shared `useMapCanvas.js` does meter↔pixel conversion with Y-flip

### Place Beacon on Map

- `MapConfigurationTab` `handlePlaceOnMap` → `MapEditor.jsx` two-click confirm + ESC cancel
- `handleCanvasClick`: click 1 sets preview, click 2 calls `onPlacementComplete(beacon, x, y)` → updates beacon X/Y
- Live green preview with coordinates during placement

### Move / Drag Beacon

- **Full drag support** in `MapEditor.jsx`: 10px hit-test, live preview, dashed line, `onBeaconsChange` on move
- Position updates live in state; must click "Save configuration" to persist

### Save / Load

- **Frontend**: `saveWebConfiguration()` → `POST /api/config/web`
- **Backend**: `UpdateWebUIConfig` → `SaveWebUIConfig()` to JSON + `WebUIConfigStore.Set()` (live in-memory store)
- **Live effect**: Positioning uses new config **immediately without restart** (proven by `phase5_mqtt_to_livemap_test.go`)
- **Load**: `loadWebConfiguration()` → `GET /api/config/web`; startup in `main.go` seeds store

### Physical Beacon Identity Mapping (MQTT → Config)

- **MQTT parsing** (`mqtt_handler.go` `parseTrackerReport`):
  ```go
  detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
  ```
  Normalizes `c3:00:00:3e:7d:e0` → `C300003E7DE0`
- **Positioning** (`positioning.go` `CalculatePosition`):
  ```go
  beaconMap[webUIConfig.Beacons[i].MACAddress] = &webUIConfig.Beacons[i]
  ...
  if cfgBeacon, exists := beaconMap[detected.MACAddress]; exists {
      // uses cfgBeacon.X, cfgBeacon.Y
  }
  ```
- **Exact string match** on normalized uppercase-no-colons MAC

---

## 3. Beacon Field Comparison

| Field                        | Reference                            | TrackerHub                                     | Status                                            |
| ---------------------------- | ------------------------------------ | ---------------------------------------------- | ------------------------------------------------- |
| UUID                         | `uuid` (required)                    | `UUID` (required, len=32)                      | ✅ SAME FUNCTIONALITY                             |
| Major                        | `major` (required)                   | `Major` (required)                             | ✅ SAME FUNCTIONALITY                             |
| Minor                        | `minor` (required)                   | `Minor` (required)                             | ✅ SAME FUNCTIONALITY                             |
| X (meters)                   | `x` (required)                       | `X` (required)                                 | ✅ SAME FUNCTIONALITY                             |
| Y (meters)                   | `y` (required)                       | `Y` (required)                                 | ✅ SAME FUNCTIONALITY                             |
| TXPower                      | `txPower` (required)                 | `TXPower` (required)                           | ✅ SAME FUNCTIONALITY                             |
| DisplayName                  | `displayName` (optional)             | `DisplayName` (optional)                       | ✅ SAME FUNCTIONALITY                             |
| Physical MAC                 | `macAddress` / `deviceId` (optional) | `MACAddress` (optional)                        | ✅ SAME FUNCTIONALITY                             |
| **Identity for positioning** | `macAddress` (case-insensitive)      | `MACAddress` (normalized uppercase, no colons) | ⚠️ DIFFERENT IMPLEMENTATION BUT FUNCTIONALLY SAME |

---

## 4. Map Placement Comparison

| Feature                       | Reference             | TrackerHub                                        | Status                                                    |
| ----------------------------- | --------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Select beacon → Place on Map  | ✅ Button + emit      | ✅ Button + state                                 | ✅ SAME FUNCTIONALITY                                     |
| Two-click confirm             | ✅                    | ✅                                                | ✅ SAME FUNCTIONALITY                                     |
| ESC cancel                    | ✅                    | ✅                                                | ✅ SAME FUNCTIONALITY                                     |
| Live preview during placement | ✅                    | ✅                                                | ✅ SAME FUNCTIONALITY                                     |
| **Drag existing beacon**      | ❌ Not implemented    | ✅ Full drag (hit-test, live update, dashed line) | ⚠️ DIFFERENT IMPLEMENTATION — TrackerHub **more capable** |
| Coordinate precision          | Rounded to 2 decimals | Full float64                                      | ⚠️ DIFFERENT IMPLEMENTATION BUT FUNCTIONALLY SAME         |

---

## 5. Persistence Comparison

| Aspect                       | Reference                                           | TrackerHub                                             | Status                                                    |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Disk format                  | JSON (`web_config.json`, `miniprogram_config.json`) | JSON (`web_config.json`)                               | ✅ SAME FUNCTIONALITY                                     |
| Save trigger                 | UI emit → parent → POST `/api/configuration/web`    | UI → `saveWebConfiguration()` → POST `/api/config/web` | ✅ SAME FUNCTIONALITY                                     |
| **Live update (no restart)** | ❌ Full reload on save                              | ✅ `WebUIConfigStore.Set()` — instant                  | ⚠️ DIFFERENT IMPLEMENTATION — TrackerHub **more capable** |
| Config import/export         | JSON file upload + paste in UI                      | JSON layout import (`handleImportLayout`)              | ✅ SAME FUNCTIONALITY                                     |
| Default/fallback config      | Written by `config_manager.py` on missing file      | Written by `ConfigManager` on missing file             | ✅ SAME FUNCTIONALITY                                     |

---

## 6. Physical Beacon Identity Mapping

### Chain: Configured Beacon → MQTT Detection → Positioning

| Step                           | Reference                                                      | TrackerHub                                                           |
| ------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Beacon config identity**     | `(uuid, major, minor)` + optional `macAddress`                 | `MACAddress` (primary join key) + UUID+Major+Minor for list identity |
| **MQTT payload MAC format**    | SenseCAP `value[].mac` with colons, lowercase                  | SenseCAP `value[].mac` with colons, lowercase (same)                 |
| **MQTT MAC normalization**     | Case-insensitive comparison in `calculate_position`            | `strings.ToUpper(strings.ReplaceAll(mac, ":", ""))` → `C300003E7DE0` |
| **Config MAC format expected** | Same format as MQTT (case-insensitive match)                   | **Must already be normalized** (uppercase, no colons)                |
| **Positioning match**          | `cfg_beacon.macAddress.lower() == detected.macAddress.lower()` | `beaconMap[detected.MACAddress]` (exact string match)                |
| **Coordinates used**           | `cfg_beacon.x`, `y` (meters)                                   | `cfgBeacon.X`, `Y` (meters)                                          |
| **TXPower used**               | `cfg_beacon.txPower`                                           | `cfgBeacon.TXPower`                                                  |

### Critical Consistency Check ✅

- **Reference**: case-insensitive comparison means format doesn't matter
- **TrackerHub**: MQTT normalizes to `C300003E7DE0`; config **must store the same format**
- Test fixtures and `real-map-config.json` store `C300003E7DEF` (uppercase, no colons) — **consistent**
- **Caveat**: TrackerHub UI does **not expose `MACAddress` field** for editing. If a user manually enters a MAC with colons/lowercase in `web_config.json`, matching would **fail**. The stored value must be pre-normalized.

---

## 7. Positioning Integration

| Aspect                   | Reference                                   | TrackerHub                                        | Status                                            |
| ------------------------ | ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Matching field           | `macAddress` (case-insensitive)             | `MACAddress` (normalized exact)                   | ⚠️ DIFFERENT IMPLEMENTATION BUT FUNCTIONALLY SAME |
| Distance formula         | Log-distance path loss (same)               | Log-distance path loss (same)                     | ✅ SAME FUNCTIONALITY                             |
| Multilateration          | scipy `least_squares` (Levenberg-Marquardt) | Gradient descent                                  | ⚠️ DIFFERENT IMPLEMENTATION BUT FUNCTIONALLY SAME |
| Fallback (<3 beacons)    | ❌ Returns None                             | ✅ Weighted centroid                              | TrackerHub **more capable**                       |
| Outlier rejection        | ❌                                          | ✅ `RejectOutliers` (50m)                         | TrackerHub **more capable**                       |
| Kalman filter            | ✅ Wired in `process_tracker_report`        | ✅ Wired via `KalmanStateStore.Apply()` (Phase 6) | ✅ SAME FUNCTIONALITY                             |
| Beacon X/Y used directly | ✅ meters                                   | ✅ meters                                         | ✅ SAME FUNCTIONALITY                             |

---

## 8. Functional Gaps

| Gap                               | Impact                                                                            | Required Fix                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **No "Add Beacon" UI**            | Users cannot create new beacons via UI — must import JSON or edit file            | Add "Add Beacon" button + modal with all fields (incl. `MACAddress`) in `MapConfigurationTab.jsx` |
| **MACAddress not editable in UI** | If a beacon's MAC changes or new beacon added, must hand-edit `web_config.json`   | Expose `MACAddress` input in beacon card (validated as 12 hex chars)                              |
| **MAC format safety**             | If config stores MAC with colons/lowercase, positioning silently fails (no match) | Add normalization on save (`UpdateWebUIConfig`) or validation; warn in UI                         |
| **BLE beacon scanning**           | Reference has BLE scan via Node service; TrackerHub has none                      | OPTIONAL/FUTURE (out of scope per task)                                                           |

---

## 9. Final Status

### Critical Chain Verification

| Step                                | Status                                | Evidence                                           |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Beacon configured in UI             | ⚠️ Partial (no Add; only edit/import) | `MapConfigurationTab.jsx` list + inline edit       |
| Beacon identity saved               | ✅                                    | `WebUIBeaconConfig` → `web_config.json`            |
| X/Y position saved                  | ✅                                    | `X`, `Y` fields persisted                          |
| MQTT identifies beacon              | ✅                                    | `parseTrackerReport` → `DetectedBeacon.MACAddress` |
| Positioning finds configured beacon | ✅                                    | `CalculatePosition` `beaconMap[MACAddress]` lookup |
| Correct coordinates used            | ✅                                    | `cfgBeacon.X`, `Y` in distance calc                |

**Verdict: 🟡 BEACON WORKFLOW PARTIAL**

### Why PARTIAL (not COMPLETE)

The chain **works end-to-end for existing beacons** (proven by Phase 4/5 tests and `phase5_mqtt_to_livemap_test.go`), but:

1. **Cannot add new beacons via UI** — must import JSON or edit `web_config.json` directly
2. **Cannot edit `MACAddress` via UI** — the physical join key is invisible in the form
3. **MAC format safety** — silent failure if config stores non-normalized MAC

### Minimum additions to reach COMPLETE

1. **Add "Add Beacon" button + modal** in `MapConfigurationTab.jsx` with all fields (including `MACAddress`)
2. **Expose `MACAddress` as editable field** in beacon card (12 hex char validation)
3. **Normalize MAC on save** in `UpdateWebUIConfig` (strip colons, uppercase) to prevent silent mismatch

**No architecture change, no positioning/MQTT changes required.**

---

**STOP — no implementation performed.**
