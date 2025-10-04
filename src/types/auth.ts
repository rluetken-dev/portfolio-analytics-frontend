// -------------------------------------------------------------
// Auth-related shared types between frontend and backend
// -------------------------------------------------------------

export interface LoginRequest {
  username: string;
  password: string;
}

// EN: Response from /api/User/login
export interface LoginResponse {
  accessToken: string;
  user: User;
}

// EN: Common user shape returned by /api/User/me and embedded in login response
export interface User {
  id: number;
  username: string;
  role: "Admin" | "User"; // EN: backend-defined role for access control
}
