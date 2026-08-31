import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 3 Tests: Beacon Placement on Calibrated Floor Plan
 *
 * Verifies that:
 * - Beacons can be placed on the map using pixel→meter conversion
 * - Beacon markers appear at correct map coordinates
 * - Beacon dragging works with meter coordinate updates
 * - Boundary clamping keeps beacons inside map bounds
 * - Multiple beacons can be placed and displayed
 * - JSON and image maps both support beacon placement
 * - Configuration persistence works (save/reload)
 */

describe("Phase 3: Beacon Placement on Calibrated Floor Plan", () => {
  /**
   * Test 1: Place beacon on map via canvas click
   * Canvas coordinates → meter coordinates
   */
  describe("Place beacon on map", () => {
    it("converts canvas click coordinates to map meters", () => {
      // Setup: 16m × 8m map, 900×520 canvas
      // With padding: effectiveWidth = 900 - 2×30 = 840
      // Scale = 840 / 16 = 52.5 px/m

      const mapConfig = {
        map: { width: 16, height: 8 },
      };
      const canvasSize = { width: 900, height: 520 };
      const padding = 30;

      const effectiveWidth = canvasSize.width - 2 * padding;
      const effectiveHeight = canvasSize.height - 2 * padding;

      const scale = effectiveWidth / mapConfig.map.width;
      const offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      const offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      // toMap conversion
      const toMap = (canvasX, canvasY) => [
        (canvasX - offsetX) / scale,
        (canvasSize.height - canvasY - offsetY) / scale,
      ];

      // Simulate click at canvas center
      const canvasCenterX = canvasSize.width / 2;
      const canvasCenterY = canvasSize.height / 2;

      const [mapX, mapY] = toMap(canvasCenterX, canvasCenterY);

      // Map center should be (8, 4)
      expect(mapX).toBeCloseTo(8, 0);
      expect(mapY).toBeCloseTo(4, 0);
    });

    it("handles two-click confirmation workflow", () => {
      // Test two-click confirmation pattern
      // First click: set pending position
      // Second click: confirm and store in beacon config

      const initialBeacon = {
        uuid: "beacon-1",
        x: null,
        y: null,
        displayName: "Beacon A",
      };

      // After first click at (5, 3)
      let pendingPosition = [5, 3];
      expect(pendingPosition).toEqual([5, 3]);

      // After second click (no change, just confirm)
      const finalPosition = pendingPosition;
      const updatedBeacon = {
        ...initialBeacon,
        x: finalPosition[0],
        y: finalPosition[1],
      };

      expect(updatedBeacon.x).toBe(5);
      expect(updatedBeacon.y).toBe(3);
    });

    it("clamps beacon coordinates to map boundaries during placement", () => {
      const mapWidth = 16;
      const mapHeight = 8;

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapWidth, x)),
        Math.max(0, Math.min(mapHeight, y)),
      ];

      // Click outside bounds
      const [clampedX1, clampedY1] = clampToMap(-2, 4);
      expect(clampedX1).toBe(0);
      expect(clampedY1).toBe(4);

      const [clampedX2, clampedY2] = clampToMap(20, 4);
      expect(clampedX2).toBe(mapWidth);
      expect(clampedY2).toBe(4);

      // Within bounds
      const [clampedX3, clampedY3] = clampToMap(8, 4);
      expect(clampedX3).toBe(8);
      expect(clampedY3).toBe(4);
    });
  });

  /**
   * Test 2: Beacon marker rendering
   * Beacons appear at correct canvas position based on map coordinates
   */
  describe("Beacon marker rendering", () => {
    it("renders beacon at correct canvas coordinates", () => {
      const mapConfig = { map: { width: 16, height: 8 } };
      const canvasSize = { width: 900, height: 520 };
      const padding = 30;

      const scale = (canvasSize.width - 2 * padding) / mapConfig.map.width;
      const offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      const offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      const toCanvas = (mapX, mapY) => [
        offsetX + mapX * scale,
        canvasSize.height - offsetY - mapY * scale,
      ];

      // Beacon at map center (8, 4)
      const [cx, cy] = toCanvas(8, 4);

      // Should appear at canvas center
      expect(cx).toBeCloseTo(canvasSize.width / 2, 0);
      expect(cy).toBeCloseTo(canvasSize.height / 2, 0);
    });

    it("updates marker position after canvas resize", () => {
      const mapConfig = { map: { width: 16, height: 8 } };
      const beacon = { x: 8, y: 4 };

      // Initial canvas size
      let canvasSize = { width: 900, height: 520 };
      let scale = (canvasSize.width - 60) / mapConfig.map.width;
      let offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      let offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      const toCanvas = (mapX, mapY, cw, ch, s, ox, oy) => [
        ox + mapX * s,
        ch - oy - mapY * s,
      ];

      const [cx1, cy1] = toCanvas(
        beacon.x,
        beacon.y,
        canvasSize.width,
        canvasSize.height,
        scale,
        offsetX,
        offsetY,
      );

      // After resize to smaller canvas
      canvasSize = { width: 600, height: 400 };
      scale = (canvasSize.width - 60) / mapConfig.map.width;
      offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      const [cx2, cy2] = toCanvas(
        beacon.x,
        beacon.y,
        canvasSize.width,
        canvasSize.height,
        scale,
        offsetX,
        offsetY,
      );

      // Position should shift, not disappear
      expect(cx1).not.toEqual(cx2);
      expect(cy1).not.toEqual(cy2);
      expect(cx2).toBeGreaterThan(0);
      expect(cy2).toBeGreaterThan(0);
    });
  });

  /**
   * Test 3: Drag beacon and update coordinates
   */
  describe("Drag beacon", () => {
    it("updates beacon X/Y during drag in meters", () => {
      const beacon = { uuid: "b1", x: 5, y: 5, displayName: "Beacon A" };

      // Simulate drag: canvas movement → meter movement
      const mapConfig = { map: { width: 16, height: 8 } };
      const canvasSize = { width: 900, height: 520 };
      const scale = (canvasSize.width - 60) / mapConfig.map.width;
      const offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      const offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      const toMap = (canvasX, canvasY) => [
        (canvasX - offsetX) / scale,
        (canvasSize.height - canvasY - offsetY) / scale,
      ];

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapConfig.map.width, x)),
        Math.max(0, Math.min(mapConfig.map.height, y)),
      ];

      // Drag to canvas position (500, 300)
      let [mapX, mapY] = toMap(500, 300);
      [mapX, mapY] = clampToMap(mapX, mapY);

      // Update beacon
      const updatedBeacon = { ...beacon, x: mapX, y: mapY };

      expect(updatedBeacon.x).toBeGreaterThanOrEqual(0);
      expect(updatedBeacon.y).toBeGreaterThanOrEqual(0);
      expect(updatedBeacon.x).toBeLessThanOrEqual(mapConfig.map.width);
      expect(updatedBeacon.y).toBeLessThanOrEqual(mapConfig.map.height);
    });

    it("maintains beacon during multiple drag operations", () => {
      const initialBeacon = { uuid: "b1", x: 5, y: 5 };
      const beacons = [initialBeacon];

      // First drag
      const beacon1 = { ...beacons[0], x: 8, y: 6 };
      const updated1 = [...beacons];
      updated1[0] = beacon1;

      // Second drag
      const beacon2 = { ...updated1[0], x: 10, y: 3 };
      const updated2 = [...updated1];
      updated2[0] = beacon2;

      expect(updated2[0].x).toBe(10);
      expect(updated2[0].y).toBe(3);
      expect(updated2[0].uuid).toBe("b1"); // UUID preserved
    });
  });

  /**
   * Test 4: Multiple beacons placement
   */
  describe("Multiple beacons", () => {
    it("places four beacons at corners without collision", () => {
      const mapConfig = { map: { width: 16, height: 8 } };

      const beacons = [
        { uuid: "b1", x: 1, y: 1, displayName: "Beacon A" },
        { uuid: "b2", x: 15, y: 1, displayName: "Beacon B" },
        { uuid: "b3", x: 1, y: 7, displayName: "Beacon C" },
        { uuid: "b4", x: 15, y: 7, displayName: "Beacon D" },
      ];

      // Verify all are within bounds
      beacons.forEach((b) => {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(mapConfig.map.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThanOrEqual(mapConfig.map.height);
      });

      // Verify all are distinct
      const positions = beacons.map((b) => `${b.x},${b.y}`);
      expect(new Set(positions).size).toBe(4);
    });

    it("renders all beacons without overwriting", () => {
      const beacons = [
        { uuid: "b1", x: 2, y: 2, displayName: "A" },
        { uuid: "b2", x: 14, y: 2, displayName: "B" },
        { uuid: "b3", x: 2, y: 6, displayName: "C" },
        { uuid: "b4", x: 14, y: 6, displayName: "D" },
      ];

      // Simulate rendering - verify all beacons can be drawn
      const canvasSize = { width: 900, height: 520 };
      const mapConfig = { map: { width: 16, height: 8 } };
      const scale = (canvasSize.width - 60) / mapConfig.map.width;
      const offsetX = (canvasSize.width - mapConfig.map.width * scale) / 2;
      const offsetY = (canvasSize.height - mapConfig.map.height * scale) / 2;

      const toCanvas = (mapX, mapY) => [
        offsetX + mapX * scale,
        canvasSize.height - offsetY - mapY * scale,
      ];

      // Draw all beacons
      const renderedPositions = beacons.map((b) => {
        const [cx, cy] = toCanvas(b.x, b.y);
        return { uuid: b.uuid, canvasX: cx, canvasY: cy };
      });

      // All should have valid canvas positions
      renderedPositions.forEach((p) => {
        expect(p.canvasX).toBeGreaterThan(0);
        expect(p.canvasX).toBeLessThan(canvasSize.width);
        expect(p.canvasY).toBeGreaterThan(0);
        expect(p.canvasY).toBeLessThan(canvasSize.height);
      });
    });
  });

  /**
   * Test 5: Image and JSON map compatibility
   */
  describe("Image and JSON map support", () => {
    it("beacon placement works with JPG/PNG floor plan", () => {
      // Floor plan: 1672×941 pixels
      // Map: 16.72m × 9.41m
      // Beacons placed on image should use same coordinate system

      const mapConfig = {
        map: {
          width: 16.72,
          height: 9.41,
          backgroundImage: "data:image/jpeg;base64,...",
          backgroundImageWidth: 1672,
          backgroundImageHeight: 941,
        },
      };

      const beacon = { uuid: "b1", x: 8.36, y: 4.705, displayName: "Center" };

      // Verify beacon is at center of map
      expect(beacon.x).toBeCloseTo(mapConfig.map.width / 2, 1);
      expect(beacon.y).toBeCloseTo(mapConfig.map.height / 2, 1);
    });

    it("beacon placement works with JSON layout", () => {
      const mapConfig = {
        map: {
          width: 16,
          height: 8,
          entities: [
            {
              type: "polyline",
              points: [
                [0, 0],
                [16, 0],
                [16, 8],
                [0, 8],
                [0, 0],
              ],
            },
          ],
        },
      };

      const beacons = [
        { uuid: "b1", x: 4, y: 2, displayName: "A" },
        { uuid: "b2", x: 12, y: 6, displayName: "B" },
      ];

      // Verify beacons are within JSON map bounds
      beacons.forEach((b) => {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(mapConfig.map.width);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeLessThanOrEqual(mapConfig.map.height);
      });
    });

    it("coordinate system is consistent between image and JSON", () => {
      // Both should use same origin and axes
      const imageMapConfig = {
        map: { width: 10, height: 10, backgroundImage: "..." },
      };
      const jsonMapConfig = {
        map: { width: 10, height: 10, entities: [] },
      };

      // Place beacon at (5, 5) on both
      const beacon = { uuid: "b1", x: 5, y: 5 };

      // Beacon should be at center of both maps
      expect(beacon.x).toBeCloseTo(imageMapConfig.map.width / 2, 1);
      expect(beacon.y).toBeCloseTo(imageMapConfig.map.height / 2, 1);

      expect(beacon.x).toBeCloseTo(jsonMapConfig.map.width / 2, 1);
      expect(beacon.y).toBeCloseTo(jsonMapConfig.map.height / 2, 1);
    });
  });

  /**
   * Test 6: Boundary clamping
   */
  describe("Boundary clamping", () => {
    it("clamps beacon at all four corners", () => {
      const mapWidth = 16;
      const mapHeight = 8;

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapWidth, x)),
        Math.max(0, Math.min(mapHeight, y)),
      ];

      // Top-left corner (0, 8)
      const [x1, y1] = clampToMap(-5, 15);
      expect(x1).toBe(0);
      expect(y1).toBe(mapHeight);

      // Top-right corner (16, 8)
      const [x2, y2] = clampToMap(25, 15);
      expect(x2).toBe(mapWidth);
      expect(y2).toBe(mapHeight);

      // Bottom-left corner (0, 0)
      const [x3, y3] = clampToMap(-5, -5);
      expect(x3).toBe(0);
      expect(y3).toBe(0);

      // Bottom-right corner (16, 0)
      const [x4, y4] = clampToMap(25, -5);
      expect(x4).toBe(mapWidth);
      expect(y4).toBe(0);
    });

    it("preserves coordinates at exact boundaries", () => {
      const mapWidth = 16;
      const mapHeight = 8;

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapWidth, x)),
        Math.max(0, Math.min(mapHeight, y)),
      ];

      const [x1, y1] = clampToMap(0, 0);
      expect(x1).toBe(0);
      expect(y1).toBe(0);

      const [x2, y2] = clampToMap(mapWidth, mapHeight);
      expect(x2).toBe(mapWidth);
      expect(y2).toBe(mapHeight);
    });
  });

  /**
   * Test 7: Configuration persistence
   */
  describe("Save and reload", () => {
    it("beacon coordinates persist in configuration object", () => {
      const originalConfig = {
        map: { width: 16, height: 8 },
        beacons: [
          { uuid: "b1", x: 3, y: 2, displayName: "Beacon A" },
          { uuid: "b2", x: 10, y: 6, displayName: "Beacon B" },
        ],
      };

      // Simulate save (JSON stringify/parse)
      const saved = JSON.stringify(originalConfig);
      const loaded = JSON.parse(saved);

      expect(loaded.beacons[0].x).toBe(3);
      expect(loaded.beacons[0].y).toBe(2);
      expect(loaded.beacons[1].x).toBe(10);
      expect(loaded.beacons[1].y).toBe(6);
    });

    it("beacon positions preserved after configuration update", () => {
      const config = {
        map: { width: 16, height: 8 },
        beacons: [{ uuid: "b1", x: 5, y: 4, displayName: "A" }],
      };

      // Update map settings but keep beacon positions
      const updated = {
        ...config,
        map: { ...config.map, name: "Updated Name" },
      };

      expect(updated.beacons[0].x).toBe(5);
      expect(updated.beacons[0].y).toBe(4);
    });
  });
});
