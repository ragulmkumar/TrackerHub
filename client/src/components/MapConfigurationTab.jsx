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

// ── Validation helpers ──────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const MAC_HEX_ONLY = /^[0-9A-Fa-f]{12}$/;

function validateUUID(uuid) {
  if (!uuid || uuid.trim() === "") return "UUID is required";
  if (!UUID_REGEX.test(uuid.trim()))
    return "UUID must be in format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (hex characters)";
  return "";
}

function validateMajor(value) {
  const num = Number(value);
  if (isNaN(num)) return "Major must be a number";
  if (!Number.isInteger(num)) return "Major must be a whole number";
  if (num < 0 || num > 65535) return "Major must be 0–65535";
  return "";
}

function validateMinor(value) {
  const num = Number(value);
  if (isNaN(num)) return "Minor must be a number";
  if (!Number.isInteger(num)) return "Minor must be a whole number";
  if (num < 0 || num > 65535) return "Minor must be 0–65535";
  return "";
}

function validateTXPower(value) {
  if (value === null || value === undefined || value === "")
    return "TX Power is required";
  const num = Number(value);
  if (isNaN(num)) return "TX Power must be a number";
  if (num < -100 || num > 20) return "TX Power must be between –100 and 20";
  return "";
}

/**
 * Normalize user-entered MAC to canonical form: uppercase, no separators, 12 hex chars.
 * Returns { normalized, error } where error is a user-facing string or empty.
 */
function normalizeMAC(raw) {
  if (!raw || raw.trim() === "") return { normalized: "", error: "" };
  const stripped = raw.replace(/[:\-]/g, "").toUpperCase();
  if (!MAC_HEX_ONLY.test(stripped))
    return {
      normalized: stripped,
      error:
        "MAC must contain exactly 12 hexadecimal characters (e.g. C3:00:00:3E:7D:E0)",
    };
  return { normalized: stripped, error: "" };
}

/**
 * Validate a complete beacon form.
 * @param {object} beacon - the form values
 * @param {Array} existingBeacons - current beacon list
 * @param {'add'|'edit'} mode
 * @param {number} editIndex - index being edited (-1 for add)
 * @returns {{ valid: boolean, errors: object }}
 */
function validateBeaconForm(beacon, existingBeacons, mode, editIndex) {
  const errors = {};
  const uuidErr = validateUUID(beacon.uuid);
  if (uuidErr) errors.uuid = uuidErr;
  const majorErr = validateMajor(beacon.major);
  if (majorErr) errors.major = majorErr;
  const minorErr = validateMinor(beacon.minor);
  if (minorErr) errors.minor = minorErr;
  const txErr = validateTXPower(beacon.txPower);
  if (txErr) errors.txPower = txErr;

  // MAC validation (only if user entered something)
  if (beacon.macAddress && beacon.macAddress.trim() !== "") {
    const { error: macErr } = normalizeMAC(beacon.macAddress);
    if (macErr) errors.macAddress = macErr;
  }

  // Display name
  if (!beacon.displayName || beacon.displayName.trim() === "")
    errors.displayName = "Display name is required";

  // Duplicate identity check (UUID + Major + Minor)
  const identity = `${(beacon.uuid || "").toUpperCase()}-${beacon.major}-${beacon.minor}`;
  const isDuplicate = existingBeacons.some((b, i) => {
    if (mode === "edit" && i === editIndex) return false;
    return `${(b.uuid || "").toUpperCase()}-${b.major}-${b.minor}` === identity;
  });
  if (isDuplicate)
    errors.identity =
      "A beacon with this UUID, Major, and Minor already exists.";

  // Duplicate MAC check (if MAC provided)
  if (beacon.macAddress && beacon.macAddress.trim() !== "") {
    const { normalized } = normalizeMAC(beacon.macAddress);
    if (normalized) {
      const macDuplicate = existingBeacons.some((b, i) => {
        if (mode === "edit" && i === editIndex) return false;
        const existingNorm = normalizeMAC(b.macAddress).normalized;
        return existingNorm && existingNorm === normalized;
      });
      if (macDuplicate)
        errors.macDuplicate = "A beacon with this MAC address already exists.";
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

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
  const [mapDimensionErrors, setMapDimensionErrors] = useState({});
  const fileInputRef = useRef(null);

  // ── Beacon modal state ──────────────────────────────────────────────────
  const [showBeaconModal, setShowBeaconModal] = useState(false);
  const [beaconModalMode, setBeaconModalMode] = useState("add"); // 'add' | 'edit'
  const [editingBeaconIndex, setEditingBeaconIndex] = useState(-1);
  const [editingBeacon, setEditingBeacon] = useState({
    displayName: "",
    uuid: "",
    major: 1,
    minor: 1,
    macAddress: "",
    x: 0,
    y: 0,
    txPower: -59,
  });
  const [beaconFormErrors, setBeaconFormErrors] = useState({});

  /**
   * Validate map dimension value
   * Returns error message if invalid, or empty string if valid
   */
  function validateMapDimension(value, fieldName) {
    if (value === null || value === undefined || value === "") {
      return `${fieldName} is required`;
    }
    const num = Number(value);
    if (isNaN(num)) {
      return `${fieldName} must be a number`;
    }
    if (num <= 0) {
      return `${fieldName} must be greater than 0`;
    }
    return "";
  }

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

  const beaconCount = useMemo(
    () => safeConfig.beacons?.length || 0,
    [safeConfig.beacons],
  );

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
    if (
      index !== undefined &&
      index >= 0 &&
      index < safeConfig.beacons.length
    ) {
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

  // ── Beacon modal helpers ────────────────────────────────────────────────

  function openAddBeaconModal() {
    setBeaconModalMode("add");
    setEditingBeaconIndex(-1);
    setEditingBeacon({
      displayName: "",
      uuid: "",
      major: 1,
      minor: 1,
      macAddress: "",
      x: 0,
      y: 0,
      txPower: -59,
    });
    setBeaconFormErrors({});
    setShowBeaconModal(true);
  }

  function openEditBeaconModal(index) {
    const beacon = safeConfig.beacons[index];
    if (!beacon) return;
    setBeaconModalMode("edit");
    setEditingBeaconIndex(index);
    setEditingBeacon({
      displayName: beacon.displayName || "",
      uuid: beacon.uuid || "",
      major: beacon.major ?? 1,
      minor: beacon.minor ?? 1,
      macAddress: beacon.macAddress || "",
      x: beacon.x ?? 0,
      y: beacon.y ?? 0,
      txPower: beacon.txPower ?? -59,
    });
    setBeaconFormErrors({});
    setShowBeaconModal(true);
  }

  function closeBeaconModal() {
    setShowBeaconModal(false);
    setBeaconFormErrors({});
  }

  function handleBeaconFormChange(field, value) {
    setEditingBeacon((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error as user edits
    setBeaconFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function saveBeaconFromModal() {
    // Normalize MAC before validation
    const macInput = editingBeacon.macAddress || "";
    const { normalized: normalizedMAC, error: macNormError } =
      normalizeMAC(macInput);
    const beaconToValidate = {
      ...editingBeacon,
      macAddress: normalizedMAC || macInput,
    };

    const { valid, errors } = validateBeaconForm(
      beaconToValidate,
      safeConfig.beacons,
      beaconModalMode,
      editingBeaconIndex,
    );

    if (macNormError) errors.macAddress = macNormError;

    if (!valid) {
      setBeaconFormErrors(errors);
      return;
    }

    // Clamp X/Y to map bounds
    const clampedX = Math.min(
      Math.max(0, beaconToValidate.x),
      safeConfig.map?.width ?? Infinity,
    );
    const clampedY = Math.min(
      Math.max(0, beaconToValidate.y),
      safeConfig.map?.height ?? Infinity,
    );

    const finalBeacon = {
      ...beaconToValidate,
      macAddress: normalizedMAC,
      x: clampedX,
      y: clampedY,
    };

    setConfig((current) => {
      const next = { ...current, beacons: [...current.beacons] };
      if (beaconModalMode === "edit" && editingBeaconIndex >= 0) {
        next.beacons[editingBeaconIndex] = finalBeacon;
      } else {
        next.beacons.push(finalBeacon);
      }
      return next;
    });

    const actionLabel = beaconModalMode === "edit" ? "updated" : "created";
    setMessage(
      `Beacon "${finalBeacon.displayName}" ${actionLabel}. Click Save to persist.`,
    );
    setShowBeaconModal(false);
  }

  function deleteBeacon(index) {
    const beacon = safeConfig.beacons[index];
    if (!beacon) return;
    setConfig((current) => {
      const next = { ...current, beacons: [...current.beacons] };
      next.beacons.splice(index, 1);
      return next;
    });
    setMessage(
      `Beacon "${beacon.displayName || `Beacon ${index + 1}`}" removed. Click Save to persist.`,
    );
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
                <p
                  className="text-sm font-medium"
                  style={{ color: colorPalette.success.dark }}
                >
                  Floor-plan image loaded
                </p>
                <p
                  className="text-xs"
                  style={{ color: colorPalette.success.main }}
                >
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
              step="0.01"
              min="0.01"
              className={`mt-2 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none transition-colors ${
                mapDimensionErrors.width
                  ? "border-red-400 bg-red-50/50"
                  : "border-slate-200"
              }`}
              value={safeConfig.map.width}
              onChange={(event) => {
                const value = event.target.value;
                const error = validateMapDimension(value, "Width");
                setMapDimensionErrors((prev) => ({
                  ...prev,
                  width: error,
                }));
                if (!error) {
                  setConfig((current) => ({
                    ...current,
                    map: {
                      ...current.map,
                      width: Number(value),
                    },
                  }));
                }
              }}
            />
            {mapDimensionErrors.width && (
              <p
                className="mt-1 text-xs"
                style={{ color: colorPalette.error.main }}
              >
                {mapDimensionErrors.width}
              </p>
            )}
          </label>
          <label
            className="text-sm font-medium"
            style={{ color: colorPalette.text.secondary }}
          >
            Height (m)
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={`mt-2 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none transition-colors ${
                mapDimensionErrors.height
                  ? "border-red-400 bg-red-50/50"
                  : "border-slate-200"
              }`}
              value={safeConfig.map.height}
              onChange={(event) => {
                const value = event.target.value;
                const error = validateMapDimension(value, "Height");
                setMapDimensionErrors((prev) => ({
                  ...prev,
                  height: error,
                }));
                if (!error) {
                  setConfig((current) => ({
                    ...current,
                    map: {
                      ...current.map,
                      height: Number(value),
                    },
                  }));
                }
              }}
            />
            {mapDimensionErrors.height && (
              <p
                className="mt-1 text-xs"
                style={{ color: colorPalette.error.main }}
              >
                {mapDimensionErrors.height}
              </p>
            )}
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
              Add, edit, or remove beacons. Use "Place on Map" to set a beacon's
              position visually.
            </p>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={openAddBeaconModal}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: colorPalette.primary.main }}
            >
              + Add Beacon
            </button>
          </div>

          <div className="space-y-3">
            {safeConfig.beacons.map((beacon, index) => (
              <div
                key={`${beacon.uuid}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                {/* Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorPalette.primary.main }}
                      title={beacon.macAddress || "No MAC"}
                    />
                    <strong style={{ color: colorPalette.text.primary }}>
                      {beacon.displayName || `Beacon ${index + 1}`}
                    </strong>
                  </div>
                  <span
                    className="rounded bg-slate-200 px-2 py-0.5 text-xs"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    {beacon.major}:{beacon.minor}
                  </span>
                </div>

                {/* Read-only identity fields */}
                <div className="mb-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span
                      className="font-medium"
                      style={{ color: colorPalette.text.secondary }}
                    >
                      UUID:{" "}
                    </span>
                    <span
                      className="break-all"
                      style={{ color: colorPalette.text.primary }}
                    >
                      {beacon.uuid || "—"}
                    </span>
                  </div>
                  <div>
                    <span
                      className="font-medium"
                      style={{ color: colorPalette.text.secondary }}
                    >
                      MAC:{" "}
                    </span>
                    <span style={{ color: colorPalette.text.primary }}>
                      {beacon.macAddress || "—"}
                    </span>
                  </div>
                </div>

                {/* Inline editable fields */}
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

                {/* Action buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
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
                  <button
                    type="button"
                    onClick={() => openEditBeaconModal(index)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    style={{ backgroundColor: colorPalette.info.main }}
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBeacon(index)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    style={{ backgroundColor: colorPalette.error.main }}
                  >
                    Delete
                  </button>
                  {beacon.x != null && beacon.y != null && (
                    <span className="text-xs text-slate-500 self-center ml-auto">
                      Position: ({Number(beacon.x).toFixed(2)},{" "}
                      {Number(beacon.y).toFixed(2)}) m
                    </span>
                  )}
                </div>
              </div>
            ))}

            {safeConfig.beacons.length === 0 && (
              <div
                className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-6 text-center"
                style={{ color: colorPalette.text.secondary }}
              >
                <p className="text-sm">No beacons configured yet.</p>
                <p className="mt-1 text-xs">
                  Click <strong>+ Add Beacon</strong> above to create one, then
                  place it on the map.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Add / Edit Beacon Modal ──────────────────────────────────────── */}
      {showBeaconModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeBeaconModal();
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3
                className="text-lg font-semibold"
                style={{ color: colorPalette.text.primary }}
              >
                {beaconModalMode === "add" ? "Add New Beacon" : "Edit Beacon"}
              </h3>
              <button
                type="button"
                onClick={closeBeaconModal}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {beaconFormErrors.identity && (
              <div
                className="mb-3 rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: colorPalette.error.light,
                  backgroundColor: `${colorPalette.error.main}10`,
                  color: colorPalette.error.dark,
                }}
              >
                {beaconFormErrors.identity}
              </div>
            )}
            {beaconFormErrors.macDuplicate && (
              <div
                className="mb-3 rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: colorPalette.error.light,
                  backgroundColor: `${colorPalette.error.main}10`,
                  color: colorPalette.error.dark,
                }}
              >
                {beaconFormErrors.macDuplicate}
              </div>
            )}

            <div className="grid gap-3">
              {/* Display Name */}
              <label className="text-sm">
                <span
                  className="mb-1 block font-medium"
                  style={{ color: colorPalette.text.secondary }}
                >
                  Display Name *
                </span>
                <input
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors ${
                    beaconFormErrors.displayName
                      ? "border-red-400 bg-red-50/50"
                      : "border-slate-200"
                  }`}
                  value={editingBeacon.displayName}
                  placeholder="e.g. Beacon A"
                  onChange={(e) =>
                    handleBeaconFormChange("displayName", e.target.value)
                  }
                />
                {beaconFormErrors.displayName && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorPalette.error.main }}
                  >
                    {beaconFormErrors.displayName}
                  </p>
                )}
              </label>

              {/* UUID */}
              <label className="text-sm">
                <span
                  className="mb-1 block font-medium"
                  style={{ color: colorPalette.text.secondary }}
                >
                  UUID *
                </span>
                <input
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono outline-none transition-colors ${
                    beaconFormErrors.uuid
                      ? "border-red-400 bg-red-50/50"
                      : "border-slate-200"
                  }`}
                  value={editingBeacon.uuid}
                  placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
                  onChange={(e) =>
                    handleBeaconFormChange("uuid", e.target.value.trim())
                  }
                />
                {beaconFormErrors.uuid && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorPalette.error.main }}
                  >
                    {beaconFormErrors.uuid}
                  </p>
                )}
              </label>

              {/* Major + Minor row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span
                    className="mb-1 block font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Major * <span className="font-normal">(0–65535)</span>
                  </span>
                  <input
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors ${
                      beaconFormErrors.major
                        ? "border-red-400 bg-red-50/50"
                        : "border-slate-200"
                    }`}
                    type="number"
                    min="0"
                    max="65535"
                    value={editingBeacon.major}
                    onChange={(e) =>
                      handleBeaconFormChange("major", Number(e.target.value))
                    }
                  />
                  {beaconFormErrors.major && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: colorPalette.error.main }}
                    >
                      {beaconFormErrors.major}
                    </p>
                  )}
                </label>
                <label className="text-sm">
                  <span
                    className="mb-1 block font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Minor * <span className="font-normal">(0–65535)</span>
                  </span>
                  <input
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors ${
                      beaconFormErrors.minor
                        ? "border-red-400 bg-red-50/50"
                        : "border-slate-200"
                    }`}
                    type="number"
                    min="0"
                    max="65535"
                    value={editingBeacon.minor}
                    onChange={(e) =>
                      handleBeaconFormChange("minor", Number(e.target.value))
                    }
                  />
                  {beaconFormErrors.minor && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: colorPalette.error.main }}
                    >
                      {beaconFormErrors.minor}
                    </p>
                  )}
                </label>
              </div>

              {/* MAC Address */}
              <label className="text-sm">
                <span
                  className="mb-1 block font-medium"
                  style={{ color: colorPalette.text.secondary }}
                >
                  MAC Address
                </span>
                <input
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono outline-none transition-colors ${
                    beaconFormErrors.macAddress
                      ? "border-red-400 bg-red-50/50"
                      : "border-slate-200"
                  }`}
                  value={editingBeacon.macAddress}
                  placeholder="c3:00:00:3e:7d:e0"
                  onChange={(e) =>
                    handleBeaconFormChange("macAddress", e.target.value)
                  }
                />
                <p
                  className="mt-1 text-xs"
                  style={{ color: colorPalette.text.disabled }}
                >
                  Colons and dashes are removed automatically. Stored as
                  uppercase (e.g. C300003E7DE0).
                </p>
                {beaconFormErrors.macAddress && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorPalette.error.main }}
                  >
                    {beaconFormErrors.macAddress}
                  </p>
                )}
              </label>

              {/* X + Y row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span
                    className="mb-1 block font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    X position (m)
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingBeacon.x}
                    onChange={(e) =>
                      handleBeaconFormChange("x", Number(e.target.value))
                    }
                  />
                </label>
                <label className="text-sm">
                  <span
                    className="mb-1 block font-medium"
                    style={{ color: colorPalette.text.secondary }}
                  >
                    Y position (m)
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingBeacon.y}
                    onChange={(e) =>
                      handleBeaconFormChange("y", Number(e.target.value))
                    }
                  />
                </label>
              </div>

              {/* TX Power */}
              <label className="text-sm">
                <span
                  className="mb-1 block font-medium"
                  style={{ color: colorPalette.text.secondary }}
                >
                  TX Power (RSSI at 1 m) *
                </span>
                <input
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors ${
                    beaconFormErrors.txPower
                      ? "border-red-400 bg-red-50/50"
                      : "border-slate-200"
                  }`}
                  type="number"
                  value={editingBeacon.txPower}
                  placeholder="-59"
                  onChange={(e) =>
                    handleBeaconFormChange("txPower", Number(e.target.value))
                  }
                />
                {beaconFormErrors.txPower && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colorPalette.error.main }}
                  >
                    {beaconFormErrors.txPower}
                  </p>
                )}
              </label>
            </div>

            {/* Modal actions */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBeaconModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveBeaconFromModal}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: colorPalette.primary.main }}
              >
                {beaconModalMode === "add" ? "Create Beacon" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
