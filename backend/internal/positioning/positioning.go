package positioning

import (
	"math"

	"trackerHub/backend/internal/models"
)

// CalculateDistance estimates distance based on RSSI using the Log-distance path loss model
func CalculateDistance(RSSI int, txPower int, n float64) float64 {
	if RSSI == 0 {
		return -1.0 // Unable to determine distance
	}
	// Formula: distance = 10^((txPower - RSSI) / (10 * n))
	exponent := float64(txPower-RSSI) / (10 * n)
	if exponent > 10 { // Avoid potential overflow for very weak signals
		return 10000.0 // Return a large distance
	}
	return math.Pow(10, exponent)
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

// CalculatePosition calculates position from detected beacons and web UI config using least squares multilateration
func CalculatePosition(detectedBeacons []models.DetectedBeacon, webUIConfig *models.WebUIConfig, lastKnownPosition *[2]float64) *[2]float64 {
	if webUIConfig == nil || len(webUIConfig.Beacons) == 0 {
		return nil
	}

	var beaconsWithCoordsDist [][3]float64
	n := webUIConfig.Settings.SignalPropagationFactor

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

	// Need at least 3 beacons for multilateration
	if len(beaconsWithCoordsDist) < 3 {
		return nil
	}

	// Perform multilateration using least squares
	return MultilaterationLeastSquares(beaconsWithCoordsDist, lastKnownPosition)
}
