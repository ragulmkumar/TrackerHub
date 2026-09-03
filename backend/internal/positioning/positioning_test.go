package positioning

import (
	"math"
	"testing"

	"trackerHub/backend/internal/models"
)

func TestCalculateDistance(t *testing.T) {
	tests := []struct {
		name        string
		rssi        int
		txPower     int
		pathLossExp float64
		wantMin     float64
		wantMax     float64
	}{
		{
			name:        "RSSI equals TX power should return 1 meter",
			rssi:        -59,
			txPower:     -59,
			pathLossExp: 2.0,
			wantMin:     0.99,
			wantMax:     1.01,
		},
		{
			name:        "Stronger RSSI should return less than 1 meter",
			rssi:        -40,
			txPower:     -59,
			pathLossExp: 2.0,
			wantMin:     0.01,
			wantMax:     0.5,
		},
		{
			name:        "Weaker RSSI should return more than 1 meter",
			rssi:        -80,
			txPower:     -59,
			pathLossExp: 2.0,
			wantMin:     10.0,
			wantMax:     20.0,
		},
		{
			name:        "Default TX power -59 dBm",
			rssi:        -70,
			txPower:     -59,
			pathLossExp: 2.0,
			wantMin:     2.0,
			wantMax:     4.0,
		},
		{
			name:        "Path loss exponent 3.0 (dense obstacles)",
			rssi:        -70,
			txPower:     -59,
			pathLossExp: 3.0,
			wantMin:     1.5,
			wantMax:     3.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateDistance(tt.rssi, tt.txPower, tt.pathLossExp)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("CalculateDistance() = %v, want between %v and %v", got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestCalculateDistanceEdgeCases(t *testing.T) {
	// Test RSSI = 0 (should return -1)
	d := CalculateDistance(0, -59, 2.0)
	if d != -1.0 {
		t.Errorf("CalculateDistance(0, -59, 2.0) = %v, expected -1.0", d)
	}

	// Test very negative RSSI
	d = CalculateDistance(-120, -59, 2.0)
	if d < 0 {
		t.Errorf("CalculateDistance(-120, -59, 2.0) = %v, expected positive", d)
	}
}

func TestWeightedCentroid(t *testing.T) {
	// Two beacons at (0,0) and (10,0) with distances 5 and 5
	// Weighted centroid should be near (5, 0)
	beacons := [][3]float64{
		{0, 0, 5},
		{10, 0, 5},
	}

	pos, accuracy := WeightedCentroid(beacons)
	if pos == nil {
		t.Fatal("WeightedCentroid returned nil")
	}
	if math.Abs(pos[0]-5.0) > 0.5 {
		t.Errorf("Expected x ≈ 5.0, got %v", pos[0])
	}
	if math.Abs(pos[1]-0.0) > 0.5 {
		t.Errorf("Expected y ≈ 0.0, got %v", pos[1])
	}
	if accuracy <= 0 {
		t.Errorf("Expected positive accuracy, got %v", accuracy)
	}
}

func TestWeightedCentroidSingleBeacon(t *testing.T) {
	// Single beacon at (5, 5) with distance 3
	// Weighted centroid should be at the beacon position
	beacons := [][3]float64{
		{5, 5, 3},
	}

	pos, accuracy := WeightedCentroid(beacons)
	if pos == nil {
		t.Fatal("WeightedCentroid returned nil")
	}
	if math.Abs(pos[0]-5.0) > 0.5 {
		t.Errorf("Expected x ≈ 5.0, got %v", pos[0])
	}
	if math.Abs(pos[1]-5.0) > 0.5 {
		t.Errorf("Expected y ≈ 5.0, got %v", pos[1])
	}
	if accuracy <= 0 {
		t.Errorf("Expected positive accuracy, got %v", accuracy)
	}
}

func TestWeightedCentroidEmpty(t *testing.T) {
	pos, accuracy := WeightedCentroid([][3]float64{})
	if pos != nil {
		t.Errorf("Expected nil position for empty beacons, got %v", pos)
	}
	if accuracy != 0.0 {
		t.Errorf("Expected 0 accuracy for empty beacons, got %v", accuracy)
	}
}

func TestRejectOutliers(t *testing.T) {
	lastPos := &[2]float64{5, 5}
	beacons := [][3]float64{
		{5, 5, 3},      // Close - keep
		{100, 100, 50}, // Far outlier - reject
		{6, 6, 2},      // Close - keep
	}

	filtered := RejectOutliers(beacons, lastPos, 10.0) // 10m max jump
	if len(filtered) != 2 {
		t.Errorf("Expected 2 beacons after outlier rejection, got %d", len(filtered))
	}
	if filtered[0][0] != 5 || filtered[0][1] != 5 {
		t.Errorf("First beacon should be (5,5), got (%v,%v)", filtered[0][0], filtered[0][1])
	}
	if filtered[1][0] != 6 || filtered[1][1] != 6 {
		t.Errorf("Second beacon should be (6,6), got (%v,%v)", filtered[1][0], filtered[1][1])
	}
}

func TestRejectOutliersAllFiltered(t *testing.T) {
	lastPos := &[2]float64{5, 5}
	beacons := [][3]float64{
		{100, 100, 50}, // Far outlier
		{200, 200, 60}, // Another outlier
	}

	filtered := RejectOutliers(beacons, lastPos, 10.0)
	// Should return original when all filtered out
	if len(filtered) != 2 {
		t.Errorf("Expected 2 beacons (all filtered -> return original), got %d", len(filtered))
	}
}

func TestRejectOutliersNoLastPosition(t *testing.T) {
	beacons := [][3]float64{
		{100, 100, 50},
		{200, 200, 60},
	}

	filtered := RejectOutliers(beacons, nil, 10.0)
	// Should return all when no last position
	if len(filtered) != 2 {
		t.Errorf("Expected 2 beacons (no last pos), got %d", len(filtered))
	}
}

func TestWeightedBeaconSeedBiasesTowardNearestBeacon(t *testing.T) {
	// All beacons share the same x so the plain centroid sits exactly on x=5.
	// A very small measured distance from the beacon at x=0 should pull the
	// weighted seed well toward it (the tracker is judged closest to that beacon).
	beacons := [][3]float64{
		{0, 0, 0.5}, // very close — dominates the seed
		{5, 0, 50},
		{10, 0, 50},
	}
	seed := weightedBeaconSeed(beacons)
	if seed[0] > 2.5 {
		t.Errorf("weighted seed x = %v, expected to be pulled toward the near beacon (x<2.5)", seed[0])
	}
	if seed[1] > 1e-9 {
		t.Errorf("weighted seed y should be ~0, got %v", seed[1])
	}

	// A single beacon places the seed exactly at the beacon (no averaging).
	alone := weightedBeaconSeed([][3]float64{{7, 9, 4}})
	if math.Abs(alone[0]-7) > 1e-9 || math.Abs(alone[1]-9) > 1e-9 {
		t.Errorf("single-beacon seed = %v, expected (7, 9)", alone)
	}
}

func TestMultilaterationLeastSquares(t *testing.T) {
	// Three beacons forming a triangle that intersect exactly at (5, 5).
	// Beacon 1 at (0, 0), distance sqrt(50)
	// Beacon 2 at (10, 0), distance sqrt(50)
	// Beacon 3 at (5, 10), distance 5
	// Expected position: (5, 5)
	// Uses a robust Levenberg-Marquardt solver (matching the reference), so it
	// recovers the exact solution rather than an approximate gradient step.
	beacons := [][3]float64{
		{0, 0, math.Sqrt(50)},
		{10, 0, math.Sqrt(50)},
		{5, 10, 5},
	}

	initialGuess := &[2]float64{5, 5}
	result := MultilaterationLeastSquares(beacons, initialGuess)
	if result == nil {
		t.Fatal("MultilaterationLeastSquares returned nil")
	}

	if math.Abs(result[0]-5.0) > 1e-3 {
		t.Errorf("Expected x ≈ 5.0, got %v", result[0])
	}
	if math.Abs(result[1]-5.0) > 1e-3 {
		t.Errorf("Expected y ≈ 5.0, got %v", result[1])
	}
}

// TestMultilaterationLeastSquaresLastKnownBranch is a regression test for the
// wrong-branch problem: with nearly-collinear beacons, distance multilateration
// has mirror-image local minima. Seeding the solver with the last known position
// (as the reference does) must pick the correct branch; a centroid start could
// reflect across the beacon line and land tens of meters away.
func TestMultilaterationLeastSquaresLastKnownBranch(t *testing.T) {
	// Nearly-collinear beacons plus a true position well above the line.
	beacons := [][3]float64{
		{79.9, 18.7, 56.3},
		{68.0, 22.8, 63.8},
		{5.9, 20.7, 122.2},
	}
	truePos := [2]float64{123.2, 54.7}

	// Last known position drives the solver to the correct (upper) branch.
	lastKnown := &[2]float64{120.0, 50.0}
	result := MultilaterationLeastSquares(beacons, lastKnown)
	if result == nil {
		t.Fatal("expected a position with last-known initial guess")
	}
	if d := math.Hypot(result[0]-truePos[0], result[1]-truePos[1]); d > 3.0 {
		t.Fatalf("last-known init recovered position %v, expected near %v (err %.2fm)", *result, truePos, d)
	}
}

func TestMultilaterationLeastSquaresInsufficientBeacons(t *testing.T) {
	tests := []struct {
		name    string
		beacons [][3]float64
	}{
		{"zero beacons", [][3]float64{}},
		{"one beacon", [][3]float64{{0, 0, 5}}},
		{"two beacons", [][3]float64{{0, 0, 5}, {10, 0, 5}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MultilaterationLeastSquares(tt.beacons, nil)
			if result != nil {
				t.Errorf("MultilaterationLeastSquares(%q) returned non-nil, expected nil", tt.name)
			}
		})
	}
}

func TestMultilaterationLeastSquaresCollinear(t *testing.T) {
	// Three collinear beacons - may produce unreliable results
	beacons := [][3]float64{
		{0, 0, 5},
		{10, 0, 5},
		{20, 0, 15},
	}

	result := MultilaterationLeastSquares(beacons, nil)
	// Should handle gracefully (may return nil or a result)
	if result == nil {
		// Acceptable - collinear beacons can't triangulate well
		return
	}
	// If it returns a result, it should be on the line (y near 0)
	if math.Abs(result[1]) > 1.0 {
		t.Errorf("Collinear beacons produced y=%v, expected near 0", result[1])
	}
}

func TestCalculatePosition(t *testing.T) {
	// Test with nil config
	result := CalculatePosition(nil, nil, nil)
	if result == nil {
		t.Fatal("CalculatePosition should return PositionResult")
	}
	if result.Position != nil {
		t.Errorf("CalculatePosition with nil config should return nil position")
	}
	if result.Method != "none" {
		t.Errorf("Expected method 'none', got %s", result.Method)
	}

	// Test with empty beacon config
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}
	result = CalculatePosition(nil, config, nil)
	if result == nil {
		t.Fatal("CalculatePosition should return PositionResult")
	}
	if result.Position != nil {
		t.Errorf("CalculatePosition with empty beacon config should return nil position")
	}
	if result.Method != "none" {
		t.Errorf("Expected method 'none', got %s", result.Method)
	}
}

func TestCalculatePositionZeroPropagationFactorUsesSafeDefault(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:02", X: 10, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:03", X: 5, Y: 10, TXPower: -59},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 0,
		},
	}

	detected := []models.DetectedBeacon{
		{MACAddress: "AA:BB:CC:DD:EE:01", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:03", RSSI: -76},
	}

	result := CalculatePosition(detected, config, nil)
	if result == nil {
		t.Fatal("CalculatePosition should return PositionResult when signal propagation factor is zero")
	}
	if result.Position == nil {
		t.Fatal("CalculatePosition should still calculate a position using the safe default propagation factor")
	}
	if result.Method == "none" {
		t.Fatalf("expected a valid positioning method, got %s", result.Method)
	}
}

func TestCalculatePositionInsufficientBeacons(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:02", X: 10, Y: 0, TXPower: -59},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	detected := []models.DetectedBeacon{
		{MACAddress: "AA:BB:CC:DD:EE:01", RSSI: -65},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -70},
	}

	result := CalculatePosition(detected, config, nil)
	if result == nil {
		t.Fatal("CalculatePosition should return PositionResult")
	}
	// With 2 beacons, should use weighted centroid fallback
	if result.Position == nil {
		t.Errorf("CalculatePosition with 2 beacons should return position via weighted centroid")
	}
	if result.Method != "weighted-centroid" {
		t.Errorf("Expected method 'weighted-centroid' for 2 beacons, got %s", result.Method)
	}
	if result.BeaconCount != 2 {
		t.Errorf("Expected beacon count 2, got %d", result.BeaconCount)
	}
	if result.Accuracy <= 0 {
		t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
	}
	if result.Confidence <= 0 || result.Confidence > 1.0 {
		t.Errorf("Expected confidence in (0, 1], got %v", result.Confidence)
	}
}

func TestCalculatePositionNoMatchingBeacons(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	// Detected beacon doesn't match configured beacon
	detected := []models.DetectedBeacon{
		{MACAddress: "XX:YY:ZZ:WW:VV:UU", RSSI: -65},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -70},
		{MACAddress: "AA:BB:CC:DD:EE:03", RSSI: -75},
	}

	result := CalculatePosition(detected, config, nil)
	if result == nil {
		t.Fatal("CalculatePosition should return PositionResult")
	}
	if result.Position != nil {
		t.Errorf("CalculatePosition with no matching beacons should return nil position")
	}
	if result.Method != "none" {
		t.Errorf("Expected method 'none', got %s", result.Method)
	}
	if result.BeaconCount != 0 {
		t.Errorf("Expected beacon count 0, got %d", result.BeaconCount)
	}
}

func TestCalculatePositionValidMultilateration(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:02", X: 10, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:03", X: 5, Y: 10, TXPower: -59},
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	// Detected beacons at known distances from (5, 5)
	// From (0,0): distance 5 -> RSSI = -59 - 20*log10(5) ≈ -59 - 13.98 = -73
	// From (10,0): distance 5 -> RSSI ≈ -73
	// From (5,10): distance ~7.07 -> RSSI ≈ -59 - 20*log10(7.07) ≈ -59 - 17 = -76
	detected := []models.DetectedBeacon{
		{MACAddress: "AA:BB:CC:DD:EE:01", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:03", RSSI: -76},
	}

	result := CalculatePosition(detected, config, nil)
	if result == nil {
		t.Fatal("CalculatePosition returned nil for valid case")
	}
	if result.Position == nil {
		t.Fatal("Expected non-nil position")
	}
	if result.Method != "multilateration" {
		t.Errorf("Expected method 'multilateration' for 3+ beacons, got %s", result.Method)
	}
	if result.BeaconCount != 3 {
		t.Errorf("Expected beacon count 3, got %d", result.BeaconCount)
	}
	if len(result.UsedBeacons) != 3 {
		t.Errorf("Expected 3 used beacons, got %d", len(result.UsedBeacons))
	}
	if result.Accuracy <= 0 {
		t.Errorf("Expected positive accuracy, got %v", result.Accuracy)
	}
	if result.Confidence <= 0 || result.Confidence > 1.0 {
		t.Errorf("Expected confidence in (0, 1], got %v", result.Confidence)
	}

	// Should be close to (5, 5) - relaxed tolerance due to gradient descent limitations
	if math.Abs(result.Position[0]-5.0) > 1.0 {
		t.Errorf("Expected x ≈ 5.0, got %v", result.Position[0])
	}
	if math.Abs(result.Position[1]-5.0) > 3.0 {
		t.Errorf("Expected y ≈ 5.0 (within tolerance), got %v", result.Position[1])
	}
}

func TestCalculatePositionWithOutlierRejection(t *testing.T) {
	config := &models.WebUIConfig{
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:02", X: 10, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:03", X: 5, Y: 10, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:04", X: 100, Y: 100, TXPower: -59}, // Far away outlier
		},
		Settings: models.WebUISettings{
			SignalPropagationFactor: 2.0,
		},
	}

	lastPos := &[2]float64{5, 5}

	// 3 good beacons near (5,5), 1 outlier at (100,100)
	detected := []models.DetectedBeacon{
		{MACAddress: "AA:BB:CC:DD:EE:01", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -73},
		{MACAddress: "AA:BB:CC:DD:EE:03", RSSI: -76},
		{MACAddress: "AA:BB:CC:DD:EE:04", RSSI: -60}, // Strong signal but far away - outlier
	}

	result := CalculatePosition(detected, config, lastPos)
	if result == nil {
		t.Fatal("CalculatePosition returned nil")
	}
	if result.Position == nil {
		t.Fatal("Expected non-nil position")
	}
	// Should reject the outlier and use 3 good beacons for multilateration
	if result.BeaconCount != 3 {
		t.Errorf("Expected 3 beacons after outlier rejection, got %d", result.BeaconCount)
	}
	if result.Method != "multilateration" {
		t.Errorf("Expected method 'multilateration', got %s", result.Method)
	}
}

// TestCalculatePositionClampsToMapBounds verifies that a raw estimate which
// lands outside the floor plan (e.g. from inconsistent RSSI-derived distances,
// where the LM multilateration can converge far past the walls) is clamped back
// inside the configured map rectangle. The tracker is physically inside the
// room, so it must never be reported outside it.
func TestCalculatePositionClampsToMapBounds(t *testing.T) {
	config := &models.WebUIConfig{
		Map: &models.WebUIMapInfo{Name: "Indoor", Width: 20, Height: 20},
		Beacons: []models.WebUIBeaconConfig{
			{MACAddress: "AA:BB:CC:DD:EE:01", X: 0, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:02", X: 10, Y: 0, TXPower: -59},
			{MACAddress: "AA:BB:CC:DD:EE:03", X: 5, Y: 10, TXPower: -59},
		},
		Settings: models.WebUISettings{SignalPropagationFactor: 2.0},
	}

	// Equally-strong large distances (~30m) from the three beacons do not have a
	// consistent intersection inside the 20x20 map: the LM solver lands at
	// (5, 40) or (5, -20), both far outside. It must be clamped into [0,20]^2.
	detected := []models.DetectedBeacon{
		{MACAddress: "AA:BB:CC:DD:EE:01", RSSI: -89},
		{MACAddress: "AA:BB:CC:DD:EE:02", RSSI: -89},
		{MACAddress: "AA:BB:CC:DD:EE:03", RSSI: -89},
	}

	result := CalculatePosition(detected, config, nil)
	if result == nil || result.Position == nil {
		t.Fatalf("expected a non-nil clamped position, got %+v", result)
	}
	x, y := result.Position[0], result.Position[1]
	if x < 0 || x > 20 || y < 0 || y > 20 {
		t.Fatalf("position (%v, %v) is outside the 20x20 map bounds", x, y)
	}
}

func TestKalmanFilter2D(t *testing.T) {
	kf := models.NewKalmanFilter2D([2]float64{0, 0}, 1.0, 1.0)

	// Initial state
	pos := kf.GetPosition()
	if pos[0] != 0 || pos[1] != 0 {
		t.Errorf("Initial state should be (0, 0), got (%v, %v)", pos[0], pos[1])
	}

	// Update with measurement (10, 10)
	kf.Update([2]float64{10, 10})

	// State should move towards measurement
	pos = kf.GetPosition()
	if pos[0] <= 0 || pos[0] >= 10 || pos[1] <= 0 || pos[1] >= 10 {
		t.Errorf("After first update, state should be between 0 and 10, got (%v, %v)", pos[0], pos[1])
	}

	// Multiple updates should converge
	for i := 0; i < 10; i++ {
		kf.Update([2]float64{10, 10})
	}
	pos = kf.GetPosition()
	if math.Abs(pos[0]-10) > 0.1 || math.Abs(pos[1]-10) > 0.1 {
		t.Errorf("After many updates, state should converge to (10, 10), got (%v, %v)", pos[0], pos[1])
	}

	// Test reset by creating new filter
	kf2 := models.NewKalmanFilter2D([2]float64{5, 5}, 1.0, 1.0)
	pos = kf2.GetPosition()
	if pos[0] != 5 || pos[1] != 5 {
		t.Errorf("New filter at (5, 5) should have position (5, 5), got (%v, %v)", pos[0], pos[1])
	}
}
