package mqtt

import (
	"testing"

	MQTT "github.com/eclipse/paho.mqtt.golang"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// mockMessage implements MQTT.Message for testing topic parsing
type mockMessage struct {
	topic   string
	payload []byte
}

func (m *mockMessage) Topic() string     { return m.topic }
func (m *mockMessage) Payload() []byte   { return m.payload }
func (m *mockMessage) Qos() byte         { return 0 }
func (m *mockMessage) Retained() bool    { return false }
func (m *mockMessage) MessageID() uint16 { return 0 }
func (m *mockMessage) Duplicate() bool   { return false }
func (m *mockMessage) Ack()              {}

// ensure mockMessage satisfies MQTT.Message at compile time
var _ MQTT.Message = (*mockMessage)(nil)

func TestParseTrackerReportParsesValidBeacons(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	payload := `{"beacons":[{"macAddress":"AA:BB:CC:DD:EE:FF","rssi":-65,"major":100,"minor":200}]}`
	report := handler.parseTrackerReport("2CF7F1C0530004AD", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report for valid payload")
	}
	if report.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", report.TrackerID)
	}
	if len(report.DetectedBeacons) != 1 {
		t.Errorf("expected 1 detected beacon, got %d", len(report.DetectedBeacons))
	}
	// MAC is normalized to uppercase without colons
	if report.DetectedBeacons[0].MACAddress != "AABBCCDDEEFF" {
		t.Errorf("expected MAC AABBCCDDEEFF, got %s", report.DetectedBeacons[0].MACAddress)
	}
	if report.DetectedBeacons[0].RSSI != -65 {
		t.Errorf("expected RSSI -65, got %d", report.DetectedBeacons[0].RSSI)
	}
	if report.DetectedBeacons[0].Major == nil || *report.DetectedBeacons[0].Major != 100 {
		t.Errorf("expected Major 100, got %v", report.DetectedBeacons[0].Major)
	}
	if report.DetectedBeacons[0].Minor == nil || *report.DetectedBeacons[0].Minor != 200 {
		t.Errorf("expected Minor 200, got %v", report.DetectedBeacons[0].Minor)
	}
}

func TestParseTrackerReportParsesRealSenseCAPPayload(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// Real SenseCAP payload format from physical tracker
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"},{"mac":"c3:00:00:3e:7d:fb","rssi":"-72"},{"mac":"c3:00:00:3e:7d:f9","rssi":"-78"}],"timestamp":1746521955000}`
	report := handler.parseTrackerReport("2CF7F1C0530004AD", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report for SenseCAP payload")
	}
	if report.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", report.TrackerID)
	}
	if report.Timestamp != 1746521955000 {
		t.Errorf("expected timestamp 1746521955000, got %d", report.Timestamp)
	}
	if len(report.DetectedBeacons) != 3 {
		t.Errorf("expected 3 detected beacons, got %d", len(report.DetectedBeacons))
	}

	// Check first beacon - MAC should be normalized to uppercase without colons
	if report.DetectedBeacons[0].MACAddress != "C300003E7DE0" {
		t.Errorf("expected MAC C300003E7DE0, got %s", report.DetectedBeacons[0].MACAddress)
	}
	if report.DetectedBeacons[0].RSSI != -69 {
		t.Errorf("expected RSSI -69, got %d", report.DetectedBeacons[0].RSSI)
	}

	// Check second beacon
	if report.DetectedBeacons[1].MACAddress != "C300003E7DFB" {
		t.Errorf("expected MAC C300003E7DFB, got %s", report.DetectedBeacons[1].MACAddress)
	}
	if report.DetectedBeacons[1].RSSI != -72 {
		t.Errorf("expected RSSI -72, got %d", report.DetectedBeacons[1].RSSI)
	}

	// Check third beacon
	if report.DetectedBeacons[2].MACAddress != "C300003E7DF9" {
		t.Errorf("expected MAC C300003E7DF9, got %s", report.DetectedBeacons[2].MACAddress)
	}
	if report.DetectedBeacons[2].RSSI != -78 {
		t.Errorf("expected RSSI -78, got %d", report.DetectedBeacons[2].RSSI)
	}
}

func TestParseTrackerReportParsesSenseCAPPayloadWithNumericRSSI(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// SenseCAP payload with numeric RSSI values
	payload := `{"value":[{"mac":"AA:BB:CC:DD:EE:FF","rssi":-65},{"mac":"11:22:33:44:55:66","rssi":-70}],"timestamp":1234567890000}`
	report := handler.parseTrackerReport("TRACKER-001", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 2 {
		t.Errorf("expected 2 detected beacons, got %d", len(report.DetectedBeacons))
	}
	if report.DetectedBeacons[0].RSSI != -65 {
		t.Errorf("expected RSSI -65, got %d", report.DetectedBeacons[0].RSSI)
	}
	if report.DetectedBeacons[1].RSSI != -70 {
		t.Errorf("expected RSSI -70, got %d", report.DetectedBeacons[1].RSSI)
	}
}

func TestEnrichDetectedBeaconsWithConfigAddsMetadataAndDistance(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "C30000665694", X: 10.35, Y: 64.46, TXPower: -59, DisplayName: "BC01"},
			{MACAddress: "C300006656B3", X: 63.79, Y: 66.95, TXPower: -59, DisplayName: "BC04"},
		},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
	}

	beacons := []models.DetectedBeacon{
		{MACAddress: "C3:00:00:66:56:94", RSSI: -97, Major: intPtr(1), Minor: intPtr(2)},
		{MACAddress: "C3:00:00:66:56:B3", RSSI: -96},
	}

	enriched := models.EnrichDetectedBeaconsWithConfig(beacons, config)
	if len(enriched) != 2 {
		t.Fatalf("expected 2 enriched beacons, got %d", len(enriched))
	}
	if enriched[0].Name != "BC01" {
		t.Fatalf("expected name BC01, got %q", enriched[0].Name)
	}
	if enriched[0].ConfiguredX == nil || *enriched[0].ConfiguredX != 10.35 {
		t.Fatalf("expected configured_x 10.35, got %#v", enriched[0].ConfiguredX)
	}
	if enriched[0].ConfiguredY == nil || *enriched[0].ConfiguredY != 64.46 {
		t.Fatalf("expected configured_y 64.46, got %#v", enriched[0].ConfiguredY)
	}
	if enriched[0].Distance == nil || *enriched[0].Distance <= 0 {
		t.Fatalf("expected positive dis distance, got %#v", enriched[0].Distance)
	}
	if enriched[0].Major == nil || *enriched[0].Major != 1 {
		t.Fatalf("expected Major 1, got %#v", enriched[0].Major)
	}
	if enriched[0].Minor == nil || *enriched[0].Minor != 2 {
		t.Fatalf("expected Minor 2, got %#v", enriched[0].Minor)
	}
}

func intPtr(v int) *int { return &v }

func TestParseTrackerReportHandlesInvalidJSON(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	report := handler.parseTrackerReport("tracker-01", []byte("not valid json"))

	if report != nil {
		t.Errorf("expected nil report for invalid JSON, got %+v", report)
	}
}

func TestParseTrackerReportHandlesEmptyBeacons(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	payload := `{"value":[],"timestamp":1234567890000}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 0 {
		t.Errorf("expected 0 detected beacons, got %d", len(report.DetectedBeacons))
	}
	if report.Timestamp != 1234567890000 {
		t.Errorf("expected timestamp 1234567890000, got %d", report.Timestamp)
	}
}

func TestParseTrackerReportHandlesMissingTimestamp(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	payload := `{"value":[{"mac":"AA:BB:CC:DD:EE:FF","rssi":"-65"}]}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 1 {
		t.Errorf("expected 1 detected beacon, got %d", len(report.DetectedBeacons))
	}
	// Should use current time when timestamp is missing
	if report.Timestamp == 0 {
		t.Error("expected timestamp to be set to current time")
	}
}

func TestParseTrackerReportHandlesMalformedValueField(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// "value" is a string instead of array
	payload := `{"value":"not-an-array","timestamp":1234567890000}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 0 {
		t.Errorf("expected 0 detected beacons for malformed value, got %d", len(report.DetectedBeacons))
	}
}

func TestParseTrackerReportHandlesMissingFields(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// Missing macAddress in legacy format - beacon is skipped (requires both MAC and RSSI)
	payload := `{"beacons":[{"rssi":-65}]}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	// Beacon without MAC is skipped in both formats
	if len(report.DetectedBeacons) != 0 {
		t.Errorf("expected 0 detected beacons (beacon missing MAC is skipped), got %d", len(report.DetectedBeacons))
	}
}

func TestParseTrackerReportSkipsBeaconsWithMissingData(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// One beacon missing MAC, one missing RSSI
	payload := `{"value":[{"rssi":"-65"},{"mac":"AA:BB:CC:DD:EE:FF"}],"timestamp":1234567890000}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	// Both beacons should be skipped (missing MAC or RSSI)
	if len(report.DetectedBeacons) != 0 {
		t.Errorf("expected 0 detected beacons (both missing required fields), got %d", len(report.DetectedBeacons))
	}
}

func TestParseTrackerReportSupportsAlternativeMACKey(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// Payload using "macAddress" key instead of "mac"
	payload := `{"value":[{"macAddress":"AA:BB:CC:DD:EE:FF","rssi":"-65"}],"timestamp":1234567890000}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 1 {
		t.Errorf("expected 1 detected beacon, got %d", len(report.DetectedBeacons))
	}
	if report.DetectedBeacons[0].MACAddress != "AABBCCDDEEFF" {
		t.Errorf("expected MAC AABBCCDDEEFF, got %s", report.DetectedBeacons[0].MACAddress)
	}
}

func TestParseTrackerReportParsesRealChirpStackEventPayload(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	payload := `{"object":{"messages":[[{"measurementValue":[{"rssi":"-82","mac":"C3:00:00:3E:7D:EF"},{"mac":"C3:00:00:3E:7D:DA","rssi":"-87"},{"rssi":"-93","mac":"C3:00:00:3E:7D:E0"}],"measurementId":"5002","type":"BLE Scan","timestamp":1745465694000.0}]]}}`
	report := handler.parseTrackerReport("2CF7F1C0530004AD", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report for real ChirpStack payload")
	}
	if report.TrackerID != "2CF7F1C0530004AD" {
		t.Fatalf("expected tracker ID 2CF7F1C0530004AD, got %s", report.TrackerID)
	}
	if len(report.DetectedBeacons) != 3 {
		t.Fatalf("expected 3 detected beacons, got %d", len(report.DetectedBeacons))
	}
	if report.DetectedBeacons[0].MACAddress != "C300003E7DEF" {
		t.Fatalf("expected first MAC to be C300003E7DEF, got %s", report.DetectedBeacons[0].MACAddress)
	}
	if report.DetectedBeacons[0].RSSI != -82 {
		t.Fatalf("expected first RSSI -82, got %d", report.DetectedBeacons[0].RSSI)
	}
}

func TestMQTTErrorConstants(t *testing.T) {
	if ErrNotConnected == nil {
		t.Fatal("ErrNotConnected should not be nil")
	}
	if ErrEmptyTopic == nil {
		t.Fatal("ErrEmptyTopic should not be nil")
	}
	if ErrNotConnected.Error() != "MQTT client not connected" {
		t.Errorf("unexpected ErrNotConnected message: %s", ErrNotConnected.Error())
	}
	if ErrEmptyTopic.Error() != "MQTT topic pattern is empty" {
		t.Errorf("unexpected ErrEmptyTopic message: %s", ErrEmptyTopic.Error())
	}
}

// --- Topic Parsing Tests for handleMQTTMessage ---

func TestHandleMQTTMessageChirpStackV4Format(t *testing.T) {
	// ChirpStack v4 integration topic: application/{appID}/device/{devEUI}/event/up
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"}],"timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "application/8d765299-6bd2-4a9c-a841-7406785ff516/device/2CF7F1C0530004AD/event/up",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	handler := &MQTTHandler{
		config:           &models.MQTTServerConfig{},
		webUIConfigStore: nil, // Not needed for this test
		runtimeConfig:    nil,
		messageHandler:   func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport == nil {
		t.Fatal("expected report to be received from ChirpStack v4 topic")
	}
	if receivedReport.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", receivedReport.TrackerID)
	}
	if len(receivedReport.DetectedBeacons) != 1 {
		t.Errorf("expected 1 detected beacon, got %d", len(receivedReport.DetectedBeacons))
	}
	if receivedReport.DetectedBeacons[0].MACAddress != "C300003E7DE0" {
		t.Errorf("expected MAC C300003E7DE0, got %s", receivedReport.DetectedBeacons[0].MACAddress)
	}
}

func TestHandleMQTTMessageDeviceSensorDataFormat(t *testing.T) {
	// device_sensor_data topic: /device_sensor_data/{appID}/{devEui}/{channelId}/{slotId}/{measurementId}
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"}],"timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "/device_sensor_data/8d765299-6bd2-4a9c-a841-7406785ff516/2CF7F1C0530004AD/1/1/5002",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	handler := &MQTTHandler{
		config:           &models.MQTTServerConfig{},
		webUIConfigStore: nil,
		runtimeConfig:    nil,
		messageHandler:   func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport == nil {
		t.Fatal("expected report to be received from device_sensor_data topic")
	}
	if receivedReport.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", receivedReport.TrackerID)
	}
}

func TestHandleMQTTMessageDeviceSensorDataIgnoresNonBLE5002(t *testing.T) {
	// device_sensor_data with measurementId != 5002 and != 3000 should be ignored
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"}],"timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "/device_sensor_data/8d765299-6bd2-4a9c-a841-7406785ff516/2CF7F1C0530004AD/1/1/4200",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	handler := &MQTTHandler{
		config:         &models.MQTTServerConfig{},
		messageHandler: func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport != nil {
		t.Error("expected report to be ignored for non-5002, non-3000 measurement ID")
	}
}

func TestHandleMQTTMessageDeviceSensorDataBattery3000(t *testing.T) {
	// device_sensor_data with measurementId 3000 (Battery) should produce a report
	// carrying the battery percentage even though it has no BLE beacon data.
	payload := `{"measurementValue":33.0,"measurementId":"3000","type":"Battery","timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "/device_sensor_data/8d765299-6bd2-4a9c-a841-7406785ff516/2CF7F1C0530004AD/1/1/3000",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	handler := &MQTTHandler{
		config:         &models.MQTTServerConfig{},
		messageHandler: func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport == nil {
		t.Fatal("expected report to be received for battery measurement ID 3000")
	}
	if receivedReport.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", receivedReport.TrackerID)
	}
	if receivedReport.Battery == nil || *receivedReport.Battery != 33 {
		t.Errorf("expected battery percentage 33, got %v", receivedReport.Battery)
	}
}

func TestHandleMQTTMessageChirpStackV4NoDeviceSegment(t *testing.T) {
	// Malformed topic without "device" segment should be ignored
	msg := &mockMessage{
		topic:   "application/8d765299/event/up",
		payload: []byte(`{"value":[]}`),
	}

	var receivedReport *models.TrackerReport
	handler := &MQTTHandler{
		config:         &models.MQTTServerConfig{},
		messageHandler: func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport != nil {
		t.Error("expected no report for malformed topic without device segment")
	}
}

func TestHandleMQTTMessageChirpStackV4AccessControl(t *testing.T) {
	// ChirpStack v4 topic with access control enabled
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"}],"timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "application/8d765299-6bd2-4a9c-a841-7406785ff516/device/2CF7F1C0530004AD/event/up",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	rtConfig := &models.ServerRuntimeConfig{
		TrackerAccessControl: models.TrackerAccessControlConfig{
			Enabled:         true,
			AllowAll:        false,
			AllowedTrackers: []string{"AAAAAAAABBBBBBBB"},
		},
	}
	rtStore := &config.RuntimeConfigStore{}
	rtStore.Set(rtConfig)

	handler := &MQTTHandler{
		config:         &models.MQTTServerConfig{},
		runtimeConfig:  rtStore,
		messageHandler: func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport != nil {
		t.Error("expected report to be blocked by access control for unlisted tracker")
	}
}

func TestHandleMQTTMessageChirpStackV4AccessControlAllowed(t *testing.T) {
	// ChirpStack v4 topic with access control - tracker IS allowed
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:e0","rssi":"-69"}],"timestamp":1746521955000}`
	msg := &mockMessage{
		topic:   "application/8d765299-6bd2-4a9c-a841-7406785ff516/device/2CF7F1C0530004AD/event/up",
		payload: []byte(payload),
	}

	var receivedReport *models.TrackerReport
	rtConfig := &models.ServerRuntimeConfig{
		TrackerAccessControl: models.TrackerAccessControlConfig{
			Enabled:         true,
			AllowAll:        false,
			AllowedTrackers: []string{"2CF7F1C0530004AD"},
		},
	}
	rtStore := &config.RuntimeConfigStore{}
	rtStore.Set(rtConfig)

	handler := &MQTTHandler{
		config:         &models.MQTTServerConfig{},
		runtimeConfig:  rtStore,
		messageHandler: func(report *models.TrackerReport, _ *models.WebUIConfig) { receivedReport = report },
	}

	handler.handleMQTTMessage(msg)

	if receivedReport == nil {
		t.Fatal("expected report to be allowed by access control for listed tracker")
	}
	if receivedReport.TrackerID != "2CF7F1C0530004AD" {
		t.Errorf("expected tracker ID 2CF7F1C0530004AD, got %s", receivedReport.TrackerID)
	}
}
