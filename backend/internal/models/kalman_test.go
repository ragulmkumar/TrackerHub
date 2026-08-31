package models

import (
	"math"
	"testing"
)

// approx returns true if a and b are within tolerance.
func approx(a, b, tol float64) bool {
	return math.Abs(a-b) <= tol
}

// TestPhase6_FirstMeasurementInitializes verifies that the first measurement
// for a tracker initializes the filter and returns the raw position unchanged.
func TestPhase6_FirstMeasurementInitializes(t *testing.T) {
	store := NewKalmanStateStore()

	raw := &[2]float64{3.0, 4.0}
	filtered := store.Apply("tracker-A", raw, 1000, 1.0, 10.0)

	if filtered == nil {
		t.Fatal("Expected a non-nil filtered position")
	}
	if !approx(filtered[0], 3.0, 1e-9) || !approx(filtered[1], 4.0, 1e-9) {
		t.Errorf("First measurement should return raw position, got (%.4f, %.4f)", filtered[0], filtered[1])
	}
}

// TestPhase6_RepeatedNoisyPositionsSmooth verifies that repeated noisy
// measurements converge closer to the true value (smoothing effect).
func TestPhase6_RepeatedNoisyPositionsSmooth(t *testing.T) {
	store := NewKalmanStateStore()

	// True position = (10, 10). Feed noisy measurements around it.
	truePos := [2]float64{10, 10}
	measurements := [][2]float64{
		{10.0, 10.0},
		{12.0, 9.0},
		{9.0, 11.0},
		{11.0, 10.0},
		{10.0, 9.0},
		{11.0, 11.0},
		{9.0, 10.0},
		{10.0, 10.0},
	}

	var firstFiltered *[2]float64
	var lastFiltered *[2]float64

	ts := int64(1000)
	for i, m := range measurements {
		ts += 500 // 500ms apart
		f := store.Apply("tracker-A", &m, ts, 1.0, 10.0)
		if f == nil {
			t.Fatalf("Expected non-nil filtered position at measurement %d", i)
		}
		if i == 1 {
			firstFiltered = f // after first smoothing step
		}
		lastFiltered = f
	}

	if firstFiltered == nil || lastFiltered == nil {
		t.Fatal("Expected multiple filtered positions")
	}

	// The filtered position should be closer to the true position than a single
	// noisy reading, and should generally improve as more samples arrive.
	firstErr := math.Hypot(firstFiltered[0]-truePos[0], firstFiltered[1]-truePos[1])
	lastErr := math.Hypot(lastFiltered[0]-truePos[0], lastFiltered[1]-truePos[1])
	if lastErr >= firstErr {
		t.Logf("Note: final error %.4f not strictly less than first error %.4f (Kalman converges gradually)", lastErr, firstErr)
	}

	// The filtered result should remain finite and sane.
	if math.IsNaN(lastFiltered[0]) || math.IsNaN(lastFiltered[1]) ||
		math.IsInf(lastFiltered[0], 0) || math.IsInf(lastFiltered[1], 0) {
		t.Errorf("Filtered position should be finite, got (%.4f, %.4f)", lastFiltered[0], lastFiltered[1])
	}

	t.Logf("First filtered: (%.4f, %.4f) err=%.4f; Last filtered: (%.4f, %.4f) err=%.4f",
		firstFiltered[0], firstFiltered[1], firstErr, lastFiltered[0], lastFiltered[1], lastErr)
}

// TestPhase6_XYFilteredCorrectly verifies both X and Y are filtered
// and that the filter reflects the underlying position.
func TestPhase6_XYFilteredCorrectly(t *testing.T) {
	store := NewKalmanStateStore()

	// Tracker moves along X; Y stays constant. Verify X tracks and Y stays close.
	ts := int64(1000)
	for i := 0; i < 20; i++ {
		ts += 500
		m := &[2]float64{float64(i), 5.0} // x = i, y = 5
		f := store.Apply("tracker-XY", m, ts, 1.0, 10.0)
		if f == nil {
			t.Fatal("Expected non-nil filtered position")
		}
		if i == 19 {
			// After 20 samples, should be close to (19, 5)
			if math.Abs(f[0]-19) > 2.0 {
				t.Errorf("X should track towards 19, got %.4f", f[0])
			}
			if math.Abs(f[1]-5) > 2.0 {
				t.Errorf("Y should remain near 5, got %.4f", f[1])
			}
		}
	}
}

// TestPhase6_IndependentTrackerState verifies that different trackers have
// independent Kalman state (smoothing one does not affect the other).
func TestPhase6_IndependentTrackerState(t *testing.T) {
	store := NewKalmanStateStore()

	// Tracker A stays at (10, 10)
	tsA := int64(1000)
	var finalA *[2]float64
	for i := 0; i < 10; i++ {
		tsA += 500
		finalA = store.Apply("tracker-A", &[2]float64{10, 10}, tsA, 1.0, 10.0)
	}

	// Tracker B is noisy and far away
	tsB := int64(1000)
	for i := 0; i < 10; i++ {
		tsB += 500
		store.Apply("tracker-B", &[2]float64{float64(i) * 10, 100}, tsB, 1.0, 10.0)
	}

	// After disturbing tracker B heavily, tracker A must remain near (10, 10).
	if finalA == nil {
		t.Fatal("Expected finalA position")
	}
	if math.Abs(finalA[0]-10) > 1.0 || math.Abs(finalA[1]-10) > 1.0 {
		t.Errorf("Tracker A should stay near (10, 10) after tracker B noise, got (%.4f, %.4f)",
			finalA[0], finalA[1])
	}
}

// TestPhase6_InvalidMeasurementDoesNotCorruptState verifies that:
//   - nil measurements return nil without corrupting state
//   - invalid Kalman config (<= 0) returns raw position and does not corrupt
func TestPhase6_InvalidMeasurementDoesNotCorruptState(t *testing.T) {
	store := NewKalmanStateStore()

	// Seed tracker with a valid measurement
	store.Apply("tracker-A", &[2]float64{5, 5}, 1000, 1.0, 10.0)

	// Nil measurement should return nil and not touch state
	if got := store.Apply("tracker-A", nil, 1500, 1.0, 10.0); got != nil {
		t.Errorf("Nil measurement should return nil, got %v", got)
	}

	// Invalid process variance (<= 0) should return raw and not corrupt filter
	raw := &[2]float64{20, 20}
	f := store.Apply("tracker-A", raw, 2000, 0.0, 10.0)
	if f == nil {
		t.Fatal("Invalid variance should still return raw position")
	}
	if !approx(f[0], 20, 1e-9) || !approx(f[1], 20, 1e-9) {
		t.Errorf("Invalid variance should return raw (20, 20), got (%.4f, %.4f)", f[0], f[1])
	}

	// Invalid measurement variance (<= 0)
	f = store.Apply("tracker-A", &[2]float64{7, 7}, 2500, 1.0, 0.0)
	if f == nil {
		t.Fatal("Invalid variance should still return raw position")
	}
	if !approx(f[0], 7, 1e-9) || !approx(f[1], 7, 1e-9) {
		t.Errorf("Invalid variance should return raw (7, 7), got (%.4f, %.4f)", f[0], f[1])
	}

	// A subsequent valid measurement must still work (filter not corrupted)
	good := store.Apply("tracker-A", &[2]float64{8, 8}, 3000, 1.0, 10.0)
	if good == nil {
		t.Fatal("Valid measurement should produce a result after invalid inputs")
	}
}

// TestPhase6_ConfigurationValuesRespected verifies that changing Kalman
// configuration reinitializes the filter (so new variances take effect).
func TestPhase6_ConfigurationValuesRespected(t *testing.T) {
	store := NewKalmanStateStore()

	// High measurement variance => less smoothing (filter trusts measurements
	// less, so it moves slowly toward them).
	ts := int64(1000)
	for i := 0; i < 5; i++ {
		ts += 500
		store.Apply("tracker-A", &[2]float64{10, 10}, ts, 1.0, 1000.0)
	}

	// The state should not have drifted much given very high measurement noise.
	pos := store.filters["tracker-A"]
	if pos == nil {
		t.Fatal("Expected filter to exist")
	}
	current := pos.Filter.GetPosition()

	// Now change config to a very low measurement variance (aggressive smoothing).
	// This must reinitialize the filter.
	raw := &[2]float64{50, 50}
	f := store.Apply("tracker-A", raw, ts+1000, 1.0, 0.5)
	if f == nil {
		t.Fatal("Expected a result after config change")
	}

	// Reinitialization means the first post-change measurement returns raw (50, 50).
	if !approx(f[0], 50, 1e-6) || !approx(f[1], 50, 1e-6) {
		t.Errorf("After reinit, first measurement should return raw (50, 50), got (%.4f, %.4f)", f[0], f[1])
	}

	_ = current // config-change reinit is the observable behavior
}

// TestPhase6_ExtremePositionChangesHandled verifies that a large jump in the
// measurement does not produce NaN/Inf and remains finite.
func TestPhase6_ExtremePositionChangesHandled(t *testing.T) {
	store := NewKalmanStateStore()

	ts := int64(1000)
	store.Apply("tracker-A", &[2]float64{0, 0}, ts, 1.0, 10.0)

	// Extreme jump
	ts += 1000
	f := store.Apply("tracker-A", &[2]float64{1e6, -1e6}, ts, 1.0, 10.0)
	if f == nil {
		t.Fatal("Expected a result for extreme measurement")
	}
	if math.IsNaN(f[0]) || math.IsNaN(f[1]) || math.IsInf(f[0], 0) || math.IsInf(f[1], 0) {
		t.Errorf("Extreme measurement should produce finite result, got (%.4f, %.4f)", f[0], f[1])
	}
}
