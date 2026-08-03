package models

// DetectedBeacon represents a BLE beacon detected by a tracker
type DetectedBeacon struct {
	MACAddress string `json:"macAddress" validate:"required,len=12"`
	Major      *int   `json:"major,omitempty"`
	Minor      *int   `json:"minor,omitempty"`
	RSSI       int    `json:"rssi" validate:"required,gte=-128,lte=20"`
}

// TrackerReport represents a report from a tracker device
type TrackerReport struct {
	TrackerID       string           `json:"trackerId" validate:"required"`
	Timestamp       int64            `json:"timestamp" validate:"required,gte=0"`
	DetectedBeacons []DetectedBeacon `json:"detectedBeacons" validate:"required,dive,required"`
}

// TrackerState represents the current state of a tracker
type TrackerState struct {
	TrackerID                string           `json:"trackerId"`
	X                        *float64         `json:"x,omitempty"`
	Y                        *float64         `json:"y,omitempty"`
	LastUpdateTime           int64            `json:"lastUpdateTime" validate:"required,gte=0"`
	LastKnownMeasurementTime *int64           `json:"lastKnownMeasurementTime,omitempty"`
	LastDetectedBeacons      []DetectedBeacon `json:"lastDetectedBeacons,omitempty"`
	PositionHistory          [][3]float64     `json:"positionHistory,omitempty"` // [x, y, timestamp]
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

// WebUIMapEntity represents an entity on the map (polyline, etc.)
type WebUIMapEntity struct {
	Type        string       `json:"type" validate:"required,oneof=polyline"`        // e.g., 'polyline'
	Points      [][2]float64 `json:"points" validate:"required,min=2,dive,required"` // List of [x, y] coordinates
	Closed      *bool        `json:"closed,omitempty"`
	StrokeColor string       `json:"strokeColor,omitempty"` // e.g., '#333333'
	LineWidth   float64      `json:"lineWidth,omitempty"`   // in pixels
	FillColor   string       `json:"fillColor,omitempty"`   // If supporting filled shapes
}

// WebUIMapInfo contains map dimensions and entities
type WebUIMapInfo struct {
	Name     string           `json:"name,omitempty"`
	Width    float64          `json:"width" validate:"required,gt=0"`  // in meters
	Height   float64          `json:"height" validate:"required,gt=0"` // in meters
	Entities []WebUIMapEntity `json:"entities,omitempty"`
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

// ServerRuntimeConfig represents server runtime configuration
type ServerRuntimeConfig struct {
	MQTT              MQTTServerConfig `json:"mqtt"`
	Server            WebServerConfig  `json:"server"`
	Kalman            KalmanParams     `json:"kalman"`
	AllowAreaLocation bool             `json:"allowAreaLocation,omitempty"`
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
