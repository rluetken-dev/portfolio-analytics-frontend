import { useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";
import { login as apiLogin } from "../services/api/auth";
import { setAccessToken } from "../utils/token";
import { logout as apiLogout } from "../services/api/auth";
import { clearAccessToken } from "../utils/token";

// AuthProvider: wraps the app and provides auth state + actions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  async function login(username: string, password: string) {
    try {
      const response = await apiLogin({ username, password });
      setAccessToken(response.accessToken); // store token in memory
      setUser(response.user); // update user state
      console.log("Login successful:", response.user);
    } catch (err) {
      console.error("Login failed:", err);
      throw err; // rethrow so UI can show error
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
