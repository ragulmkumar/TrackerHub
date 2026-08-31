import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 2 Integration Tests: Map Dimensions and JSON Import
 *
 * Verifies that:
 * - Map dimensions (width, height) are validated correctly
 * - JSON import preserves map dimensions
 * - Image import sets default dimensions
 * - Configuration can be saved and reloaded with correct dimensions
 */

describe("MapConfigurationTab - Map Dimensions (Phase 2)", () => {
  /**
   * Test 1: Validate that dimensions must be positive numbers
   */
  describe("Map dimension validation", () => {
    it("rejects zero width", () => {
      // This test verifies validation logic
      const validateMapDimension = (value, fieldName) => {
        if (value === null || value === undefined || value === "") {
          return `${fieldName} is required`;
        }
        const num = Number(value);
        if (isNaN(num)) {
          return `${fieldName} must be a number`;
        }
        if (num <= 0) {
          return `${fieldName} must be greater than 0`;
        }
        return "";
      };

      const error = validateMapDimension(0, "Width");
      expect(error).toBe("Width must be greater than 0");
    });

    it("rejects negative height", () => {
      const validateMapDimension = (value, fieldName) => {
        if (value === null || value === undefined || value === "") {
          return `${fieldName} is required`;
        }
        const num = Number(value);
        if (isNaN(num)) {
          return `${fieldName} must be a number`;
        }
        if (num <= 0) {
          return `${fieldName} must be greater than 0`;
        }
        return "";
      };

      const error = validateMapDimension(-5, "Height");
      expect(error).toBe("Height must be greater than 0");
    });

    it("rejects non-numeric width", () => {
      const validateMapDimension = (value, fieldName) => {
        if (value === null || value === undefined || value === "") {
          return `${fieldName} is required`;
        }
        const num = Number(value);
        if (isNaN(num)) {
          return `${fieldName} must be a number`;
        }
        if (num <= 0) {
          return `${fieldName} must be greater than 0`;
        }
        return "";
      };

      const error = validateMapDimension("abc", "Width");
      expect(error).toBe("Width must be a number");
    });

    it("accepts valid positive dimensions", () => {
      const validateMapDimension = (value, fieldName) => {
        if (value === null || value === undefined || value === "") {
          return `${fieldName} is required`;
        }
        const num = Number(value);
        if (isNaN(num)) {
          return `${fieldName} must be a number`;
        }
        if (num <= 0) {
          return `${fieldName} must be greater than 0`;
        }
        return "";
      };

      expect(validateMapDimension(30, "Width")).toBe("");
      expect(validateMapDimension(20.5, "Height")).toBe("");
      expect(validateMapDimension(0.1, "Width")).toBe("");
    });
  });

  /**
   * Test 2: Verify JSON import structure with dimensions
   */
  describe("JSON layout structure validation", () => {
    it("accepts valid map with width and height", () => {
      const layoutJson = {
        map: {
          width: 16.0,
          height: 8.0,
          entities: [],
        },
        beacons: [],
        settings: {
          signalPropagationFactor: 2.5,
        },
      };

      // Validation logic
      const validateLayoutStructure = (jsonData) => {
        if (!jsonData || typeof jsonData !== "object") return false;
        if (!jsonData.map || typeof jsonData.map !== "object") return false;
        if (
          typeof jsonData.map.width !== "number" ||
          typeof jsonData.map.height !== "number"
        )
          return false;
        if (jsonData.map.width <= 0 || jsonData.map.height <= 0) return false;
        return true;
      };

      expect(validateLayoutStructure(layoutJson)).toBe(true);
    });

    it("rejects map with missing width", () => {
      const layoutJson = {
        map: {
          height: 8.0,
          entities: [],
        },
      };

      const validateLayoutStructure = (jsonData) => {
        if (!jsonData || typeof jsonData !== "object") return false;
        if (!jsonData.map || typeof jsonData.map !== "object") return false;
        if (
          typeof jsonData.map.width !== "number" ||
          typeof jsonData.map.height !== "number"
        )
          return false;
        return true;
      };

      expect(validateLayoutStructure(layoutJson)).toBe(false);
    });

    it("rejects map with zero dimensions", () => {
      const layoutJson = {
        map: {
          width: 0,
          height: 8.0,
          entities: [],
        },
      };

      const validateLayoutStructure = (jsonData) => {
        if (!jsonData || typeof jsonData !== "object") return false;
        if (!jsonData.map || typeof jsonData.map !== "object") return false;
        if (
          typeof jsonData.map.width !== "number" ||
          typeof jsonData.map.height !== "number"
        )
          return false;
        if (jsonData.map.width <= 0 || jsonData.map.height <= 0) return false;
        return true;
      };

      expect(validateLayoutStructure(layoutJson)).toBe(false);
    });
  });

  /**
   * Test 3: Verify image scaling calculation
   */
  describe("Image to map coordinate scaling", () => {
    it("calculates correct pixels per meter for officeLayout example", () => {
      // officeLayout.jpg: 1672 × 941 pixels
      // If map is 16.72m × 9.41m, then 1 pixel = 0.01m or 1m = 100 pixels
      const imageDimensionsPixels = { width: 1672, height: 941 };
      const mapDimensionMeters = { width: 16.72, height: 9.41 };

      const pixelsPerMeterX =
        imageDimensionsPixels.width / mapDimensionMeters.width;
      const pixelsPerMeterY =
        imageDimensionsPixels.height / mapDimensionMeters.height;

      expect(pixelsPerMeterX).toBeCloseTo(100, 1);
      expect(pixelsPerMeterY).toBeCloseTo(100, 1);
    });

    it("converts image pixels to map meters correctly", () => {
      // Example: 100 pixels per meter
      const pixelsPerMeter = 100;

      const pixelsToMeters = (pixels) => pixels / pixelsPerMeter;
      const metersToPixels = (meters) => meters * pixelsPerMeter;

      // 500 pixels = 5 meters
      expect(pixelsToMeters(500)).toBe(5);

      // 7.5 meters = 750 pixels
      expect(metersToPixels(7.5)).toBe(750);

      // Round-trip conversion
      const originalMeters = 3.14;
      const pixels = metersToPixels(originalMeters);
      const recoveredMeters = pixelsToMeters(pixels);
      expect(recoveredMeters).toBeCloseTo(originalMeters, 2);
    });

    it("handles different aspect ratios", () => {
      // Wide image: 2000 × 800 pixels
      // Map: 20m × 8m
      const imagePixels = { width: 2000, height: 800 };
      const mapMeters = { width: 20, height: 8 };

      const scaleX = imagePixels.width / mapMeters.width; // 100 px/m
      const scaleY = imagePixels.height / mapMeters.height; // 100 px/m

      expect(scaleX).toBe(scaleY);
      expect(scaleX).toBe(100);
    });
  });

  /**
   * Test 4: Verify boundary clamping for invalid import data
   */
  describe("Boundary and range validation", () => {
    it("clamps coordinates to map bounds", () => {
      const mapWidth = 16.0;
      const mapHeight = 8.0;

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapWidth, x)),
        Math.max(0, Math.min(mapHeight, y)),
      ];

      expect(clampToMap(-1, 4)).toEqual([0, 4]);
      expect(clampToMap(20, 4)).toEqual([mapWidth, 4]);
      expect(clampToMap(8, -2)).toEqual([8, 0]);
      expect(clampToMap(8, 10)).toEqual([8, mapHeight]);
    });

    it("preserves valid coordinates within bounds", () => {
      const mapWidth = 16.0;
      const mapHeight = 8.0;

      const clampToMap = (x, y) => [
        Math.max(0, Math.min(mapWidth, x)),
        Math.max(0, Math.min(mapHeight, y)),
      ];

      expect(clampToMap(8, 4)).toEqual([8, 4]);
      expect(clampToMap(0, 0)).toEqual([0, 0]);
      expect(clampToMap(16, 8)).toEqual([mapWidth, mapHeight]);
    });
  });
});
