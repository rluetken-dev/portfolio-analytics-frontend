import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import { NotificationProvider } from "./context/NotificationProvider";
import { CurrencyProvider } from "./context/CurrencyContext";

// Wrap the app with CurrencyProvider and NotificationProvider for global access
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </CurrencyProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
