package positioning

import (
	"math"
	"testing"

	"trackerHub/backend/internal/config"
	"trackerHub/backend/internal/models"
)

// TestConfigPositioningIntegration tests the complete chain:
// 1. WebUIConfigStore is created with initial configuration
// 2. Positioning uses the store's config
// 3. Config is updated via store.Set()
// 4. Subsequent positioning uses the updated config
func TestConfigPositioningIntegration(t *testing.T) {
	// Create initial configuration with 4 beacons in a square
	initialConfig := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Test Floor",
			Width:  10,
			Height: 10,
		},
		Beacons: []models.WebUIBeaconConfig{
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
				Major:       1,
				Minor:       1,
				X:           1.0,
				Y:           1.0,
				TXPower:     -59,
				DisplayName: "Beacon A",
				MACAddress:  "AA11BB22CC33",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E1",
				Major:       2,
				Minor:       1,
				X:           9.0,
				Y:           1.0,
				TXPower:     -59,
				DisplayName: "Beacon B",
				MACAddress:  "AA11BB22CC34",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E2",
				Major:       3,
				Minor:       1,
				X:           1.0,
				Y:           9.0,
				TXPower:     -59,
				DisplayName: "Beacon C",
				MACAddress:  "AA11BB22CC35",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E3",
				Major:       4,
				Minor:       1,
				X:           9.0,
				Y:           9.0,
				TXPower:     -59,
				DisplayName: "Beacon D",
				MACAddress:  "AA11BB22CC36",
			},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.5,
		},
	}

	// Create WebUIConfigStore with initial config
	store := &config.WebUIConfigStore{}
	store.Set(initialConfig)

	// Create positioning service
	positioningService := NewPositioningService()

	// Test 1: Position at center (5, 5) with all 4 beacons
	// RSSI values for ~5.6m distance from each corner with txPower -59 and n=2.5
	// distance = 10^((txPower - RSSI) / (10 * n))
	// 5.6 = 10^((-59 - RSSI) / 25)
	// log10(5.6) = (-59 - RSSI) / 25
	// 0.748 = (-59 - RSSI) / 25
	// 18.7 = -59 - RSSI
	// RSSI = -77.7 ≈ -78
	detectedBeacons := []models.DetectedBeacon{
		{MACAddress: "AA11BB22CC33", RSSI: -78}, // Beacon A at (1,1)
		{MACAddress: "AA11BB22CC34", RSSI: -78}, // Beacon B at (9,1)
		{MACAddress: "AA11BB22CC35", RSSI: -78}, // Beacon C at (1,9)
		{MACAddress: "AA11BB22CC36", RSSI: -78}, // Beacon D at (9,9)
	}

	result1 := positioningService.CalculatePosition(detectedBeacons, store.Get(), nil)
	if result1 == nil || result1.Position == nil {
		t.Fatal("CalculatePosition returned nil for initial config")
	}

	// Position should be near center (5, 5)
	dx1 := result1.Position[0] - 5.0
	dy1 := result1.Position[1] - 5.0
	error1 := math.Sqrt(dx1*dx1 + dy1*dy1)
	t.Logf("Test 1 - Initial config: Position=(%.2f, %.2f), Error=%.2fm, Method=%s, BeaconCount=%d",
		result1.Position[0], result1.Position[1], error1, result1.Method, result1.BeaconCount)

	if error1 > 2.0 {
		t.Errorf("Initial position error %.2fm exceeds 2.0m", error1)
	}
	if result1.BeaconCount != 4 {
		t.Errorf("Expected 4 beacons, got %d", result1.BeaconCount)
	}

	// Test 2: Update beacon A position from (1,1) to (2,2)
	updatedConfig := *initialConfig // shallow copy
	updatedConfig.Beacons = make([]models.WebUIBeaconConfig, len(initialConfig.Beacons))
	copy(updatedConfig.Beacons, initialConfig.Beacons)
	updatedConfig.Beacons[0] = models.WebUIBeaconConfig{
		UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
		Major:       1,
		Minor:       1,
		X:           2.0, // Changed from 1.0 to 2.0
		Y:           2.0, // Changed from 1.0 to 2.0
		TXPower:     -59,
		DisplayName: "Beacon A",
		MACAddress:  "AA11BB22CC33",
	}

	// Update the store
	store.Set(&updatedConfig)

	// Verify store returns updated config
	storedConfig := store.Get()
	if storedConfig == nil {
		t.Fatal("Store returned nil after update")
	}
	if storedConfig.Beacons[0].X != 2.0 || storedConfig.Beacons[0].Y != 2.0 {
		t.Errorf("Store didn't persist beacon A update: got (%.1f, %.1f), expected (2.0, 2.0)",
			storedConfig.Beacons[0].X, storedConfig.Beacons[0].Y)
	}

	// Test 3: Position with updated config - same RSSI observations
	// With beacon A now at (2,2), the center of the square shifts slightly
	result2 := positioningService.CalculatePosition(detectedBeacons, store.Get(), nil)
	if result2 == nil || result2.Position == nil {
		t.Fatal("CalculatePosition returned nil for updated config")
	}

	dx2 := result2.Position[0] - 5.0
	dy2 := result2.Position[1] - 5.0
	error2 := math.Sqrt(dx2*dx2 + dy2*dy2)
	t.Logf("Test 3 - Updated config: Position=(%.2f, %.2f), Error=%.2fm, Method=%s, BeaconCount=%d",
		result2.Position[0], result2.Position[1], error2, result2.Method, result2.BeaconCount)

	// Position should shift because beacon A moved from (1,1) to (2,2)
	// The calculated position should be different from result1
	posDiff := math.Sqrt(
		math.Pow(result2.Position[0]-result1.Position[0], 2) +
			math.Pow(result2.Position[1]-result1.Position[1], 2),
	)
	t.Logf("Position shift after config update: %.4fm", posDiff)

	if posDiff < 0.01 {
		t.Errorf("Position should have changed after beacon coordinate update, but only shifted %.4fm", posDiff)
	}

	// Test 4: Simulate a position closer to the new beacon A location (2,2)
	// RSSI for ~1.4m distance: 10^((-59 - RSSI)/25) = 1.4
	// log10(1.4) = 0.146 = (-59 - RSSI) / 25
	// 3.65 = -59 - RSSI
	// RSSI = -62.65 ≈ -63
	closeToNewABeacons := []models.DetectedBeacon{
		{MACAddress: "AA11BB22CC33", RSSI: -63}, // Beacon A at (2,2) - close
		{MACAddress: "AA11BB22CC34", RSSI: -82}, // Beacon B at (9,1) - far
		{MACAddress: "AA11BB22CC35", RSSI: -82}, // Beacon C at (1,9) - far
		{MACAddress: "AA11BB22CC36", RSSI: -85}, // Beacon D at (9,9) - very far
	}

	result3 := positioningService.CalculatePosition(closeToNewABeacons, store.Get(), nil)
	if result3 == nil || result3.Position == nil {
		t.Fatal("CalculatePosition returned nil for near-new-A config")
	}

	t.Logf("Test 4 - Near new A position: Position=(%.2f, %.2f), Method=%s, BeaconCount=%d",
		result3.Position[0], result3.Position[1], result3.Method, result3.BeaconCount)

	// Position should be closer to (2,2) than to (5,5)
	distToNewA := math.Sqrt(
		math.Pow(result3.Position[0]-2.0, 2) + math.Pow(result3.Position[1]-2.0, 2),
	)
	distToCenter := math.Sqrt(
		math.Pow(result3.Position[0]-5.0, 2) + math.Pow(result3.Position[1]-5.0, 2),
	)
	t.Logf("Distance to new A (2,2): %.2fm, Distance to center (5,5): %.2fm", distToNewA, distToCenter)

	if distToNewA > distToCenter {
		t.Errorf("Position should be closer to updated beacon A (2,2) than to center (5,5)")
	}
}

// TestConfigStoreThreadSafety verifies WebUIConfigStore is thread-safe for concurrent Get/Set
func TestConfigStoreThreadSafety(t *testing.T) {
	store := &config.WebUIConfigStore{}
	initialConfig := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA11BB22CC33", X: 1.0, Y: 1.0, TXPower: -59},
		},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
	}
	store.Set(initialConfig)

	done := make(chan bool, 2)

	// Writer goroutine
	go func() {
		for i := 0; i < 100; i++ {
			newConfig := &models.WebUIConfig{
				Beacons: []models.WebUIBeaconConfig{
					{MACAddress: "AA11BB22CC33", X: float64(i), Y: float64(i), TXPower: -59},
				},
				Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
			}
			store.Set(newConfig)
		}
		done <- true
	}()

	// Reader goroutine
	go func() {
		for i := 0; i < 100; i++ {
			cfg := store.Get()
			if cfg == nil || len(cfg.Beacons) == 0 {
				t.Errorf("Got nil or empty config on read %d", i)
			}
		}
		done <- true
	}()

	<-done
	<-done

	// Final verification
	finalCfg := store.Get()
	if finalCfg == nil {
		t.Fatal("Final config is nil")
	}
	t.Logf("Final config beacon X: %.1f", finalCfg.Beacons[0].X)
}

// TestConfigStoreDeepCopy verifies that Get() returns a deep copy
// so mutations to returned config don't affect the store
func TestConfigStoreDeepCopy(t *testing.T) {
	store := &config.WebUIConfigStore{}
	initialConfig := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Test",
			Width:  10,
			Height: 10,
			Entities: []models.WebUIMapEntity{
				{Type: "polyline", Points: [][2]float64{{0, 0}, {10, 10}}},
			},
		},
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA11BB22CC33", X: 1.0, Y: 1.0, TXPower: -59},
		},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
	}
	store.Set(initialConfig)

	// Get config and mutate it
	cfg1 := store.Get()
	cfg1.Beacons[0].X = 999.0
	cfg1.Map.Name = "Mutated"
	cfg1.Map.Entities[0].Points[0][0] = 999.0

	// Get again - should be unchanged
	cfg2 := store.Get()
	if cfg2.Beacons[0].X == 999.0 {
		t.Errorf("Store was mutated via returned config: beacon X = %.1f", cfg2.Beacons[0].X)
	}
	if cfg2.Map.Name == "Mutated" {
		t.Errorf("Store map was mutated via returned config: name = %s", cfg2.Map.Name)
	}
	if cfg2.Map.Entities[0].Points[0][0] == 999.0 {
		t.Errorf("Store entities were mutated via returned config: point[0][0] = %.1f", cfg2.Map.Entities[0].Points[0][0])
	}

	// Also verify Set doesn't share references
	original := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA11BB22CC33", X: 5.0, Y: 5.0, TXPower: -59},
		},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
	}
	store.Set(original)
	original.Beacons[0].X = 888.0 // Mutate original after setting

	cfg3 := store.Get()
	if cfg3.Beacons[0].X == 888.0 {
		t.Errorf("Store shares reference with input config: beacon X = %.1f", cfg3.Beacons[0].X)
	}
}

// TestConfigPositioningWithRealMapConfig validates the integration with a realistic map config
func TestConfigPositioningWithRealMapConfig(t *testing.T) {
	// Use a simple inline config instead of file loading for test reliability
	webUIConfig := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{
			Name:   "Main Floor",
			Width:  30,
			Height: 20,
		},
		Beacons: []models.WebUIBeaconConfig{
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
				Major:       1,
				Minor:       1,
				X:           3.0,
				Y:           4.0,
				TXPower:     -59,
				DisplayName: "Beacon A",
				MACAddress:  "AA11BB22CC33",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E1",
				Major:       2,
				Minor:       1,
				X:           27.0,
				Y:           4.0,
				TXPower:     -59,
				DisplayName: "Beacon B",
				MACAddress:  "AA11BB22CC34",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E2",
				Major:       3,
				Minor:       1,
				X:           3.0,
				Y:           16.0,
				TXPower:     -59,
				DisplayName: "Beacon C",
				MACAddress:  "AA11BB22CC35",
			},
			{
				UUID:        "E2C56DB5-DFFB-48D2-B060-D0F5A71096E3",
				Major:       4,
				Minor:       1,
				X:           27.0,
				Y:           16.0,
				TXPower:     -59,
				DisplayName: "Beacon D",
				MACAddress:  "AA11BB22CC36",
			},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.5,
		},
	}

	store := &config.WebUIConfigStore{}
	store.Set(webUIConfig)

	positioningService := NewPositioningService()

	// Simulate tracker at (15, 10) - center of the map
	// Distance to each beacon: ~15.8m
	// RSSI = txPower - 10*n*log10(distance) = -59 - 25*log10(15.8) ≈ -59 - 25*1.2 = -89
	detectedBeacons := []models.DetectedBeacon{
		{MACAddress: "AA11BB22CC33", RSSI: -89}, // Beacon A
		{MACAddress: "AA11BB22CC34", RSSI: -89}, // Beacon B
		{MACAddress: "AA11BB22CC35", RSSI: -89}, // Beacon C
		{MACAddress: "AA11BB22CC36", RSSI: -89}, // Beacon D
	}

	result := positioningService.CalculatePosition(detectedBeacons, store.Get(), nil)
	if result == nil || result.Position == nil {
		t.Fatal("CalculatePosition returned nil")
	}

	t.Logf("Position: (%.2f, %.2f), Expected: (15, 10)", result.Position[0], result.Position[1])
	t.Logf("Method: %s, BeaconCount: %d, Accuracy: %.2f, Confidence: %.2f",
		result.Method, result.BeaconCount, result.Accuracy, result.Confidence)

	// Verify position is reasonable (near center)
	dx := result.Position[0] - 15.0
	dy := result.Position[1] - 10.0
	error := math.Sqrt(dx*dx + dy*dy)
	if error > 5.0 {
		t.Errorf("Position error %.2fm exceeds 5.0m", error)
	}

	// Now update one beacon and verify positioning changes
	updatedConfig := *webUIConfig
	updatedConfig.Beacons = make([]models.WebUIBeaconConfig, len(webUIConfig.Beacons))
	copy(updatedConfig.Beacons, webUIConfig.Beacons)
	updatedConfig.Beacons[0].X = 5.0 // Move beacon A from (3,4) to (5,4)
	updatedConfig.Beacons[0].Y = 4.0
	store.Set(&updatedConfig)

	result2 := positioningService.CalculatePosition(detectedBeacons, store.Get(), nil)
	if result2 == nil || result2.Position == nil {
		t.Fatal("CalculatePosition returned nil after update")
	}

	// Position should shift because beacon A moved
	shift := math.Sqrt(
		math.Pow(result2.Position[0]-result.Position[0], 2) +
			math.Pow(result2.Position[1]-result.Position[1], 2),
	)
	t.Logf("Position shift after beacon A move: %.4fm", shift)
	if shift < 0.1 {
		t.Errorf("Position should shift significantly when beacon moves, got %.4fm", shift)
	}

	// Verify the new position is actually different and reasonable
	t.Logf("New position: (%.2f, %.2f)", result2.Position[0], result2.Position[1])
}

// TestConfigStoreWithEmptyAndNilConfigs tests edge cases
func TestConfigStoreWithEmptyAndNilConfigs(t *testing.T) {
	store := &config.WebUIConfigStore{}

	// Test Get on uninitialized store
	cfg := store.Get()
	if cfg != nil {
		t.Errorf("Expected nil from uninitialized store, got %v", cfg)
	}

	// Test Set with nil
	store.Set(nil)
	cfg = store.Get()
	if cfg != nil {
		t.Errorf("Expected nil after Set(nil), got %v", cfg)
	}

	// Test Set with empty config
	emptyConfig := &models.WebUIConfig{
		Beacons:  []models.WebUIBeaconConfig{},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
	}
	store.Set(emptyConfig)
	cfg = store.Get()
	if cfg == nil || len(cfg.Beacons) != 0 {
		t.Errorf("Expected empty beacon list, got %v", cfg)
	}

	// Test with config containing nil Map
	noMapConfig := &models.WebUIConfig{
		Map:      nil,
		Beacons:  []models.WebUIBeaconConfig{{MACAddress: "AA11BB22CC33", X: 1.0, Y: 1.0, TXPower: -59}},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.5},
	}
	store.Set(noMapConfig)
	cfg = store.Get()
	if cfg == nil || cfg.Map != nil || len(cfg.Beacons) != 1 {
		t.Errorf("Expected config with nil map and 1 beacon, got %v", cfg)
	}
}
