import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

/**
 * Simple login page with username & password form.
 * Uses AuthContext.login() and redirects on success.
 */
export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(username, password);
      navigate("/companies"); // redirect after login
    } catch (err) {
      console.error("Login failed:", err);
      setError("Invalid username or password");
    }
  }

  // If already logged in, redirect to /companies
  if (isAuthenticated) {
    navigate("/companies");
    return null;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h2>🔐 Login</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "250px" }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
