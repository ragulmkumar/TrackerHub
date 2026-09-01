package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"trackerHub/backend/internal/models"
)

// ConfigManager handles loading and saving of configuration files
type ConfigManager struct{}

// NewConfigManager creates a new ConfigManager instance
func NewConfigManager() *ConfigManager {
	return &ConfigManager{}
}

// LoadServerRuntimeConfig loads the server runtime configuration from JSON file
func (cm *ConfigManager) LoadServerRuntimeConfig(filePath string) (*models.ServerRuntimeConfig, error) {
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Create default config if file doesn't exist
		defaultConfig := &models.ServerRuntimeConfig{
			MQTT: models.MQTTServerConfig{
				BrokerHost:    "127.0.0.1",
				BrokerPort:    1883,
				ApplicationID: "",
				TopicPattern:  "",
				Enabled:       false,
			},
			Server: models.WebServerConfig{
				Port: 8022,
			},
			Kalman: models.KalmanParams{
				ProcessVariance:     1.0,
				MeasurementVariance: 10.0,
			},
			AllowAreaLocation: false,
			Webhook: models.WebhookConfig{
				Enabled: false,
				Enable:  false,
				HostURL: "",
				Headers: map[string]string{},
			},
			TrackerAccessControl: models.TrackerAccessControlConfig{
				Enabled:         false,
				AllowAll:        true,
				AllowedTrackers: []string{},
			},
			TrackerRegistry: []models.TrackerRegistryEntry{},
		}
		if err := cm.SaveServerRuntimeConfig(filePath, defaultConfig); err != nil {
			return nil, err
		}
		return defaultConfig, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var config models.ServerRuntimeConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

// SaveServerRuntimeConfig saves the server runtime configuration to JSON file
func (cm *ConfigManager) SaveServerRuntimeConfig(filePath string, config *models.ServerRuntimeConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}

// LoadAuthConfig loads authentication configuration from JSON file
func (cm *ConfigManager) LoadAuthConfig(filePath string) (*models.AuthConfig, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		defaultConfig := &models.AuthConfig{
			Username: "admin",
			Password: "password123",
			Secret:   "trackerhub-secret",
		}
		if err := cm.SaveAuthConfig(filePath, defaultConfig); err != nil {
			return nil, err
		}
		return defaultConfig, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var authConfig models.AuthConfig
	if err := json.Unmarshal(data, &authConfig); err != nil {
		return nil, err
	}

	if authConfig.Username == "" {
		authConfig.Username = "admin"
	}
	if authConfig.Password == "" {
		authConfig.Password = "password123"
	}
	if authConfig.Secret == "" {
		authConfig.Secret = "trackerhub-secret"
	}

	if !strings.HasPrefix(authConfig.Password, "$2") {
		hashedPassword, err := hashConfigPassword(authConfig.Password)
		if err == nil {
			authConfig.Password = hashedPassword
			if saveErr := cm.SaveAuthConfig(filePath, &authConfig); saveErr != nil {
				return nil, saveErr
			}
		}
	}

	return &authConfig, nil
}

// SaveAuthConfig saves authentication configuration to JSON file
func (cm *ConfigManager) SaveAuthConfig(filePath string, authConfig *models.AuthConfig) error {
	if authConfig != nil && authConfig.Password != "" && !strings.HasPrefix(authConfig.Password, "$2") {
		hashedPassword, err := hashConfigPassword(authConfig.Password)
		if err == nil {
			authConfig.Password = hashedPassword
		}
	}

	data, err := json.MarshalIndent(authConfig, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}

func hashConfigPassword(password string) (string, error) {
	if password == "" {
		return "", nil
	}
	if strings.HasPrefix(password, "$2") {
		return password, nil
	}
	return bcryptHash(password)
}

func bcryptHash(password string) (string, error) {
	return bcryptHashWithCost(password, 10)
}

func bcryptHashWithCost(password string, cost int) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// LoadWebUIConfig loads the web UI configuration from JSON file
func (cm *ConfigManager) LoadWebUIConfig(filePath string) (*models.WebUIConfig, error) {
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Create default config if file doesn't exist
		defaultConfig := &models.WebUIConfig{
			Map:     nil,
			Beacons: []models.WebUIBeaconConfig{},
			Settings: models.WebUISettings{
				SignalPropagationFactor: 2.5,
			},
		}
		// Save the default config
		if err := cm.SaveWebUIConfig(filePath, defaultConfig); err != nil {
			return nil, err
		}
		return defaultConfig, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var config models.WebUIConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

// SaveWebUIConfig saves the web UI configuration to JSON file
func (cm *ConfigManager) SaveWebUIConfig(filePath string, config *models.WebUIConfig) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}
