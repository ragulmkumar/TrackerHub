import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver - use class constructor
class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }
}
globalThis.ResizeObserver = MockResizeObserver;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.sessionStorage = sessionStorageMock;

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  arcTo: vi.fn(),
  setTransform: vi.fn(),
  setLineDash: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "",
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  drawImage: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  strokeRect: vi.fn(),
  fillRect: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  transform: vi.fn(),
  setTransform: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createPattern: vi.fn(() => ({})),
  lineCap: "",
  globalAlpha: 1,
}));

// Mock FileReader for testing file uploads
class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.result = "";
  }
  readAsDataURL(file) {
    // Simulate async file reading - create a data URL based on file type
    // The file.type is what the browser would report, which comes from the File constructor
    setTimeout(() => {
      if (file.type && file.type.startsWith("image/")) {
        this.result =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      } else {
        // For non-image files, return a non-image data URL
        this.result = "data:text/plain;base64,dGVzdA==";
      }
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }
  readAsText(file) {
    // Simulate async file reading - return the file content as text
    setTimeout(async () => {
      try {
        this.result = await file.text();
      } catch {
        this.result = "";
      }
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }
}
globalThis.FileReader = MockFileReader;

// Mock HTMLImageElement for testing image loading
class MockImage {
  constructor() {
    this._src = "";
    this.onload = null;
    this.onerror = null;
    this.complete = false;
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.width = 100;
    this.height = 100;
  }

  set src(value) {
    this._src = value;
    // Simulate async loading when src is set
    setTimeout(() => {
      // If src is not an image data URL, trigger onerror
      if (this._src && !this._src.startsWith("data:image/")) {
        this.complete = true;
        if (this.onerror) {
          this.onerror({ target: this });
        }
      } else if (this._src) {
        this.complete = true;
        if (this.onload) {
          this.onload({ target: this });
        }
      }
    }, 0);
  }

  get src() {
    return this._src;
  }
}
globalThis.Image = MockImage;

// Also mock HTMLImageElement prototype for additional properties
Object.defineProperties(HTMLImageElement.prototype, {
  naturalWidth: { value: 100, writable: true },
  naturalHeight: { value: 100, writable: true },
  width: { value: 100, writable: true },
  height: { value: 100, writable: true },
  complete: { value: true, writable: true },
});
