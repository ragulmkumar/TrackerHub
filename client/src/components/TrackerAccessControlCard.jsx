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
  trackerAccessControl: {
    enabled: false,
    allowAll: true,
    allowedTrackers: [],
  },
};

function isValidTrackerEUI(value) {
  return /^[A-Fa-f0-9]{8,16}$/.test(value.trim());
}

export default function TrackerAccessControlCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newTrackerID, setNewTrackerID] = useState("");

  const allowedTrackerList = useMemo(
    () => config.trackerAccessControl.allowedTrackers || [],
    [config.trackerAccessControl.allowedTrackers],
  );

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
        allowAreaLocation: Boolean(data?.allowAreaLocation),
        webhook: {
          enabled: Boolean(data?.webhook?.enabled),
          hostUrl: data?.webhook?.hostUrl || "",
          headers: data?.webhook?.headers || {},
        },
        trackerAccessControl: {
          enabled: Boolean(data?.trackerAccessControl?.enabled),
          allowAll: Boolean(data?.trackerAccessControl?.allowAll ?? true),
          allowedTrackers: Array.isArray(
            data?.trackerAccessControl?.allowedTrackers,
          )
            ? data.trackerAccessControl.allowedTrackers
            : [],
        },
      });
    } catch (err) {
      setError(err.message || "Unable to load tracker access configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  const addTracker = () => {
    const tracker = newTrackerID.trim();
    if (!tracker) {
      setError("Enter a tracker ID before adding it to the allow-list");
      return;
    }
    if (!isValidTrackerEUI(tracker)) {
      setError("Tracker IDs must be a hexadecimal EUI value (8-16 chars)");
      return;
    }
    if (allowedTrackerList.includes(tracker)) {
      setError("That tracker ID is already present in the allow-list");
      return;
    }

    setConfig((current) => ({
      ...current,
      trackerAccessControl: {
        ...current.trackerAccessControl,
        allowedTrackers: [
          ...current.trackerAccessControl.allowedTrackers,
          tracker,
        ],
      },
    }));
    setNewTrackerID("");
    setError("");
  };

  const removeTracker = (trackerID) => {
    setConfig((current) => ({
      ...current,
      trackerAccessControl: {
        ...current.trackerAccessControl,
        allowedTrackers: current.trackerAccessControl.allowedTrackers.filter(
          (id) => id !== trackerID,
        ),
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (
        config.trackerAccessControl.enabled &&
        !config.trackerAccessControl.allowAll &&
        config.trackerAccessControl.allowedTrackers.length === 0
      ) {
        throw new Error(
          "At least one tracker ID is required when access control is enabled and allow-all is off",
        );
      }

      await saveServerRuntimeConfiguration(config);
      setMessage("Tracker access configuration updated successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save tracker access configuration");
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
            Tracker Access Control
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Restrict tracker ingestion to authorized device IDs
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Enable policy enforcement, choose whether all trackers are allowed,
            and optionally manage a dedicated allow-list of device EUI values.
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
          Loading tracker access configuration...
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: colorPalette.text.secondary }}
              >
                Enable tracker access control
              </span>
              <ToggleSwitch
                checked={Boolean(config.trackerAccessControl.enabled)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    trackerAccessControl: {
                      ...current.trackerAccessControl,
                      enabled: value,
                    },
                  }))
                }
                disabled={!editing}
                label=""
                size="sm"
              />
            </div>

            <div className="mb-4 flex items-center justify-between gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: colorPalette.text.secondary }}
              >
                Allow all trackers
              </span>
              <ToggleSwitch
                checked={Boolean(config.trackerAccessControl.allowAll)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    trackerAccessControl: {
                      ...current.trackerAccessControl,
                      allowAll: value,
                    },
                  }))
                }
                disabled={!editing || !config.trackerAccessControl.enabled}
                label=""
                size="sm"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: colorPalette.text.primary }}
                >
                  Allowed tracker IDs
                </h3>
                <span
                  className="text-xs"
                  style={{ color: colorPalette.text.secondary }}
                >
                  {allowedTrackerList.length} item
                  {allowedTrackerList.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  value={newTrackerID}
                  onChange={(event) => setNewTrackerID(event.target.value)}
                  placeholder="2CF7F1C0530004AD"
                  disabled={!editing || !config.trackerAccessControl.enabled}
                />
                <button
                  type="button"
                  onClick={addTracker}
                  disabled={!editing || !config.trackerAccessControl.enabled}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                    opacity:
                      !editing || !config.trackerAccessControl.enabled
                        ? 0.7
                        : 1,
                  }}
                >
                  Add
                </button>
              </div>

              <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                {allowedTrackerList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                    No tracker IDs added yet.
                  </div>
                ) : (
                  allowedTrackerList.map((trackerID) => (
                    <div
                      key={trackerID}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span style={{ color: colorPalette.text.primary }}>
                        {trackerID}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTracker(trackerID)}
                        disabled={!editing}
                        className="rounded-lg px-2 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: "rgba(239,68,68,0.12)",
                          color: colorPalette.error.dark,
                        }}
                      >
                        Remove
                      </button>
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
