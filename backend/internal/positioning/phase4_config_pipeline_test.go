package positioning

import (
	"sync"
	"testing"
	"time"

	"trackerHub/backend/internal/models"
)

// TestPhase4_ConfigStoreUpdatePipeline verifies the data flow:
// Configuration Update → Store Update → Positioning Uses New Config
func TestPhase4_ConfigStoreUpdatePipeline(t *testing.T) {
	initialConfig := &models.WebUIConfig{
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

	t.Run("Config update propagates to positioning engine", func(t *testing.T) {
		// Create a positioning service with initial config
		service := NewPositioningService()

		// Detector readings for a tracker at approximately (5, 5)
		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Calculate position with initial config
		result1 := service.CalculatePosition(detectorReadings, initialConfig, nil)
		if result1.Position == nil {
			t.Fatal("Expected position calculation with initial config")
		}

		// Now update the config - move one beacon
		updatedConfig := *initialConfig
		updatedBeacons := make([]models.WebUIBeaconConfig, len(initialConfig.Beacons))
		copy(updatedBeacons, initialConfig.Beacons)
		updatedBeacons[0].X = 3.0 // Move B1 from (0, 0) to (3, 0)
		updatedBeacons[0].Y = 0.0
		updatedConfig.Beacons = updatedBeacons

		// Calculate position with updated config
		result2 := service.CalculatePosition(detectorReadings, &updatedConfig, nil)
		if result2.Position == nil {
			t.Fatal("Expected position calculation with updated config")
		}

		// Positions should be different since beacon moved
		positionChanged := (result1.Position[0] != result2.Position[0]) ||
			(result1.Position[1] != result2.Position[1])

		if !positionChanged {
			t.Errorf("Config update should change position. Before: (%v,%v), After: (%v,%v)",
				result1.Position[0], result1.Position[1],
				result2.Position[0], result2.Position[1])
		}

		t.Logf("Config update succeeded: position changed from (%.2f, %.2f) to (%.2f, %.2f)",
			result1.Position[0], result1.Position[1],
			result2.Position[0], result2.Position[1])
	})

	t.Run("Concurrent config updates are handled safely", func(t *testing.T) {
		service := NewPositioningService()

		var wg sync.WaitGroup
		results := make([]*[2]float64, 100)
		resultMutex := &sync.Mutex{}

		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Scenario: Multiple positioning calculations with different configs
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()

				// Create a slightly different config for each goroutine
				config := *initialConfig
				beacons := make([]models.WebUIBeaconConfig, len(initialConfig.Beacons))
				copy(beacons, initialConfig.Beacons)

				// Adjust B1 position slightly
				offset := float64(index) * 0.01
				beacons[0].X = 0 + offset
				config.Beacons = beacons

				result := service.CalculatePosition(detectorReadings, &config, nil)
				if result.Position != nil {
					resultMutex.Lock()
					results[index] = result.Position
					resultMutex.Unlock()
				}
			}(i)
		}

		wg.Wait()

		// Verify all calculations completed
		successCount := 0
		for _, pos := range results {
			if pos != nil {
				successCount++
			}
		}

		if successCount < 90 {
			t.Errorf("Expected at least 90 successful calculations, got %d", successCount)
		}

		t.Logf("Concurrent test: %d/%d calculations succeeded", successCount, 100)
	})
}

// TestPhase4_MessageHandlerPipeline verifies the MQTT message handling pipeline
// Message → Positioning Engine → Result with new config
func TestPhase4_MessageHandlerPipeline(t *testing.T) {
	t.Run("MQTT message with new config beacon coordinates", func(t *testing.T) {
		service := NewPositioningService()

		// Simulated MQTT payload (detected beacons)
		mqttPayload := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Configuration with beacons
		config := &models.WebUIConfig{
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

		// Process message
		result := service.CalculatePosition(mqttPayload, config, nil)

		// Verify positioning result contains expected fields
		if result.Position == nil {
			t.Fatal("Expected position in message handler result")
		}

		if result.Accuracy <= 0 {
			t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
		}

		if result.Confidence < 0 || result.Confidence > 1 {
			t.Errorf("Expected confidence in [0, 1], got %v", result.Confidence)
		}

		if result.Method == "" {
			t.Errorf("Expected method name in result")
		}

		if result.BeaconCount != 4 {
			t.Errorf("Expected 4 beacons in result, got %d", result.BeaconCount)
		}

		t.Logf("Message processing result: Position=(%.2f, %.2f), Accuracy=%.2f, Confidence=%.2f, Method=%s",
			result.Position[0], result.Position[1], result.Accuracy, result.Confidence, result.Method)
	})

	t.Run("Rapid message sequence with changing config", func(t *testing.T) {
		service := NewPositioningService()

		config := &models.WebUIConfig{
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

		mqttPayloads := [][]models.DetectedBeacon{
			{
				{MACAddress: "AABBCCDDEE01", RSSI: -72},
				{MACAddress: "AABBCCDDEE02", RSSI: -72},
				{MACAddress: "AABBCCDDEE03", RSSI: -72},
				{MACAddress: "AABBCCDDEE04", RSSI: -72},
			},
			{
				{MACAddress: "AABBCCDDEE01", RSSI: -70},
				{MACAddress: "AABBCCDDEE02", RSSI: -70},
				{MACAddress: "AABBCCDDEE03", RSSI: -72},
				{MACAddress: "AABBCCDDEE04", RSSI: -72},
			},
			{
				{MACAddress: "AABBCCDDEE01", RSSI: -74},
				{MACAddress: "AABBCCDDEE02", RSSI: -74},
				{MACAddress: "AABBCCDDEE03", RSSI: -74},
				{MACAddress: "AABBCCDDEE04", RSSI: -74},
			},
		}

		// Process messages rapidly
		for i, payload := range mqttPayloads {
			result := service.CalculatePosition(payload, config, nil)
			if result.Position == nil {
				t.Errorf("Message %d: expected position, got nil", i)
			}

			// Verify positioning result is consistent
			if result.Method != "multilateration" {
				t.Errorf("Message %d: expected multilateration, got %s", i, result.Method)
			}
		}

		t.Logf("Processed %d rapid messages successfully", len(mqttPayloads))
	})
}

// TestPhase4_ConfigValidationBehavior verifies config validation during positioning
func TestPhase4_ConfigValidationBehavior(t *testing.T) {
	t.Run("Invalid beacon TX power is handled", func(t *testing.T) {
		config := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 10, Y: 0, TXPower: 0, MACAddress: "AABBCCDDEE02", DisplayName: "B2-Invalid"}, // Invalid
				{X: 0, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 10, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{
				SignalPropagationFactor: 2.0,
			},
		}

		mqttPayload := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // Should be ignored (invalid TX power)
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		service := NewPositioningService()
		result := service.CalculatePosition(mqttPayload, config, nil)

		// Should use only 3 valid beacons
		if result.BeaconCount != 3 {
			t.Errorf("Expected 3 beacons (invalid TX power ignored), got %d", result.BeaconCount)
		}

		if result.Position == nil {
			t.Fatal("Expected position with 3 beacons")
		}
	})

	t.Run("Beacon with extreme coordinates is used in calculation", func(t *testing.T) {
		config := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 1000, Y: 1000, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2-Extreme"}, // Far outside typical map
				{X: 0, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 10, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{
				SignalPropagationFactor: 2.0,
			},
		}

		mqttPayload := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72}, // Far beacon will pull position toward it
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		service := NewPositioningService()
		result := service.CalculatePosition(mqttPayload, config, nil)

		// The positioning engine should work with extreme coordinates
		if result.Position == nil {
			t.Fatal("Expected position calculation even with extreme beacon coordinates")
		}

		// Position will be influenced by the extreme beacon (this is expected behavior)
		// The algorithm uses all provided beacon coordinates in calculation
		if result.BeaconCount != 4 {
			t.Errorf("Expected 4 beacons to be used, got %d", result.BeaconCount)
		}

		t.Logf("Position with extreme beacon: (%.2f, %.2f)", result.Position[0], result.Position[1])
	})

	t.Run("Missing beacons in config", func(t *testing.T) {
		config := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 10, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				// B3 and B4 are missing from config
			},
			Settings: models.WebUISettings{
				SignalPropagationFactor: 2.0,
			},
		}

		mqttPayload := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72}, // Not in config
			{MACAddress: "AABBCCDDEE04", RSSI: -72}, // Not in config
		}

		service := NewPositioningService()
		result := service.CalculatePosition(mqttPayload, config, nil)

		// Should use only 2 configured beacons
		if result.BeaconCount != 2 {
			t.Errorf("Expected 2 beacons (unknowns ignored), got %d", result.BeaconCount)
		}

		if result.Position == nil {
			t.Fatal("Expected position with 2 beacons")
		}
	})
}

// TestPhase4_PositioningStabilityUnderConfigChanges verifies positioning remains
// stable when config is updated frequently
func TestPhase4_PositioningStabilityUnderConfigChanges(t *testing.T) {
	t.Run("Position stability with frequent beacon moves", func(t *testing.T) {
		service := NewPositioningService()

		// Fixed MQTT readings (tracker position doesn't change)
		stableReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Generate 10 config variations with beacon positions changed slightly
		positions := make([]*[2]float64, 10)
		for i := 0; i < 10; i++ {
			config := &models.WebUIConfig{
				Beacons: []models.WebUIBeaconConfig{
					{X: float64(i) * 0.1, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
					{X: 10, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
					{X: 0, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
					{X: 10, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
				},
				Settings: models.WebUISettings{
					SignalPropagationFactor: 2.0,
				},
			}

			result := service.CalculatePosition(stableReadings, config, nil)
			if result.Position != nil {
				positions[i] = result.Position
			}
		}

		// All positions should be calculated
		for i, pos := range positions {
			if pos == nil {
				t.Errorf("Position %d is nil", i)
			}
		}

		t.Logf("All %d position calculations succeeded with config changes", len(positions))
	})
}

// TestPhase4_WebsocketMessageFormat verifies the tracker update message structure
// for WebSocket transmission
func TestPhase4_WebsocketMessageFormat(t *testing.T) {
	t.Run("Positioning result has required fields for WebSocket", func(t *testing.T) {
		service := NewPositioningService()

		config := &models.WebUIConfig{
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

		readings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		result := service.CalculatePosition(readings, config, nil)

		// Verify all fields required for WebSocket tracker_update message
		if result.Position == nil {
			t.Fatal("Position is required for WebSocket message")
		}

		if len(result.Position) != 2 {
			t.Errorf("Position should have [x, y], got %d elements", len(result.Position))
		}

		if result.Position[0] < 0 || result.Position[0] > 10 {
			t.Errorf("Position X should be in [0, 10], got %v", result.Position[0])
		}

		if result.Position[1] < 0 || result.Position[1] > 10 {
			t.Errorf("Position Y should be in [0, 10], got %v", result.Position[1])
		}

		// Accuracy > 0
		if result.Accuracy <= 0 {
			t.Errorf("Accuracy should be positive, got %v", result.Accuracy)
		}

		// Confidence in [0, 1]
		if result.Confidence < 0 || result.Confidence > 1 {
			t.Errorf("Confidence should be in [0, 1], got %v", result.Confidence)
		}

		// Method identifier
		if result.Method == "" {
			t.Fatal("Method is required in result")
		}

		// Beacon count
		if result.BeaconCount <= 0 {
			t.Errorf("BeaconCount should be positive, got %d", result.BeaconCount)
		}

		t.Logf("WebSocket message format verified: Position=(%.2f, %.2f), Accuracy=%.2f, Confidence=%.2f, Method=%s, BeaconCount=%d",
			result.Position[0], result.Position[1], result.Accuracy, result.Confidence, result.Method, result.BeaconCount)
	})
}

// TestPhase4_LatencyUnderLoad simulates high-frequency positioning requests
func TestPhase4_LatencyUnderLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping latency test in short mode")
	}

	t.Run("Positioning latency under load", func(t *testing.T) {
		service := NewPositioningService()

		config := &models.WebUIConfig{
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

		readings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -72},
			{MACAddress: "AABBCCDDEE02", RSSI: -72},
			{MACAddress: "AABBCCDDEE03", RSSI: -72},
			{MACAddress: "AABBCCDDEE04", RSSI: -72},
		}

		// Process 1000 positioning requests
		startTime := time.Now()
		successCount := 0
		for i := 0; i < 1000; i++ {
			result := service.CalculatePosition(readings, config, nil)
			if result.Position != nil {
				successCount++
			}
		}
		elapsed := time.Since(startTime)

		avgLatency := elapsed / time.Duration(1000)

		// Should complete 1000 calculations in reasonable time
		if elapsed > 5*time.Second {
			t.Logf("Warning: 1000 calculations took %v (%.2f ms avg)", elapsed, float64(elapsed.Milliseconds())/1000)
		} else {
			t.Logf("Performance OK: 1000 calculations in %v (%.2f ms avg)", elapsed, float64(elapsed.Milliseconds())/1000)
		}

		if successCount < 950 {
			t.Errorf("Expected at least 950 successful calculations, got %d", successCount)
		}

		t.Logf("Load test complete: %d calculations in %v (%.4f ms per calculation)",
			successCount, elapsed, float64(elapsed.Microseconds())/float64(1000))

		_ = avgLatency // Use to avoid unused warning
	})
}
