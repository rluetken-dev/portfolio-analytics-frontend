import { useAuth } from "../hooks/useAuth";

export function AuthBadge() {
  const { user, isAuthenticated, logout } = useAuth();

  // 🔹 Debug output
  console.log("AuthBadge state:", { user, isAuthenticated });

  if (!isAuthenticated) {
    return <span style={{ color: "red" }}>Not logged in</span>;
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <span style={{ color: "green" }}>Logged in as: {user?.username}</span>
      <button onClick={logout} style={{ padding: "0.25rem 0.5rem" }}>
        Logout
      </button>
    </div>
  );
}
