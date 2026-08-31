import { describe, it, expect } from "vitest";
import { useMapCanvas } from "./useMapCanvas";
import { renderHook } from "@testing-library/react";

/**
 * Comprehensive coordinate system tests for Phase 2: Floor Plan Dimensions + Calibration
 *
 * This test suite verifies:
 * - Meter ↔ pixel conversions are correct and inverse
 * - Map origin is bottom-left (0,0)
 * - Canvas origin is top-left (0,0)
 * - Y-axis is correctly flipped between map and canvas
 * - Boundary clamping works
 * - Image scaling is deterministic
 */

describe("useMapCanvas - Coordinate System Calibration", () => {
  /**
   * Test Case 1: Verify map origin (0,0) is bottom-left
   * and canvas origin (0,0) is top-left with correct Y-flip
   */
  describe("Y-axis direction and origin", () => {
    it("converts map bottom-left (0,0) to canvas top-left area", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Map (0, 0) should be at the bottom-left of the map render area
      // Canvas-wise, this is near the bottom of the map area
      const [canvasX, canvasY] = result.current.toCanvas(0, 0);

      // Canvas bottom is at canvasHeight - offsetY
      // So (0,0) in map should have canvasY near canvasHeight - offsetY
      const expectedY = result.current.canvasHeight - result.current.offsetY;
      expect(canvasY).toBeCloseTo(expectedY, 1);
    });

    it("converts map top-left (0, mapHeight) to canvas top area", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const [canvasX, canvasY] = result.current.toCanvas(0, 20); // (0, mapHeight)

      // Canvas top is at offsetY
      const expectedY = result.current.offsetY;
      expect(canvasY).toBeCloseTo(expectedY, 1);
    });

    it("converts map center correctly", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const mapCenterX = 15;
      const mapCenterY = 10;
      const [canvasX, canvasY] = result.current.toCanvas(
        mapCenterX,
        mapCenterY,
      );

      // Canvas center should be roughly in the middle
      expect(canvasX).toBeGreaterThan(result.current.offsetX);
      expect(canvasX).toBeLessThan(
        result.current.offsetX + result.current.renderWidth,
      );
      expect(canvasY).toBeGreaterThan(result.current.offsetY);
      expect(canvasY).toBeLessThan(
        result.current.offsetY + result.current.renderHeight,
      );
    });
  });

  /**
   * Test Case 2: Verify meter ↔ pixel conversions are inverse operations
   */
  describe("Meter to pixel and back conversion", () => {
    it("converts meters to pixels and back within tolerance", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const originalMapX = 5.5;
      const originalMapY = 3.2;

      // Map → Canvas → Map
      const [canvasX, canvasY] = result.current.toCanvas(
        originalMapX,
        originalMapY,
      );
      const [recoveredMapX, recoveredMapY] = result.current.toMap(
        canvasX,
        canvasY,
      );

      // Should recover original values within floating-point tolerance
      expect(recoveredMapX).toBeCloseTo(originalMapX, 2);
      expect(recoveredMapY).toBeCloseTo(originalMapY, 2);
    });

    it("handles corner positions correctly", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const corners = [
        [0, 0], // Bottom-left
        [30, 0], // Bottom-right
        [0, 20], // Top-left
        [30, 20], // Top-right
      ];

      corners.forEach(([x, y]) => {
        const [canvasX, canvasY] = result.current.toCanvas(x, y);
        const [recoveredX, recoveredY] = result.current.toMap(canvasX, canvasY);

        expect(recoveredX).toBeCloseTo(x, 1);
        expect(recoveredY).toBeCloseTo(y, 1);
      });
    });
  });

  /**
   * Test Case 3: Verify scale calculation is deterministic
   * and image scaling works correctly
   */
  describe("Image scaling calculation", () => {
    it("calculates correct scale for known dimensions", () => {
      // Example from Phase 2: 1672 pixels × 941 pixels = 16.72m × 9.41m
      // Therefore: 1m = 100 pixels
      const mapConfig = {
        map: { width: 16.72, height: 9.41, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 1672 + 60, // 60px padding
          canvasHeight: 941 + 60,
          mapConfig,
          padding: 30,
        }),
      );

      // With padding 30px, available is 1672 and 941
      // scale = min(1672 / 16.72, 941 / 9.41) = min(100, 100) = 100
      expect(result.current.scale).toBeCloseTo(100, 0);
    });

    it("scales down if canvas is smaller than map dimensions", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 300, // Small canvas
          canvasHeight: 200,
          mapConfig,
          padding: 30,
        }),
      );

      // Available width = 300 - 60 = 240, so scale = 240/30 = 8
      // Available height = 200 - 60 = 140, so scale = 140/20 = 7
      // scale = min(8, 7) = 7
      expect(result.current.scale).toBeLessThan(8);
      expect(result.current.scale).toBeGreaterThan(6);
    });

    it("maintains aspect ratio of map", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Aspect ratio of map = 30/20 = 1.5
      // Rendered ratio = renderWidth / renderHeight
      const renderedRatio =
        result.current.renderWidth / result.current.renderHeight;
      const mapRatio = result.current.mapWidth / result.current.mapHeight;

      expect(renderedRatio).toBeCloseTo(mapRatio, 2);
    });
  });

  /**
   * Test Case 4: Verify boundary clamping works correctly
   */
  describe("Map boundary clamping", () => {
    it("clamps coordinate to map bounds", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Out of bounds
      const [clampedX, clampedY] = result.current.clampToMap(35, 25);

      // Should be clamped to [0, width] and [0, height]
      expect(clampedX).toBe(30);
      expect(clampedY).toBe(20);
    });

    it("clamps negative coordinates to 0", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const [clampedX, clampedY] = result.current.clampToMap(-5, -3);

      expect(clampedX).toBe(0);
      expect(clampedY).toBe(0);
    });

    it("preserves valid coordinates", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      const [clampedX, clampedY] = result.current.clampToMap(15, 10);

      expect(clampedX).toBe(15);
      expect(clampedY).toBe(10);
    });
  });

  /**
   * Test Case 5: Verify isInsideMap boundary check
   */
  describe("Map boundary containment check", () => {
    it("returns true for coordinates inside map", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Convert a map point to canvas
      const [canvasX, canvasY] = result.current.toCanvas(15, 10);

      // Should be inside
      expect(result.current.isInsideMap(canvasX, canvasY)).toBe(true);
    });

    it("returns false for coordinates outside map", () => {
      const mapConfig = {
        map: { width: 30, height: 20, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Point far outside the map area
      const outsideX = result.current.offsetX - 100;
      const outsideY = result.current.offsetY - 100;

      expect(result.current.isInsideMap(outsideX, outsideY)).toBe(false);
    });
  });

  /**
   * Test Case 6: Verify behavior with edge case map dimensions
   */
  describe("Edge case map dimensions", () => {
    it("handles very small map (0.1m × 0.1m)", () => {
      const mapConfig = {
        map: { width: 0.1, height: 0.1, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Should still produce valid scale and offsets
      expect(result.current.scale).toBeGreaterThan(0);
      expect(result.current.renderWidth).toBeGreaterThan(0);
      expect(result.current.renderHeight).toBeGreaterThan(0);
    });

    it("handles very large map (1000m × 1000m)", () => {
      const mapConfig = {
        map: { width: 1000, height: 1000, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Should scale down significantly
      expect(result.current.scale).toBeLessThan(1);
      expect(result.current.renderWidth).toBeLessThan(
        result.current.canvasWidth,
      );
    });

    it("handles rectangular map (non-square)", () => {
      const mapConfig = {
        map: { width: 50, height: 10, entities: [] },
      };
      const { result } = renderHook(() =>
        useMapCanvas({
          canvasWidth: 400,
          canvasHeight: 300,
          mapConfig,
          padding: 30,
        }),
      );

      // Aspect ratio should be preserved
      const aspectMap = result.current.mapWidth / result.current.mapHeight;
      const aspectRender =
        result.current.renderWidth / result.current.renderHeight;
      expect(aspectRender).toBeCloseTo(aspectMap, 2);
    });
  });
});
