import { createContext } from "react";

type NotificationType = "success" | "error" | "info";

export interface NotificationContextValue {
  showNotification: (message: string, type: NotificationType) => void;
}

// EN: Pure context object (no JSX here, so no Fast Refresh issues)
export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
