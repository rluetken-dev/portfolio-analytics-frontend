export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface User {
  id: number;
  username: string;
  role: "Admin" | "User";
}