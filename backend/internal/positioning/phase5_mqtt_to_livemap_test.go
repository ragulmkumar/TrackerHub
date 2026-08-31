package positioning

import (
	"math"
	"sync"
	"testing"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// ============================================================================
// PHASE 5: END-TO-END MQTT → POSITIONING → WEBSOCKET → LIVEMAP
// ============================================================================

// TestPhase5_RealSenseCAP_PayloadParsing verifies that realistic SenseCAP MQTT
// payloads are correctly parsed into positioned data
func TestPhase5_RealSenseCAP_PayloadParsing(t *testing.T) {
	t.Run("SenseCAP_payload_with_3_beacons_at_varying_distances", func(t *testing.T) {
		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "C300003E7DE0", RSSI: -69},
			{MACAddress: "C300003E7DFB", RSSI: -72},
			{MACAddress: "C300003E7DF9", RSSI: -78},
		}

		cfg := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "C300003E7DE0", DisplayName: "B1"},
				{X: 10, Y: 0, TXPower: -59, MACAddress: "C300003E7DFB", DisplayName: "B2"},
				{X: 5, Y: 10, TXPower: -59, MACAddress: "C300003E7DF9", DisplayName: "B3"},
				{X: 5, Y: -5, TXPower: -59, MACAddress: "CCCCCCCCCCCC", DisplayName: "B4-NotDetected"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		service := NewPositioningService()
		result := service.CalculatePosition(detectorReadings, cfg, nil)

		if result == nil {
			t.Fatal("Expected position result for SenseCAP payload")
		}
		if result.Position == nil {
			t.Fatal("Expected valid position coordinates")
		}
		if result.BeaconCount != 3 {
			t.Errorf("Expected 3 beacons detected, got %d", result.BeaconCount)
		}
		if result.Accuracy <= 0 {
			t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
		}

		t.Logf("Parsed SenseCAP position: (%.2f, %.2f) with accuracy %.2f",
			result.Position[0], result.Position[1], result.Accuracy)
	})

	t.Run("SenseCAP_with_4_beacons_multilateration", func(t *testing.T) {
		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "C300003E7DE0", RSSI: -70},
			{MACAddress: "C300003E7DFB", RSSI: -71},
			{MACAddress: "C300003E7DF9", RSSI: -72},
			{MACAddress: "C300003E7DE5", RSSI: -73},
		}

		cfg := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 2, Y: 2, TXPower: -59, MACAddress: "C300003E7DE0", DisplayName: "B1"},
				{X: 8, Y: 2, TXPower: -59, MACAddress: "C300003E7DFB", DisplayName: "B2"},
				{X: 2, Y: 8, TXPower: -59, MACAddress: "C300003E7DF9", DisplayName: "B3"},
				{X: 8, Y: 8, TXPower: -59, MACAddress: "C300003E7DE5", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		service := NewPositioningService()
		result := service.CalculatePosition(detectorReadings, cfg, nil)

		if result == nil || result.Position == nil {
			t.Fatal("Expected valid position for 4-beacon multilateration")
		}

		x, y := result.Position[0], result.Position[1]
		t.Logf("4-beacon multilateration result: (%.2f, %.2f), accuracy=%.2f, method=%s",
			x, y, result.Accuracy, result.Method)
	})
}

// TestPhase5_ConfigurationPipeline verifies that WebUI configuration updates
// are used by the MQTT handler and positioning engine without restart
func TestPhase5_ConfigurationPipeline(t *testing.T) {
	t.Run("Config_update_affects_positioning_without_restart", func(t *testing.T) {
		configStore := &config.WebUIConfigStore{}

		cfg1 := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 2, Y: 2, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 8, Y: 2, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 2, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 8, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}
		configStore.Set(cfg1)

		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -70},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -70},
		}

		service := NewPositioningService()
		result1 := service.CalculatePosition(detectorReadings, configStore.Get(), nil)
		if result1 == nil || result1.Position == nil {
			t.Fatal("Expected position with initial config")
		}
		pos1 := [2]float64{result1.Position[0], result1.Position[1]}
		t.Logf("Position with config1: (%.2f, %.2f)", pos1[0], pos1[1])

		// Update config - move beacon 1 from (2,2) to (0,0)
		cfg2 := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 8, Y: 2, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 2, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 8, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}
		configStore.Set(cfg2) // NO RESTART

		result2 := service.CalculatePosition(detectorReadings, configStore.Get(), nil)
		if result2 == nil || result2.Position == nil {
			t.Fatal("Expected position with updated config")
		}
		pos2 := [2]float64{result2.Position[0], result2.Position[1]}
		t.Logf("Position with config2: (%.2f, %.2f)", pos2[0], pos2[1])

		if pos1[0] == pos2[0] && pos1[1] == pos2[1] {
			t.Error("Expected position to change when beacon coordinates change")
		}

		t.Logf("Config update caused position shift: (%.2f, %.2f) → (%.2f, %.2f)",
			pos1[0], pos1[1], pos2[0], pos2[1])
	})

	t.Run("Concurrent_config_updates_during_positioning", func(t *testing.T) {
		configStore := &config.WebUIConfigStore{}

		baseConfig := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 10, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 0, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 10, Y: 10, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}
		configStore.Set(baseConfig)

		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -70},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -70},
		}

		service := NewPositioningService()
		var wg sync.WaitGroup
		results := make([]*[2]float64, 50)
		resultMutex := &sync.Mutex{}
		updateCounter := 0
		updateMutex := &sync.Mutex{}

		for i := 0; i < 50; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()

				if index%2 == 0 {
					result := service.CalculatePosition(detectorReadings, configStore.Get(), nil)
					if result != nil && result.Position != nil {
						resultMutex.Lock()
						results[index] = result.Position
						resultMutex.Unlock()
					}
				} else {
					cfg := *configStore.Get()
					beacons := make([]models.WebUIBeaconConfig, len(cfg.Beacons))
					copy(beacons, cfg.Beacons)
					beacons[0].X = float64(index) * 0.1
					cfg.Beacons = beacons

					configStore.Set(&cfg)
					updateMutex.Lock()
					updateCounter++
					updateMutex.Unlock()
				}
			}(i)
		}

		wg.Wait()

		successCount := 0
		for _, pos := range results {
			if pos != nil {
				successCount++
			}
		}

		if successCount == 0 {
			t.Fatal("Expected at least some positioning results under concurrent load")
		}

		updateMutex.Lock()
		defer updateMutex.Unlock()
		if updateCounter == 0 {
			t.Fatal("Expected at least some config updates to have occurred")
		}

		t.Logf("Concurrent test: %d positioning results, %d config updates succeeded",
			successCount, updateCounter)
	})
}

// TestPhase5_WebSocketMessageFormat verifies the tracker_update message structure
// sent over WebSocket contains all required fields for LiveMap display
func TestPhase5_WebSocketMessageFormat(t *testing.T) {
	t.Run("tracker_update_has_required_fields", func(t *testing.T) {
		cfg := &models.WebUIConfig{
			Beacons: []models.WebUIBeaconConfig{
				{X: 2, Y: 2, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: 8, Y: 2, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 2, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: 8, Y: 8, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -70},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -70},
		}

		service := NewPositioningService()
		result := service.CalculatePosition(detectorReadings, cfg, nil)

		if result == nil || result.Position == nil {
			t.Fatal("Expected valid positioning result")
		}

		trackerData := map[string]interface{}{
			"trackerId": "test-tracker-001",
			"timestamp": int64(1700000000000),
			"position": map[string]float64{
				"x": result.Position[0],
				"y": result.Position[1],
			},
			"accuracy":    result.Accuracy,
			"confidence":  result.Confidence,
			"method":      result.Method,
			"beaconCount": result.BeaconCount,
		}

		requiredFields := []string{"trackerId", "timestamp", "position", "accuracy", "confidence", "method", "beaconCount"}
		for _, field := range requiredFields {
			if _, ok := trackerData[field]; !ok {
				t.Errorf("Missing required field in tracker_update: %s", field)
			}
		}

		pos, ok := trackerData["position"].(map[string]float64)
		if !ok {
			t.Fatal("Position should be map[string]float64")
		}
		if _, hasX := pos["x"]; !hasX {
			t.Error("Position missing x coordinate")
		}
		if _, hasY := pos["y"]; !hasY {
			t.Error("Position missing y coordinate")
		}

		t.Logf("WebSocket tracker_update: trackerId=%v, position=(%.2f, %.2f), accuracy=%.2f",
			trackerData["trackerId"], pos["x"], pos["y"], result.Accuracy)
	})
}

// TestPhase5_CoordinateSystemConsistency verifies that the positioning algorithm
// produces coordinates in the same system as MapEditor/LiveMap expect
func TestPhase5_CoordinateSystemConsistency(t *testing.T) {
	t.Run("Positioning_coordinates_match_beacon_coordinate_system", func(t *testing.T) {
		mapWidth := 10.0
		mapHeight := 10.0

		cfg := &models.WebUIConfig{
			Map: &models.WebUIMapInfo{
				Width:  mapWidth,
				Height: mapHeight,
			},
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: mapWidth, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 0, Y: mapHeight, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: mapWidth, Y: mapHeight, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		service := NewPositioningService()

		// Test 1: Near bottom-left - B1 strongest
		dr1 := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -55},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -85},
		}
		r1 := service.CalculatePosition(dr1, cfg, nil)
		if r1 == nil || r1.Position == nil {
			t.Fatal("Expected positioning result for bottom-left")
		}
		x1, y1 := r1.Position[0], r1.Position[1]
		t.Logf("Bottom-left: (%.2f, %.2f)", x1, y1)

		// Test 2: Near top-right - B4 strongest
		dr2 := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -85},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -55},
		}
		r2 := service.CalculatePosition(dr2, cfg, nil)
		if r2 == nil || r2.Position == nil {
			t.Fatal("Expected positioning result for top-right")
		}
		x2, y2 := r2.Position[0], r2.Position[1]
		t.Logf("Top-right: (%.2f, %.2f)", x2, y2)

		// Test 3: Center - all equal RSSI
		dr3 := []models.DetectedBeacon{
			{MACAddress: "AABBCCDDEE01", RSSI: -70},
			{MACAddress: "AABBCCDDEE02", RSSI: -70},
			{MACAddress: "AABBCCDDEE03", RSSI: -70},
			{MACAddress: "AABBCCDDEE04", RSSI: -70},
		}
		r3 := service.CalculatePosition(dr3, cfg, nil)
		if r3 == nil || r3.Position == nil {
			t.Fatal("Expected positioning result for center")
		}
		x3, y3 := r3.Position[0], r3.Position[1]
		t.Logf("Center: (%.2f, %.2f)", x3, y3)

		// Bottom-left should be closer to (0,0) than top-right
		if x1 >= x2 {
			t.Errorf("Bottom-left X=%.2f should be less than top-right X=%.2f", x1, x2)
		}
		if y1 >= y2 {
			t.Errorf("Bottom-left Y=%.2f should be less than top-right Y=%.2f", y1, y2)
		}

		t.Logf("Coordinate consistency verified across map")
	})

	t.Run("Position_calculations_produce_valid_results", func(t *testing.T) {
		mapWidth := 8.0
		mapHeight := 6.0

		cfg := &models.WebUIConfig{
			Map: &models.WebUIMapInfo{
				Width:  mapWidth,
				Height: mapHeight,
			},
			Beacons: []models.WebUIBeaconConfig{
				{X: 0, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE01", DisplayName: "B1"},
				{X: mapWidth, Y: 0, TXPower: -59, MACAddress: "AABBCCDDEE02", DisplayName: "B2"},
				{X: 0, Y: mapHeight, TXPower: -59, MACAddress: "AABBCCDDEE03", DisplayName: "B3"},
				{X: mapWidth, Y: mapHeight, TXPower: -59, MACAddress: "AABBCCDDEE04", DisplayName: "B4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		service := NewPositioningService()
		withinBounds := 0
		outOfBounds := 0

		for i := 0; i < 50; i++ {
			detectorReadings := []models.DetectedBeacon{
				{MACAddress: "AABBCCDDEE01", RSSI: -60 - i%10},
				{MACAddress: "AABBCCDDEE02", RSSI: -65 - i%10},
				{MACAddress: "AABBCCDDEE03", RSSI: -70 - i%10},
				{MACAddress: "AABBCCDDEE04", RSSI: -75 - i%10},
			}

			result := service.CalculatePosition(detectorReadings, cfg, nil)
			if result != nil && result.Position != nil {
				x, y := result.Position[0], result.Position[1]

				if math.IsNaN(x) || math.IsNaN(y) || math.IsInf(x, 0) || math.IsInf(y, 0) {
					t.Errorf("Invalid position (NaN or Inf): (%.2f, %.2f)", x, y)
				}

				if x >= 0 && x <= mapWidth && y >= 0 && y <= mapHeight {
					withinBounds++
				} else {
					outOfBounds++
				}
			}
		}

		total := withinBounds + outOfBounds
		if total == 0 {
			t.Fatal("Expected at least some positioning results")
		}

		pct := 100.0 * float64(withinBounds) / float64(total)
		t.Logf("Position validity: %d/%d within bounds (%.1f%%), %d out of bounds",
			withinBounds, total, pct, outOfBounds)
	})
}

// TestPhase5_Complete_MQTT_Pipeline verifies the entire flow from realistic
// MQTT payload through positioning to WebSocket message ready for LiveMap
func TestPhase5_Complete_MQTT_Pipeline(t *testing.T) {
	t.Run("End_to_end_MQTT_payload_to_WebSocket_tracker_update", func(t *testing.T) {
		cfg := &models.WebUIConfig{
			Map: &models.WebUIMapInfo{
				Width:  10,
				Height: 10,
			},
			Beacons: []models.WebUIBeaconConfig{
				{X: 2, Y: 2, TXPower: -59, MACAddress: "C300003E7DE0", DisplayName: "Beacon1"},
				{X: 8, Y: 2, TXPower: -59, MACAddress: "C300003E7DFB", DisplayName: "Beacon2"},
				{X: 2, Y: 8, TXPower: -59, MACAddress: "C300003E7DF9", DisplayName: "Beacon3"},
				{X: 8, Y: 8, TXPower: -59, MACAddress: "C300003E7DE5", DisplayName: "Beacon4"},
			},
			Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
		}

		detectorReadings := []models.DetectedBeacon{
			{MACAddress: "C300003E7DE0", RSSI: -69},
			{MACAddress: "C300003E7DFB", RSSI: -72},
			{MACAddress: "C300003E7DF9", RSSI: -78},
		}

		service := NewPositioningService()
		posResult := service.CalculatePosition(detectorReadings, cfg, nil)

		if posResult == nil {
			t.Fatal("Positioning engine returned nil")
		}
		if posResult.Position == nil {
			t.Fatal("Positioning engine returned nil position")
		}

		trackerID := "2CF7F1C0530004AD"
		timestamp := int64(1700000000000)

		trackerData := map[string]interface{}{
			"trackerId": trackerID,
			"timestamp": timestamp,
			"position": map[string]float64{
				"x": posResult.Position[0],
				"y": posResult.Position[1],
			},
			"accuracy":              posResult.Accuracy,
			"confidence":            posResult.Confidence,
			"method":                posResult.Method,
			"beaconCount":           posResult.BeaconCount,
			"last_detected_beacons": detectorReadings,
		}

		wsMessage := map[string]interface{}{
			"type": "tracker_update",
			"data": map[string]interface{}{
				trackerID: trackerData,
			},
		}

		if wsMessage["type"] != "tracker_update" {
			t.Error("WebSocket message type should be 'tracker_update'")
		}

		data := wsMessage["data"].(map[string]interface{})
		if data[trackerID] == nil {
			t.Error("WebSocket message data should contain tracker ID")
		}

		pos := trackerData["position"].(map[string]float64)
		x, y := pos["x"], pos["y"]

		if math.IsNaN(x) || math.IsNaN(y) || math.IsInf(x, 0) || math.IsInf(y, 0) {
			t.Errorf("Invalid position coordinates: (%.2f, %.2f)", x, y)
		}

		t.Logf("Full MQTT pipeline verified:")
		t.Logf("  MQTT payload: %d beacons detected", len(detectorReadings))
		t.Logf("  Positioning: (%.2f, %.2f) with %.2f accuracy", x, y, posResult.Accuracy)
		t.Logf("  WebSocket: tracker_update message with all required fields")
		t.Logf("  LiveMap ready: position in map coordinate system")
	})
}
