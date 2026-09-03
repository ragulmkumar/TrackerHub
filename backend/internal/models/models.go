package models

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

// macHexRegex validates that a string contains exactly 12 hexadecimal characters.
var macHexRegex = regexp.MustCompile(`^[0-9A-Fa-f]{12}$`)

// NormalizeMAC normalizes a MAC address to the canonical TrackerHub format:
// uppercase, no colons or dashes, exactly 12 hex characters.
// Returns the normalized MAC and an error if the input is invalid.
// An empty input returns an empty string with no error (MAC is optional).
func NormalizeMAC(mac string) (string, error) {
	if mac == "" {
		return "", nil
	}

	// Remove common separators
	normalized := strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(mac, ":", ""), "-", ""))

	// Validate exactly 12 hex characters
	if !macHexRegex.MatchString(normalized) {
		return "", fmt.Errorf("invalid MAC address %q: must contain exactly 12 hexadecimal characters", mac)
	}

	return normalized, nil
}

// NormalizeTrackerID normalizes EUI-style tracker IDs to the canonical format used
// by the reference IndoorPositioning project, while preserving non-EUI tracker names.
func NormalizeTrackerID(trackerID string) string {
	if trackerID == "" {
		return ""
	}

	trimmed := strings.TrimSpace(trackerID)
	if regexp.MustCompile(`^[A-Fa-f0-9]{8,16}$`).MatchString(trimmed) {
		return strings.ToUpper(trimmed)
	}
	return trimmed
}

// KalmanFilterState stores per-tracker Kalman filter state and config snapshot
// for detecting configuration changes.
type KalmanFilterState struct {
	Filter              *KalmanFilter2D
	LastTimestamp       int64
	ProcessVariance     float64
	MeasurementVariance float64
}

// DetectedBeacon represents a BLE beacon detected by a tracker
type DetectedBeacon struct {
	MACAddress    string   `json:"macAddress" validate:"required,len=12"`
	Major         *int     `json:"major,omitempty"`
	Minor         *int     `json:"minor,omitempty"`
	Name          string   `json:"name,omitempty"`
	RSSI          int      `json:"rssi" validate:"required,gte=-128,lte=20"`
	TXPower       *int     `json:"txPower,omitempty"`
	ConfiguredX   *float64 `json:"configured_x,omitempty"`
	ConfiguredY   *float64 `json:"configured_y,omitempty"`
	Distance      *float64 `json:"dis,omitempty"`
	DistanceAlias *float64 `json:"distance,omitempty"`
}

// EnrichDetectedBeaconsWithConfig attaches configured beacon metadata and computed distance
// to the raw MQTT sighting data so the public API matches the IndoorPositioning reference.
func EnrichDetectedBeaconsWithConfig(beacons []DetectedBeacon, config *WebUIConfig) []DetectedBeacon {
	if len(beacons) == 0 || config == nil {
		return beacons
	}

	lookup := make(map[string]WebUIBeaconConfig, len(config.Beacons))
	for _, beacon := range config.Beacons {
		if beacon.MACAddress == "" {
			continue
		}
		normalizedMAC, err := NormalizeMAC(beacon.MACAddress)
		if err != nil {
			continue
		}
		lookup[normalizedMAC] = beacon
	}

	propagationFactor := config.Settings.SignalPropagationFactor
	if propagationFactor <= 0 {
		propagationFactor = 2.0
	}

	enriched := make([]DetectedBeacon, 0, len(beacons))
	for _, beacon := range beacons {
		item := beacon
		normalizedMAC, err := NormalizeMAC(beacon.MACAddress)
		if err == nil && normalizedMAC != "" {
			if configured, ok := lookup[normalizedMAC]; ok {
				item.Name = configured.DisplayName
				x := configured.X
				y := configured.Y
				txPower := configured.TXPower
				item.ConfiguredX = &x
				item.ConfiguredY = &y
				item.TXPower = &txPower
				if item.RSSI != 0 {
					distance := math.Pow(10.0, float64(txPower-item.RSSI)/(10.0*propagationFactor))
					item.Distance = &distance
					item.DistanceAlias = &distance
				}
			}
		}
		enriched = append(enriched, item)
	}

	return enriched
}

// TrackerReport represents a report from a tracker device
type TrackerReport struct {
	TrackerID       string           `json:"trackerId" validate:"required"`
	Timestamp       int64            `json:"timestamp" validate:"required,gte=0"`
	DetectedBeacons []DetectedBeacon `json:"detectedBeacons" validate:"required,dive,required"`
	Battery         *int             `json:"battery,omitempty"` // Battery percentage (0-100), nil if unknown
}

// TrackerState represents the current state of a tracker
type TrackerState struct {
	TrackerID                string           `json:"trackerId"`
	TrackerNumber            *string          `json:"tracker_number,omitempty"` // Free-form reference identifier, null by default
	ID                       int64            `json:"id,omitempty"`             // Stable per-tracker auto-increment id
	DeviceName               string           `json:"device_name,omitempty"`    // Display device name (defaults to the tracker EUI)
	GroupID                  int64            `json:"group_id,omitempty"`       // Group membership, 0 by default
	IsFavorite               bool             `json:"is_favorite,omitempty"`    // Favorited flag, false by default
	Map                      string           `json:"map,omitempty"`            // Map name used for positioning
	Type                     string           `json:"type,omitempty"`           // "calculation" when a position exists
	Radius                   float64          `json:"radius,omitempty"`
	SOS                      int              `json:"sos,omitempty"`
	Online                   string           `json:"online,omitempty"` // "online"/"offline" derived from freshness
	X                        *float64         `json:"x,omitempty"`
	Y                        *float64         `json:"y,omitempty"`
	Accuracy                 *float64         `json:"accuracy,omitempty"`
	Battery                  *int             `json:"battery,omitempty"`                          // Battery percentage (0-100), nil if unknown
	LastUpdateTime           int64            `json:"last_update_time" validate:"required,gte=0"` // server time (ms)
	Timestamp                int64            `json:"timestamp,omitempty"`                        // device measurement time (ms)
	LastKnownMeasurementTime *int64           `json:"last_known_measurement_time,omitempty"`
	LastDetectedBeacons      []DetectedBeacon `json:"last_detected_beacons,omitempty"`
	UsedBeacons              []DetectedBeacon `json:"used_beacons,omitempty"`
	PositionHistory          [][3]float64     `json:"position_history,omitempty"` // [x, y, timestamp]
}

// TrackerPosition represents a tracker position payload sent through WebSocket.
type TrackerPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// TrackerLiveState is the WebSocket-facing live contract used by the tracker-mode UI.
type TrackerLiveState struct {
	TrackerID           string           `json:"trackerId"`
	Timestamp           int64            `json:"timestamp"` // server update time (ms)
	Position            *TrackerPosition `json:"position,omitempty"`
	Accuracy            *float64         `json:"accuracy,omitempty"`
	Battery             *int             `json:"battery,omitempty"`
	LastDetectedBeacons []DetectedBeacon `json:"last_detected_beacons,omitempty"`
	UsedBeacons         []DetectedBeacon `json:"used_beacons,omitempty"`
	Map                 string           `json:"map,omitempty"`
	Type                string           `json:"type,omitempty"`
	Radius              float64          `json:"radius,omitempty"`
	SOS                 int              `json:"sos,omitempty"`
	Online              string           `json:"online,omitempty"`
	ID                  int64            `json:"id,omitempty"`
	DeviceName          string           `json:"device_name,omitempty"`
	GroupID             int64            `json:"group_id,omitempty"`
	IsFavorite          bool             `json:"is_favorite,omitempty"`
	TrackerNumber       *string          `json:"tracker_number,omitempty"`
	PositionHistory     [][3]float64     `json:"position_history,omitempty"`
}

// TrackerWebSocketMessage is the typed envelope sent over the WebSocket.
type TrackerWebSocketMessage struct {
	Type string                      `json:"type"`
	Data map[string]TrackerLiveState `json:"data"`
}

// MQTTStatusMessage is a WebSocket message carrying the live MQTT status.
type MQTTStatusMessage struct {
	Type string            `json:"type"`
	Data map[string]string `json:"data"`
}

// WebUIBeaconConfig represents a beacon configuration for the web UI
type WebUIBeaconConfig struct {
	UUID        string  `json:"uuid" validate:"required,len=32"` // iBeacon UUID
	Major       int     `json:"major" validate:"required,gte=0,lte=65535"`
	Minor       int     `json:"minor" validate:"required,gte=0,lte=65535"`
	X           float64 `json:"x" validate:"required"`       // meters
	Y           float64 `json:"y" validate:"required"`       // meters
	TXPower     int     `json:"txPower" validate:"required"` // RSSI at 1m
	DisplayName string  `json:"displayName,omitempty"`
	MACAddress  string  `json:"macAddress,omitempty"` // Physical MAC address if known
}

// WebUIMapEntity represents an entity on the map (polyline, wall, etc.)
type WebUIMapEntity struct {
	Type        string       `json:"type" validate:"required,oneof=polyline wall"`   // e.g., 'polyline', 'wall'
	Points      [][2]float64 `json:"points" validate:"required,min=2,dive,required"` // List of [x, y] coordinates
	Closed      *bool        `json:"closed,omitempty"`
	StrokeColor string       `json:"strokeColor,omitempty"` // e.g., '#333333'
	LineWidth   float64      `json:"lineWidth,omitempty"`   // in pixels
	FillColor   string       `json:"fillColor,omitempty"`   // If supporting filled shapes
}

// WebUIMapInfo contains map dimensions, entities, and optional background image
type WebUIMapInfo struct {
	Name                  string           `json:"name,omitempty"`
	Width                 float64          `json:"width" validate:"required,gt=0"`  // in meters
	Height                float64          `json:"height" validate:"required,gt=0"` // in meters
	Entities              []WebUIMapEntity `json:"entities,omitempty"`
	BackgroundImage       string           `json:"backgroundImage,omitempty"`       // Base64 encoded image data URL
	BackgroundImageWidth  int              `json:"backgroundImageWidth,omitempty"`  // Image width in pixels
	BackgroundImageHeight int              `json:"backgroundImageHeight,omitempty"` // Image height in pixels
}

// WebUISettings contains configuration settings for positioning
type WebUISettings struct {
	SignalPropagationFactor float64 `json:"signalPropagationFactor" validate:"required,gte=1.0,lte=6.0"` // Path loss exponent 'n'
}

// WebUIConfig represents the complete web UI configuration
type WebUIConfig struct {
	Map      *WebUIMapInfo       `json:"map,omitempty"` // Map can be optional initially
	Beacons  []WebUIBeaconConfig `json:"beacons" validate:"required,dive,required"`
	Settings WebUISettings       `json:"settings" validate:"required"`
}

// DashboardMapInfo is the reference IndoorPositioning map payload embedded in the
// dashboard response, keeping the field names used by the legacy UI while still
// accepting TrackerHub's richer map metadata.
type DashboardMapInfo struct {
	Name                  string           `json:"name,omitempty"`
	Width                 float64          `json:"width"`
	Height                float64          `json:"height"`
	MinX                  float64          `json:"minX,omitempty"`
	MaxX                  float64          `json:"maxX,omitempty"`
	MinY                  float64          `json:"minY,omitempty"`
	MaxY                  float64          `json:"maxY,omitempty"`
	Background            string           `json:"background,omitempty"`
	BackgroundImageWidth  int              `json:"backgroundImageWidth,omitempty"`
	BackgroundImageHeight int              `json:"backgroundImageHeight,omitempty"`
	Entities              []WebUIMapEntity `json:"entities,omitempty"`
}

// DashboardMapEntry is one top-level dashboard map configuration.
type DashboardMapEntry struct {
	Map      DashboardMapInfo    `json:"map"`
	Beacons  []WebUIBeaconConfig `json:"beacons"`
	Settings WebUISettings       `json:"settings"`
	IsDarwin bool                `json:"is_darwin,omitempty"`
}

// DashboardResponse is the top-level response shape used by the reference dashboard.
type DashboardResponse struct {
	Maps []DashboardMapEntry `json:"maps"`
}

// ToDashboardResponse transforms the internal app config into the reference
// dashboard JSON contract used by the UI.
func (c *WebUIConfig) ToDashboardResponse() DashboardResponse {
	response := DashboardResponse{Maps: []DashboardMapEntry{}}
	if c == nil {
		return response
	}

	entry := DashboardMapEntry{
		Beacons:  append([]WebUIBeaconConfig(nil), c.Beacons...),
		Settings: c.Settings,
	}

	if c.Map != nil {
		mapMeta := DashboardMapInfo{
			Name:                  c.Map.Name,
			Width:                 c.Map.Width,
			Height:                c.Map.Height,
			Entities:              append([]WebUIMapEntity(nil), c.Map.Entities...),
			BackgroundImageWidth:  c.Map.BackgroundImageWidth,
			BackgroundImageHeight: c.Map.BackgroundImageHeight,
			MinX:                  0,
			MaxX:                  c.Map.Width,
			MinY:                  0,
			MaxY:                  c.Map.Height,
		}
		if c.Map.BackgroundImage != "" {
			mapMeta.Background = c.Map.BackgroundImage
		}
		entry.Map = mapMeta
	}

	response.Maps = []DashboardMapEntry{entry}
	return response
}

// ServerRuntimeConfig represents server runtime configuration
type ServerRuntimeConfig struct {
	MQTT                 MQTTServerConfig           `json:"mqtt"`
	Server               WebServerConfig            `json:"server"`
	Kalman               KalmanParams               `json:"kalman"`
	AllowAreaLocation    bool                       `json:"allowAreaLocation,omitempty"`
	Webhook              WebhookConfig              `json:"webhook"`
	TrackerAccessControl TrackerAccessControlConfig `json:"trackerAccessControl,omitempty"`
	TrackerRegistry      []TrackerRegistryEntry     `json:"trackerRegistry,omitempty"`
}

// ServerRuntimeConfigReferenceResponse is the payload shape used by the
// IndoorPositioning reference dashboard. It preserves TrackerHub's internal
// config model while exposing the reference API contract for frontend consumers.
type ServerRuntimeConfigReferenceResponse struct {
	SensecapOpenStream MQTTServerConfig       `json:"sensecapOpenStream"`
	LWNSMqtt           MQTTServerConfig       `json:"lwnsMqtt"`
	ChirpStackMqtt     MQTTServerConfig       `json:"chirpStackMqtt,omitempty"`
	Server             WebServerConfig        `json:"server"`
	Kalman             KalmanParams           `json:"kalman"`
	TrackerList        []TrackerRegistryEntry `json:"tracker_list,omitempty"`
	AllowAllTracker    bool                   `json:"allow_all_tracker,omitempty"`
	AllowAreaLocation  bool                   `json:"allow_area_location,omitempty"`
	Username           string                 `json:"username,omitempty"`
	Password           string                 `json:"password,omitempty"`
	Webhook            WebhookConfig          `json:"webhook"`
}

// ToReferenceAPIResponse transforms the internal runtime config into the
// reference JSON schema expected by the dashboard.
func (c *ServerRuntimeConfig) ToReferenceAPIResponse() ServerRuntimeConfigReferenceResponse {
	response := ServerRuntimeConfigReferenceResponse{
		SensecapOpenStream: MQTTServerConfig{BrokerHost: "127.0.0.1", BrokerPort: 1883, Enabled: false},
		LWNSMqtt:           c.MQTT,
		ChirpStackMqtt:     c.MQTT,
		Server:             c.Server,
		Kalman:             c.Kalman,
		TrackerList:        c.TrackerRegistry,
		AllowAllTracker:    c.TrackerAccessControl.AllowAll,
		AllowAreaLocation:  c.AllowAreaLocation,
		Webhook:            c.Webhook,
	}
	response.Webhook.Enabled = c.Webhook.Enabled || c.Webhook.Enable
	response.Webhook.Enable = c.Webhook.Enabled || c.Webhook.Enable
	if c.TrackerAccessControl.Enabled {
		response.AllowAllTracker = c.TrackerAccessControl.AllowAll
	}
	return response
}

// MQTTServerConfig holds MQTT connection settings
type MQTTServerConfig struct {
	BrokerHost     string `json:"brokerHost" validate:"required"`
	BrokerPort     int    `json:"brokerPort" validate:"required"`
	Username       string `json:"username,omitempty"`
	Password       string `json:"password,omitempty"`
	ApplicationID  string `json:"applicationID" validate:"required"` // e.g., your OrgID
	TopicPattern   string `json:"topicPattern" validate:"required"`  // e.g., "/device_sensor_data/{ApplicationID}/+/+/+/+"
	ClientID       string `json:"clientID,omitempty"`
	ServerRegion   string `json:"serverRegion,omitempty"`
	Enabled        bool   `json:"enabled" default:"true"`
	LiveMQTTStatus string `json:"live_mqtt_status,omitempty"` // Live MQTT connection status, not saved to file
}

// WebServerConfig holds web server settings
type WebServerConfig struct {
	Port int `json:"port" validate:"required"` // Port for the HTTP/WebSocket server
}

// KalmanParams holds Kalman filter parameters
type KalmanParams struct {
	ProcessVariance     float64 `json:"processVariance" validate:"required,gte=0"`     // Kalman filter process variance Q
	MeasurementVariance float64 `json:"measurementVariance" validate:"required,gte=0"` // Kalman filter measurement variance R
}

// TrackerAccessControlConfig stores the optional tracker allow-list policy.
type TrackerAccessControlConfig struct {
	Enabled         bool     `json:"enabled"`
	AllowAll        bool     `json:"allowAll,omitempty"`
	AllowedTrackers []string `json:"allowedTrackers,omitempty"`
}

// TrackerRegistryEntry represents a pre-registered tracker with user-editable metadata.
// The reference project has no tracker registry (trackers auto-discover via MQTT);
// this is a TrackerHub extension that lets users add a display name and manage
// trackers as first-class entities before they appear on the live map.
type TrackerRegistryEntry struct {
	ID          string `json:"id"`                    // Tracker EUI (hex, 8-16 chars) — primary key
	Name        string `json:"name"`                  // User-assigned display name
	Description string `json:"description,omitempty"` // Optional description / notes
	CreatedAt   int64  `json:"createdAt"`             // Unix-ms timestamp of creation
	UpdatedAt   int64  `json:"updatedAt"`             // Unix-ms timestamp of last edit
}

// WebhookConfig stores optional outbound webhook settings.
// Support both the legacy internal field name (`enabled`) and the reference
// dashboard field name (`enable`) so the API can match either contract.
type WebhookConfig struct {
	Enabled bool              `json:"enabled"`
	Enable  bool              `json:"enable"`
	HostURL string            `json:"hostUrl,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

type AuthConfig struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Secret   string `json:"secret,omitempty"`
}

type AuthConfigResponse struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthConfigUpdateRequest struct {
	Username           string `json:"username,omitempty"`
	Password           string `json:"password,omitempty"`
	NewPassword        string `json:"newPassword,omitempty"`
	ConfirmNewPassword string `json:"confirmNewPassword,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	Message string `json:"message,omitempty"`
}

// TrackerUpdateRequest represents a tracker update pushed from a client or simulator.
type TrackerUpdateRequest struct {
	TrackerID string  `json:"trackerId" binding:"required"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Timestamp int64   `json:"timestamp"`
}
