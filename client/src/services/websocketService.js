const DEFAULT_WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

import { getAuthToken } from "../services/authService";

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

class WebSocketService {
  constructor() {
    this.ws = null;
    this.manualClose = false;
    this.reconnectTimeout = null;
    this.listeners = new Set();
    this.trackers = {};
    this.wsStatus = "offline";
    this.mqttStatus = "disconnected";
    this.mqttEnabled = null;
  }

  getState() {
    return {
      trackers: safeClone(this.trackers),
      wsStatus: this.wsStatus,
      mqttStatus: this.mqttStatus,
    };
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("WebSocketService listener error:", err);
      }
    });
  }

  connect() {
    if (this.ws) {
      return;
    }

    this.manualClose = false;
    this.setWSStatus("connecting");

    let wsUrl = WS_URL;
    const authToken = getAuthToken();
    if (authToken) {
      try {
        const parsedUrl = new URL(WS_URL, window.location.origin);
        parsedUrl.searchParams.set("token", authToken);
        wsUrl = parsedUrl.toString();
      } catch {
        console.warn("Invalid WS URL, using default URL without auth token");
      }
    }

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      this.setWSStatus("error");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.setWSStatus("connected");
    });

    ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    ws.addEventListener("close", () => {
      // Only react if this is still the tracked socket. A stale socket that
      // closes after a newer connection was established (e.g. leaving the
      // dashboard and coming back) must not wipe out the live connection,
      // mark it offline, or schedule a spurious reconnect.
      if (this.ws !== ws) {
        return;
      }
      this.ws = null;
      this.setWSStatus("offline");
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });

    ws.addEventListener("error", () => {
      this.setWSStatus("error");
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimeout || this.manualClose) {
      return;
    }
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setWSStatus("offline");
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener) {
    this.listeners.delete(listener);
  }

  setWSStatus(status) {
    if (this.wsStatus !== status) {
      this.wsStatus = status;
      this.notify();
    }
  }

  setMQTTStatus(status) {
    if (this.mqttStatus !== status) {
      this.mqttStatus = status;
      this.notify();
    }
  }

  setMQTTEnabled(enabled) {
    this.mqttEnabled = enabled;
  }

  setTrackers(trackerMap) {
    this.trackers = trackerMap;
    this.notify();
  }

  updateTrackers(data) {
    if (!data || typeof data !== "object") {
      return;
    }
    const nextTrackers = { ...this.trackers };
    Object.entries(data).forEach(([id, value]) => {
      if (!value || typeof value !== "object") {
        return;
      }
      const { last_detected_beacons, ...rest } = value;
      nextTrackers[id] = {
        ...nextTrackers[id],
        ...rest,
        trackerId: id,
        ...(last_detected_beacons
          ? { lastDetectedBeacons: last_detected_beacons }
          : {}),
      };
    });
    this.trackers = nextTrackers;
    this.notify();
  }

  handleMessage(raw) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      console.error("Invalid WebSocket payload", err);
      return;
    }

    if (!payload || typeof payload !== "object") {
      return;
    }

    const { type, data } = payload;
    if (type === "initial_state") {
      if (data && typeof data === "object") {
        this.setTrackers({ ...data });
      }
      return;
    }

    if (type === "tracker_update") {
      // Only suppress updates when MQTT is explicitly disabled. When the flag
      // is still undefined (startup) or null (runtime config not loaded yet),
      // we still process updates — otherwise live reports are silently dropped
      // during the window between the WebSocket connecting and the runtime
      // config resolving, which made the dashboard appear empty until a reload.
      if (this.mqttEnabled === false) {
        return;
      }
      this.updateTrackers(data);
      return;
    }

    if (type === "mqtt_status_update") {
      const status = data?.status || "unknown";
      this.setMQTTStatus(status);
      return;
    }
  }
}

const websocketService = new WebSocketService();
export default websocketService;
