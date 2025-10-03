import { useState } from "react";
import { login, logout, fetchMe } from "../services/api/auth";
import type { User, LoginResponse } from "../types/auth";

export default function AuthTest() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      const res: LoginResponse = await login({ username, password });
      console.log("Login success:", res);
      setError(null);
    } catch (err: unknown) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleFetchMe() {
    try {
      const me: User = await fetchMe();
      console.log("User info:", me);
      setUserInfo(me);
      setError(null);
    } catch (err: unknown) {
      console.error("FetchMe failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleLogout() {
    try {
      await logout();
      setUserInfo(null);
      setError(null);
      console.log("Logged out");
    } catch (err: unknown) {
      console.error("Logout failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", marginTop: "1rem" }}>
      <h2>🔐 Auth Test</h2>

      <div>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button onClick={handleLogin}>Login</button>
      <button onClick={handleFetchMe}>Fetch Me</button>
      <button onClick={handleLogout}>Logout</button>

      {error && <p style={{ color: "red" }}>⚠️ {error}</p>}
      {userInfo && <pre style={{ textAlign: "left" }}>{JSON.stringify(userInfo, null, 2)}</pre>}
    </div>
  );
}
