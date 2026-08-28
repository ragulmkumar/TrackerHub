import { useEffect, useMemo, useRef, useState } from "react";
import MapEditor from "./MapEditor";
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

export default function MapConfigurationTab({
  onSave,
  onReload,
  onError,
  onMessage,
  saving,
  loading,
  config: parentConfig,
  setConfig: parentSetConfig,
}) {
  // Use parent config if provided, otherwise manage local state
  const [localConfig, setLocalConfig] = useState(defaultFormState);
  const [localLoading, setLocalLoading] = useState(true);
  const [localMessage, setLocalMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [placementBeacon, setPlacementBeacon] = useState(null);
  const fileInputRef = useRef(null);

  // Determine which config/setConfig to use
  const config = parentConfig || localConfig;
  const setConfig = parentSetConfig || setLocalConfig;
  const isLoading = parentConfig ? loading : localLoading;
  const isSaving = parentConfig ? saving : false;
  const message = parentConfig ? onMessage : localMessage;
  const error = parentConfig ? onError : localError;
  const setMessage = parentConfig ? onMessage : setLocalMessage;
  const setError = parentConfig ? onError : setLocalError;

  // Load configuration if not using parent
  useEffect(() => {
    if (parentConfig) return;

    let isMounted = true;

    async function loadConfig() {
      try {
        setLocalLoading(true);
        const data = await loadWebConfiguration();
        if (isMounted) {
          setLocalConfig(
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
          setLocalError(err.message || "Unable to load configuration");
        }
      } finally {
        if (isMounted) {
          setLocalLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, [parentConfig]);

  const beaconCount = useMemo(() => config.beacons.length, [config.beacons]);

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

  function validateLayoutStructure(jsonData) {
    if (!jsonData || typeof jsonData !== "object") return false;
    if (!jsonData.map || typeof jsonData.map !== "object") return false;
    if (
      typeof jsonData.map.width !== "number" ||
      typeof jsonData.map.height !== "number"
    )
      return false;
    if (!Array.isArray(jsonData.beacons)) return false;
    if (!jsonData.settings || typeof jsonData.settings !== "object")
      return false;
    if (typeof jsonData.settings.signalPropagationFactor !== "number")
      return false;
    if (jsonData.map.entities && !Array.isArray(jsonData.map.entities))
      return false;
    if (jsonData.map.entities) {
      for (const entity of jsonData.map.entities) {
        if (entity.type !== "polyline") return false;
        if (!Array.isArray(entity.points) || entity.points.length < 2)
          return false;
        for (const point of entity.points) {
          if (
            !Array.isArray(point) ||
            point.length !== 2 ||
            typeof point[0] !== "number" ||
            typeof point[1] !== "number"
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function handleImportLayout(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!validateLayoutStructure(jsonData)) {
          setError(
            "Invalid layout format. Expected: { map: { width, height, entities[] }, beacons[], settings: { signalPropagationFactor } }",
          );
          return;
        }
        setConfig((current) => ({
          map: {
            ...current.map,
            name: jsonData.map.name || current.map.name,
            width: jsonData.map.width,
            height: jsonData.map.height,
            entities: jsonData.map.entities || [],
          },
          beacons: jsonData.beacons,
          settings: {
            ...current.settings,
            signalPropagationFactor: jsonData.settings.signalPropagationFactor,
          },
        }));
        setMessage(
          "Layout imported successfully. Review and save configuration.",
        );
        setError("");
      } catch (err) {
        setError("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function triggerFileImport() {
    fileInputRef.current?.click();
  }

  // If using parent config, delegate save/reload to parent
  const handleSave = parentConfig
    ? onSave
    : async () => {
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
      };

  const handleReload = parentConfig
    ? onReload
    : async () => {
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
      };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
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
          <div className="flex items-center gap-2">
            <div
              className="rounded-full px-3 py-1 text-sm"
              style={{
                backgroundColor: `${colorPalette.info.main}15`,
                color: colorPalette.info.dark,
              }}
            >
              {beaconCount} beacon{beaconCount === 1 ? "" : "s"}
            </div>
            <button
              type="button"
              onClick={triggerFileImport}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{
                backgroundColor: colorPalette.primary.main,
              }}
            >
              Import Layout
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportLayout}
            />
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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
                Click beacon to drag. Use beacon list to place new beacons on
                the map.
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
                      updateBeacon(index, "displayName", event.target.value)
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
                      updateBeacon(index, "txPower", Number(event.target.value))
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
  );
}
