import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";
import { login as apiLogin } from "../services/api/auth";
import { setAccessToken } from "../utils/token";
import { logout as apiLogout } from "../services/api/auth";
import { clearAccessToken } from "../utils/token";
import { fetchMe } from "../services/api/auth";

// AuthProvider: wraps the app and provides auth state + actions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        const me = await fetchMe();
        setUser(me);
        console.log("Restored session for:", me.username);
      } catch {
        console.log("No active session");
        setUser(null);
      }
    }

    initAuth();
  }, []);

  async function login(username: string, password: string) {
    try {
      const response = await apiLogin({ username, password });
      console.log("AuthProvider.login() response:", response); // 🔹 Debug

      setAccessToken(response.accessToken);
      setUser(response.user); // 🔹 sollte Badge updaten
      console.log("AuthProvider state updated:", response.user); // 🔹 Debug
    } catch (err) {
      console.error("Login failed:", err);
      throw err;
    }
  }

  async function logout() {
    try {
      await apiLogout(); // call backend logout
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      clearAccessToken(); // always clear token
      setUser(null); // clear user state
      console.log("User logged out");
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
