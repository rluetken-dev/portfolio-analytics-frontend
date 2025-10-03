import { useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";
import { login as apiLogin } from "../services/api/auth";
import { setAccessToken } from "../utils/token";

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
    console.log("logout() not implemented yet");
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
