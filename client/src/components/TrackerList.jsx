import colorPalette from "../themes/colorPalette";

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

export default function TrackerList({ trackers = [] }) {
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
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-5 text-sm text-slate-400">
          No trackers connected yet.
        </div>
      ) : (
        <div className="space-y-3">
          {trackers.map((tracker) => (
            <div
              key={tracker.trackerId}
              className="rounded-2xl border border-slate-700 bg-slate-900/75 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                    {tracker.trackerId}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {tracker.position?.x != null && tracker.position?.y != null
                      ? `x: ${tracker.position.x.toFixed(2)}m · y: ${tracker.position.y.toFixed(2)}m`
                      : "Position pending"}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor:
                      tracker.accuracy != null
                        ? "rgba(56, 189, 248, 0.12)"
                        : "rgba(100, 116, 139, 0.16)",
                    color:
                      tracker.accuracy != null
                        ? colorPalette.info.light
                        : colorPalette.text.secondary,
                  }}
                >
                  Acc:{" "}
                  {tracker.accuracy != null
                    ? `${tracker.accuracy.toFixed(1)}m`
                    : "—"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-950/90 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Last update
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    {formatTimestamp(
                      tracker.timestamp || tracker.lastUpdateTime,
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-950/90 p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Beacons seen
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    {tracker.lastDetectedBeacons?.length ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Strongest RSSI:{" "}
                    {getStrongestRSSI(tracker.lastDetectedBeacons)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
