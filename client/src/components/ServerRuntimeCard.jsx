import { useEffect, useMemo, useState } from "react";
import {
  loadServerRuntimeConfiguration,
  restartServerRuntimeService,
  saveServerRuntimeConfiguration,
} from "../services/configApiService";
import colorPalette from "../themes/colorPalette";

const defaultRuntimeConfig = {
  mqtt: {
    brokerHost: "127.0.0.1",
    brokerPort: 1883,
    username: "",
    password: "",
    applicationID: "",
    topicPattern: "",
    clientID: "",
    enabled: false,
  },
  server: {
    port: 8022,
  },
  kalman: {
    processVariance: 1,
    measurementVariance: 10,
  },
};

export default function ServerRuntimeCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await loadServerRuntimeConfiguration();
      setConfig({
        mqtt: {
          brokerHost:
            data?.mqtt?.brokerHost || defaultRuntimeConfig.mqtt.brokerHost,
          brokerPort:
            data?.mqtt?.brokerPort || defaultRuntimeConfig.mqtt.brokerPort,
          username: data?.mqtt?.username || defaultRuntimeConfig.mqtt.username,
          password: data?.mqtt?.password || defaultRuntimeConfig.mqtt.password,
          applicationID:
            data?.mqtt?.applicationID ||
            defaultRuntimeConfig.mqtt.applicationID,
          topicPattern:
            data?.mqtt?.topicPattern || defaultRuntimeConfig.mqtt.topicPattern,
          clientID: data?.mqtt?.clientID || defaultRuntimeConfig.mqtt.clientID,
          enabled: Boolean(data?.mqtt?.enabled),
        },
        server: {
          port: data?.server?.port || defaultRuntimeConfig.server.port,
        },
        kalman: {
          processVariance:
            data?.kalman?.processVariance ||
            defaultRuntimeConfig.kalman.processVariance,
          measurementVariance:
            data?.kalman?.measurementVariance ||
            defaultRuntimeConfig.kalman.measurementVariance,
        },
      });
    } catch (err) {
      setError(err.message || "Unable to load runtime configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const mqttEnabled = useMemo(
    () => Boolean(config.mqtt.enabled),
    [config.mqtt.enabled],
  );

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await saveServerRuntimeConfiguration(config);
      setMessage("Server runtime configuration updated successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save runtime configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await loadConfig();
      setMessage("Configuration reloaded successfully.");
    } catch (err) {
      setError(err.message || "Failed to reload configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setRestarting(true);
      setError("");
      setMessage("");
      await restartServerRuntimeService();
      setMessage("Service restart requested.");
    } catch (err) {
      setError(err.message || "Failed to restart service");
    } finally {
      setRestarting(false);
    }
  };

  const updateField = (section, field, value) => {
    setConfig((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  return (
    <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.3em]"
            style={{ color: colorPalette.primary.main }}
          >
            Server Runtime Configuration
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Runtime service and MQTT settings
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Review and update the runtime configuration used by the backend
            services.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReload}
            disabled={loading}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              color: colorPalette.text.primary,
              border: `1px solid ${colorPalette.divider}`,
            }}
          >
            {loading ? "Reloading..." : "Reload Configuration"}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            disabled={restarting}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
              opacity: restarting ? 0.7 : 1,
            }}
          >
            {restarting ? "Restarting..." : "Restart Service"}
          </button>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
              }}
            >
              Edit Configuration
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setMessage("");
                }}
                className="rounded-xl px-3 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: "rgba(255,255,255,0.7)",
                  color: colorPalette.text.primary,
                  border: `1px solid ${colorPalette.divider}`,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
        >
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
          Loading runtime configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3
                className="font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Server
              </h3>
              <label
                className="flex items-center gap-2 text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                <input
                  type="checkbox"
                  checked={mqttEnabled}
                  onChange={(event) =>
                    updateField("mqtt", "enabled", event.target.checked)
                  }
                  disabled={!editing}
                />
                MQTT enabled
              </label>
            </div>
            <div className="space-y-3">
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Port
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.server.port}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("server", "port", Number(event.target.value))
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Broker host
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.brokerHost}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "brokerHost", event.target.value)
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Broker port
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.brokerPort}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField(
                      "mqtt",
                      "brokerPort",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3
              className="font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              MQTT credentials
            </h3>
            <div className="mt-3 space-y-3">
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Application ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.applicationID}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "applicationID", event.target.value)
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Topic pattern
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.topicPattern}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "topicPattern", event.target.value)
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Username
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.username}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "username", event.target.value)
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.password}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "password", event.target.value)
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Client ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.clientID}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("mqtt", "clientID", event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 lg:col-span-2">
            <h3
              className="font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              Kalman filter
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Process variance
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.kalman.processVariance}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField(
                      "kalman",
                      "processVariance",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Measurement variance
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.kalman.measurementVariance}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField(
                      "kalman",
                      "measurementVariance",
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
