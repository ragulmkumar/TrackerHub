package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sync"

	"github.com/gin-gonic/gin"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// APIHandler handles HTTP API requests
type APIHandler struct {
	configManager      *config.ConfigManager
	runtimeConfigStore *config.RuntimeConfigStore
	webUIConfigStore   *config.WebUIConfigStore
	trackerStates      map[string]models.TrackerState
	trackerMu          sync.RWMutex
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(configManager *config.ConfigManager, runtimeConfigStore *config.RuntimeConfigStore, webUIConfigStore *config.WebUIConfigStore) *APIHandler {
	return &APIHandler{
		configManager:      configManager,
		runtimeConfigStore: runtimeConfigStore,
		webUIConfigStore:   webUIConfigStore,
		trackerStates:      make(map[string]models.TrackerState),
	}
}

// GetWebUIConfig godoc
// @Summary Get web UI configuration
// @Description Returns the current web UI configuration including beacon positions and map settings
// @Tags Configuration
// @Accept json
// @Produce json
// @Success 200 {object} models.WebUIConfig "Web UI configuration"
// @Failure 500 {object} map[string]string "Failed to load configuration"
// @Router /api/config/web [get]
func (h *APIHandler) GetWebUIConfig(c *gin.Context) {
	config, err := h.configManager.LoadWebUIConfig("config/web_config.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load web UI configuration"})
		return
	}
	c.JSON(http.StatusOK, config)
}

// GetDashboardConfig returns the dashboard-shaped payload expected by the
// reference IndoorPositioning UI while preserving TrackerHub's internal config model.
func (h *APIHandler) GetDashboardConfig(c *gin.Context) {
	config, err := h.configManager.LoadWebUIConfig("config/web_config.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load dashboard configuration"})
		return
	}
	c.JSON(http.StatusOK, config.ToDashboardResponse())
}

// UpdateWebUIConfig godoc
// @Summary Update web UI configuration
// @Description Updates the web UI configuration with new beacon positions or map settings
// @Tags Configuration
// @Accept json
// @Produce json
// @Param config body models.WebUIConfig true "Web UI configuration"
// @Success 200 {object} map[string]string "Configuration updated successfully"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 500 {object} map[string]string "Failed to save configuration"
// @Router /api/config/web [post]
func (h *APIHandler) UpdateWebUIConfig(c *gin.Context) {
	var config models.WebUIConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Normalize MAC addresses and detect duplicates before saving
	seenMACs := make(map[string]bool) // MAC address (unique per beacon)

	for i := range config.Beacons {
		b := &config.Beacons[i]

		// Normalize MAC address if provided
		if b.MACAddress != "" {
			normalized, err := models.NormalizeMAC(b.MACAddress)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("Invalid MAC address for beacon %q: %s", b.DisplayName, err.Error()),
				})
				return
			}
			b.MACAddress = normalized
		}

		// Beacons are uniquely identified by MAC address when one is provided.
		// Multiple beacons may share the same UUID+Major+Minor (e.g. a single
		// iBeacon factory batch) but each physical device must have a unique MAC.
		// This matches the reference IndoorPositioning project behavior.
		if b.MACAddress != "" {
			if seenMACs[b.MACAddress] {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("A beacon with MAC address %s already exists.", b.MACAddress),
				})
				return
			}
			seenMACs[b.MACAddress] = true
			continue
		}

		// If no MAC address is provided, fall back to the UUID+Major+Minor identity
		// so that two beacons without MACs don't collide with each other.
		identity := fmt.Sprintf("%s-%d-%d", b.UUID, b.Major, b.Minor)
		if seenMACs[identity] {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("A beacon with UUID %s Major %d Minor %d already exists (no MAC address provided).", b.UUID, b.Major, b.Minor),
			})
			return
		}
		seenMACs[identity] = true
	}

	if err := h.configManager.SaveWebUIConfig("config/web_config.json", &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save web UI configuration"})
		return
	}

	// Update in-memory store so positioning uses new config immediately
	if h.webUIConfigStore != nil {
		h.webUIConfigStore.Set(&config)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Web UI configuration updated successfully"})
}

// GetServerRuntimeConfig godoc
// @Summary Get server runtime configuration
// @Description Returns the current server runtime configuration including MQTT and Kalman filter settings
// @Tags Configuration
// @Accept json
// @Produce json
// @Success 200 {object} models.ServerRuntimeConfig "Server runtime configuration"
// @Failure 500 {object} map[string]string "Failed to load configuration"
// @Router /api/server-runtime-config [get]
func (h *APIHandler) GetServerRuntimeConfig(c *gin.Context) {
	config, err := h.configManager.LoadServerRuntimeConfig("config/server_runtime_config.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load server runtime configuration"})
		return
	}
	c.JSON(http.StatusOK, config.ToReferenceAPIResponse())
}

// UpdateServerRuntimeConfig godoc
// @Summary Update server runtime configuration
// @Description Updates the server runtime configuration including MQTT broker settings and Kalman filter parameters
// @Tags Configuration
// @Accept json
// @Produce json
// @Param config body models.ServerRuntimeConfig true "Server runtime configuration"
// @Success 200 {object} map[string]string "Configuration updated successfully"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 500 {object} map[string]string "Failed to save configuration"
// @Router /api/server-runtime-config [post]
func (h *APIHandler) UpdateServerRuntimeConfig(c *gin.Context) {
	var config models.ServerRuntimeConfig
	if err := c.ShouldBindJSON(&config); err == nil {
		if err := h.ValidateServerRuntimeConfig(&config); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	} else {
		var raw map[string]interface{}
		if bindErr := c.ShouldBindJSON(&raw); bindErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		if mqttValue, ok := raw["lwnsMqtt"]; ok {
			mqttBytes, marshalErr := json.Marshal(mqttValue)
			if marshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid LWNS MQTT configuration"})
				return
			}
			if unmarshalErr := json.Unmarshal(mqttBytes, &config.MQTT); unmarshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid LWNS MQTT configuration"})
				return
			}
		} else if mqttValue, ok := raw["chirpStackMqtt"]; ok {
			mqttBytes, marshalErr := json.Marshal(mqttValue)
			if marshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid LWNS MQTT configuration"})
				return
			}
			if unmarshalErr := json.Unmarshal(mqttBytes, &config.MQTT); unmarshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid LWNS MQTT configuration"})
				return
			}
		} else if mqttValue, ok = raw["mqtt"]; ok {
			mqttBytes, marshalErr := json.Marshal(mqttValue)
			if marshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid MQTT configuration"})
				return
			}
			if unmarshalErr := json.Unmarshal(mqttBytes, &config.MQTT); unmarshalErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid MQTT configuration"})
				return
			}
		}

		if serverValue, ok := raw["server"]; ok {
			serverBytes, _ := json.Marshal(serverValue)
			_ = json.Unmarshal(serverBytes, &config.Server)
		}
		if kalmanValue, ok := raw["kalman"]; ok {
			kalmanBytes, _ := json.Marshal(kalmanValue)
			_ = json.Unmarshal(kalmanBytes, &config.Kalman)
		}
		if webhookValue, ok := raw["webhook"]; ok {
			webhookBytes, _ := json.Marshal(webhookValue)
			_ = json.Unmarshal(webhookBytes, &config.Webhook)
		}
		if accessValue, ok := raw["trackerAccessControl"]; ok {
			accessBytes, _ := json.Marshal(accessValue)
			_ = json.Unmarshal(accessBytes, &config.TrackerAccessControl)
		}
		if allowAll, ok := raw["allow_all_tracker"]; ok {
			if boolValue, isBool := allowAll.(bool); isBool {
				config.TrackerAccessControl.AllowAll = boolValue
			}
		}
		if allowAreaLocation, ok := raw["allow_area_location"]; ok {
			if boolValue, isBool := allowAreaLocation.(bool); isBool {
				config.AllowAreaLocation = boolValue
			}
		}

		if err := h.ValidateServerRuntimeConfig(&config); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.configManager.SaveServerRuntimeConfig("config/server_runtime_config.json", &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save server runtime configuration"})
		return
	}
	if h.runtimeConfigStore != nil {
		h.runtimeConfigStore.Set(&config)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Server runtime configuration updated successfully"})
}

// RestartService handles a restart request for the runtime services.
func (h *APIHandler) RestartService(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Service restart requested"})
}

// ValidateServerRuntimeConfig validates the runtime configuration payload.
func (h *APIHandler) ValidateServerRuntimeConfig(config *models.ServerRuntimeConfig) error {
	if config == nil {
		return fmt.Errorf("configuration payload is required")
	}
	if config.Server.Port <= 0 {
		return fmt.Errorf("server port must be greater than zero")
	}
	if config.Kalman.ProcessVariance < 0 || config.Kalman.MeasurementVariance < 0 {
		return fmt.Errorf("kalman variances must be non-negative")
	}
	if config.MQTT.BrokerPort <= 0 || config.MQTT.BrokerPort > 65535 {
		return fmt.Errorf("mqtt broker port must be between 1 and 65535")
	}
	if config.MQTT.Enabled && config.MQTT.ApplicationID == "" {
		return fmt.Errorf("application ID is required when MQTT is enabled")
	}
	if config.MQTT.Enabled && config.MQTT.TopicPattern == "" {
		return fmt.Errorf("topic pattern is required when MQTT is enabled")
	}
	if config.Webhook.Enabled {
		if config.Webhook.HostURL == "" {
			return fmt.Errorf("webhook host URL is required when webhook is enabled")
		}
		parsedURL, err := url.ParseRequestURI(config.Webhook.HostURL)
		if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
			return fmt.Errorf("webhook host URL must be a valid http or https URL")
		}
		if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
			return fmt.Errorf("webhook host URL must be a valid http or https URL")
		}
	}
	if config.TrackerAccessControl.Enabled {
		if !config.TrackerAccessControl.AllowAll && len(config.TrackerAccessControl.AllowedTrackers) == 0 {
			return fmt.Errorf("at least one tracker ID is required when access control is enabled and allow all is off")
		}
		trackerEUIPattern := regexp.MustCompile(`^[A-Fa-f0-9]{8,16}$`)
		for _, trackerID := range config.TrackerAccessControl.AllowedTrackers {
			if !trackerEUIPattern.MatchString(trackerID) {
				return fmt.Errorf("tracker access list entries must be valid hexadecimal EUI values")
			}
		}
	}
	return nil
}

// GetTrackers godoc
// @Summary Get all tracker states
// @Description Returns the current state of all active trackers including their positions
// @Tags Trackers
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Map of tracker states"
// @Router /api/trackers [get]
func (h *APIHandler) GetTrackers(c *gin.Context) {
	h.trackerMu.RLock()
	defer h.trackerMu.RUnlock()

	trackers := make(map[string]models.TrackerState, len(h.trackerStates))
	for id, state := range h.trackerStates {
		normalizedID := models.NormalizeTrackerID(id)
		state.TrackerID = models.NormalizeTrackerID(state.TrackerID)
		trackers[normalizedID] = state
	}
	c.JSON(http.StatusOK, trackers)
}

// GetTrackerSnapshot returns the current tracker state in the WebSocket-facing contract.
func (h *APIHandler) GetTrackerSnapshot() map[string]models.TrackerLiveState {
	h.trackerMu.RLock()
	defer h.trackerMu.RUnlock()

	snapshot := make(map[string]models.TrackerLiveState, len(h.trackerStates))
	for id, state := range h.trackerStates {
		normalizedID := models.NormalizeTrackerID(id)
		trackerSnapshot := models.TrackerLiveState{
			TrackerID:           models.NormalizeTrackerID(state.TrackerID),
			Timestamp:           state.LastUpdateTime,
			Accuracy:            state.Accuracy,
			Battery:             state.Battery,
			LastDetectedBeacons: state.LastDetectedBeacons,
			PositionHistory:     state.PositionHistory,
		}
		if state.X != nil && state.Y != nil {
			trackerSnapshot.Position = &models.TrackerPosition{X: *state.X, Y: *state.Y}
		}
		snapshot[normalizedID] = trackerSnapshot
	}
	return snapshot
}

// PostTrackerUpdate godoc
// @Summary Add or update a tracker position
// @Description Stores a tracker position update for the live monitor view
// @Tags Trackers
// @Accept json
// @Produce json
// @Param update body models.TrackerUpdateRequest true "Tracker update"
// @Success 200 {object} map[string]string
// @Router /api/trackers [post]
func (h *APIHandler) PostTrackerUpdate(c *gin.Context) {
	var update models.TrackerUpdateRequest
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tracker update payload"})
		return
	}

	if !h.IsTrackerAllowed(update.TrackerID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Tracker update rejected by access control policy"})
		return
	}

	h.ApplyTrackerUpdatePayload(update)
	c.JSON(http.StatusOK, gin.H{"message": "Tracker update accepted"})
}

// UpsertTrackerState stores or updates the last known state for a tracker.
func (h *APIHandler) UpsertTrackerState(trackerID string, coordinates []float64, timestamp int64) {
	h.UpsertTrackerStateWithData(trackerID, coordinates, timestamp, nil, nil, nil)
}

// UpsertTrackerStateWithData stores or updates the last known state for a tracker and optionally enriches it.
// battery: when non-nil, updates the stored battery level; when nil, the previous value is preserved.
func (h *APIHandler) UpsertTrackerStateWithData(trackerID string, coordinates []float64, timestamp int64, detectedBeacons []models.DetectedBeacon, accuracy *float64, battery *int) {
	h.trackerMu.Lock()
	defer h.trackerMu.Unlock()

	trackerID = models.NormalizeTrackerID(trackerID)
	state := h.trackerStates[trackerID]
	state.TrackerID = trackerID
	state.LastUpdateTime = timestamp
	if accuracy != nil {
		state.Accuracy = accuracy
	} else if len(coordinates) >= 2 {
		// keep previous accuracy only when we are not explicitly clearing it
	} else if len(detectedBeacons) == 0 && battery != nil {
		// battery-only update: preserve accuracy
	} else {
		state.Accuracy = nil
	}
	if battery != nil {
		state.Battery = battery
	}
	if len(detectedBeacons) > 0 {
		state.LastDetectedBeacons = detectedBeacons
	}
	if len(coordinates) >= 2 {
		state.X = &coordinates[0]
		state.Y = &coordinates[1]
		state.PositionHistory = append(state.PositionHistory, [3]float64{coordinates[0], coordinates[1], float64(timestamp)})
		if len(state.PositionHistory) > 20 {
			state.PositionHistory = state.PositionHistory[len(state.PositionHistory)-20:]
		}
	}

	h.trackerStates[trackerID] = state
}

// IsTrackerAllowed checks whether a tracker ID is accepted by the runtime access policy.
func (h *APIHandler) IsTrackerAllowed(trackerID string) bool {
	normalizedTrackerID := models.NormalizeTrackerID(trackerID)
	runtimeConfig := h.runtimeConfigStore.Get()
	if runtimeConfig == nil {
		return true
	}
	policy := runtimeConfig.TrackerAccessControl
	if !policy.Enabled {
		return true
	}
	if policy.AllowAll {
		return true
	}
	for _, allowed := range policy.AllowedTrackers {
		if models.NormalizeTrackerID(allowed) == normalizedTrackerID {
			return true
		}
	}
	return false
}

// ApplyTrackerUpdatePayload applies a tracker update request to the in-memory tracker state.
func (h *APIHandler) ApplyTrackerUpdatePayload(update models.TrackerUpdateRequest) {
	h.UpsertTrackerState(update.TrackerID, []float64{update.X, update.Y}, update.Timestamp)
}
