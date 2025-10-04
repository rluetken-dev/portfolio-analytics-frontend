import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";
import { login as apiLogin, fetchMe, refresh, logout as apiLogout } from "../services/api/auth";
import { setAccessToken, clearAccessToken } from "../utils/token";
import { useNavigate } from "react-router-dom";

// AuthProvider: wraps the app and provides auth state + actions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function initAuth() {
      try {
        // Try to fetch user with current access token
        const me = await fetchMe();
        setUser(me);
        console.log("Restored session for:", me.username);
      } catch {
        console.log("Access token invalid, trying refresh...");

        try {
          const newTokens = await refresh();
          setAccessToken(newTokens.accessToken);

          const me = await fetchMe();
          setUser(me);
          console.log("Session restored via refresh for:", me.username);
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
      console.log("User logged out");
      navigate("/login"); // redirect after logout
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
