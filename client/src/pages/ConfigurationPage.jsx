import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChirpStackConfigCard from "../components/ChirpStackConfigCard";
import SenseCapConfigCard from "../components/SenseCapConfigCard";
import ServerRuntimeCard from "../components/ServerRuntimeCard";
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
            <ServerRuntimeCard />
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
                    Update beacon coordinates and labels to reflect the physical
                    layout.
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
                          value={beacon.x}
                          type="number"
                          placeholder="X"
                          onChange={(event) =>
                            updateBeacon(index, "x", Number(event.target.value))
                          }
                        />
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={beacon.y}
                          type="number"
                          placeholder="Y"
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
