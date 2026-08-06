import { createContext } from "react";

export type NotificationType = "success" | "error" | "info";

export interface NotificationContextValue {
  showNotification: (message: string, type: NotificationType) => void;
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);