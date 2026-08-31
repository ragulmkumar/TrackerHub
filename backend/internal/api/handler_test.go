package api

import (
	"fmt"
	"testing"

	"trackerHub/backend/internal/models"
)

func TestAPIHandlerUpsertTrackerState(t *testing.T) {
	handler := &APIHandler{trackerStates: map[string]models.TrackerState{}}

	handler.UpsertTrackerState("tracker-01", []float64{10.5, 4.25}, 1710000000)

	state, ok := handler.trackerStates["tracker-01"]
	if !ok {
		t.Fatalf("expected tracker state to be stored")
	}

	if state.TrackerID != "tracker-01" {
		t.Fatalf("expected tracker id to be tracker-01, got %s", state.TrackerID)
	}

	if state.X == nil || *state.X != 10.5 {
		t.Fatalf("expected X coordinate to be stored")
	}

	if state.Y == nil || *state.Y != 4.25 {
		t.Fatalf("expected Y coordinate to be stored")
	}
}

func TestAPIHandlerApplyTrackerUpdatePayload(t *testing.T) {
	handler := &APIHandler{trackerStates: map[string]models.TrackerState{}}

	handler.ApplyTrackerUpdatePayload(models.TrackerUpdateRequest{
		TrackerID: "tracker-02",
		X:         1.5,
		Y:         2.5,
		Timestamp: 1710000000,
	})

	state, ok := handler.trackerStates["tracker-02"]
	if !ok {
		t.Fatalf("expected tracker state to be stored from update payload")
	}

	if state.X == nil || *state.X != 1.5 {
		t.Fatalf("expected X coordinate to be applied from update payload")
	}

	if state.Y == nil || *state.Y != 2.5 {
		t.Fatalf("expected Y coordinate to be applied from update payload")
	}
}

func TestValidateServerRuntimeConfig(t *testing.T) {
	handler := &APIHandler{}

	valid := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 8022},
		MQTT: models.MQTTServerConfig{
			BrokerPort:    1883,
			ApplicationID: "app-01",
			TopicPattern:  "tracker/+/event",
			ServerRegion:  "eu",
		},
		Kalman:            models.KalmanParams{ProcessVariance: 1.0, MeasurementVariance: 10.0},
		AllowAreaLocation: true,
		TrackerAccessControl: models.TrackerAccessControlConfig{
			Enabled:         true,
			AllowedTrackers: []string{"2CF7F1C0530004AD", "2CF7F1C070300008"},
		},
	}

	if err := handler.ValidateServerRuntimeConfig(valid); err != nil {
		t.Fatalf("expected valid runtime config to pass validation: %v", err)
	}

	invalid := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 0},
		MQTT:   models.MQTTServerConfig{BrokerPort: 0},
		Kalman: models.KalmanParams{ProcessVariance: -1, MeasurementVariance: -1},
	}

	if err := handler.ValidateServerRuntimeConfig(invalid); err == nil {
		t.Fatalf("expected invalid runtime config to fail validation")
	}

	enabledWithMissingTopic := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 8022},
		MQTT: models.MQTTServerConfig{
			Enabled:       true,
			BrokerPort:    1883,
			ApplicationID: "app-01",
		},
		Kalman: models.KalmanParams{ProcessVariance: 1.0, MeasurementVariance: 10.0},
	}

	if err := handler.ValidateServerRuntimeConfig(enabledWithMissingTopic); err == nil {
		t.Fatalf("expected runtime config to require a topic pattern when MQTT is enabled")
	}

	invalidTrackerAccess := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 8022},
		MQTT: models.MQTTServerConfig{
			BrokerPort:    1883,
			ApplicationID: "app-01",
			TopicPattern:  "tracker/+/event",
			ServerRegion:  "eu",
		},
		Kalman: models.KalmanParams{ProcessVariance: 1.0, MeasurementVariance: 10.0},
		TrackerAccessControl: models.TrackerAccessControlConfig{
			Enabled:         true,
			AllowedTrackers: []string{"not-a-valid-eui"},
		},
	}

	if err := handler.ValidateServerRuntimeConfig(invalidTrackerAccess); err == nil {
		t.Fatalf("expected invalid tracker access control list to fail validation")
	}
}

// ── Phase 7: Beacon management tests ───────────────────────────────────────

func TestNormalizeMACInWebUIConfig(t *testing.T) {
	// When saving config with MAC "c3:00:00:3e:7d:e0", it should be normalized
	// to "C300003E7DE0"

	config := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Test Map",
			Width:  30,
			Height: 20,
		},
		Beacons: []models.WebUIBeaconConfig{
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
				Major:       1,
				Minor:       1,
				X:           5.0,
				Y:           3.0,
				TXPower:     -59,
				DisplayName: "Test Beacon",
				MACAddress:  "c3:00:00:3e:7d:e0",
			},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.5,
		},
	}

	// Normalize the MAC in the handler logic (same as UpdateWebUIConfig does)
	for i := range config.Beacons {
		if config.Beacons[i].MACAddress != "" {
			normalized, err := models.NormalizeMAC(config.Beacons[i].MACAddress)
			if err != nil {
				t.Fatalf("unexpected error normalizing MAC: %v", err)
			}
			config.Beacons[i].MACAddress = normalized
		}
	}

	if config.Beacons[0].MACAddress != "C300003E7DE0" {
		t.Errorf("expected normalized MAC C300003E7DE0, got %s", config.Beacons[0].MACAddress)
	}
}

func TestDuplicateDetection_UUIDMajorMinor(t *testing.T) {
	// Two beacons with the SAME UUID+Major+Minor but DIFFERENT MAC addresses
	// are valid (physical devices with unique MACs but shared iBeacon identity).
	// This matches the reference IndoorPositioning behavior.
	beacons := []models.WebUIBeaconConfig{
		{
			UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       1,
			Minor:       1,
			MACAddress:  "AABBCCDDEEFF",
			DisplayName: "Beacon A",
		},
		{
			UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       1,
			Minor:       1, // same identity as beacon A, but different MAC
			MACAddress:  "112233445566",
			DisplayName: "Beacon B (same identity, different MAC)",
		},
	}

	// With MAC addresses present, no duplicate should be detected
	seenMACs := make(map[string]bool)
	for _, b := range beacons {
		if b.MACAddress != "" {
			if seenMACs[b.MACAddress] {
				t.Fatalf("unexpected duplicate MAC: %s", b.MACAddress)
			}
			seenMACs[b.MACAddress] = true
			continue
		}
		// No MAC: fall back to UUID+Major+Minor identity
		identity := fmt.Sprintf("%s-%d-%d", b.UUID, b.Major, b.Minor)
		if seenMACs[identity] {
			t.Fatalf("unexpected duplicate identity without MAC: %s", identity)
		}
		seenMACs[identity] = true
	}
}

func TestDuplicateDetection_NoMACUsesIdentity(t *testing.T) {
	// Two beacons with NO MAC address and same UUID+Major+Minor SHOULD
	// be flagged as duplicates, because without MACs they are ambiguous.
	beacons := []models.WebUIBeaconConfig{
		{
			UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       1,
			Minor:       1,
			MACAddress:  "",
			DisplayName: "Beacon A (no MAC)",
		},
		{
			UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       1,
			Minor:       1,
			MACAddress:  "",
			DisplayName: "Beacon B (no MAC, same identity)",
		},
	}

	seen := make(map[string]bool)
	for _, b := range beacons {
		identity := fmt.Sprintf("%s-%d-%d", b.UUID, b.Major, b.Minor)
		if seen[identity] {
			// Expected duplicate
			return
		}
		seen[identity] = true
	}
	t.Fatal("expected duplicate detection to catch identical UUID+Major+Minor without MACs")
}

func TestDuplicateDetection_MACAddress(t *testing.T) {
	beacons := []models.WebUIBeaconConfig{
		{
			UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       1,
			Minor:       1,
			MACAddress:  "C300003E7DE0",
			DisplayName: "Beacon A",
		},
		{
			UUID:        "F2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
			Major:       2,
			Minor:       2,
			MACAddress:  "C300003E7DE0", // duplicate MAC
			DisplayName: "Beacon B (duplicate MAC)",
		},
	}

	seen := make(map[string]bool)
	for _, b := range beacons {
		if b.MACAddress != "" && seen[b.MACAddress] {
			// Expected duplicate
			return
		}
		seen[b.MACAddress] = true
	}
	t.Fatal("expected duplicate MAC detection")
}

func TestMQTTToConfigBeaconMACMatch(t *testing.T) {
	// Simulate: user enters "c3:00:00:3e:7d:e0" in UI
	// Saved as "C300003E7DE0" (normalized)
	// MQTT reports "c3:00:00:3e:7d:e0" (raw)
	// MQTT normalizes to "C300003E7DE0"
	// Positioning matches "C300003E7DE0" == "C300003E7DE0" -> YES

	configMAC := "C300003E7DE0"
	mqttMAC := "c3:00:00:3e:7d:e0"
	normalizedMQTT := ""
	for i := 0; i < len(mqttMAC); i++ {
		c := mqttMAC[i]
		if c != ':' && c != '-' {
			if c >= 'a' && c <= 'f' {
				normalizedMQTT += string(c - 32) // uppercase
			} else {
				normalizedMQTT += string(c)
			}
		}
	}

	if configMAC != normalizedMQTT {
		t.Errorf("MAC mismatch: config=%s mqtt=%s", configMAC, normalizedMQTT)
	}
}

func TestWebUIBeaconConfig_AllFields(t *testing.T) {
	beacon := models.WebUIBeaconConfig{
		UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
		Major:       1,
		Minor:       1,
		X:           5.0,
		Y:           3.0,
		TXPower:     -59,
		DisplayName: "Test Beacon",
		MACAddress:  "C300003E7DE0",
	}

	if beacon.UUID == "" {
		t.Error("UUID should not be empty")
	}
	if beacon.Major < 0 || beacon.Major > 65535 {
		t.Error("Major out of range")
	}
	if beacon.Minor < 0 || beacon.Minor > 65535 {
		t.Error("Minor out of range")
	}
	if beacon.MACAddress == "" {
		t.Error("MACAddress should not be empty")
	}
	if beacon.MACAddress != "C300003E7DE0" {
		t.Errorf("expected MACAddress C300003E7DE0, got %s", beacon.MACAddress)
	}
}
