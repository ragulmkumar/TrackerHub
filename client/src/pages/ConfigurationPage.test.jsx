import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ConfigurationPage from "./ConfigurationPage";
import {
  loadWebConfiguration,
  saveWebConfiguration,
} from "../services/configApiService";

// Mock configApiService
vi.mock("../services/configApiService", () => ({
  loadWebConfiguration: vi.fn(),
  saveWebConfiguration: vi.fn(),
  loadServerRuntimeConfiguration: vi.fn().mockResolvedValue({}),
  loadAuthenticationConfiguration: vi.fn().mockResolvedValue({
    adminUsername: "admin",
    password: "********",
  }),
  saveAuthenticationConfiguration: vi.fn().mockResolvedValue({}),
  saveServerRuntimeConfiguration: vi.fn().mockResolvedValue({}),
  restartServerRuntimeService: vi.fn().mockResolvedValue({}),
  getTrackers: vi.fn().mockResolvedValue([]),
  postTrackerUpdate: vi.fn().mockResolvedValue({}),
}));

// Mock colorPalette
vi.mock("../themes/colorPalette", () => ({
  default: {
    background: { default: "#0f172a", paper: "#1e293b" },
    primary: { main: "#3b82f6" },
    secondary: { main: "#8b5cf6" },
    text: { primary: "#f8fafc", secondary: "#94a3b8" },
    divider: "#334155",
    error: { main: "#ef4444", dark: "#b91c1c" },
    success: { main: "#22c55e", dark: "#166534" },
    info: { main: "#06b6d4", dark: "#0e7490" },
  },
}));

const mockConfig = {
  map: { name: "Main Floor", width: 30, height: 20, entities: [] },
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
  settings: { signalPropagationFactor: 2.5 },
};

const mockLayoutWithEntities = {
  map: {
    name: "Factory Floor",
    width: 50,
    height: 40,
    entities: [
      {
        type: "polyline",
        points: [
          [0, 0],
          [50, 0],
          [50, 40],
          [0, 40],
          [0, 0],
        ],
        closed: true,
        strokeColor: "#94a3b8",
        fillColor: "rgba(148, 163, 184, 0.1)",
        lineWidth: 2,
      },
      {
        type: "polyline",
        points: [
          [10, 10],
          [20, 10],
          [20, 20],
          [10, 20],
          [10, 10],
        ],
        closed: true,
        strokeColor: "#ef4444",
        fillColor: "rgba(239, 68, 68, 0.2)",
        lineWidth: 2,
      },
    ],
  },
  beacons: [
    {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      x: 15,
      y: 15,
      txPower: -59,
      displayName: "Beacon A",
      macAddress: "AA11BB22CC33",
    },
    {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E1",
      major: 1,
      minor: 2,
      x: 35,
      y: 25,
      txPower: -59,
      displayName: "Beacon B",
      macAddress: "AA11BB22CC34",
    },
  ],
  settings: { signalPropagationFactor: 2.0 },
};

describe("ConfigurationPage - Layout Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ConfigurationPage />
      </BrowserRouter>,
    );
  };

  it("renders Import Layout button", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });
  });

  it("shows file input when Import Layout is clicked", async () => {
    renderPage();
    await waitFor(() => {
      const importButton = screen.getByText("Import Layout");
      fireEvent.click(importButton);
      // File input is hidden, but we can verify it exists
      const fileInput = document.querySelector(
        'input[type="file"][accept=".json"]',
      );
      expect(fileInput).toBeInTheDocument();
    });
  });

  it("imports valid layout file and updates config", async () => {
    renderPage();
    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });
    // Find the beacon badge in the Map overview section
    await waitFor(() => {
      const mapOverviewSection = screen
        .getByText("Map overview")
        .closest("section");
      expect(mapOverviewSection).toBeInTheDocument();
      expect(mapOverviewSection).toHaveTextContent(/1 beacon/);
    });

    // Create a valid JSON file
    const jsonContent = JSON.stringify(mockLayoutWithEntities);
    const file = new File([jsonContent], "layout.json", {
      type: "application/json",
    });

    // Simulate file input change
    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Layout imported successfully. Review and save configuration.",
        ),
      ).toBeInTheDocument();
    });

    // Verify config was updated
    await waitFor(() => {
      // Check the Map overview section badge updates to "2 beacons"
      const mapOverviewSection = screen
        .getByText("Map overview")
        .closest("section");
      expect(mapOverviewSection).toHaveTextContent("2 beacons");
      expect(screen.getByDisplayValue("Factory Floor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("50")).toBeInTheDocument(); // width
      expect(screen.getByDisplayValue("40")).toBeInTheDocument(); // height
      expect(screen.getByDisplayValue("2")).toBeInTheDocument(); // signalPropagationFactor
    });
  });

  it("rejects invalid JSON file", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    // Create an invalid JSON file (missing required fields)
    const invalidJson = JSON.stringify({
      map: { width: 10 },
      beacons: "not-an-array",
    });
    const file = new File([invalidJson], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid layout format/)).toBeInTheDocument();
    });
  });

  it("rejects malformed JSON file", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    const file = new File(["{ invalid json }"], "malformed.json", {
      type: "application/json",
    });
    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Failed to parse JSON file/)).toBeInTheDocument();
    });
  });

  it("validates layout structure correctly - missing map", async () => {
    // Test validateLayoutStructure function directly by importing the component
    // Since it's not exported, we test via the import flow
    const invalidLayout = {
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "test.json", {
      type: "application/json",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid layout format/)).toBeInTheDocument();
    });
  });

  it("validates layout structure correctly - invalid entities", async () => {
    const invalidLayout = {
      map: {
        width: 30,
        height: 20,
        entities: [{ type: "invalid", points: [] }],
      },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "test.json", {
      type: "application/json",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid layout format/)).toBeInTheDocument();
    });
  });

  it("validates layout structure correctly - invalid polyline points", async () => {
    const invalidLayout = {
      map: {
        width: 30,
        height: 20,
        entities: [{ type: "polyline", points: [[1, 2, 3]] }],
      },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "test.json", {
      type: "application/json",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid layout format/)).toBeInTheDocument();
    });
  });

  it("preserves existing settings when importing layout without settings", async () => {
    const layoutWithoutSettings = {
      map: { name: "New Floor", width: 25, height: 15, entities: [] },
      beacons: [],
      settings: {}, // missing signalPropagationFactor
    };
    const file = new File(
      [JSON.stringify(layoutWithoutSettings)],
      "test.json",
      { type: "application/json" },
    );

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Import Layout")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("2.5")).toBeInTheDocument(); // Original signalPropagationFactor preserved
    });
  });
});

describe("ConfigurationPage - Beacon Placement on Imported Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockLayoutWithEntities);
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ConfigurationPage />
      </BrowserRouter>,
    );
  };

  it("renders imported layout entities in MapEditor", async () => {
    renderPage();
    await waitFor(() => {
      // MapEditor should render - verify canvas exists
      const canvas = document.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });
  });

  it("allows placing beacons on imported layout", async () => {
    renderPage();
    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });
    // Check the Map overview section badge shows "2 beacons"
    await waitFor(() => {
      const mapOverviewSection = screen
        .getByText("Map overview")
        .closest("section");
      expect(mapOverviewSection).toHaveTextContent("2 beacons");
    });

    // Click "Place on Map" for first beacon in the Beacon list section
    const beaconListSection = screen
      .getByText("Beacon list")
      .closest("section");
    const placeButtons = beaconListSection.querySelectorAll(
      "button:not([disabled])",
    );
    const placeButton = Array.from(placeButtons).find(
      (btn) => btn.textContent === "Place on Map",
    );
    expect(placeButton).toBeInTheDocument();
    fireEvent.click(placeButton);

    // The placement mode should be active - check the DOM indicator in MapEditor
    await waitFor(() => {
      expect(
        screen.getByText("Click map to place • Esc to cancel"),
      ).toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - Save and Reload Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockLayoutWithEntities);
    saveWebConfiguration.mockResolvedValue({
      message: "Configuration saved successfully.",
    });
  });

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ConfigurationPage />
      </BrowserRouter>,
    );
  };

  it("saves imported layout to server", async () => {
    renderPage();
    // Wait for loading to complete
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });
    // Check the Map overview section badge shows "2 beacons"
    await waitFor(() => {
      const mapOverviewSection = screen
        .getByText("Map overview")
        .closest("section");
      expect(mapOverviewSection).toHaveTextContent("2 beacons");
    });

    const saveButton = screen.getByText("Save configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveWebConfiguration).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("Configuration saved successfully."),
      ).toBeInTheDocument();
    });

    // Verify saved config includes layout entities
    const savedConfig = saveWebConfiguration.mock.calls[0][0];
    expect(savedConfig.map.entities).toHaveLength(2);
    expect(savedConfig.map.width).toBe(50);
    expect(savedConfig.map.height).toBe(40);
    expect(savedConfig.beacons).toHaveLength(2);
  });

  it("reloads layout from server on page load", async () => {
    // This is tested by the initial load
    renderPage();
    await waitFor(() => {
      expect(loadWebConfiguration).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue("Factory Floor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("50")).toBeInTheDocument();
      expect(screen.getByDisplayValue("40")).toBeInTheDocument();
    });
  });
});
