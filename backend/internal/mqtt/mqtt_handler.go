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
	//      BLE scan is 5002 (positioning), Battery is 3000 (battery percentage).
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
		// BLE scan (5002) and Battery (3000) are the measurement types we surface
		// in the live UI. All other measurement types are dropped for now.
		if measurementID != "5002" && measurementID != "3000" {
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

	deviceEUI = models.NormalizeTrackerID(deviceEUI)
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

	// Extract timestamp from payload (milliseconds since epoch).
	// Real ChirpStack payloads store a timestamp inside the nested measurement object,
	// so prefer the top-level timestamp when present and otherwise fall back to the
	// first nested measurement timestamp found while scanning the payload.
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
	} else if nestedTS := findNestedMeasurementTimestamp(data); nestedTS != nil {
		timestamp = *nestedTS
	} else {
		timestamp = time.Now().UnixMilli()
	}

	report := &models.TrackerReport{
		TrackerID: deviceEUI,
		Timestamp: timestamp,
		Battery:   findBatteryPercentage(data),
	}

	beaconValues := findBeaconValues(data)
	for _, b := range beaconValues {
		beaconMap, ok := b.(map[string]interface{})
		if !ok {
			continue
		}
		detected := models.DetectedBeacon{}

		if mac, ok := beaconMap["mac"].(string); ok {
			detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
		} else if mac, ok := beaconMap["macAddress"].(string); ok {
			detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
		}

		if rssi, ok := beaconMap["rssi"].(string); ok {
			if parsed, err := strconv.Atoi(rssi); err == nil {
				detected.RSSI = parsed
			}
		} else if rssi, ok := beaconMap["rssi"].(float64); ok {
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

		if detected.MACAddress != "" && detected.RSSI != 0 {
			report.DetectedBeacons = append(report.DetectedBeacons, detected)
		}
	}

	return report
}

func findBeaconValues(data interface{}) []interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		if beaconValues, ok := v["value"].([]interface{}); ok {
			return beaconValues
		}
		if beaconValues, ok := v["beacons"].([]interface{}); ok {
			return beaconValues
		}
		if measurementValue, ok := v["measurementValue"].([]interface{}); ok {
			return measurementValue
		}
		for _, value := range v {
			if beaconValues := findBeaconValues(value); len(beaconValues) > 0 {
				return beaconValues
			}
		}
	case []interface{}:
		for _, item := range v {
			if beaconValues := findBeaconValues(item); len(beaconValues) > 0 {
				return beaconValues
			}
		}
	}
	return nil
}

func findNestedMeasurementTimestamp(data interface{}) *int64 {
	switch v := data.(type) {
	case map[string]interface{}:
		if ts, ok := v["timestamp"]; ok {
			switch typed := ts.(type) {
			case float64:
				parsed := int64(typed)
				return &parsed
			case string:
				if parsed, err := strconv.ParseInt(typed, 10, 64); err == nil {
					return &parsed
				}
			}
		}
		for _, value := range v {
			if nested := findNestedMeasurementTimestamp(value); nested != nil {
				return nested
			}
		}
	case []interface{}:
		for _, item := range v {
			if nested := findNestedMeasurementTimestamp(item); nested != nil {
				return nested
			}
		}
	}
	return nil
}

// findBatteryPercentage recursively scans a ChirpStack/SenseCAP payload for
// a Battery measurement (measurementId == "3000"). When present the battery
// percentage (0-100) lands in measurementValue as a number. Returns nil when no
// battery measurement is found.
func findBatteryPercentage(data interface{}) *int {
	switch v := data.(type) {
	case map[string]interface{}:
		if mid, ok := v["measurementId"]; ok {
			if midStr, isStr := mid.(string); isStr && midStr == "3000" {
				if mv, ok := v["measurementValue"]; ok {
					switch pct := mv.(type) {
					case float64:
						clamped := int(pct + 0.5)
						if clamped < 0 {
							clamped = 0
						} else if clamped > 100 {
							clamped = 100
						}
						return &clamped
					case string:
						if parsed, err := strconv.Atoi(pct); err == nil {
							if parsed < 0 {
								parsed = 0
							} else if parsed > 100 {
								parsed = 100
							}
							return &parsed
						}
					}
				}
			}
		}
		for _, value := range v {
			if pct := findBatteryPercentage(value); pct != nil {
				return pct
			}
		}
	case []interface{}:
		for _, item := range v {
			if pct := findBatteryPercentage(item); pct != nil {
				return pct
			}
		}
	}
	return nil
}

// Error constants
var (
	ErrNotConnected = errors.New("MQTT client not connected")
	ErrEmptyTopic   = errors.New("MQTT topic pattern is empty")
)
