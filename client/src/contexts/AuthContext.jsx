import { createContext, useContext, useMemo, useState } from "react";
import {
  getAuthToken,
  getAuthUser,
  loginRequest,
  removeAuthToken,
  saveAuthToken,
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getAuthToken());
  const [user, setUser] = useState(getAuthUser());
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const tokenValue = await loginRequest(username, password);
      saveAuthToken(tokenValue, username);
      setToken(tokenValue);
      setUser(username);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
