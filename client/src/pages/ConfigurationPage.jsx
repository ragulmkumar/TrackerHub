import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MapConfigurationTab from "../components/MapConfigurationTab";
import AppConfigurationTab from "../components/AppConfigurationTab";
import AlarmSettingsTab from "../components/AlarmSettingsTab";
import {
  loadWebConfiguration,
  saveWebConfiguration,
} from "../services/configApiService";
import colorPalette from "../themes/colorPalette";

const defaultFormState = {
  map: {
    name: "Main Floor",
    width: 30,
    height: 20,
    entities: [],
  },
  beacons: [
    {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      x: 3,
      y: 4,
      txPower: -59,
      displayName: "Beacon A",
      macAddress: "AA11BB22CC33",
    },
  ],
  settings: {
    signalPropagationFactor: 2.5,
  },
};

const tabs = [
  { id: "map", label: "Map Configuration" },
  { id: "app", label: "App Configuration" },
  { id: "alarm", label: "Alarm Settings" },
];

export default function ConfigurationPage() {
  const [config, setConfig] = useState(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("map");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        setLoading(true);
        const data = await loadWebConfiguration();
        if (isMounted) {
          setConfig(
            data && typeof data === "object"
              ? {
                  map: data.map || defaultFormState.map,
                  beacons: Array.isArray(data.beacons) ? data.beacons : [],
                  settings: data.settings || defaultFormState.settings,
                }
              : defaultFormState,
          );
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load configuration");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const beaconCount = useMemo(() => config.beacons.length, [config.beacons]);

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await saveWebConfiguration(config);
      setMessage("Configuration saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await loadWebConfiguration();
      setConfig(
        data && typeof data === "object"
          ? {
              map: data.map || defaultFormState.map,
              beacons: Array.isArray(data.beacons) ? data.beacons : [],
              settings: data.settings || defaultFormState.settings,
            }
          : defaultFormState,
      );
      setMessage("Configuration reloaded successfully.");
    } catch (err) {
      setError(err.message || "Failed to reload configuration");
    } finally {
      setLoading(false);
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
              Configuration Suite
            </p>
            <h1
              className="text-3xl font-semibold"
              style={{ color: colorPalette.text.primary }}
            >
              {tabs.find((t) => t.id === activeTab)?.label || "Configuration"}
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: colorPalette.text.secondary }}
            >
              {activeTab === "map" &&
                "Configure the positioning map, add beacon metadata, and save it through the secured API."}
              {activeTab === "app" &&
                "Configure authentication, server runtime, MQTT integrations, and access control."}
              {activeTab === "alarm" &&
                "Configure alarm thresholds, notification channels, and escalation policies."}
            </p>
          </div>
          <div className="flex gap-3">
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
            {activeTab !== "alarm" && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save configuration"}
              </button>
            )}
          </div>
        </div>

        {(message || error) && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: error
                ? `${colorPalette.error.main}12`
                : `${colorPalette.success.main}12`,
              borderColor: error
                ? colorPalette.error.main
                : colorPalette.success.main,
              color: error
                ? colorPalette.error.dark
                : colorPalette.success.dark,
            }}
          >
            {error || message}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="rounded-2xl border border-white/70 bg-white/70 p-2 shadow-sm backdrop-blur">
          <div className="flex gap-1" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "text-white" : ""
                }`}
                style={{
                  background:
                    activeTab === tab.id
                      ? `linear-gradient(135deg, ${colorPalette.primary.main}, ${colorPalette.secondary.main})`
                      : "transparent",
                  color:
                    activeTab === tab.id ? "white" : colorPalette.text.primary,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/70 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
            Loading configuration...
          </div>
        ) : (
          <div className="grid gap-6">
            {activeTab === "map" && (
              <MapConfigurationTab
                onSave={handleSave}
                onReload={handleReload}
                onError={setError}
                onMessage={setMessage}
                saving={saving}
                loading={loading}
                config={config}
                setConfig={setConfig}
              />
            )}
            {activeTab === "app" && <AppConfigurationTab />}
            {activeTab === "alarm" && <AlarmSettingsTab />}
          </div>
        )}
      </div>
    </div>
  );
}
