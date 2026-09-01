package positioning

import (
	"math"

	"trackerHub/backend/internal/models"
)

// PositionResult contains the calculated position along with accuracy/confidence metrics
type PositionResult struct {
	Position    *[2]float64
	Accuracy    float64 // Estimated accuracy in meters (lower is better)
	Confidence  float64 // Confidence level 0.0-1.0 (higher is better)
	Method      string  // "multilateration" or "weighted-centroid"
	BeaconCount int     // Number of beacons used in calculation
}

// CalculateDistance estimates distance based on RSSI using the Log-distance path loss model
func CalculateDistance(RSSI int, txPower int, n float64) float64 {
	if RSSI == 0 {
		return -1.0 // Unable to determine distance
	}
	if n <= 0 || math.IsNaN(n) || math.IsInf(n, 0) {
		n = 2.0
	}
	// Formula: distance = 10^((txPower - RSSI) / (10 * n))
	exponent := float64(txPower-RSSI) / (10 * n)
	if exponent > 10 { // Avoid potential overflow for very weak signals
		return 10000.0 // Return a large distance
	}
	return math.Pow(10, exponent)
}

// WeightedCentroid calculates position using weighted centroid based on signal strength
// Used as fallback when <3 beacons are available
func WeightedCentroid(beaconsWithDist [][3]float64) (*[2]float64, float64) {
	if len(beaconsWithDist) == 0 {
		return nil, 0.0
	}

	var weightedX, weightedY, totalWeight float64

	for _, b := range beaconsWithDist {
		// Weight by inverse of distance (closer beacons have more influence)
		// Add small epsilon to avoid division by zero
		weight := 1.0 / (b[2] + 0.1)
		weightedX += b[0] * weight
		weightedY += b[1] * weight
		totalWeight += weight
	}

	if totalWeight == 0 {
		return nil, 0.0
	}

	pos := &[2]float64{
		weightedX / totalWeight,
		weightedY / totalWeight,
	}

	// Accuracy estimate: weighted average distance to beacons
	var weightedDistSum float64
	for _, b := range beaconsWithDist {
		dx := pos[0] - b[0]
		dy := pos[1] - b[1]
		dist := math.Sqrt(dx*dx + dy*dy)
		weightedDistSum += dist * (1.0 / (b[2] + 0.1))
	}
	accuracy := weightedDistSum / totalWeight

	// For single beacon, accuracy should be the estimated distance to that beacon
	// (since the position equals the beacon position, distance is 0, which is wrong)
	if len(beaconsWithDist) == 1 {
		accuracy = beaconsWithDist[0][2]
	}

	return pos, accuracy
}

// RejectOutliers removes beacons with implausible RSSI values that would cause position jumps
func RejectOutliers(beaconsWithDist [][3]float64, lastKnownPosition *[2]float64, maxJumpDistance float64) [][3]float64 {
	if lastKnownPosition == nil || len(beaconsWithDist) == 0 {
		return beaconsWithDist
	}

	var filtered [][3]float64
	for _, b := range beaconsWithDist {
		dx := b[0] - lastKnownPosition[0]
		dy := b[1] - lastKnownPosition[1]
		dist := math.Sqrt(dx*dx + dy*dy)

		// Keep beacon if it's within reasonable distance of last known position
		// or if we don't have a last known position to compare against
		if dist <= maxJumpDistance {
			filtered = append(filtered, b)
		}
	}

	// If we filtered out everything, return original (better than nothing)
	if len(filtered) == 0 {
		return beaconsWithDist
	}

	return filtered
}

// MultilaterationLeastSquares calculates position using least squares optimization based on distances to known beacon coordinates
func MultilaterationLeastSquares(beaconsWithDist [][3]float64, initialGuess *[2]float64) *[2]float64 {
	if len(beaconsWithDist) < 3 {
		// Not enough beacons for multilateration
		return nil
	}

	// Convert to arrays for easier math
	var beaconCoords [][2]float64
	var distances []float64
	for _, b := range beaconsWithDist {
		beaconCoords = append(beaconCoords, [2]float64{b[0], b[1]})
		distances = append(distances, b[2])
	}

	// Define error function: difference between measured and estimated distances
	errorFunc := func(pos [2]float64) []float64 {
		var errors []float64
		for i, beacon := range beaconCoords {
			// Calculate Euclidean distance from estimated position to beacon
			dx := pos[0] - beacon[0]
			dy := pos[1] - beacon[1]
			estimatedDist := math.Sqrt(dx*dx + dy*dy)
			// Error is measured distance minus estimated distance
			errors = append(errors, distances[i]-estimatedDist)
		}
		return errors
	}

	// Initial guess
	var pos [2]float64
	if initialGuess != nil {
		pos = *initialGuess
	} else {
		// Use centroid of beacons as initial guess
		for _, beacon := range beaconCoords {
			pos[0] += beacon[0]
			pos[1] += beacon[1]
		}
		pos[0] /= float64(len(beaconCoords))
		pos[1] /= float64(len(beaconCoords))
	}

	// Simple gradient descent (for demonstration - in practice use LM or similar)
	learningRate := 0.01
	maxIterations := 1000
	tolerance := 1e-6

	for iter := 0; iter < maxIterations; iter++ {
		// Calculate error
		errors := errorFunc(pos)

		// Calculate sum of squared errors
		var sumSqErr float64
		for _, e := range errors {
			sumSqErr += e * e
		}

		// Check for convergence
		if math.Sqrt(sumSqErr) < tolerance {
			break
		}

		// Calculate gradient (numerical approximation)
		var grad [2]float64
		epsilon := 1e-6
		for i := 0; i < 2; i++ {
			posPlus := pos
			posPlus[i] += epsilon
			errorsPlus := errorFunc(posPlus)
			var sumSqErrPlus float64
			for _, e := range errorsPlus {
				sumSqErrPlus += e * e
			}
			grad[i] = (sumSqErrPlus - sumSqErr) / epsilon
		}

		// Update position
		pos[0] -= learningRate * grad[0]
		pos[1] -= learningRate * grad[1]
	}

	return &pos
}

// CalculatePosition calculates position from detected beacons and web UI config
// Returns PositionResult with position, accuracy, confidence, method, and beacon count
func CalculatePosition(detectedBeacons []models.DetectedBeacon, webUIConfig *models.WebUIConfig, lastKnownPosition *[2]float64) *PositionResult {
	if webUIConfig == nil || len(webUIConfig.Beacons) == 0 {
		return &PositionResult{
			Position:    nil,
			Accuracy:    0.0,
			Confidence:  0.0,
			Method:      "none",
			BeaconCount: 0,
		}
	}

	var beaconsWithCoordsDist [][3]float64
	n := webUIConfig.Settings.SignalPropagationFactor
	if n <= 0 || math.IsNaN(n) || math.IsInf(n, 0) {
		n = 2.0
	}

	// Create a map of beacons for quick lookup by MAC address
	beaconMap := make(map[string]*models.WebUIBeaconConfig)
	for i := range webUIConfig.Beacons {
		if webUIConfig.Beacons[i].MACAddress != "" {
			beaconMap[webUIConfig.Beacons[i].MACAddress] = &webUIConfig.Beacons[i]
		}
	}

	// Process each detected beacon
	for _, detected := range detectedBeacons {
		if detected.MACAddress == "" {
			// Skip beacons without MAC address
			continue
		}

		// Find matching beacon in configuration
		if cfgBeacon, exists := beaconMap[detected.MACAddress]; exists {
			if cfgBeacon.TXPower == 0 {
				// Skip beacons with invalid TX power
				continue
			}

			// Validate RSSI range
			if detected.RSSI > 0 || detected.RSSI < -120 {
				// Ignore implausible RSSI values
				continue
			}

			// Calculate distance
			distance := CalculateDistance(detected.RSSI, cfgBeacon.TXPower, n)
			if distance > 0.1 && distance < 100 {
				// Valid distance measurement
				beaconsWithCoordsDist = append(beaconsWithCoordsDist, [3]float64{
					cfgBeacon.X,
					cfgBeacon.Y,
					distance,
				})
			}
			// else: ignore invalid distance
		}
		// else: beacon not found in configuration, ignore
	}

	// No valid beacons at all
	if len(beaconsWithCoordsDist) == 0 {
		return &PositionResult{
			Position:    nil,
			Accuracy:    0.0,
			Confidence:  0.0,
			Method:      "none",
			BeaconCount: 0,
		}
	}

	// Outlier rejection based on last known position
	beaconsWithCoordsDist = RejectOutliers(beaconsWithCoordsDist, lastKnownPosition, 50.0) // 50m max jump

	// If we still have >=3 beacons after outlier rejection, use multilateration
	if len(beaconsWithCoordsDist) >= 3 {
		pos := MultilaterationLeastSquares(beaconsWithCoordsDist, lastKnownPosition)
		if pos != nil {
			// Calculate accuracy as RMS error of distances
			var sumSqError float64
			for _, b := range beaconsWithCoordsDist {
				dx := pos[0] - b[0]
				dy := pos[1] - b[1]
				estimatedDist := math.Sqrt(dx*dx + dy*dy)
				error := b[2] - estimatedDist
				sumSqError += error * error
			}
			accuracy := math.Sqrt(sumSqError / float64(len(beaconsWithCoordsDist)))
			confidence := math.Max(0.0, math.Min(1.0, 1.0-accuracy/20.0)) // Confidence based on accuracy

			return &PositionResult{
				Position:    pos,
				Accuracy:    accuracy,
				Confidence:  confidence,
				Method:      "multilateration",
				BeaconCount: len(beaconsWithCoordsDist),
			}
		}
	}

	// Fallback to weighted centroid for 1-2 beacons (or if multilateration failed)
	pos, accuracy := WeightedCentroid(beaconsWithCoordsDist)
	if pos != nil {
		// Lower confidence for weighted centroid: penalize based on beacon count and accuracy
		// With 1 beacon, max confidence ~0.6; with 2 beacons, max ~0.75
		beaconFactor := 0.5 + 0.25*float64(len(beaconsWithCoordsDist)) // 0.5 for 1, 0.75 for 2
		accuracyFactor := math.Max(0.0, math.Min(1.0, 1.0-accuracy/20.0))
		confidence := math.Max(0.0, math.Min(1.0, beaconFactor*accuracyFactor))

		return &PositionResult{
			Position:    pos,
			Accuracy:    accuracy,
			Confidence:  confidence,
			Method:      "weighted-centroid",
			BeaconCount: len(beaconsWithCoordsDist),
		}
	}

	// Should not reach here, but just in case
	return &PositionResult{
		Position:    nil,
		Accuracy:    0.0,
		Confidence:  0.0,
		Method:      "none",
		BeaconCount: len(beaconsWithCoordsDist),
	}
}
