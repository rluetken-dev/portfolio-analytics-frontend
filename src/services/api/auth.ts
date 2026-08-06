import type { LoginRequest, LoginResponse, User } from "../../types/auth";
import { clearAccessToken, setAccessToken } from "../../utils/token";
import { fetchJson } from "./client";

export interface RegisterRequest {
  username: string;
  password: string;
}

export type RegisterResponse = LoginResponse;

export type RefreshResponse = {
  accessToken: string;
};

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetchJson<LoginResponse, LoginRequest>({
    method: "POST",
    path: "/api/User/login",
    body: data,
  });

  setAccessToken(response.accessToken);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await fetchJson({
      method: "POST",
      path: "/api/User/logout",
    });
  } finally {
    clearAccessToken();
  }
}

export async function fetchMe(): Promise<User> {
  return fetchJson<User>({
    method: "GET",
    path: "/api/User/me",
  });
}

export async function refresh(): Promise<RefreshResponse> {
  return fetchJson<RefreshResponse>({
    method: "POST",
    path: "/api/User/refresh",
  });
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await fetchJson<RegisterResponse, RegisterRequest>({
    method: "POST",
    path: "/api/User/register",
    body: data,
  });

  setAccessToken(response.accessToken);
  return response;
}