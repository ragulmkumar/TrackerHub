import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  loadWebConfiguration,
  loadServerRuntimeConfiguration,
} from "../services/configApiService";
import websocketService from "../services/websocketService";
import LiveMap from "../components/LiveMap";
import TrackerList from "../components/TrackerList";
import colorPalette from "../themes/colorPalette";

const statusStyles = {
  connected: "bg-emerald-500/15 text-emerald-300",
  connecting: "bg-sky-500/15 text-sky-300",
  disconnected: "bg-slate-500/15 text-slate-300",
  disabled: "bg-amber-500/15 text-amber-300",
  error: "bg-rose-500/15 text-rose-300",
  offline: "bg-slate-500/15 text-slate-300",
  unknown: "bg-slate-500/15 text-slate-300",
};

function getStatusBadge(status) {
  return statusStyles[status] || statusStyles.unknown;
}

export default function TrackerModePage() {
  const [mapConfig, setMapConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [runtimeConfig, setRuntimeConfig] = useState(null);
  const [loadingRuntimeConfig, setLoadingRuntimeConfig] = useState(true);
  const [error, setError] = useState("");
  const [showTrails, setShowTrails] = useState(true);
  const [trackers, setTrackers] = useState([]);
  const [wsStatus, setWsStatus] = useState("offline");
  const [mqttStatus, setMqttStatus] = useState("disconnected");

  const loadConfig = useCallback(async () => {
    try {
      setError("");
      setLoadingConfig(true);
      const config = await loadWebConfiguration();
      setMapConfig(config);
    } catch (err) {
      setError(err.message || "Unable to load map configuration.");
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const loadRuntimeConfig = useCallback(async () => {
    try {
      setLoadingRuntimeConfig(true);
      const config = await loadServerRuntimeConfiguration();
      setRuntimeConfig(config);
    } catch (err) {
      console.warn("Unable to load runtime configuration:", err);
      setRuntimeConfig(null);
    } finally {
      setLoadingRuntimeConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadRuntimeConfig();
  }, [loadConfig, loadRuntimeConfig]);

  useEffect(() => {
    websocketService.connect();
    const listener = ({
      trackers: trackerMap,
      wsStatus: socketStatus,
      mqttStatus: mqttState,
    }) => {
      setTrackers(Object.values(trackerMap));
      setWsStatus(socketStatus);
      setMqttStatus(mqttState);
    };

    websocketService.subscribe(listener);
    return () => {
      websocketService.unsubscribe(listener);
      websocketService.disconnect();
    };
  }, []);

  const activeTrackers = useMemo(() => trackers.length, [trackers]);
  const latestTracker = useMemo(() => {
    return trackers
      .filter((tracker) => tracker.timestamp || tracker.lastUpdateTime)
      .sort(
        (a, b) =>
          (b.timestamp || b.lastUpdateTime) - (a.timestamp || a.lastUpdateTime),
      )[0];
  }, [trackers]);

  const mqttEnabled = runtimeConfig?.mqtt?.enabled;
  const effectiveMqttStatus = useMemo(() => {
    if (mqttEnabled === false) {
      return "disabled";
    }
    if (mqttEnabled !== true) {
      return mqttStatus;
    }
    if (mqttStatus === "connected") {
      return "connected";
    }
    if (mqttStatus === "connecting") {
      return "connecting";
    }
    if (mqttStatus === "disconnected") {
      return "disconnected";
    }
    if (mqttStatus === "error") {
      return "error";
    }
    return "unknown";
  }, [mqttEnabled, mqttStatus]);

  const mqttStatusMessage = useMemo(() => {
    if (mqttEnabled === false) {
      return "MQTT is disabled in runtime settings.";
    }
    if (wsStatus !== "connected") {
      return "Waiting for WebSocket connection.";
    }
    if (effectiveMqttStatus === "connected") {
      return "Broker connection active.";
    }
    if (effectiveMqttStatus === "connecting") {
      return "Attempting to connect to MQTT broker.";
    }
    if (effectiveMqttStatus === "disconnected") {
      return "MQTT broker disconnected.";
    }
    if (effectiveMqttStatus === "error") {
      return "MQTT broker error detected.";
    }
    return "MQTT connection unavailable.";
  }, [effectiveMqttStatus, mqttEnabled, wsStatus]);

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        background: `linear-gradient(135deg, ${colorPalette.background.default} 0%, ${colorPalette.background.paper} 100%)`,
      }}
    >
      <div className="mx-auto grid max-w-7xl gap-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
              Live Tracker Mode
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Real-time position monitoring
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              This workspace uses the live WebSocket feed as the source of truth
              for tracker positions, MQTT connectivity and map rendering.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Dashboard
            </Link>
            <Link
              to="/configuration"
              className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
            >
              Configuration
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                  WebSocket
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(wsStatus)}`}
                  >
                    {wsStatus}
                  </span>
                  <p className="text-sm text-slate-300">
                    {wsStatus === "connected"
                      ? "Connected to live tracker updates"
                      : wsStatus === "connecting"
                        ? "Establishing connection..."
                        : wsStatus === "offline"
                          ? "Disconnected from WebSocket"
                          : wsStatus === "error"
                            ? "Connection error. Reconnecting..."
                            : "Waiting for connection..."}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                  MQTT status
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(effectiveMqttStatus)}`}
                  >
                    {effectiveMqttStatus}
                  </span>
                  <p className="text-sm text-slate-300">{mqttStatusMessage}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                    Map preview
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">
                    Tracker map view
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrails((current) => !current)}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  {showTrails ? "Hide trails" : "Show trails"}
                </button>
              </div>

              <div className="mt-4 min-h-115 rounded-3xl border border-slate-700 bg-slate-950/90 p-4">
                {loadingConfig ? (
                  <div className="flex h-full items-center justify-center rounded-3xl bg-slate-900/80 text-slate-400">
                    Loading configured map...
                  </div>
                ) : (
                  <LiveMap
                    mapConfig={mapConfig}
                    beacons={mapConfig?.beacons || []}
                    trackers={trackers}
                    showTrails={showTrails}
                    wsStatus={wsStatus}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                  Active trackers
                </p>
                <p className="mt-3 text-4xl font-semibold text-slate-100">
                  {activeTrackers}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {activeTrackers === 0
                    ? "No tracker data received yet."
                    : latestTracker
                      ? `Last updated ${new Date(latestTracker.timestamp || latestTracker.lastUpdateTime).toLocaleTimeString()}`
                      : "Awaiting live updates."}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                  Map configuration
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-100">
                  {mapConfig?.map?.name || "Unnamed map"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {mapConfig?.map
                    ? `${mapConfig.map.width}m × ${mapConfig.map.height}m with ${mapConfig.beacons?.length ?? 0} beacon${mapConfig.beacons?.length === 1 ? "" : "s"}`
                    : "No configured map data available."}
                </p>
              </div>
            </div>
          </div>

          <TrackerList trackers={trackers} />
        </div>
      </div>
    </div>
  );
}
