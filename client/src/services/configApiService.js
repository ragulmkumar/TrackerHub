const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getAuthHeaders() {
  const token = localStorage.getItem("trackerhubToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("trackerhubToken");
      localStorage.removeItem("trackerhubUser");
    }
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

function normalizeDashboardPayload(data) {
  const maps = Array.isArray(data?.maps) ? data.maps : [];
  const primaryMap = maps[0] || {};
  const mapDetails = primaryMap.map || data?.map || {};
  const normalizedMap = {
    ...(mapDetails || {}),
    background:
      mapDetails.background ||
      mapDetails.backgroundImage ||
      data?.background ||
      "",
    backgroundImage:
      mapDetails.background ||
      mapDetails.backgroundImage ||
      data?.background ||
      "",
    backgroundImageWidth:
      mapDetails.backgroundImageWidth || data?.backgroundImageWidth || 0,
    backgroundImageHeight:
      mapDetails.backgroundImageHeight || data?.backgroundImageHeight || 0,
    entities: mapDetails.entities || data?.entities || [],
    width: mapDetails.width || data?.width || 0,
    height: mapDetails.height || data?.height || 0,
    minX: mapDetails.minX ?? data?.minX ?? 0,
    maxX: mapDetails.maxX ?? data?.maxX ?? 0,
    minY: mapDetails.minY ?? data?.minY ?? 0,
    maxY: mapDetails.maxY ?? data?.maxY ?? 0,
  };

  return {
    map: normalizedMap,
    beacons: Array.isArray(primaryMap.beacons)
      ? primaryMap.beacons
      : Array.isArray(data?.beacons)
        ? data.beacons
        : [],
    settings: primaryMap.settings ||
      data?.settings || { signalPropagationFactor: 2.5 },
  };
}

export async function loadWebConfiguration() {
  const data = await request("/config/web");
  if (Array.isArray(data?.maps)) {
    return normalizeDashboardPayload(data);
  }
  return data;
}

export async function loadDashboardConfiguration() {
  const data = await request("/dashboard");
  return normalizeDashboardPayload(data);
}

export async function saveWebConfiguration(configData) {
  return request("/config/web", {
    method: "POST",
    body: JSON.stringify(configData),
  });
}

function normalizeRuntimeConfig(data) {
  const fallbackMqtt =
    data?.mqtt ||
    data?.lwnsMqtt ||
    data?.chirpStackMqtt ||
    data?.sensecapOpenStream ||
    {};
  const lwnsMqtt = data?.lwnsMqtt || fallbackMqtt;
  const normalized = {
    ...data,
    mqtt: fallbackMqtt,
    lwnsMqtt,
    chirpStackMqtt: data?.chirpStackMqtt || lwnsMqtt,
    sensecapOpenStream: data?.sensecapOpenStream || {
      brokerHost: "127.0.0.1",
      brokerPort: 1883,
      username: "",
      password: null,
      applicationID: null,
      topicPattern: "",
      clientID: "",
      enabled: false,
      live_mqtt_status: "disconnected",
    },
    trackerAccessControl: {
      enabled: Boolean(
        data?.trackerAccessControl?.enabled ??
        data?.tracker_access_control ??
        true,
      ),
      allowAll: Boolean(
        data?.trackerAccessControl?.allowAll ?? data?.allow_all_tracker ?? true,
      ),
      allowedTrackers: data?.trackerAccessControl?.allowedTrackers || [],
    },
    webhook: data?.webhook || { enabled: false },
  };

  if (
    normalized.trackerAccessControl.enabled === false &&
    normalized.trackerAccessControl.allowAll === false
  ) {
    normalized.trackerAccessControl.allowAll = true;
  }

  return normalized;
}

export async function loadServerRuntimeConfiguration() {
  const data = await request("/server-runtime-config");
  return normalizeRuntimeConfig(data);
}

export async function loadAuthenticationConfiguration() {
  return request("/auth-config");
}

export async function saveAuthenticationConfiguration(configData) {
  return request("/auth-config", {
    method: "POST",
    body: JSON.stringify(configData),
  });
}

export async function saveServerRuntimeConfiguration(configData) {
  return request("/server-runtime-config", {
    method: "POST",
    body: JSON.stringify(configData),
  });
}

export async function restartServerRuntimeService() {
  return request("/server-runtime-config/restart", {
    method: "POST",
  });
}

export async function getTrackers() {
  return request("/trackers");
}

// The REST /trackers endpoint returns the persisted shape (flat x/y,
// last_update_time, snake_case beacon fields), which differs from the shape the
// WebSocket push delivers (position:{x,y}, timestamp, camelCase fields). The UI
// (LiveMap / TrackerList) reads the WebSocket shape, so normalize one tracker
// here so a REST snapshot can be used as a drop-in for live data.
export function normalizeTrackerState(tracker = {}) {
  const hasPosition = tracker.x != null && tracker.y != null;
  return {
    trackerId: tracker.trackerId,
    position: hasPosition ? { x: tracker.x, y: tracker.y } : null,
    accuracy: tracker.accuracy != null ? tracker.accuracy : null,
    battery: tracker.battery != null ? tracker.battery : null,
    timestamp: tracker.last_update_time || tracker.timestamp,
    lastUpdateTime: tracker.last_update_time || tracker.timestamp,
    lastDetectedBeacons: tracker.last_detected_beacons || [],
    usedBeacons: tracker.used_beacons || [],
    map: tracker.map || null,
    type: tracker.type || null,
    online: tracker.online || null,
    id: tracker.id != null ? tracker.id : null,
    deviceName: tracker.device_name || null,
    groupId: tracker.group_id != null ? tracker.group_id : null,
    isFavorite: Boolean(tracker.is_favorite),
    trackerNumber:
      tracker.tracker_number != null ? tracker.tracker_number : null,
    position_history: tracker.position_history || [],
  };
}

export async function postTrackerUpdate(update) {
  return request("/trackers", {
    method: "POST",
    body: JSON.stringify(update),
  });
}
