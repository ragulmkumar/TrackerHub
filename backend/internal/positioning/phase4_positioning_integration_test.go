package positioning

import (
	"math"
	"testing"

	"trackerHub/backend/internal/models"
)

// Phase 4: Verify beacon coordinates are consumed by positioning engine
// Test data flow: Configuration → Positioning Engine → Position Result

func TestPhase4_BeaconCoordinatesUsedInPositioning(t *testing.T) {
	// Scenario: Test that beacon coordinates from webUIConfig are actually used by positioning engine
	// Known beacons at corners of a 8m × 8m map
	webUIConfig := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Test Floor Plan",
			Width:  8.0,
			Height: 8.0,
		},
		Beacons: []models.WebUIBeaconConfig{
			{
				UUID:        "B1000000000000000000000000000001",
				Major:       0,
				Minor:       1,
				X:           2.0, // Bottom-left
				Y:           2.0,
				TXPower:     -59,
				DisplayName: "B1",
				MACAddress:  "AABBCCDDEE01",
			},
			{
				UUID:        "B2000000000000000000000000000002",
				Major:       0,
				Minor:       2,
				X:           8.0, // Bottom-right
				Y:           2.0,
				TXPower:     -59,
				DisplayName: "B2",
				MACAddress:  "AABBCCDDEE02",
			},
			{
				UUID:        "B3000000000000000000000000000003",
				Major:       0,
				Minor:       3,
				X:           2.0, // Top-left
				Y:           8.0,
				TXPower:     -59,
				DisplayName: "B3",
				MACAddress:  "AABBCCDDEE03",
			},
			{
				UUID:        "B4000000000000000000000000000004",
				Major:       0,
				Minor:       4,
				X:           8.0, // Top-right
				Y:           8.0,
				TXPower:     -59,
				DisplayName: "B4",
				MACAddress:  "AABBCCDDEE04",
			},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	// Scenario 1: Tracker at (5, 5) - center of map
	t.Run("Tracker at center (5,5) with all 4 beacons", func(t *testing.T) {
		// All beacons at 5m distance from center beacon
		// Distance from center to each corner beacon should be approximately:
		// B1 at (2,2): sqrt((5-2)^2 + (5-2)^2) = sqrt(18) ≈ 4.24m
		// B2 at (8,2): sqrt((5-8)^2 + (5-2)^2) = sqrt(18) ≈ 4.24m
		// B3 at (2,8): sqrt((5-2)^2 + (5-8)^2) = sqrt(18) ≈ 4.24m
		// B4 at (8,8): sqrt((5-8)^2 + (5-8)^2) = sqrt(18) ≈ 4.24m

		// Distance from center to each corner beacon should be approximately:
		// sqrt((5-2)^2 + (5-2)^2) = sqrt(18) ≈ 4.24m
		// RSSI calculation: distance = 10^((txPower - RSSI) / (10 * n))
		// 4.24 = 10^((-59 - RSSI) / 20)
		// log10(4.24) = (-59 - RSSI) / 20
		// 0.627 = (-59 - RSSI) / 20
		// 12.54 = -59 - RSSI
		// RSSI = -71.54 ≈ -72
		requiredRSSI := -72

		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: requiredRSSI}, // B1
			{MACAddress: "AABBCCDDEE02", RSSI: requiredRSSI}, // B2
			{MACAddress: "AABBCCDDEE03", RSSI: requiredRSSI}, // B3
			{MACAddress: "AABBCCDDEE04", RSSI: requiredRSSI}, // B4
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		if result.Position == nil {
			t.Fatal("Expected position result, got nil")
		}

		// Verify position is close to (5, 5)
		tolerance := 0.5 // 0.5m tolerance
		if math.Abs(result.Position[0]-5.0) > tolerance {
			t.Errorf("Expected X ≈ 5.0, got %v", result.Position[0])
		}
		if math.Abs(result.Position[1]-5.0) > tolerance {
			t.Errorf("Expected Y ≈ 5.0, got %v", result.Position[1])
		}

		if result.BeaconCount != 4 {
			t.Errorf("Expected 4 beacons used, got %d", result.BeaconCount)
		}

		if result.Method != "multilateration" {
			t.Errorf("Expected multilateration method, got %s", result.Method)
		}

		if result.Confidence <= 0.5 {
			t.Errorf("Expected confidence > 0.5, got %v", result.Confidence)
		}
	})

	// Scenario 2: Verify beacon coordinates are used (not hardcoded positions)
	t.Run("Beacon coordinate changes affect positioning", func(t *testing.T) {
		// Create a modified config with beacon B1 moved from (2,2) to (3,3)
		modifiedConfig := *webUIConfig
		modifiedBeacons := make([]models.WebUIBeaconConfig, len(webUIConfig.Beacons))
		copy(modifiedBeacons, webUIConfig.Beacons)
		modifiedBeacons[0].X = 3.0 // Move B1 from (2,2) to (3,3)
		modifiedBeacons[0].Y = 3.0
		modifiedConfig.Beacons = modifiedBeacons

		// Same tracker detected from all beacons
		// This tracker position should be different after moving B1
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72}, // B1 (moved)
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // B2
			{MACAddress: "AABBCCDDEE03", RSSI: -72}, // B3
			{MACAddress: "AABBCCDDEE04", RSSI: -72}, // B4
		}

		// Calculate position with original config
		resultOriginal := CalculatePosition(detectedBeacons, webUIConfig, nil)

		// Calculate position with modified config
		resultModified := CalculatePosition(detectedBeacons, &modifiedConfig, nil)

		if resultOriginal.Position == nil || resultModified.Position == nil {
			t.Fatal("Expected both position results, got nil")
		}

		// Positions should be different
		positionsDifferent := math.Abs(resultOriginal.Position[0]-resultModified.Position[0]) > 0.1 ||
			math.Abs(resultOriginal.Position[1]-resultModified.Position[1]) > 0.1

		if !positionsDifferent {
			t.Errorf("Moving beacon B1 should change calculated position. Original: (%v,%v), Modified: (%v,%v)",
				resultOriginal.Position[0], resultOriginal.Position[1],
				resultModified.Position[0], resultModified.Position[1])
		}
	})

	// Scenario 3: Test with fewer beacons (fallback to weighted centroid)
	t.Run("Positioning with 2 beacons (weighted centroid fallback)", func(t *testing.T) {
		// Only B1 and B2 detected
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72}, // B1 at (2,2)
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // B2 at (8,2)
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		if result.Position == nil {
			t.Fatal("Expected position result for 2 beacons, got nil")
		}

		// With 2 equal-distance beacons, position should be roughly between them
		// B1=(2,2), B2=(8,2), so midpoint is approximately (5,2)
		if math.Abs(result.Position[0]-5.0) > 1.0 {
			t.Errorf("Expected X ≈ 5.0 with 2 beacons, got %v", result.Position[0])
		}

		if result.Method != "weighted-centroid" {
			t.Errorf("Expected weighted-centroid for 2 beacons, got %s", result.Method)
		}

		if result.BeaconCount != 2 {
			t.Errorf("Expected 2 beacons, got %d", result.BeaconCount)
		}
	})

	// Scenario 4: Single beacon (weighted centroid)
	t.Run("Positioning with 1 beacon", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72}, // B1 at (2,2)
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		if result.Position == nil {
			t.Fatal("Expected position result for 1 beacon, got nil")
		}

		// Position should be at beacon location (weighted centroid collapses to beacon)
		if math.Abs(result.Position[0]-2.0) > 1.0 {
			t.Errorf("Expected X ≈ 2.0 with 1 beacon, got %v", result.Position[0])
		}
		if math.Abs(result.Position[1]-2.0) > 1.0 {
			t.Errorf("Expected Y ≈ 2.0 with 1 beacon, got %v", result.Position[1])
		}

		if result.Method != "weighted-centroid" {
			t.Errorf("Expected weighted-centroid for 1 beacon, got %s", result.Method)
		}

		// Confidence should be lower with single beacon
		if result.Confidence >= 0.8 {
			t.Errorf("Expected lower confidence with 1 beacon (got %v)", result.Confidence)
		}
	})

	// Scenario 5: Beacon not in config should be ignored
	t.Run("Unknown beacon MAC address is ignored", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},   // B1 (known)
			{MACAddress: "AABBCCDDEE02", RSSI: -72},   // B2 (known)
			{MACAddress: "FFFFFFFFFFFF99", RSSI: -60}, // Unknown beacon (should be ignored)
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		// Should only use 2 known beacons, ignoring the unknown one
		if result.BeaconCount != 2 {
			t.Errorf("Expected 2 beacons used (unknown ignored), got %d", result.BeaconCount)
		}
	})

	// Scenario 6: Invalid RSSI (0 or out of range) should be ignored
	t.Run("Invalid RSSI values are rejected", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},  // Valid
			{MACAddress: "AABBCCDDEE02", RSSI: -72},  // Valid
			{MACAddress: "AABBCCDDEE03", RSSI: 0},    // Invalid: 0
			{MACAddress: "AABBCCDDEE04", RSSI: -125}, // Invalid: < -120
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		// Should only use 2 valid beacons
		if result.BeaconCount != 2 {
			t.Errorf("Expected 2 valid beacons, got %d", result.BeaconCount)
		}
	})

	// Scenario 7: Beacons with invalid TX power should be ignored
	t.Run("Beacons with zero TX power are ignored", func(t *testing.T) {
		invalidConfig := *webUIConfig
		invalidBeacons := make([]models.WebUIBeaconConfig, len(webUIConfig.Beacons))
		copy(invalidBeacons, webUIConfig.Beacons)
		invalidBeacons[2].TXPower = 0 // Invalidate B3
		invalidConfig.Beacons = invalidBeacons

		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72}, // B1 (valid)
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // B2 (valid)
			{MACAddress: "AABBCCDDEE03", RSSI: -72}, // B3 (invalid TX power)
			{MACAddress: "AABBCCDDEE04", RSSI: -72}, // B4 (valid)
		}

		result := CalculatePosition(detectedBeacons, &invalidConfig, nil)

		// Should use 3 valid beacons (skip B3)
		if result.BeaconCount != 3 {
			t.Errorf("Expected 3 beacons (invalid TX power ignored), got %d", result.BeaconCount)
		}
	})

	// Scenario 8: Verify position stays within map bounds
	t.Run("Calculated position within map bounds", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72}, // B1
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // B2
			{MACAddress: "AABBCCDDEE03", RSSI: -72}, // B3
			{MACAddress: "AABBCCDDEE04", RSSI: -72}, // B4
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		if result.Position == nil {
			t.Fatal("Expected position result")
		}

		// Position should be within or very close to map bounds [0, 8] × [0, 8]
		// Multilateration can calculate positions slightly outside, which is okay for error handling
		if result.Position[0] < -0.5 || result.Position[0] > 8.5 {
			t.Errorf("X position %v outside reasonable bounds", result.Position[0])
		}
		if result.Position[1] < -0.5 || result.Position[1] > 8.5 {
			t.Errorf("Y position %v outside reasonable bounds", result.Position[1])
		}
	})

	// Scenario 9: Configuration with no beacons
	t.Run("Config with no beacons returns nil position", func(t *testing.T) {
		emptyConfig := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{},
			Settings: models.WebUISettings{
				SignalPropagationFactor: 2.0,
			},
		}

		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
		}

		result := CalculatePosition(detectedBeacons, emptyConfig, nil)

		if result.Position != nil {
			t.Errorf("Expected nil position with empty config, got %v", result.Position)
		}
		if result.Method != "none" {
			t.Errorf("Expected 'none' method with empty config, got %s", result.Method)
		}
	})

	// Scenario 10: Nil config should be handled gracefully
	t.Run("Nil config returns nil position", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
		}

		result := CalculatePosition(detectedBeacons, nil, nil)

		if result.Position != nil {
			t.Errorf("Expected nil position with nil config, got %v", result.Position)
		}
	})
}

// TestPhase4_ConfigStoreIntegration verifies that WebUIConfigStore is used correctly
// This test demonstrates that the positioning service receives the config from the store
func TestPhase4_PositioningUsesProvidedConfig(t *testing.T) {
	service := NewPositioningService()

	webUIConfig := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Test Floor",
			Width:  10.0,
			Height: 10.0,
		},
		Beacons: []models.WebUIBeaconConfig{
			{
				UUID:        "B1",
				X:           2.0,
				Y:           2.0,
				TXPower:     -59,
				MACAddress:  "AABBCCDDEE01",
				DisplayName: "B1",
			},
			{
				UUID:        "B2",
				X:           8.0,
				Y:           2.0,
				TXPower:     -59,
				MACAddress:  "AABBCCDDEE02",
				DisplayName: "B2",
			},
			{
				UUID:        "B3",
				X:           2.0,
				Y:           8.0,
				TXPower:     -59,
				MACAddress:  "AABBCCDDEE03",
				DisplayName: "B3",
			},
			{
				UUID:        "B4",
				X:           8.0,
				Y:           8.0,
				TXPower:     -59,
				MACAddress:  "AABBCCDDEE04",
				DisplayName: "B4",
			},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	// Detected beacons for tracker at approximately (5, 5)
	detectedBeacons := []models.DetectedBeacon{
		{MACAddress: "AABBCCDDEE01", RSSI: -72},
		{MACAddress: "AABBCCDDEE02", RSSI: -72},
		{MACAddress: "AABBCCDDEE03", RSSI: -72},
		{MACAddress: "AABBCCDDEE04", RSSI: -72},
	}

	result := service.CalculatePosition(detectedBeacons, webUIConfig, nil)

	if result.Position == nil {
		t.Fatal("Service should return calculated position")
	}

	// Verify beacons were used
	if result.BeaconCount != 4 {
		t.Errorf("Service should use all 4 beacons, used %d", result.BeaconCount)
	}

	// Verify position is reasonable (should be near center)
	if math.Abs(result.Position[0]-5.0) > 1.0 || math.Abs(result.Position[1]-5.0) > 1.0 {
		t.Errorf("Position should be near (5,5), got (%v,%v)", result.Position[0], result.Position[1])
	}
}

// TestPhase4_AccuracyCalculation verifies accuracy metrics
func TestPhase4_AccuracyMetrics(t *testing.T) {
	webUIConfig := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
			{X: 10, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
			{X: 0, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
			{X: 10, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	t.Run("Multilateration returns accuracy metric", func(t *testing.T) {
		detectedBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		result := CalculatePosition(detectedBeacons, webUIConfig, nil)

		if result.Accuracy <= 0 {
			t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
		}
		if result.Confidence < 0 || result.Confidence > 1 {
			t.Errorf("Expected confidence between 0 and 1, got %v", result.Confidence)
		}
	})

	t.Run("Accuracy decreases with better measurements", func(t *testing.T) {
		// Good measurements (tight RSSI values)
		goodBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Poor measurements (inconsistent RSSI values)
		poorBeacons := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -60},
			{MACAddress: "AABBCCDDEE02", RSSI: -80},
			{MACAddress: "AABBCCDDEE03", RSSI: -65},
			{MACAddress: "AABBCCDDEE04", RSSI: -75},
		}

		resultGood := CalculatePosition(goodBeacons, webUIConfig, nil)
		resultPoor := CalculatePosition(poorBeacons, webUIConfig, nil)

		// Both should have valid results
		if resultGood.Position == nil || resultPoor.Position == nil {
			t.Fatal("Both results should be valid")
		}

		// Good measurements should have higher confidence than poor
		if resultGood.Confidence <= resultPoor.Confidence {
			t.Errorf("Good measurements should have higher confidence: good=%v, poor=%v",
				resultGood.Confidence, resultPoor.Confidence)
		}
	})
}
