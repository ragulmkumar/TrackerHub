import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackerList from "./TrackerList";

describe("TrackerList", () => {
  it("renders a concise empty state when no trackers", () => {
    render(<TrackerList trackers={[]} />);
    expect(screen.getByText("No trackers connected yet.")).toBeInTheDocument();
  });

  it("shows tracker count in badge", () => {
    render(<TrackerList trackers={[]} />);
    expect(screen.getByText("0 active")).toBeInTheDocument();
  });

  it("displays tracker with position", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 5.123, y: 3.456 },
        accuracy: 1.5,
        timestamp: Date.now(),
        lastDetectedBeacons: [
          { macAddress: "aa:bb:cc:dd:ee:01", rssi: -65 },
          { macAddress: "aa:bb:cc:dd:ee:02", rssi: -70 },
        ],
      },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("tracker-1")).toBeInTheDocument();
    expect(screen.getByText("x: 5.12m · y: 3.46m")).toBeInTheDocument();
    expect(screen.getByText("Acc: 1.5m")).toBeInTheDocument();
  });

  it("displays tracker without position", () => {
    const trackers = [
      {
        trackerId: "tracker-2",
        position: null,
        lastUpdateTime: Date.now(),
      },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("tracker-2")).toBeInTheDocument();
    expect(screen.getByText("Position pending")).toBeInTheDocument();
    expect(screen.getByText("Acc: —")).toBeInTheDocument();
  });

  it("formats timestamp correctly", () => {
    const now = Date.now();
    const trackers = [
      {
        trackerId: "tracker-1",
        timestamp: now,
        position: { x: 1, y: 1 },
      },
    ];
    render(<TrackerList trackers={trackers} />);
    // Check that a formatted date appears
    const timestampText = new Date(now).toLocaleString();
    expect(screen.getByText(timestampText)).toBeInTheDocument();
  });

  it("shows beacon count and strongest RSSI", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 1, y: 1 },
        lastDetectedBeacons: [
          { macAddress: "aa:bb:cc:dd:ee:01", rssi: -65 },
          { macAddress: "aa:bb:cc:dd:ee:02", rssi: -70 },
          { macAddress: "aa:bb:cc:dd:ee:03", rssi: -55 },
        ],
      },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("Beacons seen")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Strongest RSSI: -55")).toBeInTheDocument();
  });

  it("handles missing lastDetectedBeacons", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 1, y: 1 },
      },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("Beacons seen")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Strongest RSSI: —")).toBeInTheDocument();
  });

  it("handles empty lastDetectedBeacons array", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 1, y: 1 },
        lastDetectedBeacons: [],
      },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("Beacons seen")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Strongest RSSI: —")).toBeInTheDocument();
  });

  it("handles tracker with only lastUpdateTime (no timestamp)", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 1, y: 1 },
        lastUpdateTime: Date.now(),
      },
    ];
    render(<TrackerList trackers={trackers} />);
    // Should not crash and should show a formatted date
    const timeText = screen.getByText(
      /^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)$/,
    );
    expect(timeText).toBeInTheDocument();
  });

  it("renders multiple trackers", () => {
    const trackers = [
      { trackerId: "tracker-1", position: { x: 1, y: 1 } },
      { trackerId: "tracker-2", position: { x: 2, y: 2 } },
      { trackerId: "tracker-3", position: { x: 3, y: 3 } },
    ];
    render(<TrackerList trackers={trackers} />);
    expect(screen.getByText("3 active")).toBeInTheDocument();
    expect(screen.getByText("tracker-1")).toBeInTheDocument();
    expect(screen.getByText("tracker-2")).toBeInTheDocument();
    expect(screen.getByText("tracker-3")).toBeInTheDocument();
  });
});
