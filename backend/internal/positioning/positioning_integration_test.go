package positioning

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"trackerHub/backend/internal/models"
)

// TestRealSenseCAPayloadWithRealMapConfig tests the full pipeline with real SenseCAP payload
// and real map configuration from the IndoorPositioning project
func TestRealSenseCAPayloadWithRealMapConfig(t *testing.T) {
	// Load real map config
	mapConfigPath := "../../../client/src/test/fixtures/real-map-config.json"
	data, err := os.ReadFile(filepath.Clean(mapConfigPath))
	if err != nil {
		t.Skipf("Could not load map config: %v", err)
	}

	var webUIConfig models.WebUIConfig
	if err := json.Unmarshal(data, &webUIConfig); err != nil {
		t.Fatalf("Failed to unmarshal map config: %v", err)
	}

	// Real SenseCAP payload from physical tracker (matching real-map-config.json beacons)
	payload := `{"value":[{"mac":"c3:00:00:3e:7d:ef","rssi":"-69"},{"mac":"c3:00:00:3e:7d:da","rssi":"-72"},{"mac":"c3:00:00:3e:7d:e0","rssi":"-78"}],"timestamp":1746521955000}`

	var senseCAPData map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &senseCAPData); err != nil {
		t.Fatalf("Failed to parse SenseCAP payload: %v", err)
	}

	// Parse detected beacons (simulating MQTT handler)
	var detectedBeacons []models.DetectedBeacon
	if beaconValues, ok := senseCAPData["value"].([]interface{}); ok {
		for _, b := range beaconValues {
			if beaconMap, ok := b.(map[string]interface{}); ok {
				detected := models.DetectedBeacon{}
				if mac, ok := beaconMap["mac"].(string); ok {
					detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
				}
				if rssi, ok := beaconMap["rssi"].(string); ok {
					detected.RSSI, _ = strconv.Atoi(rssi)
				} else if rssi, ok := beaconMap["rssi"].(float64); ok {
					detected.RSSI = int(rssi)
				}
				if detected.MACAddress != "" && detected.RSSI != 0 {
					detectedBeacons = append(detectedBeacons, detected)
				}
			}
		}
	}

	if len(detectedBeacons) != 3 {
		t.Fatalf("Expected 3 detected beacons, got %d", len(detectedBeacons))
	}

	// Calculate position
	result := CalculatePosition(detectedBeacons, &webUIConfig, nil)
	if result == nil {
		t.Fatal("CalculatePosition returned nil")
	}

	// We have 3 matching beacons, so should use multilateration
	t.Logf("Position: %v", result.Position)
	t.Logf("Method: %s", result.Method)
	t.Logf("Accuracy: %v", result.Accuracy)
	t.Logf("Confidence: %v", result.Confidence)
	t.Logf("BeaconCount: %d", result.BeaconCount)

	if result.Position == nil {
		t.Error("Expected non-nil position with 3 beacons")
	}
	if result.Method != "multilateration" && result.Method != "weighted-centroid" {
		t.Errorf("Expected multilateration or weighted-centroid, got %s", result.Method)
	}
	if result.BeaconCount != 3 {
		t.Errorf("Expected 3 beacons used, got %d", result.BeaconCount)
	}
	if result.Accuracy <= 0 {
		t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
	}
	if result.Confidence <= 0 || result.Confidence > 1.0 {
		t.Errorf("Expected confidence in (0, 1], got %v", result.Confidence)
	}
}

// TestLoRaWANPayloadWithRealMapConfig tests the full pipeline with LoRaWAN payload
// containing the embedded SenseCAP format
func TestLoRaWANPayloadWithRealMapConfig(t *testing.T) {
	// Load real map config
	mapConfigPath := "../../../client/src/test/fixtures/real-map-config.json"
	data, err := os.ReadFile(filepath.Clean(mapConfigPath))
	if err != nil {
		t.Skipf("Could not load map config: %v", err)
	}

	var webUIConfig models.WebUIConfig
	if err := json.Unmarshal(data, &webUIConfig); err != nil {
		t.Fatalf("Failed to unmarshal map config: %v", err)
	}

	// LoRaWAN payload from physical tracker
	lorawanPath := "../../../client/src/test/fixtures/lorawan-payload.json"
	lorawanData, err := os.ReadFile(filepath.Clean(lorawanPath))
	if err != nil {
		t.Skipf("Could not load LoRaWAN payload: %v", err)
	}

	var lorawanPayload map[string]interface{}
	if err := json.Unmarshal(lorawanData, &lorawanPayload); err != nil {
		t.Fatalf("Failed to parse LoRaWAN payload: %v", err)
	}

	// Extract the SenseCAP data from object.messages[1] (measurementId 5002)
	obj := lorawanPayload["object"].(map[string]interface{})
	messages := obj["messages"].([]interface{})
	var beaconList []interface{}
	for _, msg := range messages {
		msgArray := msg.([]interface{})
		for _, measurement := range msgArray {
			measurementMap := measurement.(map[string]interface{})
			if measurementMap["measurementId"] == "5002" {
				// In LoRaWAN format, measurementValue is directly an array of beacon objects
				beaconList = measurementMap["measurementValue"].([]interface{})
				break
			}
		}
		if beaconList != nil {
			break
		}
	}

	if beaconList == nil {
		t.Fatal("Could not find measurementId 5002 in LoRaWAN payload")
	}

	// Parse detected beacons
	var detectedBeacons []models.DetectedBeacon
	for _, b := range beaconList {
		beaconMap := b.(map[string]interface{})
		detected := models.DetectedBeacon{}
		if mac, ok := beaconMap["mac"].(string); ok {
			detected.MACAddress = strings.ToUpper(strings.ReplaceAll(mac, ":", ""))
		}
		if rssi, ok := beaconMap["rssi"].(string); ok {
			detected.RSSI, _ = strconv.Atoi(rssi)
		} else if rssi, ok := beaconMap["rssi"].(float64); ok {
			detected.RSSI = int(rssi)
		}
		if detected.MACAddress != "" && detected.RSSI != 0 {
			detectedBeacons = append(detectedBeacons, detected)
		}
	}

	t.Logf("Detected beacons from LoRaWAN: %d", len(detectedBeacons))
	for _, b := range detectedBeacons {
		t.Logf("  MAC: %s, RSSI: %d", b.MACAddress, b.RSSI)
	}

	// Calculate position
	result := CalculatePosition(detectedBeacons, &webUIConfig, nil)
	if result == nil {
		t.Fatal("CalculatePosition returned nil")
	}

	t.Logf("Position: %v", result.Position)
	t.Logf("Method: %s", result.Method)
	t.Logf("Accuracy: %v", result.Accuracy)
	t.Logf("Confidence: %v", result.Confidence)
	t.Logf("BeaconCount: %d", result.BeaconCount)

	if result.Position == nil {
		t.Error("Expected non-nil position")
	}
	if result.BeaconCount != 3 {
		t.Errorf("Expected 3 beacons used, got %d", result.BeaconCount)
	}
}

// TestWalkTestSimulation simulates a walk test with known positions
// Note: RSSI-based positioning has inherent limitations; these tests verify the pipeline
// executes correctly and produces reasonable results, not sub-meter accuracy.
func TestWalkTestSimulation(t *testing.T) {
	// Load real map config
	mapConfigPath := "../../../client/src/test/fixtures/real-map-config.json"
	data, err := os.ReadFile(filepath.Clean(mapConfigPath))
	if err != nil {
		t.Skipf("Could not load map config: %v", err)
	}

	var webUIConfig models.WebUIConfig
	if err := json.Unmarshal(data, &webUIConfig); err != nil {
		t.Fatalf("Failed to unmarshal map config: %v", err)
	}

	// Simulated walk test positions with known ground truth
	// Using RSSI values that roughly correspond to expected distances
	walkTestCases := []struct {
		name            string
		actualPos       [2]float64
		detectedBeacons []models.DetectedBeacon
		maxError        float64 // Maximum acceptable error in meters (relaxed for simulation)
	}{
		{
			name:      "Near MBeaco3 (0.83, 2.04)",
			actualPos: [2]float64{1.0, 2.0},
			detectedBeacons: []models.DetectedBeacon{
				{MACAddress: "C300003E7DE0", RSSI: -55}, // MBeaco3 - very close (~2m)
				{MACAddress: "C300003E7DFB", RSSI: -75}, // MBeaco1 - far (~10m)
				{MACAddress: "C300003E7DDA", RSSI: -80}, // MBeaco4 - far (~14m)
			},
			maxError: 5.0,
		},
		{
			name:      "Near MBeaco1 (1.56, 4.24)",
			actualPos: [2]float64{1.5, 4.0},
			detectedBeacons: []models.DetectedBeacon{
				{MACAddress: "C300003E7DFB", RSSI: -55}, // MBeaco1 - very close (~2m)
				{MACAddress: "C300003E7DE0", RSSI: -70}, // MBeaco3 - medium (~6m)
				{MACAddress: "C300003E7DEF", RSSI: -85}, // MBeaco5 - far (~18m)
			},
			maxError: 5.0,
		},
		{
			name:      "Center of map (4.5, 2.5)",
			actualPos: [2]float64{4.5, 2.5},
			detectedBeacons: []models.DetectedBeacon{
				{MACAddress: "C300003E7DE0", RSSI: -70}, // MBeaco3 (~6m)
				{MACAddress: "C300003E7DFB", RSSI: -72}, // MBeaco1 (~7m)
				{MACAddress: "C300003E7DDA", RSSI: -75}, // MBeaco4 (~10m)
				{MACAddress: "C300003E7DEF", RSSI: -78}, // MBeaco5 (~13m)
			},
			maxError: 5.0,
		},
	}

	for _, tc := range walkTestCases {
		t.Run(tc.name, func(t *testing.T) {
			result := CalculatePosition(tc.detectedBeacons, &webUIConfig, nil)
			if result == nil || result.Position == nil {
				t.Errorf("CalculatePosition returned nil for %s", tc.name)
				return
			}

			// Calculate error distance
			dx := result.Position[0] - tc.actualPos[0]
			dy := result.Position[1] - tc.actualPos[1]
			errorDist := math.Sqrt(dx*dx + dy*dy)

			t.Logf("  Actual: (%.2f, %.2f)", tc.actualPos[0], tc.actualPos[1])
			t.Logf("  Calculated: (%.2f, %.2f)", result.Position[0], result.Position[1])
			t.Logf("  Error: %.2fm", errorDist)
			t.Logf("  Method: %s", result.Method)
			t.Logf("  Accuracy: %.2f", result.Accuracy)
			t.Logf("  Confidence: %.2f", result.Confidence)

			if errorDist > tc.maxError {
				t.Errorf("Position error %.2fm exceeds max %.2fm for %s", errorDist, tc.maxError, tc.name)
			}

			// Verify basic pipeline correctness
			if result.BeaconCount < 3 {
				t.Errorf("Expected at least 3 beacons, got %d", result.BeaconCount)
			}
			if result.Method != "multilateration" {
				t.Errorf("Expected multilateration with 3+ beacons, got %s", result.Method)
			}
			if result.Accuracy <= 0 {
				t.Errorf("Expected positive accuracy, got %.2f", result.Accuracy)
			}
			if result.Confidence <= 0 || result.Confidence > 1.0 {
				t.Errorf("Expected confidence in (0, 1], got %.2f", result.Confidence)
			}
		})
	}
}

// TestWeightedCentroidFallback tests the weighted centroid fallback with 1-2 beacons
func TestWeightedCentroidFallback(t *testing.T) {
	mapConfigPath := "../../../client/src/test/fixtures/real-map-config.json"
	data, err := os.ReadFile(filepath.Clean(mapConfigPath))
	if err != nil {
		t.Skipf("Could not load map config: %v", err)
	}

	var webUIConfig models.WebUIConfig
	if err := json.Unmarshal(data, &webUIConfig); err != nil {
		t.Fatalf("Failed to unmarshal map config: %v", err)
	}

	// Test with 1 beacon
	result1 := CalculatePosition([]models.DetectedBeacon{
		{MACAddress: "C300003E7DE0", RSSI: -65}, // MBeaco3
	}, &webUIConfig, nil)

	if result1 == nil {
		t.Fatal("CalculatePosition returned nil for 1 beacon")
	}
	if result1.Position == nil {
		t.Error("Expected position with 1 beacon (weighted centroid)")
	}
	if result1.Method != "weighted-centroid" {
		t.Errorf("Expected weighted-centroid for 1 beacon, got %s", result1.Method)
	}
	if result1.BeaconCount != 1 {
		t.Errorf("Expected 1 beacon used, got %d", result1.BeaconCount)
	}
	if result1.Confidence >= 0.8 {
		t.Errorf("Confidence should be lower for weighted centroid (< 0.8), got %.2f", result1.Confidence)
	}

	// Test with 2 beacons
	result2 := CalculatePosition([]models.DetectedBeacon{
		{MACAddress: "C300003E7DE0", RSSI: -65}, // MBeaco3
		{MACAddress: "C300003E7DFB", RSSI: -70}, // MBeaco1
	}, &webUIConfig, nil)

	if result2 == nil {
		t.Fatal("CalculatePosition returned nil for 2 beacons")
	}
	if result2.Position == nil {
		t.Error("Expected position with 2 beacons (weighted centroid)")
	}
	if result2.Method != "weighted-centroid" {
		t.Errorf("Expected weighted-centroid for 2 beacons, got %s", result2.Method)
	}
	if result2.BeaconCount != 2 {
		t.Errorf("Expected 2 beacons used, got %d", result2.BeaconCount)
	}
}
