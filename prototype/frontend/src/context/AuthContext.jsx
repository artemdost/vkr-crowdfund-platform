import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up axios interceptor for the Authorization header
  useEffect(() => {
    const interceptor = api.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, []);

  // On mount, check if we have a stored token and fetch user info
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api
        .get("/auth/me")
        .then((res) => {
          setUser(res.data.user || res.data);
        })
        .catch(() => {
          // Token is invalid or expired
          localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Log in with email and password.
   */
  const login = useCallback(async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user: userData } = res.data;
      localStorage.setItem("token", token);
      setUser(userData);
      toast.success("Вход выполнен успешно!");
      return userData;
    } catch (err) {
      const msg = err.response?.data?.message || "Ошибка входа";
      toast.error(msg);
      throw err;
    }
  }, []);

  /**
   * Register a new account.
   */
  const register = useCallback(async (email, password, role) => {
    try {
      const res = await api.post("/auth/register", { email, password, role });
      toast.success("Регистрация успешна! Войдите в систему.");
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || "Ошибка регистрации";
      toast.error(msg);
      throw err;
    }
  }, []);

  /**
   * Log out — clear token and user state.
   */
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    toast.success("Вы вышли из системы");
  }, []);

  /**
   * Refresh user data from API.
   */
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user || res.data);
    } catch {
      // ignore
    }
  }, []);

  const value = { user, setUser, loading, login, register, logout, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
