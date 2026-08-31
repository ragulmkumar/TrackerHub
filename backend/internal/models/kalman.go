package models

// KalmanFilter2D implements a simple 2D Kalman filter assuming constant velocity
type KalmanFilter2D struct {
	// State vector [x, y, vx, vy]
	State [4]float64
	// State covariance matrix
	P [4][4]float64
	// Measurement matrix H (maps state to measurement space [x, y])
	H [2][4]float64
	// Measurement noise covariance R
	R [2][2]float64
	// Process noise covariance Q
	Q [4][4]float64
	// State transition matrix F (updated in predict)
	F [4][4]float64
	// Identity matrix
	I [4][4]float64
	// Time of last update
	LastUpdateTime float64
}

// NewKalmanFilter2D creates a new 2D Kalman filter
func NewKalmanFilter2D(initialPos [2]float64, processVariance, measurementVariance float64) *KalmanFilter2D {
	kf := &KalmanFilter2D{}

	// Initialize state vector [x, y, vx, vy] - Initialize velocity to 0
	kf.State[0] = initialPos[0]
	kf.State[1] = initialPos[1]
	kf.State[2] = 0
	kf.State[3] = 0

	// Initialize state covariance matrix P - Initial uncertainty
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			if i == j {
				kf.P[i][j] = 100.0 // Large initial uncertainty
			} else {
				kf.P[i][j] = 0
			}
		}
	}

	// Measurement matrix H (maps state to measurement space [x, y])
	kf.H[0][0] = 1
	kf.H[0][1] = 0
	kf.H[0][2] = 0
	kf.H[0][3] = 0
	kf.H[1][0] = 0
	kf.H[1][1] = 1
	kf.H[1][2] = 0
	kf.H[1][3] = 0

	// Measurement noise covariance R
	kf.R[0][0] = measurementVariance
	kf.R[0][1] = 0
	kf.R[1][0] = 0
	kf.R[1][1] = measurementVariance

	// Process noise covariance Q
	kf.Q[0][0] = processVariance
	kf.Q[0][1] = 0
	kf.Q[0][2] = 0
	kf.Q[0][3] = 0
	kf.Q[1][0] = 0
	kf.Q[1][1] = processVariance
	kf.Q[1][2] = 0
	kf.Q[1][3] = 0
	kf.Q[2][0] = 0
	kf.Q[2][1] = 0
	kf.Q[2][2] = processVariance
	kf.Q[2][3] = 0
	kf.Q[3][0] = 0
	kf.Q[3][1] = 0
	kf.Q[3][2] = 0
	kf.Q[3][3] = processVariance

	// State transition matrix F (will be updated in predict)
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			if i == j {
				kf.F[i][j] = 1
			} else {
				kf.F[i][j] = 0
			}
		}
	}

	// Identity matrix
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			if i == j {
				kf.I[i][j] = 1
			} else {
				kf.I[i][j] = 0
			}
		}
	}

	kf.LastUpdateTime = 0

	return kf
}

// Predict predicts the next state based on the time delta dt
func (kf *KalmanFilter2D) Predict(dt float64) {
	// Update state transition matrix F for time dt
	kf.F[0][2] = dt
	kf.F[1][3] = dt

	// Predict state: x_k = F * x_{k-1}
	var predictedState [4]float64
	for i := 0; i < 4; i++ {
		predictedState[i] = 0
		for j := 0; j < 4; j++ {
			predictedState[i] += kf.F[i][j] * kf.State[j]
		}
	}
	copy(kf.State[:], predictedState[:])

	// Predict state covariance: P_k = F * P_{k-1} * F^T + Q
	var predictedP [4][4]float64
	var FT [4][4]float64

	// Calculate F^T
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			FT[i][j] = kf.F[j][i]
		}
	}

	// Calculate F * P
	var FP [4][4]float64
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			FP[i][j] = 0
			for k := 0; k < 4; k++ {
				FP[i][j] += kf.F[i][k] * kf.P[k][j]
			}
		}
	}

	// Calculate F * P * F^T
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			predictedP[i][j] = 0
			for k := 0; k < 4; k++ {
				predictedP[i][j] += FP[i][k] * FT[k][j]
			}
		}
	}

	// Add Q
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			predictedP[i][j] += kf.Q[i][j]
		}
	}

	copy(kf.P[:], predictedP[:])
}

// Update updates the state based on the measurement [x, y]
func (kf *KalmanFilter2D) Update(measurement [2]float64) bool {
	// z = measurement vector
	z := [2]float64{measurement[0], measurement[1]}

	// Measurement residual (innovation): y = z - H * x_k
	var Hx [2]float64
	for i := 0; i < 2; i++ {
		Hx[i] = 0
		for j := 0; j < 4; j++ {
			Hx[i] += kf.H[i][j] * kf.State[j]
		}
	}

	var y [2]float64
	y[0] = z[0] - Hx[0]
	y[1] = z[1] - Hx[1]

	// Residual covariance: S = H * P_k * H^T + R
	var HPHt [2][2]float64
	var HT [4][2]float64

	// Calculate H^T
	for i := 0; i < 4; i++ {
		for j := 0; j < 2; j++ {
			HT[i][j] = kf.H[j][i]
		}
	}

	// Calculate H * P
	var HP [2][4]float64
	for i := 0; i < 2; i++ {
		for j := 0; j < 4; j++ {
			HP[i][j] = 0
			for k := 0; k < 4; k++ {
				HP[i][j] += kf.H[i][k] * kf.P[k][j]
			}
		}
	}

	// Calculate H * P * H^T
	for i := 0; i < 2; i++ {
		for j := 0; j < 2; j++ {
			HPHt[i][j] = 0
			for k := 0; k < 4; k++ {
				HPHt[i][j] += HP[i][k] * HT[k][j]
			}
		}
	}

	// Add R to get S
	var S [2][2]float64
	for i := 0; i < 2; i++ {
		for j := 0; j < 2; j++ {
			S[i][j] = HPHt[i][j] + kf.R[i][j]
		}
	}

	// Kalman gain: K = P_k * H^T * S^{-1}
	var SInverse [2][2]float64
	detS := S[0][0]*S[1][1] - S[0][1]*S[1][0]
	if (detS < 0 && -detS < 1e-10) || (detS > 0 && detS < 1e-10) {
		// Matrix is singular, cannot invert
		return false
	}
	SInverse[0][0] = S[1][1] / detS
	SInverse[0][1] = -S[0][1] / detS
	SInverse[1][0] = -S[1][0] / detS
	SInverse[1][1] = S[0][0] / detS

	var PHt [4][2]float64
	var K [4][2]float64

	// Calculate P * H^T
	for i := 0; i < 4; i++ {
		for j := 0; j < 2; j++ {
			PHt[i][j] = 0
			for k := 0; k < 4; k++ {
				PHt[i][j] += kf.P[i][k] * HT[k][j]
			}
		}
	}

	// Calculate K = P * H^T * S^{-1}
	for i := 0; i < 4; i++ {
		for j := 0; j < 2; j++ {
			K[i][j] = 0
			for k := 0; k < 2; k++ {
				K[i][j] += PHt[i][k] * SInverse[k][j]
			}
		}
	}

	// Update state estimate: x_k = x_k + K * y
	var Ky [4]float64
	for i := 0; i < 4; i++ {
		Ky[i] = 0
		for j := 0; j < 2; j++ {
			Ky[i] += K[i][j] * y[j]
		}
	}

	for i := 0; i < 4; i++ {
		kf.State[i] += Ky[i]
	}

	// Update state covariance: P_k = (I - K * H) * P_k
	var KH [4][4]float64
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			KH[i][j] = 0
			for k := 0; k < 2; k++ {
				KH[i][j] += K[i][k] * kf.H[k][j]
			}
		}
	}

	var I_KH [4][4]float64
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			I_KH[i][j] = kf.I[i][j] - KH[i][j]
		}
	}

	var newP [4][4]float64
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			newP[i][j] = 0
			for k := 0; k < 4; k++ {
				newP[i][j] += I_KH[i][k] * kf.P[k][j]
			}
		}
	}

	copy(kf.P[:], newP[:])

	kf.LastUpdateTime = 0 // Will be set by caller if needed
	return true
}

// GetPosition returns the filtered position (x, y)
func (kf *KalmanFilter2D) GetPosition() [2]float64 {
	return [2]float64{kf.State[0], kf.State[1]}
}

// GetVelocity returns the filtered velocity (vx, vy)
func (kf *KalmanFilter2D) GetVelocity() [2]float64 {
	return [2]float64{kf.State[2], kf.State[3]}
}

// KalmanStateStore manages per-tracker Kalman filters, ensuring each tracker
// has its own independent filter state and that configuration changes trigger
// a safe reinitialization. It is safe for concurrent use by a single goroutine
// (the MQTT message handler). Methods do not block and rely on the caller to
// serialize access.
type KalmanStateStore struct {
	filters map[string]*KalmanFilterState
}

// NewKalmanStateStore creates an empty per-tracker Kalman store.
func NewKalmanStateStore() *KalmanStateStore {
	return &KalmanStateStore{filters: make(map[string]*KalmanFilterState)}
}

// Apply runs the Kalman update for a single tracker given a raw measurement and
// returns the filtered position. It returns the raw measurement unchanged when:
//   - the measurement is empty/nil
//   - process or measurement variance is invalid (<= 0)
//   - the filter update fails (singular matrix / degenerate state)
//
// The first measurement for a tracker initializes its filter with the raw
// position (no smoothing yet). Subsequent measurements are smoothed.
func (s *KalmanStateStore) Apply(trackerID string, raw *[2]float64, timestamp int64, processVariance, measurementVariance float64) *[2]float64 {
	if raw == nil {
		return nil
	}
	if processVariance <= 0 || measurementVariance <= 0 {
		// Invalid Kalman parameters — fall back to raw position
		return raw
	}

	kfState, exists := s.filters[trackerID]

	// Reinitialize when Kalman configuration changes
	if exists && (kfState.ProcessVariance != processVariance || kfState.MeasurementVariance != measurementVariance) {
		exists = false
		delete(s.filters, trackerID)
	}

	if !exists {
		// First measurement — initialize filter with raw position
		kf := NewKalmanFilter2D(*raw, processVariance, measurementVariance)
		kf.Update(*raw)
		s.filters[trackerID] = &KalmanFilterState{
			Filter:              kf,
			LastTimestamp:       timestamp,
			ProcessVariance:     processVariance,
			MeasurementVariance: measurementVariance,
		}
		// First measurement returns the raw position (no smoothing history)
		return raw
	}

	// Subsequent measurement — predict, then update
	dtSec := float64(timestamp-kfState.LastTimestamp) / 1000.0
	if dtSec < 0.01 {
		dtSec = 0.01 // clamp tiny/negative deltas
	}
	if dtSec > 300 {
		dtSec = 300 // cap stale-tracker prediction
	}

	kfState.Filter.Predict(dtSec)
	updated := kfState.Filter.Update(*raw)
	kfState.LastTimestamp = timestamp
	if !updated {
		// Filter update failed (singular matrix etc.) — fall back to raw
		return raw
	}

	filtered := kfState.Filter.GetPosition()
	return &filtered
}
