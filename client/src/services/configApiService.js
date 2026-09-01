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

export async function loadWebConfiguration() {
  return request("/config/web");
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

export async function postTrackerUpdate(update) {
  return request("/trackers", {
    method: "POST",
    body: JSON.stringify(update),
  });
}
