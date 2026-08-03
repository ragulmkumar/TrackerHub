import { useEffect, useMemo, useState } from "react";
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
  allowAreaLocation: false,
  webhook: {
    enabled: false,
    hostUrl: "",
    headers: {},
  },
};

function isValidHttpUrl(value) {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function WebhookConfigCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  const headersList = useMemo(() => {
    return Object.entries(config.webhook.headers || {});
  }, [config.webhook.headers]);

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
        allowAreaLocation: Boolean(data?.allowAreaLocation),
        webhook: {
          enabled: Boolean(data?.webhook?.enabled),
          hostUrl: data?.webhook?.hostUrl || "",
          headers: data?.webhook?.headers || {},
        },
      });
    } catch (err) {
      setError(err.message || "Unable to load webhook configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const updateWebhookField = (field, value) => {
    setConfig((current) => ({
      ...current,
      webhook: {
        ...current.webhook,
        [field]: value,
      },
    }));
  };

  const addHeader = () => {
    const name = headerName.trim();
    const value = headerValue.trim();
    if (!name) {
      setError("Header name is required");
      return;
    }
    setConfig((current) => ({
      ...current,
      webhook: {
        ...current.webhook,
        headers: {
          ...current.webhook.headers,
          [name]: value,
        },
      },
    }));
    setHeaderName("");
    setHeaderValue("");
    setError("");
  };

  const updateHeader = (name, nextValue) => {
    setConfig((current) => ({
      ...current,
      webhook: {
        ...current.webhook,
        headers: {
          ...current.webhook.headers,
          [name]: nextValue,
        },
      },
    }));
  };

  const deleteHeader = (name) => {
    setConfig((current) => {
      const nextHeaders = { ...(current.webhook.headers || {}) };
      delete nextHeaders[name];
      return {
        ...current,
        webhook: {
          ...current.webhook,
          headers: nextHeaders,
        },
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (config.webhook.enabled && !config.webhook.hostUrl.trim()) {
        throw new Error("Webhook host URL is required when enabled");
      }
      if (
        config.webhook.enabled &&
        !isValidHttpUrl(config.webhook.hostUrl.trim())
      ) {
        throw new Error("Webhook host URL must be a valid HTTP or HTTPS URL");
      }

      await saveServerRuntimeConfiguration(config);
      setMessage("Webhook configuration updated successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save webhook configuration");
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
            Webhook Configuration
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Configure outbound webhook delivery settings
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Enable webhook delivery, define the host endpoint, and manage the
            outbound HTTP headers used by TrackerHub.
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
          Loading webhook configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: colorPalette.text.secondary }}
              >
                Enable webhook integration
              </span>
              <input
                type="checkbox"
                checked={config.webhook.enabled}
                onChange={(event) =>
                  updateWebhookField("enabled", event.target.checked)
                }
                disabled={!editing}
              />
            </div>

            <label
              className="block text-sm"
              style={{ color: colorPalette.text.secondary }}
            >
              Webhook Host URL
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                value={config.webhook.hostUrl}
                onChange={(event) =>
                  updateWebhookField("hostUrl", event.target.value)
                }
                disabled={!editing}
                placeholder="https://example.com/webhook"
              />
            </label>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: colorPalette.text.primary }}
                >
                  HTTP Headers
                </h3>
                <span
                  className="text-xs"
                  style={{ color: colorPalette.text.secondary }}
                >
                  {headersList.length} header
                  {headersList.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label
                  className="text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Header name
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    value={headerName}
                    onChange={(event) => setHeaderName(event.target.value)}
                    disabled={!editing}
                    placeholder="Authorization"
                  />
                </label>
                <label
                  className="text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Header value
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    value={headerValue}
                    onChange={(event) => setHeaderValue(event.target.value)}
                    disabled={!editing}
                    placeholder="Bearer token"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addHeader}
                    disabled={!editing}
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                      opacity: editing ? 1 : 0.7,
                    }}
                  >
                    Add Header
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {headersList.length === 0 ? (
                  <div
                    className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    No custom headers configured.
                  </div>
                ) : (
                  headersList.map(([name, value]) => (
                    <div
                      key={name}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[1fr_1fr_auto]"
                    >
                      <label
                        className="text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Header name
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          value={name}
                          readOnly
                        />
                      </label>
                      <label
                        className="text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Header value
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                          value={value}
                          onChange={(event) =>
                            updateHeader(name, event.target.value)
                          }
                          disabled={!editing}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => deleteHeader(name)}
                          disabled={!editing}
                          className="w-full rounded-xl px-3 py-2 text-sm font-semibold"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.7)",
                            color: colorPalette.text.primary,
                            border: `1px solid ${colorPalette.divider}`,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
