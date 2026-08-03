const DEFAULT_WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

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

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (err) {
      this.setWSStatus("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.setWSStatus("connected");
    });

    this.ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.ws.addEventListener("close", () => {
      this.ws = null;
      this.setWSStatus("offline");
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", () => {
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
      nextTrackers[id] = {
        ...nextTrackers[id],
        ...value,
        trackerId: id,
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
