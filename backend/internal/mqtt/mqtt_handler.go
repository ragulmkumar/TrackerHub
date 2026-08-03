package mqtt

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	MQTT "github.com/eclipse/paho.mqtt.golang"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// MQTTHandler handles MQTT client connections and message processing
type MQTTHandler struct {
	client           MQTT.Client
	config           *models.MQTTServerConfig
	webUIConfig      *models.WebUIConfig
	runtimeConfig    *config.RuntimeConfigStore
	messageHandler   func(*models.TrackerReport)
	errorHandler     func(error)
	connectionStatus string // "connected", "disconnected", "connecting"
}

// NewMQTTHandler creates a new MQTT handler
func NewMQTTHandler(config *models.MQTTServerConfig, webUIConfig *models.WebUIConfig, runtimeConfig *config.RuntimeConfigStore) *MQTTHandler {
	return &MQTTHandler{
		config:           config,
		webUIConfig:      webUIConfig,
		runtimeConfig:    runtimeConfig,
		connectionStatus: "disconnected",
	}
}

// Connect establishes connection to the MQTT broker
func (h *MQTTHandler) Connect() error {
	if h.client != nil && h.client.IsConnected() {
		return nil
	}

	brokerAddr := fmt.Sprintf("tcp://%s:%d", h.config.BrokerHost, h.config.BrokerPort)

	opts := MQTT.NewClientOptions().
		AddBroker(brokerAddr).
		SetClientID(h.config.ClientID).
		SetUsername(h.config.Username).
		SetPassword(h.config.Password).
		SetConnectTimeout(10 * time.Second)

	// Set connection handlers
	opts.OnConnect = func(client MQTT.Client) {
		h.connectionStatus = "connected"
		if h.errorHandler != nil {
			h.errorHandler(nil) // nil error means successful connection
		}
	}

	opts.OnConnectionLost = func(client MQTT.Client, err error) {
		h.connectionStatus = "disconnected"
		if h.errorHandler != nil {
			h.errorHandler(err)
		}
	}

	h.client = MQTT.NewClient(opts)
	if token := h.client.Connect(); token.Wait() && token.Error() != nil {
		h.connectionStatus = "disconnected"
		return token.Error()
	}

	h.connectionStatus = "connecting"
	return nil
}

// Disconnect disconnects from the MQTT broker
func (h *MQTTHandler) Disconnect() {
	if h.client != nil {
		h.client.Disconnect(250)
		h.connectionStatus = "disconnected"
	}
}

// IsConnected returns true if the client is connected to the broker
func (h *MQTTHandler) IsConnected() bool {
	return h.client != nil && h.client.IsConnected()
}

// GetConnectionStatus returns the current connection status
func (h *MQTTHandler) GetConnectionStatus() string {
	return h.connectionStatus
}

// SetMessageHandler sets the function to call when a tracker report is received
func (h *MQTTHandler) SetMessageHandler(handler func(*models.TrackerReport)) {
	h.messageHandler = handler
}

// SetErrorHandler sets the function to call when an error occurs
func (h *MQTTHandler) SetErrorHandler(handler func(error)) {
	h.errorHandler = handler
}

// StartSubscribing begins subscribing to the configured topic
func (h *MQTTHandler) StartSubscribing() error {
	if h.client == nil || !h.client.IsConnected() {
		return ErrNotConnected
	}

	if h.config.TopicPattern == "" {
		return ErrEmptyTopic
	}

	// Replace {ApplicationID} placeholder if present
	topic := h.config.TopicPattern
	if h.config.ApplicationID != "" {
		topic = strings.ReplaceAll(topic, "{ApplicationID}", h.config.ApplicationID)
	}

	token := h.client.Subscribe(topic, 0, func(client MQTT.Client, msg MQTT.Message) {
		h.handleMQTTMessage(msg)
	})
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	return nil
}

// handleMQTTMessage processes incoming MQTT messages
func (h *MQTTHandler) handleMQTTMessage(msg MQTT.Message) {
	// Parse the topic to extract device EUI and measurement ID
	topic := msg.Topic()
	// Expected format: /device_sensor_data/{ApplicationID}/{devEui}/{channelId}/{slotId}/{measurementId}
	// We're interested in messages where measurementId == "5002"

	// Split topic by '/'
	parts := strings.Split(topic, "/")
	if len(parts) < 7 || !strings.HasPrefix(topic, "/device_sensor_data/") {
		// Ignore malformed topics
		return
	}

	deviceEUI := parts[3]
	measurementID := parts[6]

	if measurementID != "5002" {
		// Ignore non-relevant measurements
		return
	}
	if h.runtimeConfig != nil {
		currentConfig := h.runtimeConfig.Get()
		if currentConfig != nil {
			policy := currentConfig.TrackerAccessControl
			if policy.Enabled && !policy.AllowAll {
				allowed := false
				for _, allowedTracker := range policy.AllowedTrackers {
					if allowedTracker == deviceEUI {
						allowed = true
						break
					}
				}
				if !allowed {
					return
				}
			}
		}
	}

	// Process the payload
	if h.messageHandler != nil {
		report := h.parseTrackerReport(deviceEUI, msg.Payload())
		if report != nil {
			h.messageHandler(report)
		}
	}
}

// parseTrackerReport parses the MQTT payload into a TrackerReport
func (h *MQTTHandler) parseTrackerReport(deviceEUI string, payload []byte) *models.TrackerReport {
	// This is a placeholder implementation - you'll need to adapt this
	// based on your actual payload format
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil
	}

	report := &models.TrackerReport{
		TrackerID: deviceEUI,
		Timestamp: time.Now().UnixMilli(),
	}

	// Parse detected beacons - this depends on your payload format
	// This is just an example structure
	if beacons, ok := data["beacons"].([]interface{}); ok {
		for _, b := range beacons {
			if beaconMap, ok := b.(map[string]interface{}); ok {
				detected := models.DetectedBeacon{}
				if mac, ok := beaconMap["macAddress"].(string); ok {
					detected.MACAddress = mac
				}
				if rssi, ok := beaconMap["rssi"].(float64); ok {
					detected.RSSI = int(rssi)
				}
				if major, ok := beaconMap["major"].(float64); ok {
					majorInt := int(major)
					detected.Major = &majorInt
				}
				if minor, ok := beaconMap["minor"].(float64); ok {
					minorInt := int(minor)
					detected.Minor = &minorInt
				}
				report.DetectedBeacons = append(report.DetectedBeacons, detected)
			}
		}
	}

	return report
}

// Error constants
var (
	ErrNotConnected = errors.New("MQTT client not connected")
	ErrEmptyTopic   = errors.New("MQTT topic pattern is empty")
)
