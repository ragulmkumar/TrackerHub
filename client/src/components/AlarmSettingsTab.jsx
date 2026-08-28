import colorPalette from "../themes/colorPalette";

export default function AlarmSettingsTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-[0.3em]"
              style={{ color: colorPalette.primary.main }}
            >
              Alarm Settings
            </p>
            <h2
              className="mt-1 text-xl font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              Alarm and notification configuration
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: colorPalette.text.secondary }}
            >
              Configure alarm thresholds, notification channels, and escalation
              policies.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div
                className="mx-auto mb-4 rounded-full bg-amber-100 p-4"
                style={{ width: 64, height: 64 }}
              >
                <svg
                  className="mx-auto h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ stroke: "rgb(217 119 6)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                Alarm Settings Coming Soon
              </h3>
              <p
                className="mt-2 text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                Alarm and notification functionality is not yet implemented in
                the current version of TrackerHub.
              </p>
              <p
                className="mt-2 text-sm"
                style={{ color: colorPalette.text.secondary }}
              >
                This tab is a placeholder for future alarm configuration
                features including:
              </p>
              <ul
                className="mt-4 space-y-2 text-sm text-left max-w-md mx-auto"
                style={{ color: colorPalette.text.secondary }}
              >
                <li className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 text-white text-xs w-5 h-5 flex items-center justify-center">
                    1
                  </span>
                  Alarm threshold configuration (RSSI, distance, battery)
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 text-white text-xs w-5 h-5 flex items-center justify-center">
                    2
                  </span>
                  Notification channels (email, webhook, SMS, push)
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 text-white text-xs w-5 h-5 flex items-center justify-center">
                    3
                  </span>
                  Escalation policies and schedules
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 text-white text-xs w-5 h-5 flex items-center justify-center">
                    4
                  </span>
                  Alarm history and audit log
                </li>
              </ul>
              <div
                className="mt-6 text-xs"
                style={{ color: colorPalette.text.secondary }}
              >
                No backend alarm infrastructure detected. Implementation would
                require:
              </div>
              <ul
                className="mt-2 space-y-1 text-xs text-left max-w-md mx-auto"
                style={{ color: colorPalette.text.secondary }}
              >
                <li>• Backend alarm evaluation engine</li>
                <li>• MQTT/HTTP alarm ingestion endpoints</li>
                <li>• Notification delivery service</li>
                <li>• Alarm state persistence</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
