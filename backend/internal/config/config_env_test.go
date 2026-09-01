package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadServerRuntimeConfig_AppliesEnvironmentOverrides(t *testing.T) {
	t.Setenv("MQTT_BROKER_HOST", "lwns.adarko.io")
	t.Setenv("MQTT_BROKER_PORT", "1883")
	t.Setenv("MQTT_USERNAME", "tenant-uuid")
	t.Setenv("MQTT_PASSWORD", "tenant-api-key")
	t.Setenv("MQTT_APPLICATION_ID", "app-123")
	t.Setenv("MQTT_TOPIC_PATTERN", "application/app-123/device/+/event/up")
	t.Setenv("MQTT_CLIENT_ID", "trackerhub-lwns")
	t.Setenv("MQTT_ENABLED", "true")
	t.Setenv("SERVER_PORT", "8022")

	dir := t.TempDir()
	configPath := filepath.Join(dir, "server_runtime_config.json")
	json := `{
	  "mqtt": {
	    "brokerHost": "localhost",
	    "brokerPort": 1884,
	    "username": "old-user",
	    "password": "old-pass",
	    "applicationID": "old-app",
	    "topicPattern": "old/topic",
	    "clientID": "old-client",
	    "enabled": false
	  },
	  "server": {
	    "port": 9000
	  },
	  "kalman": {
	    "processVariance": 1,
	    "measurementVariance": 10
	  },
	  "webhook": {
	    "enabled": false,
	    "enable": false,
	    "hostUrl": "",
	    "headers": {}
	  },
	  "trackerAccessControl": {
	    "enabled": true,
	    "allowAll": false,
	    "allowedTrackers": ["AA"]
	  }
	}`
	if err := os.WriteFile(configPath, []byte(json), 0644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cm := NewConfigManager()
	cfg, err := cm.LoadServerRuntimeConfig(configPath)
	if err != nil {
		t.Fatalf("LoadServerRuntimeConfig returned error: %v", err)
	}

	if cfg.MQTT.BrokerHost != "lwns.adarko.io" {
		t.Fatalf("expected broker host override, got %q", cfg.MQTT.BrokerHost)
	}
	if cfg.MQTT.ApplicationID != "app-123" {
		t.Fatalf("expected application ID override, got %q", cfg.MQTT.ApplicationID)
	}
	if cfg.MQTT.TopicPattern != "application/app-123/device/+/event/up" {
		t.Fatalf("expected topic override, got %q", cfg.MQTT.TopicPattern)
	}
	if cfg.Server.Port != 8022 {
		t.Fatalf("expected server port override, got %d", cfg.Server.Port)
	}
	if !cfg.MQTT.Enabled {
		t.Fatal("expected MQTT enabled override to be true")
	}
}
