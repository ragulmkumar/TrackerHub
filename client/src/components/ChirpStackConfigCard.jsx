import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadServerRuntimeConfiguration,
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
    serverRegion: "",
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

function buildDerivedValues(applicationID) {
  const normalizedApplicationID = (applicationID || "").trim();
  const topicPattern = normalizedApplicationID
    ? `application/${normalizedApplicationID}/device/+/event/up`
    : "";
  const clientID = normalizedApplicationID
    ? `trackerhub-${normalizedApplicationID.replace(/[^a-zA-Z0-9-]/g, "-")}`
    : "";
  const username = normalizedApplicationID ? normalizedApplicationID : "";

  return {
    topicPattern,
    clientID,
    username,
  };
}

export default function ChirpStackConfigCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const derivedValues = useMemo(() => {
    return buildDerivedValues(config.mqtt.applicationID);
  }, [config.mqtt.applicationID]);

  const loadConfig = useCallback(async () => {
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
          serverRegion:
            data?.mqtt?.serverRegion || defaultRuntimeConfig.mqtt.serverRegion,
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
      setError(err.message || "Unable to load ChirpStack configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  const updateField = (field, value) => {
    setConfig((current) => ({
      ...current,
      mqtt: {
        ...current.mqtt,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = {
        mqtt: {
          ...config.mqtt,
          username: config.mqtt.username || derivedValues.username,
          topicPattern: config.mqtt.topicPattern || derivedValues.topicPattern,
          clientID: config.mqtt.clientID || derivedValues.clientID,
        },
        server: {
          ...config.server,
        },
        kalman: {
          ...config.kalman,
        },
      };

      await saveServerRuntimeConfiguration(payload);
      setMessage("ChirpStack MQTT configuration updated successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save ChirpStack configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.3em]"
            style={{ color: colorPalette.primary.main }}
          >
            ChirpStack MQTT
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Configure ChirpStack connectivity for LoRaWAN tracker ingestion
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Manage the broker settings and topic identity used for ChirpStack
            MQTT traffic.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
            }}
          >
            Edit configuration
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

      {(message || error) && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
        >
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
          Loading ChirpStack configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3
                className="font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Connection profile
              </h3>
              <label
                className="flex items-center gap-2 text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                <input
                  type="checkbox"
                  checked={config.mqtt.enabled}
                  onChange={(event) =>
                    updateField("enabled", event.target.checked)
                  }
                  disabled={!editing}
                />
                Enable ChirpStack MQTT
              </label>
            </div>
            <div className="space-y-3">
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
                    updateField("brokerHost", event.target.value)
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
                    updateField("brokerPort", Number(event.target.value))
                  }
                />
              </label>
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
                    updateField("applicationID", event.target.value)
                  }
                  placeholder="Enter application ID"
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Username
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.username || derivedValues.username}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("username", event.target.value)
                  }
                  placeholder="Auto-generated from application ID"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3
              className="font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              Topic and client identity
            </h3>
            <div className="mt-3 space-y-3">
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Topic pattern
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.topicPattern || derivedValues.topicPattern}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("topicPattern", event.target.value)
                  }
                  placeholder="Auto-generated from application ID"
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
                    updateField("password", event.target.value)
                  }
                  placeholder="Enter password"
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Client ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.clientID || derivedValues.clientID}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("clientID", event.target.value)
                  }
                  placeholder="Auto-generated from application ID"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
