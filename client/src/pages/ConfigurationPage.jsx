import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AreaLocationConfigCard from "../components/AreaLocationConfigCard";
import AuthenticationCard from "../components/AuthenticationCard";
import ChirpStackConfigCard from "../components/ChirpStackConfigCard";
import MapEditor from "../components/MapEditor";
import SenseCapConfigCard from "../components/SenseCapConfigCard";
import ServerRuntimeCard from "../components/ServerRuntimeCard";
import TrackerAccessControlCard from "../components/TrackerAccessControlCard";
import WebhookConfigCard from "../components/WebhookConfigCard";
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

export default function ConfigurationPage() {
  const [config, setConfig] = useState(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [placementBeacon, setPlacementBeacon] = useState(null);

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

  function updateBeacon(index, field, value) {
    setConfig((current) => {
      const next = { ...current, beacons: [...current.beacons] };
      next.beacons[index] = { ...next.beacons[index], [field]: value };
      return next;
    });
  }

  function handleBeaconsChange(newBeacons) {
    setConfig((current) => ({
      ...current,
      beacons: newBeacons,
    }));
  }

  function handlePlaceOnMap(beacon, index) {
    if (beacon.x != null && beacon.y != null) {
      // Beacon already placed - could open editor at its position
      // For now, just allow re-placement
    }
    setPlacementBeacon({ ...beacon, _index: index });
  }

  function handlePlacementComplete(beacon, x, y) {
    const index = beacon._index;
    if (index !== undefined && index >= 0 && index < config.beacons.length) {
      setConfig((current) => {
        const next = { ...current, beacons: [...current.beacons] };
        next.beacons[index] = { ...next.beacons[index], x, y };
        return next;
      });
    }
    setPlacementBeacon(null);
  }

  function handlePlacementCancel() {
    setPlacementBeacon(null);
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
              Map and beacon configuration
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: colorPalette.text.secondary }}
            >
              Configure the positioning map, add beacon metadata, and save it
              through the secured API.
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

        {loading ? (
          <div className="rounded-3xl border border-white/70 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
            Loading configuration...
          </div>
        ) : (
          <div className="grid gap-6">
            <AuthenticationCard />
            <ServerRuntimeCard />
            <AreaLocationConfigCard />
            <WebhookConfigCard />
            <TrackerAccessControlCard />
            <SenseCapConfigCard />
            <ChirpStackConfigCard />

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      style={{ color: colorPalette.text.primary }}
                    >
                      Map overview
                    </h2>
                    <p
                      className="text-sm"
                      style={{ color: colorPalette.text.secondary }}
                    >
                      Define the map footprint and general settings used by the
                      positioning engine.
                    </p>
                  </div>
                  <div
                    className="rounded-full px-3 py-1 text-sm"
                    style={{
                      backgroundColor: `${colorPalette.info.main}15`,
                      color: colorPalette.info.dark,
                    }}
                  >
                    {beaconCount} beacon{beaconCount === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label
                    className="text-sm font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Map name
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                      value={config.map.name}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          map: { ...current.map, name: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label
                    className="text-sm font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Signal propagation factor
                    <input
                      type="number"
                      step="0.1"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                      value={config.settings.signalPropagationFactor}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            signalPropagationFactor: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label
                    className="text-sm font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Width (m)
                    <input
                      type="number"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                      value={config.map.width}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          map: {
                            ...current.map,
                            width: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label
                    className="text-sm font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Height (m)
                    <input
                      type="number"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
                      value={config.map.height}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          map: {
                            ...current.map,
                            height: Number(event.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      style={{ color: colorPalette.text.primary }}
                    >
                      Map editor
                    </h2>
                    <p
                      className="text-sm"
                      style={{ color: colorPalette.text.secondary }}
                    >
                      Click beacon to drag. Use beacon list to place new beacons
                      on the map.
                    </p>
                  </div>
                </div>

                <MapEditor
                  mapConfig={config}
                  beacons={config.beacons}
                  onBeaconsChange={handleBeaconsChange}
                  placementBeacon={placementBeacon}
                  onPlacementComplete={handlePlacementComplete}
                  onPlacementCancel={handlePlacementCancel}
                  canvasWidth={900}
                  canvasHeight={520}
                />
              </section>

              <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
                <div className="mb-4">
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: colorPalette.text.primary }}
                  >
                    Beacon list
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Update beacon properties. Click "Place on Map" to position a
                    beacon visually.
                  </p>
                </div>

                <div className="space-y-3">
                  {config.beacons.map((beacon, index) => (
                    <div
                      key={`${beacon.uuid}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <strong style={{ color: colorPalette.text.primary }}>
                          {beacon.displayName || `Beacon ${index + 1}`}
                        </strong>
                        <span
                          className="text-xs"
                          style={{ color: colorPalette.primary.main }}
                        >
                          {beacon.major}:{beacon.minor}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={beacon.displayName}
                          placeholder="Display name"
                          onChange={(event) =>
                            updateBeacon(
                              index,
                              "displayName",
                              event.target.value,
                            )
                          }
                        />
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={beacon.x != null ? beacon.x.toFixed(2) : ""}
                          type="number"
                          step="0.01"
                          placeholder="X (m)"
                          onChange={(event) =>
                            updateBeacon(index, "x", Number(event.target.value))
                          }
                        />
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={beacon.y != null ? beacon.y.toFixed(2) : ""}
                          type="number"
                          step="0.01"
                          placeholder="Y (m)"
                          onChange={(event) =>
                            updateBeacon(index, "y", Number(event.target.value))
                          }
                        />
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={beacon.txPower}
                          type="number"
                          placeholder="TX Power"
                          onChange={(event) =>
                            updateBeacon(
                              index,
                              "txPower",
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handlePlaceOnMap(beacon, index)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                          disabled={placementBeacon !== null}
                        >
                          {placementBeacon?._index === index
                            ? "Placing..."
                            : "Place on Map"}
                        </button>
                        {beacon.x != null && beacon.y != null && (
                          <span className="text-xs text-slate-500 self-center">
                            Positioned: ({Number(beacon.x).toFixed(2)},{" "}
                            {Number(beacon.y).toFixed(2)})m
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
