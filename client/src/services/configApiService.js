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

export async function loadServerRuntimeConfiguration() {
  return request("/server-runtime-config");
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
