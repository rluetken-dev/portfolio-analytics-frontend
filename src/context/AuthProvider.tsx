import { useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { AuthContext } from "./auth-context";

// AuthProvider: wraps the app and provides auth state + actions
export function AuthProvider({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [user, setUser] = useState<User | null>(null); // TODO: implement in login()

  async function login(username: string, password: string) {
    console.log("login() not implemented yet", username, password);
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
