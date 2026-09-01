import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getTrackers,
  loadWebConfiguration,
  loadServerRuntimeConfiguration,
} from "../services/configApiService";
import websocketService from "../services/websocketService";
import LiveMap from "../components/LiveMap";
import TrackerList from "../components/TrackerList";
import colorPalette from "../themes/colorPalette";

/* ------------------------------------------------------------------ */
/* Status metadata for the live connection pills                       */
/* ------------------------------------------------------------------ */
const STATUS_META = {
  connected: {
    label: "Connected",
    color: colorPalette.success.main,
    bg: `${colorPalette.success.main}14`,
  },
  connecting: {
    label: "Connecting",
    color: colorPalette.info.main,
    bg: `${colorPalette.info.main}14`,
  },
  disconnected: {
    label: "Disconnected",
    color: colorPalette.text.secondary,
    bg: `${colorPalette.text.secondary}14`,
  },
  disabled: {
    label: "Disabled",
    color: colorPalette.warning.dark,
    bg: `${colorPalette.warning.main}16`,
  },
  error: {
    label: "Error",
    color: colorPalette.error.main,
    bg: `${colorPalette.error.main}14`,
  },
  offline: {
    label: "Offline",
    color: colorPalette.text.disabled,
    bg: `${colorPalette.text.disabled}14`,
  },
  unknown: {
    label: "Unknown",
    color: colorPalette.text.disabled,
    bg: `${colorPalette.text.disabled}14`,
  },
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl p-6 transition-all duration-300 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255, 255, 255, 0.7)",
        boxShadow: "0 10px 40px -18px rgba(0, 0, 0, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2
        className="text-lg font-semibold"
        style={{ color: colorPalette.text.primary }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-0.5 text-sm"
          style={{ color: colorPalette.text.secondary }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">
      <div
        className="flex h-full flex-col justify-between gap-3 rounded-2xl p-5"
        style={{
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(12px) saturate(160%)",
          WebkitBackdropFilter: "blur(12px) saturate(160%)",
          border: "1px solid rgba(255, 255, 255, 0.7)",
          boxShadow: "0 8px 32px -16px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: colorPalette.text.secondary }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-2xl font-bold"
              style={{ color: colorPalette.text.primary }}
            >
              {value}
            </p>
            {sub && (
              <p
                className="mt-0.5 text-xs"
                style={{ color: colorPalette.text.disabled }}
              >
                {sub}
              </p>
            )}
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${color}14`,
              border: `1px solid ${color}20`,
              color,
            }}
          >
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm" style={{ color: colorPalette.text.secondary }}>
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{
          color: accent ? colorPalette.primary.main : colorPalette.text.primary,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SVG icons (stroke style consistent with the rest of the app)        */
/* ------------------------------------------------------------------ */
const Icons = {
  trackers: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a9 9 0 109 9" />
      <path d="M12 21V12" />
      <path d="M12 12L18 6" />
    </svg>
  ),
  located: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  beacons: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4h20v14H2z" />
      <path d="M7 21h10" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M12 3a7 7 0 000 14" />
    </svg>
  ),
  mqtt: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 9l3 3-3 3" />
      <path d="M13 15h6" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  engine: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V10M10 20V4M16 20v-8M22 20V7" />
    </svg>
  ),
  settings: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  chart: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M8 17V9M13 17V5M18 17v-7" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [mapConfig, setMapConfig] = useState(null);
  const [runtimeConfig, setRuntimeConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trackers, setTrackers] = useState([]);
  const [wsStatus, setWsStatus] = useState("offline");
  const [mqttStatus, setMqttStatus] = useState("disconnected");
  const [showTrails, setShowTrails] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [webConfig, runtime, trackerData] = await Promise.all([
          loadWebConfiguration(),
          loadServerRuntimeConfiguration(),
          getTrackers(),
        ]);
        if (!isMounted) return;
        setMapConfig(webConfig);
        setRuntimeConfig(runtime);
        setTrackers(Object.values(trackerData || {}));
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || "Unable to load configuration.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const mqttEnabled = runtimeConfig?.mqtt?.enabled;
  useEffect(() => {
    if (runtimeConfig == null) {
      websocketService.setMQTTEnabled(null);
      return;
    }
    websocketService.setMQTTEnabled(mqttEnabled !== false);
    if (mqttEnabled === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrackers([]);
    }
  }, [runtimeConfig, mqttEnabled]);

  const totalTrackers = trackers.length;
  const locatedTrackers = trackers.filter(
    (t) => t.position?.x != null && t.position?.y != null,
  ).length;
  const beacons = mapConfig?.beacons || [];
  const beaconCount = beacons.length;
  const mapInfo = mapConfig?.map;
  const signalFactor = mapConfig?.settings?.signalPropagationFactor;
  const kalman = runtimeConfig?.kalman;
  const mqtt = runtimeConfig?.mqtt;

  const effectiveMqttStatus = useMemo(() => {
    if (mqttEnabled === false) return "disabled";
    if (mqttEnabled !== true) return mqttStatus;
    if (mqttStatus === "connected") return "connected";
    if (mqttStatus === "connecting") return "connecting";
    if (mqttStatus === "disconnected") return "disconnected";
    if (mqttStatus === "error") return "error";
    return "unknown";
  }, [mqttEnabled, mqttStatus]);

  const latestTracker = useMemo(
    () =>
      trackers
        .filter((t) => t.timestamp || t.lastUpdateTime)
        .sort(
          (a, b) =>
            (b.timestamp || b.lastUpdateTime) -
            (a.timestamp || a.lastUpdateTime),
        )[0],
    [trackers],
  );

  return (
    <div
      className="min-h-screen px-3 py-5 sm:px-4 lg:px-6"
      style={{
        background: `linear-gradient(135deg, ${colorPalette.background.default} 0%, ${colorPalette.background.paper} 100%)`,
      }}
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  boxShadow: `0 6px 20px ${colorPalette.primary.main}35`,
                }}
              >
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: colorPalette.primary.main }}
                >
                  Indoor Positioning Overview
                </p>
                <h1
                  className="mt-1 text-xl font-bold sm:text-2xl"
                  style={{ color: colorPalette.text.primary }}
                >
                  Welcome back,{" "}
                  <span style={{ color: colorPalette.primary.main }}>
                    {user || "Admin"}
                  </span>
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <p style={{ color: colorPalette.text.secondary }}>
                    {formatDate(currentTime)}
                  </p>
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: colorPalette.text.disabled }}
                  />
                  <p style={{ color: colorPalette.primary.main }}>
                    {formatTime(currentTime)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="hidden items-center gap-2 rounded-xl px-2.5 py-1.5 sm:flex"
                style={{
                  backgroundColor: `${colorPalette.success.main}12`,
                  border: `1px solid ${colorPalette.success.main}24`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: colorPalette.success.main }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: colorPalette.success.dark }}
                >
                  Positioning engine{" "}
                  {wsStatus === "connected" ? "online" : "pending"}
                </span>
              </div>
              <Link
                to="/monitor"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  color: colorPalette.primary.contrastText,
                  boxShadow: `0 4px 16px ${colorPalette.primary.main}30`,
                }}
              >
                {Icons.chart}
                Monitor
              </Link>
              <Link
                to="/configuration"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  color: colorPalette.primary.contrastText,
                  boxShadow: `0 4px 16px ${colorPalette.primary.main}30`,
                }}
              >
                {Icons.settings}
                Configure
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.error.main}, ${colorPalette.error.dark})`,
                  color: colorPalette.error.contrastText,
                  boxShadow: `0 4px 16px ${colorPalette.error.main}30`,
                }}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </GlassCard>

        {error && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: `${colorPalette.error.main}10`,
              borderColor: `${colorPalette.error.main}24`,
              color: colorPalette.error.dark,
            }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Trackers"
            value={totalTrackers}
            sub={
              latestTracker
                ? `Last seen ${new Date(
                    latestTracker.timestamp || latestTracker.lastUpdateTime,
                  ).toLocaleTimeString()}`
                : "Awaiting live updates"
            }
            icon={Icons.trackers}
            color={colorPalette.primary.main}
          />
          <StatCard
            label="Trackers Located"
            value={locatedTrackers}
            sub={`${totalTrackers === 0 ? 0 : Math.round((locatedTrackers / totalTrackers) * 100)}% positioned`}
            icon={Icons.located}
            color={colorPalette.success.main}
          />
          <StatCard
            label="Beacons Configured"
            value={beaconCount}
            sub={
              mapInfo ? `on ${mapInfo.name || "current map"}` : "no map loaded"
            }
            icon={Icons.beacons}
            color={colorPalette.info.main}
          />
          <StatCard
            label="MQTT Feed"
            value={
              mqttEnabled === false
                ? "Off"
                : effectiveMqttStatus === "connected"
                  ? "Live"
                  : "Idle"
            }
            sub={
              mqttEnabled === false
                ? "disabled in runtime settings"
                : mqtt
                  ? `${mqtt.brokerHost || "—"}:${mqtt.brokerPort || "—"}`
                  : "—"
            }
            icon={Icons.mqtt}
            color={
              effectiveMqttStatus === "connected"
                ? colorPalette.success.main
                : mqttEnabled === false
                  ? colorPalette.warning.main
                  : colorPalette.text.secondary
            }
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
          <GlassCard className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle
                title="Live position map"
                subtitle={
                  mapInfo
                    ? `${mapInfo.name || "Unnamed map"} · ${mapInfo.width}m × ${mapInfo.height}m`
                    : "Configured beacons and live tracker positions"
                }
              />
              <div className="flex items-center gap-2">
                <StatusPill status={wsStatus} />
                <button
                  type="button"
                  onClick={() => setShowTrails((cur) => !cur)}
                  className="rounded-xl px-3 py-1.5 text-sm font-semibold transition hover:opacity-95"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.7)",
                    color: colorPalette.text.primary,
                    border: `1px solid ${colorPalette.divider}`,
                  }}
                >
                  {showTrails ? "Hide trails" : "Show trails"}
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-700">
              {loading ? (
                <div className="flex h-80 items-center justify-center text-sm text-slate-400 sm:h-96">
                  Loading configured map...
                </div>
              ) : (
                <LiveMap
                  mapConfig={mapConfig}
                  beacons={beacons}
                  trackers={trackers}
                  showTrails={showTrails}
                  wsStatus={wsStatus}
                />
              )}
            </div>
          </GlassCard>

          <TrackerList trackers={trackers} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard>
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${colorPalette.primary.main}14`,
                  color: colorPalette.primary.main,
                }}
              >
                {Icons.engine}
              </div>
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: colorPalette.text.primary }}
                >
                  Positioning Engine
                </h2>
                <p
                  className="text-xs"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Multilateration + Kalman smoothing
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-200/70">
              <ConfigRow
                label="Signal factor (n)"
                value={signalFactor != null ? `${signalFactor}` : "—"}
                accent
              />
              <ConfigRow
                label="Kalman process variance"
                value={kalman?.processVariance ?? "—"}
              />
              <ConfigRow
                label="Kalman measurement variance"
                value={kalman?.measurementVariance ?? "—"}
              />
              <ConfigRow
                label="Map"
                value={
                  mapInfo
                    ? `${mapInfo.name || "Unnamed"} · ${mapInfo.width}×${mapInfo.height}m`
                    : "Not configured"
                }
              />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${colorPalette.secondary.main}14`,
                    color: colorPalette.secondary.dark,
                  }}
                >
                  {Icons.mqtt}
                </div>
                <div>
                  <h2
                    className="text-base font-semibold"
                    style={{ color: colorPalette.text.primary }}
                  >
                    MQTT Connectivity
                  </h2>
                  <p
                    className="text-xs"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Ingest for tracker reports
                  </p>
                </div>
              </div>
              <StatusPill status={effectiveMqttStatus} />
            </div>
            <div className="divide-y divide-slate-200/70">
              <ConfigRow
                label="Broker"
                value={
                  mqtt
                    ? `${mqtt.brokerHost || "—"}:${mqtt.brokerPort || "—"}`
                    : "—"
                }
              />
              <ConfigRow
                label="Application ID"
                value={mqtt?.applicationID || "—"}
              />
              <ConfigRow
                label="Topic pattern"
                value={mqtt?.topicPattern || "—"}
              />
              <ConfigRow
                label="Enabled"
                value={mqttEnabled === false ? "No" : "Yes"}
              />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${colorPalette.warning.main}14`,
                  color: colorPalette.warning.dark,
                }}
              >
                {Icons.settings}
              </div>
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: colorPalette.text.primary }}
                >
                  Workspace
                </h2>
                <p
                  className="text-xs"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Jump into a module
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                {
                  to: "/tracker-mode",
                  label: "Tracker mode",
                  desc: "Full-screen live map & tracker details",
                },
                {
                  to: "/monitor",
                  label: "Live monitor",
                  desc: "Simulate updates & inspect runtime settings",
                },
                {
                  to: "/configuration",
                  label: "Configuration",
                  desc: "Map, beacons, server runtime & security",
                },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.4)",
                    border: `1px solid rgba(255,255,255,0.6)`,
                  }}
                >
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: colorPalette.text.primary }}
                    >
                      {action.label}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: colorPalette.text.disabled }}
                    >
                      {action.desc}
                    </p>
                  </div>
                  <span
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: colorPalette.primary.main }}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
