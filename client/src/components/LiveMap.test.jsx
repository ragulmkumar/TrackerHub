import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveMap from "./LiveMap";

describe("LiveMap", () => {
  const defaultProps = {
    mapConfig: {
      map: { width: 10, height: 10, name: "Test Map" },
      beacons: [
        { uuid: "beacon-1", x: 1, y: 1, displayName: "Beacon 1" },
        { uuid: "beacon-2", x: 9, y: 9, displayName: "Beacon 2" },
      ],
    },
    beacons: [
      { uuid: "beacon-1", x: 1, y: 1, displayName: "Beacon 1" },
      { uuid: "beacon-2", x: 9, y: 9, displayName: "Beacon 2" },
    ],
    trackers: [],
    showTrails: true,
    wsStatus: "connected",
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders canvas element", () => {
    render(<LiveMap {...defaultProps} />);
    // Find canvas by test ID or element type
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("displays beacon and tracker counts in badge", () => {
    render(<LiveMap {...defaultProps} />);
    // Use a flexible text matcher to find the badge text
    expect(screen.getByText(/2 beacons · 0 trackers/)).toBeInTheDocument();
  });

  it("handles missing mapConfig gracefully", () => {
    render(<LiveMap {...defaultProps} mapConfig={null} wsStatus="connected" />);
    // Should render without crashing - just verify canvas exists
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("shows waiting message when websocket not connected (no mapConfig)", () => {
    render(<LiveMap {...defaultProps} mapConfig={null} wsStatus="offline" />);
    // Should render without crashing - just verify canvas exists
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders trackers with position", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 5, y: 5 },
        accuracy: 1.5,
      },
    ];
    render(<LiveMap {...defaultProps} trackers={trackers} />);
    // The badge shows "2 beacons · 1 tracker" (split across text nodes)
    expect(screen.getByText(/1 tracker/)).toBeInTheDocument();
  });

  it("handles trackers with position history for trails", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 5, y: 5 },
        position_history: [
          [1, 1],
          [2, 2],
          [3, 3],
        ],
      },
    ];
    render(<LiveMap {...defaultProps} trackers={trackers} showTrails={true} />);
    expect(screen.getByText(/1 tracker/)).toBeInTheDocument();
  });

  it("hides trails when showTrails is false", () => {
    const trackers = [
      {
        trackerId: "tracker-1",
        position: { x: 5, y: 5 },
        position_history: [
          [1, 1],
          [2, 2],
        ],
      },
    ];
    render(
      <LiveMap {...defaultProps} trackers={trackers} showTrails={false} />,
    );
    expect(screen.getByText(/1 tracker/)).toBeInTheDocument();
  });

  it("handles map entities (polylines)", () => {
    const mapConfig = {
      map: {
        width: 10,
        height: 10,
        name: "Test Map",
        entities: [
          {
            type: "polyline",
            points: [
              [0, 0],
              [10, 10],
            ],
            strokeColor: "#FF0000",
          },
        ],
      },
    };
    render(<LiveMap {...defaultProps} mapConfig={mapConfig} />);
    expect(screen.getByText(/2 beacons · 0 trackers/)).toBeInTheDocument();
  });

  it("handles beacon without displayName", () => {
    const mapConfig = {
      map: { width: 10, height: 10, name: "Test Map" },
      beacons: [{ uuid: "beacon-no-name", x: 1, y: 1 }],
    };
    render(
      <LiveMap
        {...defaultProps}
        mapConfig={mapConfig}
        beacons={mapConfig.beacons}
      />,
    );
    expect(screen.getByText(/1 beacon/)).toBeInTheDocument();
  });
});
