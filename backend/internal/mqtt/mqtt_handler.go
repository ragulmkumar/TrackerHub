package mqtt

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
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
	webUIConfigStore *config.WebUIConfigStore
	runtimeConfig    *config.RuntimeConfigStore
	messageHandler   func(*models.TrackerReport, *models.WebUIConfig)
	errorHandler     func(error)
	connectionStatus string // "connected", "disconnected", "connecting"
}

// NewMQTTHandler creates a new MQTT handler
func NewMQTTHandler(config *models.MQTTServerConfig, webUIConfigStore *config.WebUIConfigStore, runtimeConfig *config.RuntimeConfigStore) *MQTTHandler {
	return &MQTTHandler{
		config:           config,
		webUIConfigStore: webUIConfigStore,
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
// The handler will receive the current web UI config snapshot for positioning
func (h *MQTTHandler) SetMessageHandler(handler func(*models.TrackerReport, *models.WebUIConfig)) {
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
	// Parse the topic to extract device EUI and measurement ID.
	//
	// Supported topic formats:
	//   1. ChirpStack v4 / device_sensor_data:
	//      /device_sensor_data/{ApplicationID}/{devEui}/{channelId}/{slotId}/{measurementId}
	//      Device EUI at index 3, measurement ID at index 6.
	//      Messages with measurementId != "5002" (BLE scan) are ignored.
	//
	//   2. ChirpStack v4 integration:
	//      application/{ApplicationID}/device/{devEui}/event/up
	//      Device EUI at index 3. No measurement ID filtering (all uplinks processed).
	topic := msg.Topic()
	parts := strings.Split(topic, "/")

	deviceEUI := ""
	isDeviceSensorData := strings.HasPrefix(topic, "/device_sensor_data/")

	if isDeviceSensorData {
		// Format: /device_sensor_data/{ApplicationID}/{devEui}/{channelId}/{slotId}/{measurementId}
		if len(parts) < 7 {
			return
		}
		deviceEUI = parts[3]
		measurementID := parts[6]
		if measurementID != "5002" {
			// Only process BLE scan results (measurement ID 5002)
			return
		}
	} else {
		// Format: application/{ApplicationID}/device/{devEui}/event/up
		// Also handle without leading slash: application/{ApplicationID}/device/{devEui}/event/up
		if len(parts) >= 5 {
			// Try to find "device" segment to locate EUI
			for i, seg := range parts {
				if seg == "device" && i+1 < len(parts) {
					deviceEUI = parts[i+1]
					break
				}
			}
		}
		if deviceEUI == "" {
			return
		}
	}

	if deviceEUI == "" {
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
			webUIConfig := h.webUIConfigStore.Get()
			h.messageHandler(report, webUIConfig)
		}
	}
}

// parseTrackerReport parses the MQTT payload into a TrackerReport
// Supports SenseCAP format: {"value":[{"mac":"AA:BB:CC:DD:EE:FF","rssi":"-65"},...],"timestamp":1234567890000}
// Also supports legacy format: {"beacons":[{"macAddress":"AA:BB:CC:DD:EE:FF","rssi":-65},...]}
func (h *MQTTHandler) parseTrackerReport(deviceEUI string, payload []byte) *models.TrackerReport {
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil
	}

	// Extract timestamp from payload (milliseconds since epoch)
	var timestamp int64
	if ts, ok := data["timestamp"]; ok {
		switch v := ts.(type) {
		case float64:
			timestamp = int64(v)
		case string:
			if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
				timestamp = parsed
			} else {
				timestamp = time.Now().UnixMilli()
			}
		default:
			timestamp = time.Now().UnixMilli()
		}
	} else {
		timestamp = time.Now().UnixMilli()
	}

	report := &models.TrackerReport{
		TrackerID: deviceEUI,
		Timestamp: timestamp,
	}

	// Parse SenseCAP format: "value" array with beacon objects containing "mac" and "rssi"
	if beaconValues, ok := data["value"].([]interface{}); ok {
		for _, b := range beaconValues {
			if beaconMap, ok := b.(map[string]interface{}); ok {
				detected := models.DetectedBeacon{}

				// MAC address (key is "mac" in SenseCAP format)
				if mac, ok := beaconMap["mac"].(string); ok {
					detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
				} else if mac, ok := beaconMap["macAddress"].(string); ok {
					// Also support alternative key "macAddress"
					detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
				}

				// RSSI (key is "rssi" - can be string or number in SenseCAP format)
				if rssi, ok := beaconMap["rssi"].(string); ok {
					if parsed, err := strconv.Atoi(rssi); err == nil {
						detected.RSSI = parsed
					}
				} else if rssi, ok := beaconMap["rssi"].(float64); ok {
					detected.RSSI = int(rssi)
				}

				// Only add if we have valid MAC and RSSI
				if detected.MACAddress != "" && detected.RSSI != 0 {
					report.DetectedBeacons = append(report.DetectedBeacons, detected)
				}
			}
		}
	} else if beaconValues, ok := data["beacons"].([]interface{}); ok {
		// Legacy format support
		for _, b := range beaconValues {
			if beaconMap, ok := b.(map[string]interface{}); ok {
				detected := models.DetectedBeacon{}

				// MAC address (key is "macAddress" in legacy format)
				if mac, ok := beaconMap["macAddress"].(string); ok {
					detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
				}

				// RSSI (can be string or number)
				if rssi, ok := beaconMap["rssi"].(string); ok {
					if parsed, err := strconv.Atoi(rssi); err == nil {
						detected.RSSI = parsed
					}
				} else if rssi, ok := beaconMap["rssi"].(float64); ok {
					detected.RSSI = int(rssi)
				}

				// Optional: Major/Minor for iBeacon
				if major, ok := beaconMap["major"].(float64); ok {
					majorInt := int(major)
					detected.Major = &majorInt
				}
				if minor, ok := beaconMap["minor"].(float64); ok {
					minorInt := int(minor)
					detected.Minor = &minorInt
				}

				// Only add if we have valid MAC and RSSI
				if detected.MACAddress != "" && detected.RSSI != 0 {
					report.DetectedBeacons = append(report.DetectedBeacons, detected)
				}
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
