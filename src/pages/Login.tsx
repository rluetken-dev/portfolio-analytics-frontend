import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

/**
 * Centered login page with username & password form.
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
    } catch {
      setError("Invalid username or password");
    }
  }

  if (isAuthenticated) {
    navigate("/companies");
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start", // ❌ nicht mittig, sondern oben
        paddingTop: "10vh", // 🔹 nach unten verschoben (~oberes Drittel)
        backgroundColor: "#f9fafb",
      }}
    >
      <div
        style={{
          padding: "2rem",
          borderRadius: "8px",
          backgroundColor: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "320px",
        }}
      >
        <h2 style={{ marginBottom: "1rem", textAlign: "center" }}>🔐 Login</h2>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.2s ease",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1d4ed8")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2563eb")
            }
          >
            Login
          </button>
        </form>
        {error && <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>}
      </div>
    </div>
  );
}
