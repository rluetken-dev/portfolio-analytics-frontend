import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Spinner } from "../components/Spinner";
import { useAuth } from "../hooks/useAuth";

type ApiError = {
  status?: number;
};

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error && "status" in error) {
    const status = (error as ApiError).status;

    if (status === 401) {
      return "Invalid username or password.";
    }

    if (typeof status === "number" && status >= 500) {
      return "Server error. Please try again later.";
    }

    return "Login failed. Please try again.";
  }

  return "Unexpected error occurred.";
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/companies", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
      navigate("/companies", { replace: true });
    } catch (error) {
      setError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "10vh",
        backgroundColor: "#f9fafb",
      }}
    >
      <section
        aria-labelledby="login-title"
        style={{
          padding: "2rem",
          borderRadius: 8,
          backgroundColor: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: 320,
        }}
      >
        <h1 id="login-title" style={{ marginBottom: "1rem", textAlign: "center" }}>
          Login
        </h1>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <label>
            <span style={{ display: "block", marginBottom: 4, fontSize: "0.875rem" }}>
              Username
            </span>
            <input
              type="text"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            />
          </label>

          <label>
            <span style={{ display: "block", marginBottom: 4, fontSize: "0.875rem" }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 4,
                border: "1px solid #ccc",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.5rem",
              borderRadius: 4,
              border: "none",
              backgroundColor: loading ? "#93c5fd" : "#2563eb",
              color: "white",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            {loading ? (
              <>
                <Spinner /> Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <p
          style={{
            marginTop: "1rem",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#374151",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link to="/register" style={{ color: "#2563eb", fontWeight: 500 }}>
            Register here
          </Link>
        </p>
      </section>
    </main>
  );
}