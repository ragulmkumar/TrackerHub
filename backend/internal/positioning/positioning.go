package positioning

import (
	"log"
	"math"

	"trackerHub/backend/internal/models"
)

// PositionResult contains the calculated position along with accuracy/confidence metrics
type PositionResult struct {
	Position    *[2]float64
	Accuracy    float64                 // Estimated accuracy in meters (lower is better)
	Confidence  float64                 // Confidence level 0.0-1.0 (higher is better)
	Method      string                  // "multilateration" or "weighted-centroid"
	BeaconCount int                     // Number of beacons used in calculation
	UsedBeacons []models.DetectedBeacon // The detected beacons actually accepted into the calculation
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

// clampToMapBounds clamps a position so it stays inside the configured map
// rectangle [0, width] x [0, height]. Real beacons are placed within the floor
// plan, so a tracker that is physically in the room should never be reported
// outside it — RSSI noise and Kalman velocity overshoot can otherwise push the
// estimate past the walls. Guard each dimension against a non-positive size.
func clampToMapBounds(pos [2]float64, width, height float64) [2]float64 {
	if width > 0 {
		pos[0] = math.Max(0, math.Min(width, pos[0]))
	}
	if height > 0 {
		pos[1] = math.Max(0, math.Min(height, pos[1]))
	}
	return pos
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

	// Solve the nonlinear least-squares problem with Levenberg-Marquardt.
	// This matches the reference project, which uses scipy.optimize.least_squares
	// with method='lm'. The previous implementation used a fixed-learning-rate
	// gradient descent with a numerical gradient, which is not robust: across
	// varying beacon geometries it can stall or diverge by tens of meters from
	// the correct position. LM uses the analytic Jacobian and an adaptive damping
	// factor, so it converges reliably for the ill-conditioned real-world cases
	// that fixed-step gradient descent gets wrong.
	lambda := 1e-3
	maxIterations := 100
	for iter := 0; iter < maxIterations; iter++ {
		// Build the analytic Jacobian (JtJ and Jtf) and current cost.
		var JtJ [2][2]float64
		var Jtf [2]float64
		var cost float64
		for i, beacon := range beaconCoords {
			dx := pos[0] - beacon[0]
			dy := pos[1] - beacon[1]
			est := math.Sqrt(dx*dx + dy*dy)
			if est < 1e-9 {
				est = 1e-9 // avoid div-by-zero right on top of a beacon
			}
			ji0 := dx / est
			ji1 := dy / est
			f := est - distances[i]
			cost += f * f
			JtJ[0][0] += ji0 * ji0
			JtJ[0][1] += ji0 * ji1
			JtJ[1][0] += ji1 * ji0
			JtJ[1][1] += ji1 * ji1
			Jtf[0] += ji0 * f
			Jtf[1] += ji1 * f
		}

		// Solve (JtJ + lambda*I) * dp = -Jtf, accepting a step only when it
		// reduces the cost; otherwise grow lambda (more gradient-descent-like).
		accepted := false
		for trial := 0; trial < 30; trial++ {
			a := JtJ[0][0] + lambda
			b := JtJ[0][1]
			c := JtJ[1][0]
			d := JtJ[1][1] + lambda
			det := a*d - b*c
			if math.Abs(det) < 1e-12 {
				lambda *= 10
				continue
			}
			dp0 := (-Jtf[0]*d + Jtf[1]*b) / det
			dp1 := (Jtf[0]*c - Jtf[1]*a) / det

			// Small step means we have converged.
			if math.Hypot(dp0, dp1) < 1e-6 {
				return &pos
			}

			qx := pos[0] + dp0
			qy := pos[1] + dp1
			var newCost float64
			for i, beacon := range beaconCoords {
				dx := qx - beacon[0]
				dy := qy - beacon[1]
				e := math.Sqrt(dx*dx + dy*dy)
				f := e - distances[i]
				newCost += f * f
			}
			if newCost < cost {
				pos[0] = qx
				pos[1] = qy
				lambda *= 0.5
				accepted = true
				break
			}
			lambda *= 10
		}

		if !accepted {
			// No step reduced the cost — we have converged to a local optimum.
			break
		}
	}

	return &pos
}

// weightedBeaconSeed returns a distance-weighted centroid of the beacons: closer
// beacons (smaller measured distance) dominate. Unlike the plain centroid, which
// ignores range entirely, this nudges the seed toward where the tracker most
// likely is. For strongly inhomogeneous distances the plain centroid can sit far
// from the truth and let the solver land on the wrong mirror branch, so this is
// a much better start when no last-known position is available.
func weightedBeaconSeed(beaconsWithDist [][3]float64) [2]float64 {
	var sx, sy, sw float64
	for _, b := range beaconsWithDist {
		w := 1.0 / (b[2]*b[2] + 1e-3)
		sx += b[0] * w
		sy += b[1] * w
		sw += w
	}
	if sw == 0 {
		return [2]float64{}
	}
	return [2]float64{sx / sw, sy / sw}
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
	var usedBeacons []models.DetectedBeacon
	// Signal propagation exponent for the log-distance path-loss model.
	// The reference project uses 2.8 for typical indoor BLE environments.
	// A value of 0 means "not calibrated" — fall back to the reference default
	// rather than 2.0, which systematically overestimates distances and pushes
	// the multilateration solver to wrong positions.
	n := webUIConfig.Settings.SignalPropagationFactor
	if n <= 0 || math.IsNaN(n) || math.IsInf(n, 0) {
		n = 2.8
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
				usedBeacons = append(usedBeacons, detected)
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

	// Map bounds for clamping the final estimate. Trackers live inside the floor
	// plan, so we keep the estimate within its walls regardless of how noisy the
	// RSSI-derived distances are.
	mapWidth, mapHeight := 0.0, 0.0
	if webUIConfig.Map != nil {
		mapWidth = webUIConfig.Map.Width
		mapHeight = webUIConfig.Map.Height
	}

	// Diagnostic: compare beacon spread against declared map size. If the map
	// is declared much larger than the actual beacon geometry, multilateration
	// will produce wrong positions because RSSI-derived distances (real meters)
	// don't match the inflated coordinate space.
	if len(beaconsWithCoordsDist) >= 2 && mapWidth > 0 && mapHeight > 0 {
		var minX, maxX, minY, maxY float64
		minX, minY = beaconsWithCoordsDist[0][0], beaconsWithCoordsDist[0][1]
		maxX, maxY = minX, minY
		for _, b := range beaconsWithCoordsDist {
			if b[0] < minX {
				minX = b[0]
			}
			if b[0] > maxX {
				maxX = b[0]
			}
			if b[1] < minY {
				minY = b[1]
			}
			if b[1] > maxY {
				maxY = b[1]
			}
		}
		beaconSpreadX := maxX - minX
		beaconSpreadY := maxY - minY
		// If the beacon geometry spans less than 25% of the declared map in
		// either axis, the map dimensions are likely oversized relative to the
		// real room — positions will be systematically wrong.
		if (mapWidth > 0 && beaconSpreadX < mapWidth*0.25) ||
			(mapHeight > 0 && beaconSpreadY < mapHeight*0.25) {
			log.Printf("[positioning] WARNING: beacon spread (%.1f×%.1f m) is much "+
				"smaller than declared map (%.0f×%.0f m). If the map width/height "+
				"does not match the real room size, positions will be inaccurate. "+
				"Check map dimensions in the Configuration page.",
				beaconSpreadX, beaconSpreadY, mapWidth, mapHeight)
		}
	}

	// Outlier rejection based on last known position
	beaconsWithCoordsDist = RejectOutliers(beaconsWithCoordsDist, lastKnownPosition, 50.0) // 50m max jump

	// If we still have >=3 beacons after outlier rejection, use multilateration.
	// Seed the solver with the last-known position when we have one; otherwise
	// use a distance-weighted centroid, which measurably beats the plain centroid
	// (it biases the start toward the near, most reliable beacons).
	if len(beaconsWithCoordsDist) >= 3 {
		seed := lastKnownPosition
		var weightedSeed [2]float64
		if seed == nil {
			weightedSeed = weightedBeaconSeed(beaconsWithCoordsDist)
			seed = &weightedSeed
		}
		pos := MultilaterationLeastSquares(beaconsWithCoordsDist, seed)
		if pos != nil {
			clamped := clampToMapBounds(*pos, mapWidth, mapHeight)
			pos = &clamped
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
				UsedBeacons: usedBeacons,
			}
		}
	}

	// Fallback to weighted centroid for 1-2 beacons (or if multilateration failed)
	pos, accuracy := WeightedCentroid(beaconsWithCoordsDist)
	if pos != nil {
		clamped := clampToMapBounds(*pos, mapWidth, mapHeight)
		pos = &clamped
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
			UsedBeacons: usedBeacons,
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
