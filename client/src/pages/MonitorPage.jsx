import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTrackers,
  loadServerRuntimeConfiguration,
  postTrackerUpdate,
} from "../services/configApiService";
import colorPalette from "../themes/colorPalette";

export default function MonitorPage() {
  const [trackers, setTrackers] = useState([]);
  const [runtimeConfig, setRuntimeConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ trackerId: "tracker-01", x: 6, y: 4 });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [trackerData, runtimeData] = await Promise.all([
        getTrackers(),
        loadServerRuntimeConfiguration(),
      ]);

      const trackerList = Object.values(trackerData || {}).map((tracker) => ({
        id: tracker.trackerId || "unknown",
        x: tracker.x ?? tracker.position?.x ?? null,
        y: tracker.y ?? tracker.position?.y ?? null,
        lastUpdate: tracker.lastUpdateTime || tracker.timestamp || null,
      }));

      setTrackers(trackerList);
      setRuntimeConfig(runtimeData);
    } catch (err) {
      setError(err.message || "Unable to load monitor data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const wrappedLoadData = async () => {
      if (!isMounted) {
        return;
      }
      await loadData();
    };

    wrappedLoadData();
    const interval = window.setInterval(wrappedLoadData, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [loadData]);

  const mqttEnabled = useMemo(
    () => runtimeConfig?.mqtt?.enabled ?? false,
    [runtimeConfig],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await postTrackerUpdate({
        trackerId: form.trackerId,
        x: Number(form.x),
        y: Number(form.y),
        timestamp: Date.now(),
      });
      setSuccess(`Tracker ${form.trackerId} updated.`);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to submit tracker update");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        background: `linear-gradient(135deg, ${colorPalette.background.default} 0%, ${colorPalette.background.paper} 100%)`,
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.3em]"
              style={{ color: colorPalette.primary.main }}
            >
              Live Monitor
            </p>
            <h1
              className="text-3xl font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              Tracker activity and runtime settings
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: colorPalette.text.secondary }}
            >
              Review tracker positions and the server runtime configuration from
              the secured dashboard.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              color: colorPalette.text.primary,
              border: `1px solid ${colorPalette.divider}`,
            }}
          >
            Back to dashboard
          </Link>
        </div>

        {(error || success) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
          >
            {error || success}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/70 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
            Loading tracker monitor...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: colorPalette.text.primary }}
                  >
                    Tracker positions
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Latest known positions served from the backend.
                  </p>
                </div>
                <div
                  className="rounded-full px-3 py-1 text-sm"
                  style={{
                    backgroundColor: `${colorPalette.info.main}15`,
                    color: colorPalette.info.dark,
                  }}
                >
                  {trackers.length} active
                </div>
              </div>
              <div className="space-y-3">
                {trackers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No tracker updates yet.
                  </div>
                ) : (
                  trackers.map((tracker) => (
                    <div
                      key={tracker.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <strong style={{ color: colorPalette.text.primary }}>
                          {tracker.id}
                        </strong>
                        <span
                          className="text-xs"
                          style={{ color: colorPalette.primary.main }}
                        >
                          {tracker.x != null && tracker.y != null
                            ? `x:${tracker.x.toFixed(2)} y:${tracker.y.toFixed(2)}`
                            : "No position"}
                        </span>
                      </div>
                      <div
                        className="mt-2 text-sm"
                        style={{ color: colorPalette.text.secondary }}
                      >
                        Last update:{" "}
                        {tracker.lastUpdate
                          ? new Date(tracker.lastUpdate).toLocaleString()
                          : "pending"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
              <h2
                className="text-xl font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Simulate tracker update
              </h2>
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                  value={form.trackerId}
                  placeholder="Tracker ID"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackerId: event.target.value,
                    }))
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                    value={form.x}
                    placeholder="X"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        x: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                    value={form.y}
                    placeholder="Y"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        y: event.target.value,
                      }))
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Submitting..." : "Submit update"}
                </button>
              </form>

              <h2
                className="mt-6 text-xl font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Runtime settings
              </h2>
              <div
                className="mt-4 space-y-3 text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div
                    className="font-semibold"
                    style={{ color: colorPalette.text.primary }}
                  >
                    MQTT enabled
                  </div>
                  <div>{mqttEnabled ? "Yes" : "No"}</div>
                </div>
                {runtimeConfig?.mqtt && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div
                      className="font-semibold"
                      style={{ color: colorPalette.text.primary }}
                    >
                      Broker
                    </div>
                    <div>
                      {runtimeConfig.mqtt.brokerHost}:
                      {runtimeConfig.mqtt.brokerPort}
                    </div>
                  </div>
                )}
                {runtimeConfig?.kalman && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div
                      className="font-semibold"
                      style={{ color: colorPalette.text.primary }}
                    >
                      Kalman parameters
                    </div>
                    <div>
                      Process variance: {runtimeConfig.kalman.processVariance}
                    </div>
                    <div>
                      Measurement variance:{" "}
                      {runtimeConfig.kalman.measurementVariance}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
