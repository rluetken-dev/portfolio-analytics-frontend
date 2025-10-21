import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";
import { login as apiLogin, fetchMe, refresh, logout as apiLogout } from "../services/api/auth";
import { setAccessToken, clearAccessToken, getAccessToken } from "../utils/token";
import { useNavigate } from "react-router-dom";

// AuthProvider: wraps the app and provides auth state + actions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();

  // ✅ Helper to fetch user balance
  async function fetchBalanceAndSet() {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch("/api/User/balance", {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBalance(data.cashBalance);
      console.log("💰 Balance loaded:", data.cashBalance);
    } catch (err) {
      console.warn("⚠️ Failed to fetch balance:", err);
    }
  }

  useEffect(() => {
    async function initAuth() {
      try {
        // Try to fetch user with current access token
        const me = await fetchMe();
        setUser(me);
        console.log("Restored session for:", me.username);

        await fetchBalanceAndSet(); // ✅ load balance on startup
      } catch {
        console.log("Access token invalid, trying refresh...");

        try {
          const newTokens = await refresh();
          setAccessToken(newTokens.accessToken);

          const me = await fetchMe();
          setUser(me);
          console.log("Session restored via refresh for:", me.username);

          await fetchBalanceAndSet(); // ✅ also load balance after refresh
        } catch {
          console.log("No active session available");
          setUser(null);
        }
      }
    }

    void initAuth();
  }, []);

  // login wrapper
  async function login(username: string, password: string) {
    try {
      const response = await apiLogin({ username, password });
      console.log("AuthProvider.login() response:", response);

      setAccessToken(response.accessToken);
      setUser(response.user);
      console.log("AuthProvider state updated:", response.user);

      await fetchBalanceAndSet(); // ✅ load balance after login
    } catch (err) {
      console.error("Login failed:", err);
      throw err;
    }
  }

  // logout wrapper with redirect
  async function logout() {
    try {
      await apiLogout(); // call backend logout
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      clearAccessToken();
      setUser(null);
      setBalance(null);
      console.log("User logged out");
      navigate("/login");
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        balance,
        setBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
