import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import websocketService from "./websocketService";

describe("websocketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    websocketService.disconnect();
  });

  describe("getState", () => {
    it("returns initial state", () => {
      const state = websocketService.getState();
      expect(state).toEqual({
        trackers: {},
        wsStatus: "offline",
        mqttStatus: "disconnected",
      });
    });
  });

  describe("subscribe", () => {
    it("adds listener and calls it with current state", () => {
      const listener = vi.fn();
      const unsubscribe = websocketService.subscribe(listener);

      expect(listener).toHaveBeenCalledWith({
        trackers: {},
        wsStatus: "offline",
        mqttStatus: "disconnected",
      });

      // Test unsubscribe
      unsubscribe();
      websocketService.notify();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("supports multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      websocketService.subscribe(listener1);
      // listener1 called once on subscribe
      expect(listener1).toHaveBeenCalledTimes(1);

      websocketService.subscribe(listener2);
      // listener2 called once on subscribe
      expect(listener2).toHaveBeenCalledTimes(1);
      // listener1 NOT called again

      websocketService.notify();
      // Both called on notify
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(2);
    });
  });

  describe("setTrackers", () => {
    it("updates trackers and notifies listeners", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      const trackerMap = {
        "tracker-1": { trackerId: "tracker-1", x: 1, y: 2 },
        "tracker-2": { trackerId: "tracker-2", x: 3, y: 4 },
      };

      websocketService.setTrackers(trackerMap);

      expect(listener).toHaveBeenCalledTimes(2); // initial + update
      const lastCall = listener.mock.calls[1][0];
      expect(lastCall.trackers).toEqual(trackerMap);
    });
  });

  describe("updateTrackers", () => {
    it("merges tracker data and notifies listeners", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      // Initial state
      websocketService.setTrackers({
        "tracker-1": {
          trackerId: "tracker-1",
          x: 1,
          y: 2,
          lastUpdateTime: 1000,
        },
      });

      // Update with new data
      websocketService.updateTrackers({
        "tracker-1": {
          x: 5,
          y: 6,
          last_detected_beacons: [{ macAddress: "aa:bb:cc", rssi: -65 }],
        },
        "tracker-2": { trackerId: "tracker-2", x: 7, y: 8 },
      });

      expect(listener).toHaveBeenCalledTimes(3); // initial + set + update
      const lastCall = listener.mock.calls[2][0];
      expect(lastCall.trackers["tracker-1"].x).toBe(5);
      expect(lastCall.trackers["tracker-1"].y).toBe(6);
      expect(lastCall.trackers["tracker-1"].lastDetectedBeacons).toEqual([
        { macAddress: "aa:bb:cc", rssi: -65 },
      ]);
      expect(lastCall.trackers["tracker-2"].x).toBe(7);
    });

    it("ignores invalid data", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.updateTrackers(null);
      websocketService.updateTrackers("invalid");
      websocketService.updateTrackers(123);

      // Should only have initial call
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("setMQTTEnabled", () => {
    it("sets mqttEnabled flag", () => {
      websocketService.setMQTTEnabled(true);
      expect(websocketService.mqttEnabled).toBe(true);

      websocketService.setMQTTEnabled(false);
      expect(websocketService.mqttEnabled).toBe(false);

      websocketService.setMQTTEnabled(null);
      expect(websocketService.mqttEnabled).toBeNull();
    });
  });

  describe("handleMessage", () => {
    it("handles initial_state message", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage(
        JSON.stringify({
          type: "initial_state",
          data: { "tracker-1": { trackerId: "tracker-1", x: 1, y: 2 } },
        }),
      );

      expect(listener).toHaveBeenCalledTimes(2);
      const lastCall = listener.mock.calls[1][0];
      expect(lastCall.trackers["tracker-1"].x).toBe(1);
    });

    it("ignores tracker_update when mqttEnabled is false", () => {
      websocketService.setMQTTEnabled(false);
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage(
        JSON.stringify({
          type: "tracker_update",
          data: { "tracker-1": { trackerId: "tracker-1", x: 1, y: 2 } },
        }),
      );

      // Should only have initial call, no update
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("processes tracker_update when mqttEnabled is true", () => {
      websocketService.setMQTTEnabled(true);
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage(
        JSON.stringify({
          type: "tracker_update",
          data: { "tracker-1": { trackerId: "tracker-1", x: 1, y: 2 } },
        }),
      );

      expect(listener).toHaveBeenCalledTimes(2);
      const lastCall = listener.mock.calls[1][0];
      expect(lastCall.trackers["tracker-1"].x).toBe(1);
    });

    it("handles mqtt_status_update", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage(
        JSON.stringify({
          type: "mqtt_status_update",
          data: { status: "connected" },
        }),
      );

      expect(listener).toHaveBeenCalledTimes(2);
      const lastCall = listener.mock.calls[1][0];
      expect(lastCall.mqttStatus).toBe("connected");
    });

    it("handles invalid JSON gracefully", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage("not valid json");

      expect(consoleError).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledTimes(1); // Only initial call

      consoleError.mockRestore();
    });

    it("handles message without type", () => {
      const listener = vi.fn();
      websocketService.subscribe(listener);

      websocketService.handleMessage(
        JSON.stringify({
          data: { "tracker-1": { x: 1 } },
        }),
      );

      expect(listener).toHaveBeenCalledTimes(1); // Only initial call
    });
  });
});
