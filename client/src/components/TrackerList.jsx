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
    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-5 shadow-lg">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Tracker details
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Live tracker positions, beacon counts, and the freshest signal
            information.
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
          {trackers.length} active
        </span>
      </div>

      {trackers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
          No trackers connected yet. Waiting for live updates from the WebSocket
          feed.
        </div>
      ) : (
        <div className="space-y-4">
          {trackers.map((tracker) => (
            <div
              key={tracker.trackerId}
              className="rounded-3xl border border-slate-700 bg-slate-900/75 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
                    {tracker.trackerId}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {tracker.position?.x != null && tracker.position?.y != null
                      ? `x: ${tracker.position.x.toFixed(2)}m · y: ${tracker.position.y.toFixed(2)}m`
                      : "Position pending"}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/90 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Last update
                  </p>
                  <p className="mt-2 text-sm text-slate-100">
                    {formatTimestamp(
                      tracker.timestamp || tracker.lastUpdateTime,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/90 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Beacons seen
                  </p>
                  <p className="mt-2 text-sm text-slate-100">
                    {tracker.lastDetectedBeacons?.length ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
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
