import { useEffect, useRef, useState } from "react";
import colorPalette from "../themes/colorPalette";

// A tracker is considered "live" if we have seen a report within this window.
// Reports may be sparse when a tracker is idle, so keep this generous.
const LIVE_WINDOW_MS = 120 * 1000;
// Re-evaluate freshness every this often so the status flips on its own even
// when no new reports are arriving (e.g. after a tracker goes offline).
const FRESHNESS_TICK_MS = 10 * 1000;

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleString();
}

function getStrongestRSSI(beacons) {
  if (!Array.isArray(beacons) || beacons.length === 0) {
    return "—";
  }
  return Math.max(...beacons.map((beacon) => beacon.rssi));
}

function msSince(timestamp) {
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return Math.max(0, Date.now() - time);
}

function formatBattery(battery) {
  if (battery == null) {
    return "—";
  }
  return `${battery}%`;
}

function getBatteryColor(battery) {
  if (battery == null) {
    return { color: colorPalette.text.secondary, bg: "transparent" };
  }
  if (battery <= 20) {
    return {
      color: colorPalette.error.main,
      bg: `${colorPalette.error.main}18`,
    };
  }
  if (battery <= 50) {
    return {
      color: colorPalette.warning.main,
      bg: `${colorPalette.warning.main}18`,
    };
  }
  return {
    color: colorPalette.success.main,
    bg: `${colorPalette.success.main}18`,
  };
}

function TrackerStatusDot({ status }) {
  const meta = {
    live: {
      label: "Live",
      color: colorPalette.success.main,
      bg: `${colorPalette.success.main}18`,
    },
    stale: {
      label: "Stale",
      color: colorPalette.warning.main,
      bg: `${colorPalette.warning.main}18`,
    },
    unknown: {
      label: "No data",
      color: colorPalette.text.secondary,
      bg: `${colorPalette.text.secondary}18`,
    },
  }[status] || {
    label: "No data",
    color: colorPalette.text.secondary,
    bg: `${colorPalette.text.secondary}18`,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

const RowMeta = {
  live: {
    color: colorPalette.success.main,
    bg: `${colorPalette.success.main}10`,
  },
  stale: {
    color: colorPalette.warning.main,
    bg: `${colorPalette.warning.main}10`,
  },
  unknown: {
    color: colorPalette.text.secondary,
    bg: "transparent",
  },
};

export default function TrackerList({ trackers = [] }) {
  // Tick to refresh offline/online freshness without waiting for new reports.
  const [, setTick] = useState(0);
  const tickRef = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, FRESHNESS_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Tracker details
          </h2>
        </div>
        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          {trackers.length} active
        </span>
      </div>

      {trackers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${colorPalette.text.secondary}16` }}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a9 9 0 109 9" />
              <path d="M12 21V12" />
              <path d="M12 12L18 6" />
            </svg>
          </div>
          No trackers connected yet.
          <p className="mt-1 text-xs text-slate-500">
            Waiting for the first live position report.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 border-collapse text-left text-sm">
            <thead>
              <tr
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colorPalette.text.secondary }}
              >
                <th className="pb-2 pr-3 font-semibold">Tracker</th>
                <th className="pb-2 pr-3 font-semibold">Position</th>
                <th className="pb-2 pr-3 font-semibold">Accuracy</th>
                <th className="pb-2 pr-3 font-semibold">Beacons</th>
                <th className="pb-2 pr-3 font-semibold">RSSI</th>
                <th className="pb-2 pr-3 font-semibold">Battery</th>
                <th className="pb-2 pr-3 font-semibold">Last update</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {trackers.map((tracker) => {
                const stamp = tracker.timestamp || tracker.lastUpdateTime;
                const elapsed = msSince(stamp);
                const isLive = elapsed != null && elapsed <= LIVE_WINDOW_MS;
                const isStale = elapsed != null && elapsed > LIVE_WINDOW_MS;
                const status = isLive ? "live" : isStale ? "stale" : "unknown";
                const hasPosition =
                  tracker.position?.x != null && tracker.position?.y != null;
                const rowMeta = RowMeta[status] || RowMeta.unknown;

                return (
                  <tr
                    key={tracker.trackerId}
                    className="align-middle"
                    style={{ backgroundColor: rowMeta.bg }}
                  >
                    <td className="py-3 pr-3">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
                        {tracker.trackerId}
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-slate-200">
                      {hasPosition
                        ? `x: ${tracker.position.x.toFixed(2)}m · y: ${tracker.position.y.toFixed(2)}m`
                        : "Position pending"}
                    </td>
                    <td className="py-3 pr-3">
                      {tracker.accuracy != null ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "rgba(56, 189, 248, 0.12)",
                            color: colorPalette.info.light,
                          }}
                        >
                          {tracker.accuracy.toFixed(1)}m
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-slate-300">
                      {tracker.lastDetectedBeacons?.length ?? 0}
                    </td>
                    <td className="py-3 pr-3 text-slate-300">
                      {getStrongestRSSI(tracker.lastDetectedBeacons)}
                    </td>
                    <td className="py-3 pr-3">
                      {tracker.battery != null ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: getBatteryColor(tracker.battery)
                              .bg,
                            color: getBatteryColor(tracker.battery).color,
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: getBatteryColor(tracker.battery)
                                .color,
                            }}
                          />
                          {formatBattery(tracker.battery)}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                      {formatTimestamp(stamp)}
                    </td>
                    <td className="py-3">
                      <TrackerStatusDot status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
