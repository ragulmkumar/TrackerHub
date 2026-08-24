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
	if report.DetectedBeacons[0].MACAddress != "AA:BB:CC:DD:EE:FF" {
		t.Errorf("expected MAC AA:BB:CC:DD:EE:FF, got %s", report.DetectedBeacons[0].MACAddress)
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

func TestParseTrackerReportHandlesInvalidJSON(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	report := handler.parseTrackerReport("tracker-01", []byte("not valid json"))

	if report != nil {
		t.Errorf("expected nil report for invalid JSON, got %+v", report)
	}
}

func TestParseTrackerReportHandlesEmptyBeacons(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	payload := `{"beacons":[]}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 0 {
		t.Errorf("expected 0 detected beacons, got %d", len(report.DetectedBeacons))
	}
}

func TestParseTrackerReportHandlesMissingFields(t *testing.T) {
	handler := &MQTTHandler{config: &models.MQTTServerConfig{}}

	// Missing macAddress creates beacon with empty MAC (current behavior)
	payload := `{"beacons":[{"rssi":-65}]}`
	report := handler.parseTrackerReport("tracker-01", []byte(payload))

	if report == nil {
		t.Fatal("expected non-nil report")
	}
	if len(report.DetectedBeacons) != 1 {
		t.Errorf("expected 1 detected beacon (MAC empty string), got %d", len(report.DetectedBeacons))
	}
	if report.DetectedBeacons[0].MACAddress != "" {
		t.Errorf("expected empty MAC address, got %s", report.DetectedBeacons[0].MACAddress)
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
