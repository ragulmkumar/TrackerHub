package api

import (
	"testing"

	"trackerHub/backend/internal/models"
)

func TestAPIHandlerUpsertTrackerState(t *testing.T) {
	handler := &APIHandler{trackerStates: map[string]models.TrackerState{}}

	handler.UpsertTrackerState("tracker-01", []float64{10.5, 4.25}, 1710000000)

	state, ok := handler.trackerStates["tracker-01"]
	if !ok {
		t.Fatalf("expected tracker state to be stored")
	}

	if state.TrackerID != "tracker-01" {
		t.Fatalf("expected tracker id to be tracker-01, got %s", state.TrackerID)
	}

	if state.X == nil || *state.X != 10.5 {
		t.Fatalf("expected X coordinate to be stored")
	}

	if state.Y == nil || *state.Y != 4.25 {
		t.Fatalf("expected Y coordinate to be stored")
	}
}

func TestAPIHandlerApplyTrackerUpdatePayload(t *testing.T) {
	handler := &APIHandler{trackerStates: map[string]models.TrackerState{}}

	handler.ApplyTrackerUpdatePayload(models.TrackerUpdateRequest{
		TrackerID: "tracker-02",
		X:         1.5,
		Y:         2.5,
		Timestamp: 1710000000,
	})

	state, ok := handler.trackerStates["tracker-02"]
	if !ok {
		t.Fatalf("expected tracker state to be stored from update payload")
	}

	if state.X == nil || *state.X != 1.5 {
		t.Fatalf("expected X coordinate to be applied from update payload")
	}

	if state.Y == nil || *state.Y != 2.5 {
		t.Fatalf("expected Y coordinate to be applied from update payload")
	}
}

func TestValidateServerRuntimeConfig(t *testing.T) {
	handler := &APIHandler{}

	valid := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 8022},
		MQTT: models.MQTTServerConfig{
			BrokerPort:    1883,
			ApplicationID: "app-01",
			TopicPattern:  "tracker/+/event",
			ServerRegion:  "eu",
		},
		Kalman: models.KalmanParams{ProcessVariance: 1.0, MeasurementVariance: 10.0},
	}

	if err := handler.ValidateServerRuntimeConfig(valid); err != nil {
		t.Fatalf("expected valid runtime config to pass validation: %v", err)
	}

	invalid := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 0},
		MQTT:   models.MQTTServerConfig{BrokerPort: 0},
		Kalman: models.KalmanParams{ProcessVariance: -1, MeasurementVariance: -1},
	}

	if err := handler.ValidateServerRuntimeConfig(invalid); err == nil {
		t.Fatalf("expected invalid runtime config to fail validation")
	}

	enabledWithoutRegion := &models.ServerRuntimeConfig{
		Server: models.WebServerConfig{Port: 8022},
		MQTT: models.MQTTServerConfig{
			Enabled:       true,
			BrokerPort:    1883,
			ApplicationID: "app-01",
			TopicPattern:  "tracker/+/event",
		},
		Kalman: models.KalmanParams{ProcessVariance: 1.0, MeasurementVariance: 10.0},
	}

	if err := handler.ValidateServerRuntimeConfig(enabledWithoutRegion); err == nil {
		t.Fatalf("expected runtime config to require a server region when MQTT is enabled")
	}
}
