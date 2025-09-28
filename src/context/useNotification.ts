import { useContext } from "react";
import { NotificationContext } from "./NotificationContext";

// EN: custom hook to easily use notifications anywhere in the app
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used inside NotificationProvider");
  }
  return ctx;
}
