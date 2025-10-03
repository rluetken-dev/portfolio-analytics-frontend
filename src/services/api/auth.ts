import { fetchJson } from "./client";
import type { LoginRequest, LoginResponse, User } from "../../types/auth";
import { setAccessToken, clearAccessToken } from "../../utils/token";

export interface RegisterRequest {
  username: string;
  password: string;
}

export type RegisterResponse = LoginResponse;

// Login
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetchJson<LoginResponse, LoginRequest>({
    method: "POST",
    path: "/api/User/login",
    body: data,
  });

  // Save accessToken in memory
  setAccessToken(response.accessToken);

  return response;
}

// Logout
export async function logout(): Promise<void> {
  try {
    await fetchJson({
      method: "POST",
      path: "/api/User/logout",
    });
  } catch (err) {
    console.warn("Logout request failed:", err);
  } finally {
    clearAccessToken(); // immer AccessToken löschen
  }
}

// Fetch me
export async function fetchMe(): Promise<User> {
  return fetchJson<User>({
    method: "GET",
    path: "/api/User/me",
  });
}

// Refresh
export async function refresh(): Promise<{ accessToken: string }> {
  return await fetchJson<{ accessToken: string }>({
    method: "POST",
    path: "/api/User/refresh",
    // 🔹 wichtig: Cookie mit dem RefreshToken mitschicken
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Register
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetchJson<RegisterResponse>({
    method: "POST",
    path: "/api/User/register",
    body: data,
  });

  // ✅ Save accessToken in memory (as with login)
  setAccessToken(response.accessToken);

  return response;
}
