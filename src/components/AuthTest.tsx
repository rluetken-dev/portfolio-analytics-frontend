import { useState } from "react";
import { useAuth } from "../hooks/useAuth"; // ✅ statt direkte API-Calls

export default function AuthTest() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { user, isAuthenticated, login, logout } = useAuth();

  async function handleLogin() {
    try {
      await login(username, password); // ✅ Context-Login ruft Provider
      console.log("Login via AuthProvider success");
    } catch (err: unknown) {
      console.error("Login failed:", err);
    }
  }

  async function handleLogout() {
    try {
      await logout(); // ✅ Context-Logout ruft Provider
      console.log("Logged out via AuthProvider");
    } catch (err: unknown) {
      console.error("Logout failed:", err);
    }
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", marginTop: "1rem" }}>
      <h2>🔐 Auth Test (via Context)</h2>

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
      <button onClick={handleLogout}>Logout</button>

      <div style={{ marginTop: "1rem" }}>
        {isAuthenticated ? (
          <p style={{ color: "green" }}>✅ Logged in as {user?.username}</p>
        ) : (
          <p style={{ color: "red" }}>❌ Not logged in</p>
        )}
      </div>
    </div>
  );
}
