import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MapEditor from "./MapEditor";

const defaultProps = {
  mapConfig: {
    map: { width: 20, height: 15, name: "Test Map" },
  },
  beacons: [
    { uuid: "beacon-1", x: 5, y: 5, displayName: "Beacon 1" },
    { uuid: "beacon-2", x: 10, y: 10, displayName: "Beacon 2" },
  ],
  onBeaconsChange: vi.fn(),
  canvasWidth: 800,
  canvasHeight: 600,
};

describe("MapEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders canvas element", () => {
    render(<MapEditor {...defaultProps} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("displays beacon count badge", () => {
    render(<MapEditor {...defaultProps} />);
    expect(screen.getByText(/2 beacons/)).toBeInTheDocument();
  });

  it("renders without crashing when mapConfig is null", () => {
    render(<MapEditor {...defaultProps} mapConfig={null} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("does not crash when beacon has no x/y", () => {
    const beacons = [
      { uuid: "beacon-1", displayName: "Beacon 1" }, // no x, y
      { uuid: "beacon-2", x: 10, y: 10, displayName: "Beacon 2" },
    ];
    render(<MapEditor {...defaultProps} beacons={beacons} />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("enters placement mode when placementBeacon is provided", () => {
    const placementBeacon = {
      uuid: "new-beacon",
      displayName: "New Beacon",
      _index: 2,
    };
    render(<MapEditor {...defaultProps} placementBeacon={placementBeacon} />);

    // The component should render without error
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("handles rapid prop changes without crashing", () => {
    const { rerender } = render(<MapEditor {...defaultProps} />);

    // Change map config
    rerender(
      <MapEditor
        {...defaultProps}
        mapConfig={{ map: { width: 30, height: 20, name: "Large Map" } }}
      />,
    );

    // Change beacons
    rerender(
      <MapEditor
        {...defaultProps}
        beacons={[
          { uuid: "beacon-1", x: 1, y: 1, displayName: "Beacon 1" },
          { uuid: "beacon-2", x: 29, y: 19, displayName: "Beacon 2" },
          { uuid: "beacon-3", x: 15, y: 10, displayName: "Beacon 3" },
        ]}
      />,
    );

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
