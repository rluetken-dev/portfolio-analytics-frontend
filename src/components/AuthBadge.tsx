import { useAuth } from "../hooks/useAuth";

const badgeBaseStyle = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: "0.875rem",
  fontWeight: 500,
};

export function AuthBadge() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <span
        aria-label="Authentication status: not logged in"
        style={{
          ...badgeBaseStyle,
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
        }}
      >
        Not logged in
      </span>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <span
        aria-label={`Logged in as ${user?.username ?? "unknown user"}`}
        style={{
          ...badgeBaseStyle,
          backgroundColor: "#dcfce7",
          color: "#166534",
        }}
      >
        {user?.username ?? "User"}
      </span>

      <button
        type="button"
        onClick={logout}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid #ccc",
          backgroundColor: "white",
          color: "#111827",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  );
}