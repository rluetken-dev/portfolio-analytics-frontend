import { useContext } from "react";
import { AuthContext } from "../context/auth-context";

/** Safe and typed access to AuthContext (returns user, login, logout, etc.). */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
