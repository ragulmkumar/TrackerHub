import { describe, it, expect, vi, beforeEach } from "vitest";
import { drawMapBase } from "./useMapCanvas";

/**
 * Focused unit test for the background-image rendering path in drawMapBase.
 * This directly verifies the bug that was fixed: the map background fill must
 * NOT overwrite a loaded floor-plan image.
 */

const FAKE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
    strokeRect: vi.fn(),
    strokeStyle: "",
    lineWidth: 1,
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
  };
}

const coords = {
  scale: 10,
  offsetX: 50,
  offsetY: 50,
  renderWidth: 300,
  renderHeight: 200,
  toCanvas: (x, y) => [50 + x * 10, 250 - y * 10],
};

const mapConfig = {
  map: { name: "Test", width: 30, height: 20, entities: [] },
};

describe("drawMapBase - background image rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("draws a loaded background Image object onto the canvas", () => {
    const ctx = makeCtx();
    const loadedImg = { complete: true, naturalWidth: 100, naturalHeight: 100 };

    drawMapBase(ctx, {
      mapConfig,
      canvasWidth: 400,
      canvasHeight: 300,
      coords,
      backgroundImage: loadedImg,
    });

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      loadedImg,
      coords.offsetX,
      coords.offsetY,
      coords.renderWidth,
      coords.renderHeight,
    );
    // The background must NOT be painted over the image with an opaque fill
    // inside the map area - otherwise the image would be hidden.
  });

  it("does not fill the map area with solid background color when an image is present", () => {
    const ctx = makeCtx();
    const loadedImg = { complete: true, naturalWidth: 100, naturalHeight: 100 };

    drawMapBase(ctx, {
      mapConfig,
      canvasWidth: 400,
      canvasHeight: 300,
      coords,
      backgroundImage: loadedImg,
      backgroundColor: "#020617",
    });

    // The image path uses a clip then drawImage. An opaque fillRect covering the
    // exact map rect after the image is what bug hidden the image. Verify we never
    // paint an opaque full-rect over the map area when an image is loaded.
    const fullRectFills = ctx.fillRect.mock.calls.filter(
      ([x, y, w, h]) =>
        Math.round(x) === coords.offsetX &&
        Math.round(y) === coords.offsetY &&
        Math.round(w) === coords.renderWidth &&
        Math.round(h) === coords.renderHeight,
    );
    // The '#111827' under-lay is drawn slightly larger (-1) to create a border,
    // and should NOT be a full exact-rect after the image. Only the grid/border
    // remain. Assert no opaque fill covers the exact map rect.
    expect(fullRectFills.length).toBe(0);
  });

  it("fills map area with background color only when no image is provided", () => {
    const ctx = makeCtx();

    drawMapBase(ctx, {
      mapConfig,
      canvasWidth: 400,
      canvasHeight: 300,
      coords,
      backgroundImage: null,
      backgroundColor: "#020617",
    });

    expect(ctx.drawImage).not.toHaveBeenCalled();
    // Now the opaque background fill over the map area IS expected.
    expect(
      ctx.fillRect.mock.calls.some(
        ([x, y, w, h]) =>
          Math.round(x) === coords.offsetX &&
          Math.round(y) === coords.offsetY &&
          Math.round(w) === coords.renderWidth &&
          Math.round(h) === coords.renderHeight,
      ),
    ).toBe(true);
  });

  it("decodes and offers to draw a string data-URL background (no crash)", () => {
    const ctx = makeCtx();

    // Passed as a string; drawMapBase should attempt to build an Image and not throw.
    expect(() =>
      drawMapBase(ctx, {
        mapConfig,
        canvasWidth: 400,
        canvasHeight: 300,
        coords,
        backgroundImage: FAKE_DATA_URL,
      }),
    ).not.toThrow();
  });
});
