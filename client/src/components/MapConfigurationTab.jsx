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
  const [importType, setImportType] = useState("json");
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

  // Ensure config has required structure (defensive defaults)
  const safeConfig = {
    map: config?.map || defaultFormState.map,
    beacons: config?.beacons || [],
    settings: config?.settings || defaultFormState.settings,
  };

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

  const beaconCount = useMemo(() => safeConfig.beacons?.length || 0, [safeConfig.beacons]);

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
    if (index !== undefined && index >= 0 && index < safeConfig.beacons.length) {
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
    // Beacons are optional - user places them separately in TrackerHub
    // Reference format uses empty object {} for beacons, also accept array []
    if (jsonData.beacons !== undefined) {
      const beacons = jsonData.beacons;
      if (
        !Array.isArray(beacons) &&
        !(
          beacons &&
          typeof beacons === "object" &&
          Object.keys(beacons).length === 0
        )
      ) {
        return false;
      }
    }
    // Settings are optional - managed separately in TrackerHub
    if (
      jsonData.settings !== undefined &&
      typeof jsonData.settings !== "object"
    )
      return false;
    if (
      jsonData.settings &&
      typeof jsonData.settings.signalPropagationFactor !== "number"
    )
      return false;
    if (jsonData.map.entities && !Array.isArray(jsonData.map.entities))
      return false;
    if (jsonData.map.entities) {
      for (const entity of jsonData.map.entities) {
        // Support polyline and wall types (reference uses "wall" for closed boundaries)
        if (entity.type !== "polyline" && entity.type !== "wall") return false;
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

    // Check file extension before reading
    const fileName = file.name.toLowerCase();
    const isImage =
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png");
    const isJson = fileName.endsWith(".json");

    if (!isJson && !isImage) {
      setError(
        "Unsupported file format. Please upload a JSON layout file or JPG/PNG floor-plan image.",
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    if (isImage) {
      // Handle image import - read as data URL for background display
      reader.onload = (e) => {
        try {
          const imageDataUrl = e.target.result;
          // Create a new image to get its dimensions
          const img = new Image();
          img.onload = () => {
            // Use image dimensions as default map dimensions (in meters, assuming 1 pixel = 0.01m or similar)
            // For now, use reasonable defaults that can be adjusted by user
            const defaultWidth = 30;
            const defaultHeight = 20;

            setConfig((current) => ({
              map: {
                ...current.map,
                name: fileName.replace(/\.(jpg|jpeg|png)$/i, ""),
                width: defaultWidth,
                height: defaultHeight,
                entities: current.map.entities || [],
                backgroundImage: imageDataUrl,
                backgroundImageWidth: img.width,
                backgroundImageHeight: img.height,
              },
              // Keep existing beacons and settings
              beacons: current.beacons,
              settings: current.settings,
            }));
            setMessage(
              "Floor-plan image imported successfully. Adjust map dimensions to match the floor-plan scale, then add wall/boundary entities and place beacons.",
            );
            setError("");
          };
          img.onerror = () => {
            setError(
              "Failed to load image. Please ensure it's a valid JPG or PNG file.",
            );
          };
          img.src = imageDataUrl;
        } catch (err) {
          setError("Failed to process image file.");
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Handle JSON import
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          if (!validateLayoutStructure(jsonData)) {
            setError(
              "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
            );
            return;
          }
          // Normalize beacons: treat empty object {} same as empty array [] or undefined (preserve existing)
          const importedBeacons = jsonData.beacons;
          const hasBeacons =
            importedBeacons !== undefined &&
            !(
              importedBeacons &&
              typeof importedBeacons === "object" &&
              Object.keys(importedBeacons).length === 0
            ) &&
            !(Array.isArray(importedBeacons) && importedBeacons.length === 0);

          setConfig((current) => ({
            map: {
              ...current.map,
              name: jsonData.map.name || current.map.name,
              width: jsonData.map.width,
              height: jsonData.map.height,
              entities: jsonData.map.entities || [],
              // Clear background image when importing JSON layout
              backgroundImage: undefined,
              backgroundImageWidth: undefined,
              backgroundImageHeight: undefined,
            },
            // Only update beacons if they were provided as non-empty array in the layout file
            // Otherwise keep existing beacons (beacon config is managed separately)
            beacons: hasBeacons
              ? Array.isArray(importedBeacons)
                ? importedBeacons
                : []
              : current.beacons,
            // Only update settings if provided
            settings:
              jsonData.settings !== undefined
                ? {
                    ...current.settings,
                    signalPropagationFactor:
                      jsonData.settings?.signalPropagationFactor ??
                      current.settings.signalPropagationFactor,
                  }
                : current.settings,
          }));
          setMessage(
            "Floor layout imported successfully. Map dimensions and wall/boundary entities loaded. Add and place beacons separately using the beacon list.",
          );
          setError("");
        } catch (err) {
          setError("The selected file is not valid JSON.");
        }
      };
      reader.readAsText(file);
    }
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

  function handleRemoveImage() {
    setConfig((current) => ({
      map: {
        ...current.map,
        backgroundImage: undefined,
        backgroundImageWidth: undefined,
        backgroundImageHeight: undefined,
      },
    }));
    setMessage("Floor-plan image removed.");
    setError("");
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
            <div className="flex items-center gap-2">
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm bg-white border border-slate-300"
                style={{ color: colorPalette.text.primary }}
              >
                <option value="json">JSON Layout</option>
                <option value="image">Image (JPG/PNG)</option>
              </select>
              <button
                type="button"
                onClick={triggerFileImport}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{
                  backgroundColor: colorPalette.primary.main,
                }}
              >
                Import Floor Layout
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept={importType === "json" ? ".json" : ".jpg,.jpeg,.png"}
                title={
                  importType === "json"
                    ? "Supported format: JSON floor layout with map dimensions and polyline/wall entities"
                    : "Supported formats: JPG/PNG floor-plan images"
                }
                style={{ display: "none" }}
                onChange={handleImportLayout}
              />
            </div>
          </div>
        </div>

        {/* Show floor-plan image info when loaded */}
        {safeConfig.map.backgroundImage && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50/50 border border-emerald-200 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: colorPalette.success.dark }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: colorPalette.success.dark }}>
                  Floor-plan image loaded
                </p>
                <p className="text-xs" style={{ color: colorPalette.success.main }}>
                  {safeConfig.map.backgroundImageWidth
                    ? `${safeConfig.map.backgroundImageWidth} × ${safeConfig.map.backgroundImageHeight} px`
                    : "Unknown dimensions"}
                  {safeConfig.map.name && ` · ${safeConfig.map.name}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{
                backgroundColor: colorPalette.error.main,
              }}
            >
              Remove Image
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label
            className="text-sm font-medium"
            style={{ color: colorPalette.text.secondary }}
          >
            Map name
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm outline-none"
              value={safeConfig.map.name}
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
              value={config.settings?.signalPropagationFactor ?? 2.5}
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
              value={safeConfig.map.width}
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
              value={safeConfig.map.height}
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
            beacons={safeConfig.beacons}
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
            {safeConfig.beacons.map((beacon, index) => (
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
