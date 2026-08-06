import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import Notification from "../components/Notification";
import { NotificationContext } from "./NotificationContext";
import type { NotificationType } from "./NotificationContext";

interface NotificationProviderProps {
  children: ReactNode;
}

type NotificationState = {
  message: string;
  type: NotificationType;
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type });
  }, []);

  useEffect(() => {
    const handleRateLimit = () => {
      setNotification({
        message: "API rate limit reached. Please wait a moment.",
        type: "error",
      });
    };

    window.addEventListener("api:rate-limit", handleRateLimit);
    return () => window.removeEventListener("api:rate-limit", handleRateLimit);
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