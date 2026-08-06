import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Spinner } from "../components/Spinner";
import { useAuth } from "../hooks/useAuth";
import { register } from "../services/api/auth";

function getRegistrationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Registration failed. Please try again.";
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register({ username: username.trim(), password });
      await login(username.trim(), password);
      navigate("/companies", { replace: true });
    } catch (error) {
      setError(getRegistrationErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        paddingTop: "10vh",
        backgroundColor: "#f9fafb",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          border: "1px solid #ccc",
          padding: "2rem",
          borderRadius: 8,
          width: "100%",
          maxWidth: 320,
          backgroundColor: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ marginBottom: "0.25rem", textAlign: "center" }}>Register</h1>

        <label>
          <span style={{ display: "block", marginBottom: 4, fontSize: "0.875rem" }}>Username</span>
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
          <span style={{ display: "block", marginBottom: 4, fontSize: "0.875rem" }}>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="new-password"
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
              <Spinner /> Registering...
            </>
          ) : (
            "Register"
          )}
        </button>

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

        <p style={{ fontSize: "0.9rem", textAlign: "center" }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}