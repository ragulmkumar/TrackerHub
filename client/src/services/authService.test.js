import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.localStorage = localStorageMock;

import {
  getAuthToken,
  saveAuthToken,
  removeAuthToken,
  getAuthUser,
  loginRequest,
} from "./authService";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe("getAuthToken", () => {
    it("returns null when no token in localStorage", () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(getAuthToken()).toBeNull();
    });

    it("returns token when stored in localStorage", () => {
      localStorageMock.getItem.mockReturnValue("test-token-123");
      expect(getAuthToken()).toBe("test-token-123");
    });
  });

  describe("saveAuthToken", () => {
    it("stores token and user in localStorage", () => {
      saveAuthToken("new-token-456", "testuser");
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "trackerhubToken",
        "new-token-456",
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "trackerhubUser",
        "testuser",
      );
    });
  });

  describe("removeAuthToken", () => {
    it("removes token and user from localStorage", () => {
      removeAuthToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "trackerhubToken",
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "trackerhubUser",
      );
    });
  });

  describe("getAuthUser", () => {
    it("returns null when no user in localStorage", () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(getAuthUser()).toBeNull();
    });

    it("returns user when stored in localStorage", () => {
      localStorageMock.getItem.mockReturnValue("testuser");
      expect(getAuthUser()).toBe("testuser");
    });
  });

  describe("loginRequest", () => {
    it("returns token on successful login", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, token: "jwt-token-789" }),
      });

      const token = await loginRequest("admin", "password");
      expect(token).toBe("jwt-token-789");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "password" }),
        }),
      );
    });

    it("throws error on failed login", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Invalid credentials" }),
      });

      await expect(loginRequest("admin", "wrong")).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("throws error on network failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(loginRequest("admin", "password")).rejects.toThrow(
        "Network error",
      );
    });
  });
});
