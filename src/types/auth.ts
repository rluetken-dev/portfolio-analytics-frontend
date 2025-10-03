export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    username: string;
  };
}

export interface User {
  id: number;
  username: string;
}
