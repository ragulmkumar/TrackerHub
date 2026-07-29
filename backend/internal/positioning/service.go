package positioning

import (
	"trackerHub/backend/internal/models"
)

// PositioningService handles position calculation logic
type PositioningService struct{}

// NewPositioningService creates a new positioning service
func NewPositioningService() *PositioningService {
	return &PositioningService{}
}

// CalculatePosition calculates position from detected beacons and web UI config
func (s *PositioningService) CalculatePosition(detectedBeacons []models.DetectedBeacon, webUIConfig *models.WebUIConfig, lastKnownPosition *[2]float64) *[2]float64 {
	return CalculatePosition(detectedBeacons, webUIConfig, lastKnownPosition)
}
