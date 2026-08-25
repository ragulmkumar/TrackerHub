import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMapCanvas } from "./useMapCanvas";

describe("useMapCanvas", () => {
  const defaultParams = {
    canvasWidth: 800,
    canvasHeight: 600,
    mapConfig: {
      map: { width: 20, height: 15, name: "Test Map" },
    },
    padding: 30,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates scale, offset, and render dimensions correctly", () => {
    const { result } = renderHook(() => useMapCanvas(defaultParams));

    expect(result.current.mapWidth).toBe(20);
    expect(result.current.mapHeight).toBe(15);
    expect(result.current.canvasWidth).toBe(800);
    expect(result.current.canvasHeight).toBe(600);
    expect(result.current.padding).toBe(30);

    // Available space: 800-60=740 width, 600-60=540 height
    // Scale = min(740/20, 540/15) = min(37, 36) = 36
    expect(result.current.scale).toBe(36);
    expect(result.current.renderWidth).toBe(720); // 20 * 36
    expect(result.current.renderHeight).toBe(540); // 15 * 36
    expect(result.current.offsetX).toBe(40); // (800-720)/2
    expect(result.current.offsetY).toBe(30); // (600-540)/2
  });

  it("handles missing mapConfig gracefully", () => {
    const { result } = renderHook(() =>
      useMapCanvas({
        canvasWidth: 800,
        canvasHeight: 600,
        mapConfig: null,
      }),
    );

    expect(result.current.scale).toBe(1);
    expect(result.current.offsetX).toBe(0);
    expect(result.current.offsetY).toBe(0);
    expect(result.current.renderWidth).toBe(0);
    expect(result.current.renderHeight).toBe(0);
    expect(result.current.mapWidth).toBe(0);
    expect(result.current.mapHeight).toBe(0);
  });

  it("handles zero map dimensions", () => {
    const { result } = renderHook(() =>
      useMapCanvas({
        canvasWidth: 800,
        canvasHeight: 600,
        mapConfig: { map: { width: 0, height: 0 } },
      }),
    );

    expect(result.current.scale).toBe(1);
    expect(result.current.renderWidth).toBe(0);
    expect(result.current.renderHeight).toBe(0);
  });

  describe("toCanvas", () => {
    it("converts map coordinates to canvas coordinates", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { toCanvas } = result.current;

      // Map origin (0,0) bottom-left -> Canvas (offsetX, canvasHeight - offsetY)
      const [x, y] = toCanvas(0, 0);
      expect(x).toBe(40); // offsetX
      expect(y).toBe(570); // 600 - 30

      // Map top-right (20, 15) -> Canvas (offsetX + renderWidth, offsetY)
      const [x2, y2] = toCanvas(20, 15);
      expect(x2).toBe(760); // 40 + 720
      expect(y2).toBe(30); // offsetY
    });

    it("converts center point correctly", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { toCanvas } = result.current;

      const [x, y] = toCanvas(10, 7.5); // Center of 20x15 map
      expect(x).toBe(400); // 40 + 10*36 = 400
      expect(y).toBe(300); // 600 - 30 - 7.5*36 = 300
    });
  });

  describe("toMap", () => {
    it("converts canvas coordinates to map coordinates (inverse of toCanvas)", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { toCanvas, toMap } = result.current;

      // Round-trip test
      const mapPoints = [
        [0, 0],
        [10, 7.5],
        [20, 15],
        [5, 3],
        [15, 12],
      ];

      mapPoints.forEach(([mx, my]) => {
        const [cx, cy] = toCanvas(mx, my);
        const [mx2, my2] = toMap(cx, cy);
        expect(mx2).toBeCloseTo(mx, 5);
        expect(my2).toBeCloseTo(my, 5);
      });
    });

    it("handles canvas origin correctly", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { toMap } = result.current;

      // Canvas top-left (0, 0) -> should be outside map bounds
      const [mx, my] = toMap(0, 0);
      expect(mx).toBeLessThan(0);
      expect(my).toBeGreaterThan(15);
    });
  });

  describe("isInsideMap", () => {
    it("returns true for points inside map bounds", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { isInsideMap, toCanvas } = result.current;

      // Center of map
      const [cx, cy] = toCanvas(10, 7.5);
      expect(isInsideMap(cx, cy)).toBe(true);

      // Edges
      const [cx1, cy1] = toCanvas(0, 0);
      expect(isInsideMap(cx1, cy1)).toBe(true);

      const [cx2, cy2] = toCanvas(20, 15);
      expect(isInsideMap(cx2, cy2)).toBe(true);
    });

    it("returns false for points outside map bounds", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { isInsideMap } = result.current;

      // Outside left
      expect(isInsideMap(0, 300)).toBe(false);
      // Outside right
      expect(isInsideMap(800, 300)).toBe(false);
      // Outside top
      expect(isInsideMap(400, 0)).toBe(false);
      // Outside bottom
      expect(isInsideMap(400, 600)).toBe(false);
    });

    it("respects tolerance parameter", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { isInsideMap, offsetX } = result.current;

      // Just outside left edge with tolerance
      expect(isInsideMap(offsetX - 5, 300, 10)).toBe(true);
      expect(isInsideMap(offsetX - 5, 300, 4)).toBe(false);
    });
  });

  describe("clampToMap", () => {
    it("clamps coordinates to map bounds", () => {
      const { result } = renderHook(() => useMapCanvas(defaultParams));
      const { clampToMap } = result.current;

      // Below minimum
      expect(clampToMap(-5, -5)).toEqual([0, 0]);
      // Above maximum
      expect(clampToMap(25, 20)).toEqual([20, 15]);
      // Within bounds
      expect(clampToMap(10, 7.5)).toEqual([10, 7.5]);
      // Edge cases
      expect(clampToMap(0, 0)).toEqual([0, 0]);
      expect(clampToMap(20, 15)).toEqual([20, 15]);
    });
  });

  describe("responsive to prop changes", () => {
    it("updates when canvas size changes", () => {
      const { result, rerender } = renderHook(
        ({ width, height }) =>
          useMapCanvas({
            canvasWidth: width,
            canvasHeight: height,
            mapConfig: { map: { width: 20, height: 15 } },
            padding: 30,
          }),
        { initialProps: { width: 800, height: 600 } },
      );

      expect(result.current.scale).toBe(36);

      rerender({ width: 1200, height: 900 });
      // New available: 1140x840, scale = min(1140/20, 840/15) = min(57, 56) = 56
      expect(result.current.scale).toBe(56);
    });

    it("updates when map config changes", () => {
      const { result, rerender } = renderHook(
        ({ mapConfig }) =>
          useMapCanvas({
            canvasWidth: 800,
            canvasHeight: 600,
            mapConfig,
            padding: 30,
          }),
        { initialProps: { mapConfig: { map: { width: 20, height: 15 } } } },
      );

      expect(result.current.scale).toBe(36);

      rerender({ mapConfig: { map: { width: 10, height: 10 } } });
      // New scale = min(740/10, 540/10) = min(74, 54) = 54
      expect(result.current.scale).toBe(54);
    });
  });
});
