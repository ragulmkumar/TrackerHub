package config

import (
	"sync"

	"trackerHub/backend/internal/models"
)

// RuntimeConfigStore keeps a single in-memory runtime configuration snapshot
// and exposes it through a thread-safe getter/setter pair.
type RuntimeConfigStore struct {
	mu     sync.RWMutex
	config *models.ServerRuntimeConfig
}

// NewRuntimeConfigStore loads the runtime config from disk once during startup
// and initializes the shared in-memory state.
func NewRuntimeConfigStore(configManager *ConfigManager, filePath string) (*RuntimeConfigStore, error) {
	cfg, err := configManager.LoadServerRuntimeConfig(filePath)
	if err != nil {
		return nil, err
	}

	return &RuntimeConfigStore{
		config: cloneServerRuntimeConfig(cfg),
	}, nil
}

// Get returns a safe snapshot of the latest runtime configuration.
func (s *RuntimeConfigStore) Get() *models.ServerRuntimeConfig {
	if s == nil {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	return cloneServerRuntimeConfig(s.config)
}

// Set replaces the current runtime configuration snapshot in memory.
func (s *RuntimeConfigStore) Set(config *models.ServerRuntimeConfig) {
	if s == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.config = cloneServerRuntimeConfig(config)
}

func cloneServerRuntimeConfig(config *models.ServerRuntimeConfig) *models.ServerRuntimeConfig {
	if config == nil {
		return nil
	}

	clone := *config
	clone.MQTT = config.MQTT
	clone.Server = config.Server
	clone.Kalman = config.Kalman
	clone.AllowAreaLocation = config.AllowAreaLocation
	clone.Webhook = config.Webhook
	clone.TrackerAccessControl = config.TrackerAccessControl

	if config.Webhook.Headers != nil {
		cloneHeaders := make(map[string]string, len(config.Webhook.Headers))
		for key, value := range config.Webhook.Headers {
			cloneHeaders[key] = value
		}
		clone.Webhook.Headers = cloneHeaders
	}

	if config.TrackerAccessControl.AllowedTrackers != nil {
		cloneTrackers := append([]string(nil), config.TrackerAccessControl.AllowedTrackers...)
		clone.TrackerAccessControl.AllowedTrackers = cloneTrackers
	}

	return &clone
}
