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
  trackerRegistry: [],
};

const TRACKER_ID_REGEX = /^[A-Fa-f0-9]{8,16}$/;

function isValidTrackerID(value) {
  const v = (value || "").trim();
  return v !== "" && TRACKER_ID_REGEX.test(v);
}

export default function TrackerRegistryCard() {
  const [config, setConfig] = useState(defaultRuntimeConfig);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTracker, setNewTracker] = useState({
    id: "",
    name: "",
    description: "",
  });

  // Edit form state
  const [editIndex, setEditIndex] = useState(-1);
  const [editTracker, setEditTracker] = useState({
    id: "",
    name: "",
    description: "",
  });

  const registry = useMemo(
    () => (Array.isArray(config.trackerRegistry) ? config.trackerRegistry : []),
    [config.trackerRegistry],
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
        trackerRegistry: Array.isArray(data?.trackerRegistry)
          ? data.trackerRegistry
          : [],
      });
    } catch (err) {
      setError(err.message || "Unable to load tracker registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  // ── Add ────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    const id = newTracker.id.trim();
    if (!id) {
      setError("Tracker ID (EUI) is required");
      return;
    }
    if (!isValidTrackerID(id)) {
      setError("Tracker ID must be a hexadecimal EUI value (8-16 chars)");
      return;
    }
    if (registry.some((t) => t.id.toUpperCase() === id.toUpperCase())) {
      setError("That tracker ID already exists in the registry");
      return;
    }
    const now = Date.now();
    setConfig((current) => ({
      ...current,
      trackerRegistry: [
        ...current.trackerRegistry,
        {
          id: id.toUpperCase(),
          name: newTracker.name.trim() || id.toUpperCase(),
          description: newTracker.description.trim(),
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    setNewTracker({ id: "", name: "", description: "" });
    setShowAddForm(false);
    setError("");
    setMessage("Tracker added to registry. Press 'Save changes' to persist.");
  };

  // ── Edit ───────────────────────────────────────────────────────────────
  const startEdit = (index) => {
    const tracker = registry[index];
    setEditIndex(index);
    setEditTracker({
      id: tracker.id,
      name: tracker.name || "",
      description: tracker.description || "",
    });
    setError("");
    setMessage("");
  };

  const cancelEdit = () => {
    setEditIndex(-1);
    setEditTracker({ id: "", name: "", description: "" });
    setError("");
    setMessage("");
  };

  const handleEditSave = () => {
    if (editIndex < 0 || editIndex >= registry.length) return;
    const tracker = registry[editIndex];
    const updated = {
      ...tracker,
      name: editTracker.name.trim() || tracker.id,
      description: editTracker.description.trim(),
      updatedAt: Date.now(),
    };
    setConfig((current) => {
      const next = [...current.trackerRegistry];
      next[editIndex] = updated;
      return { ...current, trackerRegistry: next };
    });
    setEditIndex(-1);
    setEditTracker({ id: "", name: "", description: "" });
    setError("");
    setMessage(
      `Tracker ${tracker.id} updated. Press 'Save changes' to persist.`,
    );
  };

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = (index) => {
    const tracker = registry[index];
    if (!window.confirm(`Delete tracker ${tracker.id} from the registry?`)) {
      return;
    }
    setConfig((current) => ({
      ...current,
      trackerRegistry: current.trackerRegistry.filter((_, i) => i !== index),
    }));
    if (index === editIndex) cancelEdit();
    setError("");
    setMessage(
      `Tracker ${tracker.id} removed. Press 'Save changes' to persist.`,
    );
  };

  // ── Save / Load ────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await saveServerRuntimeConfiguration(config);
      setMessage("Tracker registry saved successfully.");
      setEditing(false);
      await loadConfig();
    } catch (err) {
      setError(err.message || "Failed to save tracker registry");
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    setEditing(false);
    setShowAddForm(false);
    cancelEdit();
    setError("");
    setMessage("");
    await loadConfig();
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none";

  return (
    <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.3em]"
            style={{ color: colorPalette.primary.main }}
          >
            Tracker Registry
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colorPalette.text.primary }}
          >
            Manage known trackers
          </h2>
          <p
            className="mt-2 text-sm"
            style={{ color: colorPalette.text.secondary }}
          >
            Pre-register trackers with names and descriptions, then add them to
            the access allow-list as needed.
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
              onClick={handleReload}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,0.7)",
                color: colorPalette.text.primary,
                border: `1px solid ${colorPalette.divider}`,
              }}
            >
              Reload
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
              {saving ? "Saving..." : "Save changes"}
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
          Loading tracker registry...
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Add form */}
          {editing && showAddForm && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3
                className="font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Add Tracker
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label
                  className="block text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Tracker ID (EUI)
                  <input
                    className={inputClass}
                    value={newTracker.id}
                    placeholder="e.g. 2CF7F1C0530004AD"
                    onChange={(event) =>
                      setNewTracker((cur) => ({
                        ...cur,
                        id: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  className="block text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Display name
                  <input
                    className={inputClass}
                    value={newTracker.name}
                    placeholder="e.g. Gate Sensor"
                    onChange={(event) =>
                      setNewTracker((cur) => ({
                        ...cur,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label
                  className="block text-sm"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Description
                  <input
                    className={inputClass}
                    value={newTracker.description}
                    placeholder="Optional notes"
                    onChange={(event) =>
                      setNewTracker((cur) => ({
                        ...cur,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  }}
                >
                  Add Tracker
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTracker({ id: "", name: "", description: "" });
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
              </div>
            </div>
          )}

          {/* Tracker list */}
          {registry.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
              No trackers registered yet.
              {editing && " Use 'Add Tracker' to register your first tracker."}
            </div>
          ) : (
            <div className="space-y-3">
              {registry.map((tracker, index) =>
                editIndex === index ? (
                  <div
                    key={tracker.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label
                        className="block text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Tracker ID (EUI)
                        <input
                          className={inputClass}
                          value={editTracker.id}
                          disabled
                        />
                      </label>
                      <label
                        className="block text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Display name
                        <input
                          className={inputClass}
                          value={editTracker.name}
                          onChange={(event) =>
                            setEditTracker((cur) => ({
                              ...cur,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label
                        className="block text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Description
                        <input
                          className={inputClass}
                          value={editTracker.description}
                          onChange={(event) =>
                            setEditTracker((cur) => ({
                              ...cur,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={handleEditSave}
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                        }}
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl px-3 py-2 text-sm font-semibold"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.7)",
                          color: colorPalette.text.primary,
                          border: `1px solid ${colorPalette.divider}`,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={tracker.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: colorPalette.text.primary }}
                        >
                          {tracker.name || tracker.id}
                        </p>
                        <p
                          className="mt-0.5 text-xs font-mono"
                          style={{ color: colorPalette.primary.main }}
                        >
                          {tracker.id}
                        </p>
                        {tracker.description && (
                          <p
                            className="mt-1 text-sm"
                            style={{ color: colorPalette.text.secondary }}
                          >
                            {tracker.description}
                          </p>
                        )}
                      </div>
                      {editing && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.7)",
                              color: colorPalette.text.primary,
                              border: `1px solid ${colorPalette.divider}`,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(index)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: "rgba(254, 226, 226, 0.7)",
                              color: colorPalette.error.main,
                              border: "1px solid #fca5a5",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {editing && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
              }}
            >
              + Add Tracker
            </button>
          )}
        </div>
      )}
    </section>
  );
}
