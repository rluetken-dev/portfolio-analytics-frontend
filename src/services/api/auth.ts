import { fetchJson } from "./client";
import type { LoginRequest, LoginResponse, User } from "../../types/auth";
import { setAccessToken } from "../../utils/token";

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
  await fetchJson<void>({
    method: "POST",
    path: "/api/User/logout",
  });
}

// Aktueller User
export async function fetchMe(): Promise<User> {
  return fetchJson<User>({
    method: "GET",
    path: "/api/User/me",
  });
}
