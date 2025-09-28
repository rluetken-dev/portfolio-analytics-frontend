import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import Notification from "../components/Notification";
import { NotificationContext } from "./NotificationContext";

type NotificationType = "success" | "error" | "info";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<{
    message: string;
    type: NotificationType;
  } | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type });
  }, []);

  // 🔴 Listen for global rate-limit events
  useEffect(() => {
    const handler = () => {
      setNotification({ message: "API rate limit reached. Please wait a moment.", type: "error" });
    };
    window.addEventListener("api:rate-limit", handler);
    return () => window.removeEventListener("api:rate-limit", handler);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </NotificationContext.Provider>
  );
}
