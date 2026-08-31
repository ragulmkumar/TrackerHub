import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
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

// Valid tiny 1x1 pixel transparent PNG data URL for testing
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

const renderPage = (initialConfig = mockConfig) => {
  vi.clearAllMocks();
  loadWebConfiguration.mockResolvedValue(initialConfig);
  saveWebConfiguration.mockResolvedValue({
    message: "Configuration saved successfully.",
  });

  return render(
    <BrowserRouter>
      <ConfigurationPage />
    </BrowserRouter>,
  );
};

// Render page with custom loadWebConfiguration mock (for error cases)
const renderPageWithLoadMock = (loadMock) => {
  vi.clearAllMocks();
  loadWebConfiguration.mockImplementation(loadMock);
  saveWebConfiguration.mockResolvedValue({
    message: "Configuration saved successfully.",
  });

  return render(
    <BrowserRouter>
      <ConfigurationPage />
    </BrowserRouter>,
  );
};

describe("ConfigurationPage - Tab Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  it("renders three tab buttons: Map Configuration, App Configuration, Alarm Settings", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("tab", { name: "Map Configuration" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "App Configuration" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Alarm Settings" }),
    ).toBeInTheDocument();
  });

  it("defaults to Map Configuration tab", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const mapTab = screen.getByRole("tab", { name: "Map Configuration" });
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "App Configuration" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Alarm Settings" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("switches to App Configuration tab when clicked", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const appTab = screen.getByRole("tab", { name: "App Configuration" });
    fireEvent.click(appTab);

    await waitFor(() => {
      expect(appTab).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByRole("tab", { name: "Map Configuration" }),
      ).toHaveAttribute("aria-selected", "false");
    });
  });

  it("switches to Alarm Settings tab when clicked", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const alarmTab = screen.getByRole("tab", { name: "Alarm Settings" });
    fireEvent.click(alarmTab);

    await waitFor(() => {
      expect(alarmTab).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByRole("tab", { name: "Map Configuration" }),
      ).toHaveAttribute("aria-selected", "false");
    });
  });

  it("shows different header title based on active tab", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Map Configuration tab - h1 shows tab label
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Map Configuration",
    );
    // Description is in p tag
    expect(
      screen.getByText(
        "Configure the positioning map, add beacon metadata, and save it through the secured API.",
      ),
    ).toBeInTheDocument();

    // Switch to App Configuration
    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "App Configuration",
      );
      expect(
        screen.getByText(
          "Configure authentication, server runtime, MQTT integrations, and access control.",
        ),
      ).toBeInTheDocument();
    });

    // Switch to Alarm Settings
    fireEvent.click(screen.getByRole("tab", { name: "Alarm Settings" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Alarm Settings",
      );
      // Use getAllByText since text appears in both header and AlarmSettingsTab
      expect(
        screen.getAllByText(
          "Configure alarm thresholds, notification channels, and escalation policies.",
        ).length,
      ).toBeGreaterThan(0);
    });
  });
});

describe("ConfigurationPage - Map Configuration Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  const renderMapTab = () => {
    const { container } = renderPage();
    return container;
  };

  it("renders Map Configuration content when active", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("Map overview")).toBeInTheDocument();
    expect(screen.getByText("Map editor")).toBeInTheDocument();
    expect(screen.getByText("Beacon list")).toBeInTheDocument();
  });

  it("shows Map overview section with map name, signal propagation factor, width, height", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Main Floor")).toBeInTheDocument(); // Map name
    expect(screen.getByDisplayValue("30")).toBeInTheDocument(); // Width
    expect(screen.getByDisplayValue("20")).toBeInTheDocument(); // Height
    expect(screen.getByDisplayValue("2.5")).toBeInTheDocument(); // Signal propagation factor
  });

  it("shows Import Floor Layout button", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
  });

  it("shows beacon count badge", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Badge shows "1 beacon" (singular) - use getAllByText since it may appear multiple times
    const badges = screen.getAllByText("1 beacon");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders MapEditor canvas", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders Beacon list with beacon details", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("Beacon A")).toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument(); // major:minor
    expect(screen.getByDisplayValue("Beacon A")).toBeInTheDocument(); // Display name input
    expect(screen.getByPlaceholderText("X (m)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Y (m)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("TX Power")).toBeInTheDocument();
    expect(screen.getByText("Place on Map")).toBeInTheDocument();
  });
});

describe("ConfigurationPage - Map Configuration Tab - Layout Import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  const renderMapTab = () => renderPage();

  it("shows file input when Import Floor Layout is clicked", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();
  });

  it("imports valid layout file and updates config", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Create a valid JSON file with only map data (beacons managed separately)
    const layoutWithoutBeacons = {
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
        ],
      },
      // No beacons - they are managed separately in TrackerHub
    };
    const jsonContent = JSON.stringify(layoutWithoutBeacons);
    const file = new File([jsonContent], "layout.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor layout imported successfully. Map dimensions and wall/boundary entities loaded. Add and place beacons separately using the beacon list.",
        ),
      ).toBeInTheDocument();
    });

    // Verify config was updated - map data changed, but existing beacons preserved
    await waitFor(() => {
      expect(screen.getByDisplayValue("Factory Floor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("50")).toBeInTheDocument(); // width
      expect(screen.getByDisplayValue("40")).toBeInTheDocument(); // height
      // Signal propagation factor preserved from original config (2.5)
      expect(screen.getByDisplayValue("2.5")).toBeInTheDocument();
      // Original beacon count (1) preserved since no beacons in import file
      const badges = screen.getAllByText("1 beacon");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("rejects invalid JSON file", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

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
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects malformed JSON file", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const file = new File(["{ invalid json }"], "malformed.json", {
      type: "application/json",
    });
    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText("The selected file is not valid JSON."),
      ).toBeInTheDocument();
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
      {
        type: "application/json",
      },
    );

    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("2.5")).toBeInTheDocument(); // Original signalPropagationFactor preserved
    });
  });

  it("rejects layout with missing map object", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects layout with missing map width", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      map: { height: 10, entities: [] },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects layout with missing map height", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      map: { width: 10, entities: [] },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects layout with invalid entity type", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      map: {
        width: 10,
        height: 10,
        entities: [
          {
            type: "circle",
            points: [
              [0, 0],
              [5, 5],
            ],
          },
        ],
      },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects layout with invalid entity points (too few)", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      map: {
        width: 10,
        height: 10,
        entities: [{ type: "polyline", points: [[0, 0]] }],
      },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects layout with non-numeric entity points", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(screen.getByText("Import Floor Layout")).toBeInTheDocument();
    });

    const invalidLayout = {
      map: {
        width: 10,
        height: 10,
        entities: [
          {
            type: "polyline",
            points: [
              [0, "invalid"],
              [5, 5],
            ],
          },
        ],
      },
      beacons: [],
      settings: { signalPropagationFactor: 2.5 },
    };
    const file = new File([JSON.stringify(invalidLayout)], "invalid.json", {
      type: "application/json",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid floor layout. Expected a map object with width, height, and optional polyline/wall entities. Beacons and settings are managed separately in TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - Map Configuration Tab - Beacon Placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockLayoutWithEntities);
  });

  const renderMapTab = () => renderPage(mockLayoutWithEntities);

  it("renders imported layout entities in MapEditor", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("allows placing beacons on imported layout", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Check the beacon count - use getAllByText since it appears multiple times
    await waitFor(() => {
      expect(screen.getAllByText("2 beacons").length).toBeGreaterThan(0);
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

describe("ConfigurationPage - Map Configuration Tab - Save and Reload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockLayoutWithEntities);
    saveWebConfiguration.mockResolvedValue({
      message: "Configuration saved successfully.",
    });
  });

  const renderMapTab = () => renderPage(mockLayoutWithEntities);

  it("saves imported layout to server", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText("2 beacons").length).toBeGreaterThan(0);
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
    renderMapTab();
    await waitFor(() => {
      expect(loadWebConfiguration).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue("Factory Floor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("50")).toBeInTheDocument();
      expect(screen.getByDisplayValue("40")).toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - App Configuration Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  it("renders App Configuration content when tab is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Switch to App Configuration tab
    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      // Check for section buttons (these are buttons, not just text)
      expect(
        screen.getByRole("button", { name: "Authentication" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Server Runtime" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Area Location" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Webhook" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Tracker Access" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "SenseCAP MQTT" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "ChirpStack MQTT" }),
      ).toBeInTheDocument();
    });
  });

  it("shows select section message when no section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Select a configuration section above to view and edit its settings.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows Authentication card when Authentication section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Authentication" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Authentication" }));

    await waitFor(() => {
      expect(
        screen.getByText("Administrator credential settings"),
      ).toBeInTheDocument();
      // Use getAllByText since "Username" and "Password" appear multiple times
      expect(screen.getAllByText("Username").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Password").length).toBeGreaterThan(0);
    });
  });

  it("shows Server Runtime card when Server Runtime section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(screen.getByText("Server Runtime")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Server Runtime"));

    await waitFor(() => {
      expect(
        screen.getByText("Runtime service and MQTT settings"),
      ).toBeInTheDocument();
      expect(screen.getByText("Server & MQTT")).toBeInTheDocument();
      expect(screen.getByText("MQTT credentials")).toBeInTheDocument();
      expect(screen.getByText("Kalman filter")).toBeInTheDocument();
    });
  });

  it("shows Area Location card when Area Location section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(screen.getByText("Area Location")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Area Location"));

    await waitFor(() => {
      expect(
        screen.getByText("Control whether area-based positioning is enabled"),
      ).toBeInTheDocument();
      expect(screen.getByText("Enable area location")).toBeInTheDocument();
    });
  });

  it("shows Webhook card when Webhook section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(screen.getByText("Webhook")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Webhook"));

    await waitFor(() => {
      expect(
        screen.getByText("Configure outbound webhook delivery settings"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Enable webhook integration"),
      ).toBeInTheDocument();
      expect(screen.getByText("Webhook Host URL")).toBeInTheDocument();
      expect(screen.getByText("HTTP Headers")).toBeInTheDocument();
    });
  });

  it("shows Tracker Access Control card when Tracker Access section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(screen.getByText("Tracker Access")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Tracker Access"));

    await waitFor(() => {
      expect(
        screen.getByText("Restrict tracker ingestion to authorized device IDs"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Enable tracker access control"),
      ).toBeInTheDocument();
      expect(screen.getByText("Allow all trackers")).toBeInTheDocument();
      expect(screen.getByText("Allowed tracker IDs")).toBeInTheDocument();
    });
  });

  it("shows SenseCAP MQTT card when SenseCAP MQTT section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "SenseCAP MQTT" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "SenseCAP MQTT" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Configure OpenStream connectivity for tracker ingestion",
        ),
      ).toBeInTheDocument();
      // "Connection profile" appears in multiple cards
      expect(screen.getAllByText("Connection profile").length).toBeGreaterThan(
        0,
      );
      // ToggleSwitch renders an "Enabled"/"Disabled" status badge
      expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
      // "Server region" appears in both SenseCAP and ChirpStack cards
      expect(screen.getAllByText("Server region").length).toBeGreaterThan(0);
      // Use getAllByText since "Application ID" appears in multiple places
      expect(screen.getAllByText("Application ID").length).toBeGreaterThan(0);
    });
  });

  it("shows ChirpStack MQTT card when ChirpStack MQTT section is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ChirpStack MQTT" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "ChirpStack MQTT" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Configure ChirpStack connectivity for LoRaWAN tracker ingestion",
        ),
      ).toBeInTheDocument();
      // "Connection profile" appears in multiple cards
      expect(screen.getAllByText("Connection profile").length).toBeGreaterThan(
        0,
      );
      // ToggleSwitch renders an "Enabled"/"Disabled" status badge
      expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
      // Use getAllByText since "Broker host" appears in multiple places
      expect(screen.getAllByText("Broker host").length).toBeGreaterThan(0);
      // Use getAllByText since "Application ID" appears in multiple places
      expect(screen.getAllByText("Application ID").length).toBeGreaterThan(0);
    });
  });
});

describe("ConfigurationPage - Alarm Settings Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
  });

  it("renders Alarm Settings placeholder content when tab is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Alarm Settings" }));

    await waitFor(() => {
      expect(
        screen.getByText("Alarm Settings Coming Soon"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Alarm and notification functionality is not yet implemented in the current version of TrackerHub.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows placeholder list of planned alarm features", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Alarm Settings" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Alarm threshold configuration (RSSI, distance, battery)",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Notification channels (email, webhook, SMS, push)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Escalation policies and schedules"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Alarm history and audit log"),
      ).toBeInTheDocument();
    });
  });

  it("shows backend infrastructure requirements", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Alarm Settings" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "No backend alarm infrastructure detected. Implementation would require:",
        ),
      ).toBeInTheDocument();
      // The text includes bullet points in the li elements
      expect(
        screen.getByText("• Backend alarm evaluation engine"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("• MQTT/HTTP alarm ingestion endpoints"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("• Notification delivery service"),
      ).toBeInTheDocument();
      expect(screen.getByText("• Alarm state persistence")).toBeInTheDocument();
    });
  });

  it("does not show Save configuration button in Alarm Settings tab", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // On Map tab, save button exists
    expect(screen.getByText("Save configuration")).toBeInTheDocument();

    // Switch to Alarm Settings tab
    fireEvent.click(screen.getByRole("tab", { name: "Alarm Settings" }));

    await waitFor(() => {
      // Save button should not be visible (or at least not in the header)
      // The save button is conditionally rendered only for non-alarm tabs
      expect(screen.queryByText("Save configuration")).not.toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - MapEditor Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockLayoutWithEntities);
  });

  it("MapEditor is only mounted in Map Configuration tab", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // MapEditor should be present in Map Configuration tab
    expect(document.querySelector("canvas")).toBeInTheDocument();

    // Switch to App Configuration tab
    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));

    // MapEditor canvas should be removed from DOM (hidden via conditional rendering)
    await waitFor(() => {
      // The canvas from MapEditor should not be in the document when not in Map tab
      // Note: since we use conditional rendering, the MapEditor component unmounts
      const canvases = document.querySelectorAll("canvas");
      // Only the MapEditor has a canvas, so there should be 0 when not in Map tab
      expect(canvases.length).toBe(0);
    });
  });

  it("MapEditor renders correctly when switching back to Map Configuration tab", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Switch away and back
    fireEvent.click(screen.getByRole("tab", { name: "App Configuration" }));
    await waitFor(() => {
      expect(document.querySelectorAll("canvas").length).toBe(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Map Configuration" }));
    await waitFor(() => {
      expect(document.querySelector("canvas")).toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - Layout Import - Image and Reference Format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
    saveWebConfiguration.mockResolvedValue({
      message: "Configuration saved successfully.",
    });
  });

  const renderMapTab = () => renderPage();

  it("shows file input for image when Image (JPG/PNG) is selected", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Select image import type
    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();
  });

  it("imports JPG floor-plan image and shows success message", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Select image import type
    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Create a mock image file
    const file = new File(["mock-image-data"], "floorplan.jpg", {
      type: "image/jpeg",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor-plan image imported successfully. Adjust map dimensions to match the floor-plan scale, then add wall/boundary entities and place beacons.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("imports PNG floor-plan image and shows success message", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Select image import type
    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Create a mock PNG file
    const file = new File(["mock-image-data"], "floorplan.png", {
      type: "image/png",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor-plan image imported successfully. Adjust map dimensions to match the floor-plan scale, then add wall/boundary entities and place beacons.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects unsupported file format", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Default is JSON - try to import a text file
    const file = new File(["test"], "test.txt", {
      type: "text/plain",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unsupported file format. Please upload a JSON layout file or JPG/PNG floor-plan image.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("imports layout with empty beacon object (reference format)", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Reference format uses empty object for beacons
    const layoutWithEmptyBeaconObject = {
      map: {
        name: "Reference Floor",
        width: 30,
        height: 20,
        entities: [
          {
            type: "wall",
            points: [
              [0, 0],
              [30, 0],
              [30, 20],
              [0, 20],
              [0, 0],
            ],
            closed: true,
          },
        ],
      },
      beacons: {}, // Empty object - reference format
    };
    const jsonContent = JSON.stringify(layoutWithEmptyBeaconObject);
    const file = new File([jsonContent], "reference.json", {
      type: "application/json",
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor layout imported successfully. Map dimensions and wall/boundary entities loaded. Add and place beacons separately using the beacon list.",
        ),
      ).toBeInTheDocument();
    });

    // Verify existing beacons preserved (since beacons was empty object)
    await waitFor(() => {
      const badges = screen.getAllByText("1 beacon");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("imports layout with wall entities (reference format)", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const layoutWithWalls = {
      map: {
        name: "Wall Floor",
        width: 25,
        height: 15,
        entities: [
          {
            type: "wall",
            points: [
              [0, 0],
              [25, 0],
              [25, 15],
              [0, 15],
              [0, 0],
            ],
            closed: true,
            strokeColor: "#94a3b8",
            fillColor: "rgba(148, 163, 184, 0.1)",
            lineWidth: 2,
          },
        ],
      },
      beacons: [],
    };
    const jsonContent = JSON.stringify(layoutWithWalls);
    const file = new File([jsonContent], "walls.json", {
      type: "application/json",
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    const fileInput = document.querySelector(
      'input[type="file"][accept=".json"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor layout imported successfully. Map dimensions and wall/boundary entities loaded. Add and place beacons separately using the beacon list.",
        ),
      ).toBeInTheDocument();
    });

    // Verify map name updated
    await waitFor(() => {
      expect(screen.getByDisplayValue("Wall Floor")).toBeInTheDocument();
      expect(screen.getByDisplayValue("25")).toBeInTheDocument(); // width
      expect(screen.getByDisplayValue("15")).toBeInTheDocument(); // height
    });
  });

  it("shows image info and allows removing loaded image", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Select image import type
    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Create a mock image file
    const file = new File(["mock-image-data"], "floorplan.png", {
      type: "image/png",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for image import success
    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor-plan image imported successfully. Adjust map dimensions to match the floor-plan scale, then add wall/boundary entities and place beacons.",
        ),
      ).toBeInTheDocument();
    });

    // Verify image info is displayed
    await waitFor(() => {
      expect(screen.getByText("Floor-plan image loaded")).toBeInTheDocument();
      // Use function matcher since "floorplan" may be part of " · floorplan" text node
      expect(
        screen.getByText((content) => content.includes("floorplan")),
      ).toBeInTheDocument();
      expect(screen.getByText("Remove Image")).toBeInTheDocument();
    });

    // Click remove image button
    const removeButton = screen.getByText("Remove Image");
    fireEvent.click(removeButton);

    // Verify image removed
    await waitFor(() => {
      expect(screen.getByText("Floor-plan image removed.")).toBeInTheDocument();
      expect(
        screen.queryByText("Floor-plan image loaded"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Remove Image")).not.toBeInTheDocument();
    });
  });

  it("replaces existing image when new image is uploaded", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    // Select image import type
    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Upload first image
    const file1 = new File(["mock-image-data-1"], "first-image.jpg", {
      type: "image/jpeg",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(
        screen.getByText((content) =>
          content.includes("Floor-plan image imported successfully"),
        ),
      ).toBeInTheDocument();
    });

    // Upload second image (replace)
    const file2 = new File(["mock-image-data-2"], "second-image.png", {
      type: "image/png",
    });

    // Trigger file import again
    fireEvent.click(importButton);
    // File input should still be image type
    const fileInput2 = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    fireEvent.change(fileInput2, { target: { files: [file2] } });

    await waitFor(() => {
      expect(
        screen.getByText((content) =>
          content.includes("Floor-plan image imported successfully"),
        ),
      ).toBeInTheDocument();
    });

    // Verify new image info is shown
    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes("second-image")),
      ).toBeInTheDocument();
    });
  });

  it("shows JPEG upload and displays correctly", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Create a mock JPEG file
    const file = new File(["mock-image-data"], "floorplan.jpeg", {
      type: "image/jpeg",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Floor-plan image imported successfully. Adjust map dimensions to match the floor-plan scale, then add wall/boundary entities and place beacons.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("rejects invalid image file (corrupted/non-image)", async () => {
    renderMapTab();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const importButton = screen.getByText("Import Floor Layout");
    fireEvent.click(importButton);

    const select =
      screen.getByRole("combobox") || document.querySelector("select");
    fireEvent.change(select, { target: { value: "image" } });

    // Create a file with wrong extension but image type
    const file = new File(["not an image"], "fake.jpg", {
      type: "text/plain",
    });

    const fileInput = document.querySelector(
      'input[type="file"][accept=".jpg,.jpeg,.png"]',
    );
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Should show error for invalid image
    await waitFor(() => {
      expect(
        screen.getByText(
          "Failed to load image. Please ensure it's a valid JPG or PNG file.",
        ),
      ).toBeInTheDocument();
    });
  });
});

describe("ConfigurationPage - Existing Configuration Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
    saveWebConfiguration.mockResolvedValue({
      message: "Configuration saved successfully.",
    });
  });

  it("save button triggers saveWebConfiguration with current config", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    // Modify map name
    const mapNameInput = screen.getByDisplayValue("Main Floor");
    fireEvent.change(mapNameInput, { target: { value: "Updated Floor" } });

    const saveButton = screen.getByText("Save configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveWebConfiguration).toHaveBeenCalledTimes(1);
      const savedConfig = saveWebConfiguration.mock.calls[0][0];
      expect(savedConfig.map.name).toBe("Updated Floor");
    });
  });

  it("shows loading state initially", async () => {
    loadWebConfiguration.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(mockConfig), 100)),
    );

    renderPage();

    expect(screen.getByText("Loading configuration...")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });
  });

  it("shows error message on load failure", async () => {
    const { container } = renderPageWithLoadMock(() =>
      Promise.reject(new Error("Network error")),
    );

    // Wait for error message to appear (the loading state will clear and error will show)
    await waitFor(() => {
      // The error message is in a div with error styling - find by className
      const errorDiv = container.querySelector(
        ".rounded-2xl.border.px-4.py-3.text-sm",
      );
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv.textContent).toContain("Network error");
    });
  });

  it("shows success message on save", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText("Save configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText("Configuration saved successfully."),
      ).toBeInTheDocument();
    });
  });

  it("shows error message on save failure", async () => {
    // Use a custom mock for saveWebConfiguration that rejects
    vi.clearAllMocks();
    loadWebConfiguration.mockResolvedValue(mockConfig);
    saveWebConfiguration.mockRejectedValue(new Error("Save failed"));

    const { container } = render(
      <BrowserRouter>
        <ConfigurationPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Loading configuration..."),
      ).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText("Save configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      // The error message is in a div with error styling - find by className
      const errorDiv = container.querySelector(
        ".rounded-2xl.border.px-4.py-3.text-sm",
      );
      expect(errorDiv).toBeInTheDocument();
      expect(errorDiv.textContent).toContain("Save failed");
    });
  });
});
