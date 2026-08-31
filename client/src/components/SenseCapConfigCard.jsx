import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadServerRuntimeConfiguration,
  saveServerRuntimeConfiguration,
} from "../services/configApiService";
import colorPalette from "../themes/colorPalette";
import ToggleSwitch from "./ToggleSwitch";

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
};

function buildDerivedValues(applicationID, serverRegion) {
  const normalizedAppId = (applicationID || "").trim();
  const normalizedRegion = (serverRegion || "eu").trim().toLowerCase();
  const regionPrefix = normalizedRegion || "eu";
  const username = normalizedAppId ? `${normalizedAppId}@${regionPrefix}` : "";
  const topicPattern = normalizedAppId
    ? `application/${normalizedAppId}/device/+/event/up`
    : "";
  const clientID = normalizedAppId
    ? `trackerhub-${regionPrefix}-${normalizedAppId}`
    : "";

  return { username, topicPattern, clientID };
}

export default function SenseCapConfigCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const derivedValues = useMemo(() => {
    return buildDerivedValues(
      config.mqtt.applicationID,
      config.mqtt.serverRegion,
    );
  }, [config.mqtt.applicationID, config.mqtt.serverRegion]);

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
      });
    } catch (err) {
      setError(err.message || "Unable to load SenseCAP configuration");
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
          username: derivedValues.username || config.mqtt.username,
          topicPattern: derivedValues.topicPattern || config.mqtt.topicPattern,
          clientID: derivedValues.clientID || config.mqtt.clientID,
        },
      };
      await saveServerRuntimeConfiguration({
        mqtt: payload.mqtt,
        server: { port: 8022 },
        kalman: { processVariance: 1, measurementVariance: 10 },
      });
      setMessage("SenseCAP MQTT configuration updated successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save SenseCAP configuration");
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
            SenseCAP OpenStream MQTT
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Configure OpenStream connectivity for tracker ingestion
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Configure the connection profile used for SenseCAP OpenStream MQTT
            streams.
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
          Loading SenseCAP configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3
                className="font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Connection profile
              </h3>
              <ToggleSwitch
                checked={Boolean(config.mqtt.enabled)}
                onChange={(value) => updateField("enabled", value)}
                disabled={!editing}
                label=""
                size="sm"
              />
            </div>
            <div className="space-y-3">
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Server region
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={config.mqtt.serverRegion}
                  disabled={!editing}
                  onChange={(event) =>
                    updateField("serverRegion", event.target.value)
                  }
                  placeholder="eu"
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
                  value={derivedValues.username || config.mqtt.username}
                  disabled={!editing}
                  placeholder="Auto-generated from application ID"
                  readOnly
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
                  value={derivedValues.topicPattern || config.mqtt.topicPattern}
                  disabled={!editing}
                  placeholder="Auto-generated from application ID"
                  readOnly
                />
              </label>
              <label
                className="block text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Client ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={derivedValues.clientID || config.mqtt.clientID}
                  disabled={!editing}
                  placeholder="Auto-generated from application ID"
                  readOnly
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
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
