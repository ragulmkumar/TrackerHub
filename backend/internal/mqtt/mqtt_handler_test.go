package mqtt

import (
	"testing"

	"trackerHub/backend/internal/models"
)

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
