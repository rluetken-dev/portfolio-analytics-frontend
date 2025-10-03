import { useAuth } from "../hooks/useAuth";

export function AuthBadge() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "999px",
          backgroundColor: "#fee2e2", // light red
          color: "#b91c1c", // dark red text
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        Not logged in
      </span>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "999px",
          backgroundColor: "#dcfce7", // light green
          color: "#166534", // dark green text
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        {user?.username}
      </span>
      <button
        onClick={logout}
        style={{
          padding: "4px 8px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          backgroundColor: "white",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ef4444"; // red
          (e.currentTarget as HTMLButtonElement).style.color = "white";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
          (e.currentTarget as HTMLButtonElement).style.color = "black";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#ccc";
        }}
      >
        Logout
      </button>
    </div>
  );
}
