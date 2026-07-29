package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// APIHandler handles HTTP API requests
type APIHandler struct {
	configManager *config.ConfigManager
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(configManager *config.ConfigManager) *APIHandler {
	return &APIHandler{
		configManager: configManager,
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

	if err := h.configManager.SaveWebUIConfig("config/web_config.json", &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save web UI configuration"})
		return
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
	c.JSON(http.StatusOK, config)
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
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.configManager.SaveServerRuntimeConfig("config/server_runtime_config.json", &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save server runtime configuration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Server runtime configuration updated successfully"})
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
	// In a real implementation, we would get this from a tracker state manager
	// For now, return an empty map
	c.JSON(http.StatusOK, gin.H{})
}
