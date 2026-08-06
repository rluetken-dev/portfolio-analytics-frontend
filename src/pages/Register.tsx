import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Spinner } from "../components/Spinner";
import { useAuth } from "../hooks/useAuth";
import { register } from "../services/api/auth";

function getRegisterErrorMessage(error: unknown): string {
  const fallback = "Registration failed. Please try again.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message;

  if (message.includes("minimum length") || message.includes("Password")) {
    return "Password must be at least 8 characters long.";
  }

  if (message.includes("Username")) {
    return "Please enter a valid username.";
  }

  if (message.includes("already") || message.includes("exists")) {
    return "This username is already taken.";
  }

  if (message.includes("400")) {
    return "Please check your username and password.";
  }

  if (message.includes("500")) {
    return "Server error. Please try again later.";
  }

  return message || fallback;
}

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError("Please enter username and password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      await register({ username: trimmedUsername, password });
      await login(trimmedUsername, password);
      navigate("/companies");
    } catch (registerError) {
      setError(getRegisterErrorMessage(registerError));
    } finally {
      setLoading(false);
    }
  }

   return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
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
          padding: "2rem",
          borderRadius: 8,
          backgroundColor: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: 320,
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center" }}>Register</h2>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
          Username
          <input
            type="text"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: 4,
              border: "1px solid #ccc",
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
          Password
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: 4,
              border: "1px solid #ccc",
              fontSize: 14,
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
            display: "inline-flex",
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
            margin: 0,
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#374151",
          }}
        >
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#2563eb", fontWeight: 500 }}>
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}