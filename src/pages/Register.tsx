import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/api/auth";
import { Spinner } from "../components/Spinner";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Register user
      await register({ username, password });

      // 2️⃣ Log in directly (updates context and tokens)
      await login(username, password);

      // 3️⃣ Redirect to companies page
      navigate("/companies");
    } catch (err: unknown) {
      console.error("Registration failed:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed, please try again");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        paddingTop: "10vh",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          border: "1px solid #ccc",
          padding: "1rem",
          borderRadius: 8,
          width: 300,
        }}
      >
        <h2>📝 Register</h2>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Spinner /> Registering…
            </>
          ) : (
            "Register"
          )}
        </button>

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

        <p style={{ fontSize: "0.9rem" }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
