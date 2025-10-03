import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/Spinner";
import { Link } from "react-router-dom";

/**
 * Centered login page with username & password form.
 */
export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      navigate("/companies");
    } catch (err: unknown) {
      console.error("Login error:", err);

      if (err instanceof Error && "status" in err) {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          setError("Invalid username or password");
        } else if (status && status >= 500) {
          setError("Server error, please try again later");
        } else {
          setError("Login failed, please try again");
        }
      } else {
        setError("Unexpected error occurred");
      }
    } finally {
      setLoading(false);
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
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "none",
              backgroundColor: loading ? "#93c5fd" : "#2563eb",
              color: "white",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            {loading ? (
              <>
                <Spinner /> Logging in…
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
        {error && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 🔹 NEU: Link zur Register-Seite */}
        <p
          style={{
            marginTop: "1rem",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#374151", // neutral gray
          }}
        >
          Don’t have an account?{" "}
          <Link to="/register" style={{ color: "#2563eb", fontWeight: 500 }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

// Global style injection for spin animation
const style = document.createElement("style");
style.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(style);
