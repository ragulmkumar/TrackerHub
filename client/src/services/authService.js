const API_BASE = import.meta.env.VITE_API_URL || "";
const STORAGE_TOKEN_KEY = "trackerhubToken";
const STORAGE_USER_KEY = "trackerhubUser";

export async function loginRequest(username, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Login failed. Please check your credentials.",
    );
  }

  return data.token;
}

export function saveAuthToken(token, username) {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_USER_KEY, username);
}

export function removeAuthToken() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function getAuthUser() {
  return localStorage.getItem(STORAGE_USER_KEY);
}
