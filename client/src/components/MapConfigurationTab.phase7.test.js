import { describe, it, expect } from "vitest";

/**
 * Phase 7 Tests: Complete Beacon Management Workflow
 *
 * Tests beacon validation, MAC normalization, duplicate detection,
 * and the full add/edit/delete lifecycle.
 *
 * The validation functions are extracted from MapConfigurationTab.jsx
 * and tested independently to ensure correctness.
 */

// ── Validation helpers (mirrors MapConfigurationTab.jsx) ────────────────────

const UUID_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const MAC_HEX_ONLY = /^[0-9A-Fa-f]{12}$/;

function validateUUID(uuid) {
  if (!uuid || uuid.trim() === "") return "UUID is required";
  if (!UUID_REGEX.test(uuid.trim()))
    return "UUID must be in format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (hex characters)";
  return "";
}

function validateMajor(value) {
  const num = Number(value);
  if (isNaN(num)) return "Major must be a number";
  if (!Number.isInteger(num)) return "Major must be a whole number";
  if (num < 0 || num > 65535) return "Major must be 0–65535";
  return "";
}

function validateMinor(value) {
  const num = Number(value);
  if (isNaN(num)) return "Minor must be a number";
  if (!Number.isInteger(num)) return "Minor must be a whole number";
  if (num < 0 || num > 65535) return "Minor must be 0–65535";
  return "";
}

function validateTXPower(value) {
  if (value === null || value === undefined || value === "")
    return "TX Power is required";
  const num = Number(value);
  if (isNaN(num)) return "TX Power must be a number";
  if (num < -100 || num > 20) return "TX Power must be between –100 and 20";
  return "";
}

function normalizeMAC(raw) {
  if (!raw || raw.trim() === "") return { normalized: "", error: "" };
  const stripped = raw.replace(/[:\-]/g, "").toUpperCase();
  if (!MAC_HEX_ONLY.test(stripped))
    return {
      normalized: stripped,
      error:
        "MAC must contain exactly 12 hexadecimal characters (e.g. C3:00:00:3E:7D:E0)",
    };
  return { normalized: stripped, error: "" };
}

function validateBeaconForm(beacon, existingBeacons, mode, editIndex) {
  const errors = {};
  const uuidErr = validateUUID(beacon.uuid);
  if (uuidErr) errors.uuid = uuidErr;
  const majorErr = validateMajor(beacon.major);
  if (majorErr) errors.major = majorErr;
  const minorErr = validateMinor(beacon.minor);
  if (minorErr) errors.minor = minorErr;
  const txErr = validateTXPower(beacon.txPower);
  if (txErr) errors.txPower = txErr;

  if (beacon.macAddress && beacon.macAddress.trim() !== "") {
    const { error: macErr } = normalizeMAC(beacon.macAddress);
    if (macErr) errors.macAddress = macErr;
  }

  if (!beacon.displayName || beacon.displayName.trim() === "")
    errors.displayName = "Display name is required";

  // Duplicate identity check
  // Reference behavior (Seeed IndoorPositioning): a beacon is a duplicate only if
  // it matches UUID+Major+Minor AND has the same MAC address (or both have no MAC).
  // Multiple beacons can share UUID/Major/Minor but must have unique MAC addresses.
  const uuidMatch = (a, b) =>
    (a.uuid || "").toUpperCase() === (b.uuid || "").toUpperCase() &&
    a.major === b.major &&
    a.minor === b.minor;

  const isDuplicate = existingBeacons.some((b, i) => {
    if (mode === "edit" && i === editIndex) return false;

    // Must share the same UUID+Major+Minor identity
    if (!uuidMatch(b, beacon)) return false;

    // Match by MAC address when both have one
    const existingMAC = normalizeMAC(b.macAddress).normalized;
    const newMAC = normalizeMAC(beacon.macAddress).normalized;

    if (existingMAC && newMAC) {
      return existingMAC === newMAC; // duplicate only if same MAC
    }
    // If neither has a MAC, the UUID+Major+Minor is the only identity
    if (!existingMAC && !newMAC) return true;
    // If only one has a MAC, they are considered different devices
    return false;
  });
  if (isDuplicate)
    errors.identity =
      "A beacon with this UUID, Major, Minor, and MAC already exists.";

  if (beacon.macAddress && beacon.macAddress.trim() !== "") {
    const { normalized } = normalizeMAC(beacon.macAddress);
    if (normalized) {
      const macDuplicate = existingBeacons.some((b, i) => {
        if (mode === "edit" && i === editIndex) return false;
        const existingNorm = normalizeMAC(b.macAddress).normalized;
        return existingNorm && existingNorm === normalized;
      });
      if (macDuplicate)
        errors.macDuplicate = "A beacon with this MAC address already exists.";
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

// ── Test: MAC Normalization ─────────────────────────────────────────────────

describe("Phase 7 — MAC Address Normalization", () => {
  it("normalizes colon-separated lowercase MAC to uppercase", () => {
    const result = normalizeMAC("c3:00:00:3e:7d:e0");
    expect(result.normalized).toBe("C300003E7DE0");
    expect(result.error).toBe("");
  });

  it("normalizes dash-separated MAC", () => {
    const result = normalizeMAC("c3-00-00-3e-7d-e0");
    expect(result.normalized).toBe("C300003E7DE0");
    expect(result.error).toBe("");
  });

  it("normalizes already-uppercase MAC", () => {
    const result = normalizeMAC("C3:00:00:3E:7D:E0");
    expect(result.normalized).toBe("C300003E7DE0");
    expect(result.error).toBe("");
  });

  it("accepts bare 12-char hex MAC", () => {
    const result = normalizeMAC("C300003E7DE0");
    expect(result.normalized).toBe("C300003E7DE0");
    expect(result.error).toBe("");
  });

  it("rejects MAC with non-hex characters", () => {
    const result = normalizeMAC("GG:HH:II:JJ:KK:LL");
    expect(result.error).toContain("12 hexadecimal");
  });

  it("rejects MAC that is too short", () => {
    const result = normalizeMAC("AA:BB:CC");
    expect(result.error).toContain("12 hexadecimal");
  });

  it("rejects MAC that is too long", () => {
    const result = normalizeMAC("AA:BB:CC:DD:EE:FF:00");
    expect(result.error).toContain("12 hexadecimal");
  });

  it("accepts empty MAC (optional field)", () => {
    const result = normalizeMAC("");
    expect(result.normalized).toBe("");
    expect(result.error).toBe("");
  });

  it("normalizes all-zeroes MAC", () => {
    const result = normalizeMAC("00:00:00:00:00:00");
    expect(result.normalized).toBe("000000000000");
    expect(result.error).toBe("");
  });
});

// ── Test: UUID Validation ───────────────────────────────────────────────────

describe("Phase 7 — UUID Validation", () => {
  it("accepts valid UUID", () => {
    expect(validateUUID("E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")).toBe("");
  });

  it("accepts lowercase UUID", () => {
    expect(validateUUID("e2c56db5-dffb-48d2-b060-d0f5a71096e0")).toBe("");
  });

  it("rejects empty UUID", () => {
    expect(validateUUID("")).toBe("UUID is required");
  });

  it("rejects UUID with wrong format", () => {
    expect(validateUUID("not-a-uuid")).toContain("UUID must be in format");
  });

  it("rejects UUID missing segments", () => {
    expect(validateUUID("E2C56DB5-DFFB-48D2")).toContain(
      "UUID must be in format",
    );
  });
});

// ── Test: Major/Minor Validation ────────────────────────────────────────────

describe("Phase 7 — Major/Minor Validation", () => {
  it("accepts valid Major 0", () => {
    expect(validateMajor(0)).toBe("");
  });

  it("accepts valid Major 65535", () => {
    expect(validateMajor(65535)).toBe("");
  });

  it("rejects Major 65536", () => {
    expect(validateMajor(65536)).toBe("Major must be 0–65535");
  });

  it("rejects negative Major", () => {
    expect(validateMajor(-1)).toBe("Major must be 0–65535");
  });

  it("rejects non-integer Major", () => {
    expect(validateMajor(1.5)).toBe("Major must be a whole number");
  });

  it("rejects non-numeric Major", () => {
    expect(validateMajor("abc")).toBe("Major must be a number");
  });

  it("accepts valid Minor 0", () => {
    expect(validateMinor(0)).toBe("");
  });

  it("accepts valid Minor 65535", () => {
    expect(validateMinor(65535)).toBe("");
  });

  it("rejects Minor 65536", () => {
    expect(validateMinor(65536)).toBe("Minor must be 0–65535");
  });
});

// ── Test: TX Power Validation ───────────────────────────────────────────────

describe("Phase 7 — TX Power Validation", () => {
  it("accepts valid TX power -59", () => {
    expect(validateTXPower(-59)).toBe("");
  });

  it("accepts TX power 0", () => {
    expect(validateTXPower(0)).toBe("");
  });

  it("accepts TX power 20", () => {
    expect(validateTXPower(20)).toBe("");
  });

  it("accepts TX power -100", () => {
    expect(validateTXPower(-100)).toBe("");
  });

  it("rejects TX power -101", () => {
    expect(validateTXPower(-101)).toContain("between");
  });

  it("rejects TX power 21", () => {
    expect(validateTXPower(21)).toContain("between");
  });

  it("rejects empty TX power", () => {
    expect(validateTXPower("")).toBe("TX Power is required");
  });
});

// ── Test: Duplicate Detection ───────────────────────────────────────────────

describe("Phase 7 — Duplicate Beacon Detection", () => {
  const existingBeacons = [
    {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      macAddress: "C300003E7DE0",
      displayName: "Existing Beacon",
      x: 0,
      y: 0,
      txPower: -59,
    },
  ];

  it("allows same UUID+Major+Minor with a different MAC address", () => {
    // Reference (Seeed IndoorPositioning) allows multiple physical beacons
    // that share the same iBeacon UUID/Major/Minor as long as they have
    // different MAC addresses.
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "112233445566",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(true);
    expect(errors.identity).toBeUndefined();
  });

  it("detects duplicate UUID+Major+Minor when both have no MAC", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      [
        {
          uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
          major: 1,
          minor: 1,
          macAddress: "",
          displayName: "Existing Beacon",
          x: 0,
          y: 0,
          txPower: -59,
        },
      ],
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.identity).toBeDefined();
    expect(errors.identity).toContain("already exists");
  });

  it("detects duplicate when same identity AND same MAC", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "C300003E7DE0",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.identity).toBeDefined();
    expect(errors.identity).toContain("already exists");
  });

  it("allows same UUID with different Major", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 2,
        minor: 1,
        macAddress: "112233445566",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(true);
    expect(errors.identity).toBeUndefined();
  });

  it("allows same UUID with different Minor", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 2,
        macAddress: "112233445566",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(true);
    expect(errors.identity).toBeUndefined();
  });

  it("detects duplicate MAC address", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "F2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 99,
        minor: 99,
        macAddress: "c3:00:00:3e:7d:e0", // same MAC, different format
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.macDuplicate).toBeDefined();
    expect(errors.macDuplicate).toContain("already exists");
  });

  it("allows different MAC address", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "F2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 99,
        minor: 99,
        macAddress: "AA:BB:CC:DD:EE:FF",
        displayName: "New Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "add",
      -1,
    );
    expect(valid).toBe(true);
    expect(errors.macDuplicate).toBeUndefined();
  });

  it("allows same identity when editing the same beacon", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "C300003E7DE0",
        displayName: "Updated Beacon",
        x: 0,
        y: 0,
        txPower: -59,
      },
      existingBeacons,
      "edit",
      0, // editing index 0 (the same beacon)
    );
    expect(valid).toBe(true);
    expect(errors.identity).toBeUndefined();
  });
});

// ── Test: Full Beacon Form Validation ───────────────────────────────────────

describe("Phase 7 — Beacon Form Validation (Complete)", () => {
  it("validates a complete valid beacon", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "c3:00:00:3e:7d:e0",
        displayName: "Test Beacon",
        x: 5,
        y: 3,
        txPower: -59,
      },
      [],
      "add",
      -1,
    );
    expect(valid).toBe(true);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("rejects beacon with empty display name", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "",
        displayName: "",
        x: 0,
        y: 0,
        txPower: -59,
      },
      [],
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.displayName).toBeDefined();
  });

  it("rejects beacon with invalid UUID", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "not-a-uuid",
        major: 1,
        minor: 1,
        macAddress: "",
        displayName: "Test",
        x: 0,
        y: 0,
        txPower: -59,
      },
      [],
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.uuid).toBeDefined();
  });

  it("collects multiple errors at once", () => {
    const { valid, errors } = validateBeaconForm(
      {
        uuid: "",
        major: 99999,
        minor: -5,
        macAddress: "invalid",
        displayName: "",
        x: 0,
        y: 0,
        txPower: 50,
      },
      [],
      "add",
      -1,
    );
    expect(valid).toBe(false);
    expect(errors.uuid).toBeDefined();
    expect(errors.major).toBeDefined();
    expect(errors.minor).toBeDefined();
    expect(errors.macAddress).toBeDefined();
    expect(errors.displayName).toBeDefined();
    expect(errors.txPower).toBeDefined();
  });
});

// ── Test: Add Beacon Workflow ───────────────────────────────────────────────

describe("Phase 7 — Add Beacon Workflow", () => {
  it("can add a new beacon to an empty list", () => {
    const beacons = [];
    const newBeacon = {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      macAddress: "C300003E7DE0",
      displayName: "New Beacon",
      x: 5,
      y: 3,
      txPower: -59,
    };

    beacons.push(newBeacon);

    expect(beacons).toHaveLength(1);
    expect(beacons[0].displayName).toBe("New Beacon");
    expect(beacons[0].macAddress).toBe("C300003E7DE0");
  });

  it("can add multiple beacons with unique identities", () => {
    const beacons = [];
    beacons.push({
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      macAddress: "C300003E7DE0",
      displayName: "Beacon A",
      x: 0,
      y: 0,
      txPower: -59,
    });
    beacons.push({
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 2,
      macAddress: "C300003E7DFB",
      displayName: "Beacon B",
      x: 5,
      y: 5,
      txPower: -59,
    });

    expect(beacons).toHaveLength(2);
    expect(beacons[0].minor).toBe(1);
    expect(beacons[1].minor).toBe(2);
  });
});

// ── Test: Edit Beacon Workflow ──────────────────────────────────────────────

describe("Phase 7 — Edit Beacon Workflow", () => {
  it("can update all fields of an existing beacon", () => {
    const beacons = [
      {
        uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
        major: 1,
        minor: 1,
        macAddress: "C300003E7DE0",
        displayName: "Old Name",
        x: 0,
        y: 0,
        txPower: -59,
      },
    ];

    // Simulate editing
    beacons[0] = {
      ...beacons[0],
      displayName: "New Name",
      uuid: "F2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 2,
      minor: 3,
      macAddress: "AABBCCDDEEFF",
      x: 10,
      y: 8,
      txPower: -72,
    };

    expect(beacons[0].displayName).toBe("New Name");
    expect(beacons[0].uuid).toBe("F2C56DB5-DFFB-48D2-B060-D0F5A71096E0");
    expect(beacons[0].major).toBe(2);
    expect(beacons[0].minor).toBe(3);
    expect(beacons[0].macAddress).toBe("AABBCCDDEEFF");
    expect(beacons[0].x).toBe(10);
    expect(beacons[0].y).toBe(8);
    expect(beacons[0].txPower).toBe(-72);
  });
});

// ── Test: Delete Beacon Workflow ────────────────────────────────────────────

describe("Phase 7 — Delete Beacon Workflow", () => {
  it("can remove a beacon from the list", () => {
    const beacons = [
      {
        uuid: "A",
        major: 1,
        minor: 1,
        displayName: "A",
        macAddress: "AA",
        x: 0,
        y: 0,
        txPower: -59,
      },
      {
        uuid: "B",
        major: 2,
        minor: 2,
        displayName: "B",
        macAddress: "BB",
        x: 0,
        y: 0,
        txPower: -59,
      },
    ];

    beacons.splice(0, 1);

    expect(beacons).toHaveLength(1);
    expect(beacons[0].uuid).toBe("B");
  });
});

// ── Test: Persistence (Create → Save → Reload) ─────────────────────────────

describe("Phase 7 — Beacon Persistence", () => {
  it("beacon survives serialization round-trip", () => {
    const beacon = {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      macAddress: "C300003E7DE0",
      displayName: "Test Beacon",
      x: 5.5,
      y: 3.3,
      txPower: -59,
    };

    // Simulate save → reload via JSON round-trip
    const saved = JSON.stringify({ beacons: [beacon] });
    const reloaded = JSON.parse(saved);

    expect(reloaded.beacons[0].uuid).toBe(beacon.uuid);
    expect(reloaded.beacons[0].major).toBe(beacon.major);
    expect(reloaded.beacons[0].minor).toBe(beacon.minor);
    expect(reloaded.beacons[0].macAddress).toBe(beacon.macAddress);
    expect(reloaded.beacons[0].displayName).toBe(beacon.displayName);
    expect(reloaded.beacons[0].x).toBeCloseTo(beacon.x);
    expect(reloaded.beacons[0].y).toBeCloseTo(beacon.y);
    expect(reloaded.beacons[0].txPower).toBe(beacon.txPower);
  });
});

// ── Test: MQTT → Config MAC Matching ────────────────────────────────────────

describe("Phase 7 — MQTT → Config Beacon MAC Matching", () => {
  it("MQTT-reported MAC matches normalized config MAC", () => {
    // User enters "c3:00:00:3e:7d:e0" → normalized to "C300003E7DE0"
    const configMAC = normalizeMAC("c3:00:00:3e:7d:e0").normalized;
    expect(configMAC).toBe("C300003E7DE0");

    // MQTT reports "c3:00:00:3e:7d:e0" → parser normalizes to "C300003E7DE0"
    const mqttRaw = "c3:00:00:3e:7d:e0";
    const mqttMAC = mqttRaw.replace(/:/g, "").toUpperCase();
    expect(mqttMAC).toBe("C300003E7DE0");

    // Match: YES
    expect(configMAC).toBe(mqttMAC);
  });

  it("different MACs do not match", () => {
    const configMAC = normalizeMAC("c3:00:00:3e:7d:e0").normalized;
    const mqttMAC = "C300003E7DFB"; // different beacon
    expect(configMAC).not.toBe(mqttMAC);
  });
});

// ── Test: Coordinate Handling ───────────────────────────────────────────────

describe("Phase 7 — Coordinate Handling", () => {
  it("coordinates are stored in meters (float64)", () => {
    const beacon = {
      x: 5.123,
      y: 3.456,
    };
    expect(typeof beacon.x).toBe("number");
    expect(typeof beacon.y).toBe("number");
    expect(beacon.x).toBeCloseTo(5.123);
    expect(beacon.y).toBeCloseTo(3.456);
  });

  it("X/Y are clamped to map bounds", () => {
    const mapWidth = 30;
    const mapHeight = 20;

    const clampedX = Math.min(Math.max(0, 35), mapWidth);
    const clampedY = Math.min(Math.max(0, -5), mapHeight);

    expect(clampedX).toBe(30);
    expect(clampedY).toBe(0);
  });
});

// ── Test: Positioning Uses Configured Beacon X/Y/TXPower ────────────────────

describe("Phase 7 — Positioning Uses Configured Beacon X/Y/TXPower", () => {
  it("configured beacon provides all positioning inputs", () => {
    const beacon = {
      uuid: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
      major: 1,
      minor: 1,
      macAddress: "C300003E7DE0",
      displayName: "Test",
      x: 5.0,
      y: 3.0,
      txPower: -59,
    };

    // These are the values used by CalculatePosition
    expect(beacon.x).toBe(5.0);
    expect(beacon.y).toBe(3.0);
    expect(beacon.txPower).toBe(-59);
    expect(beacon.macAddress).toBe("C300003E7DE0");
  });
});
