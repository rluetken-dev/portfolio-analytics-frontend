import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { CurrencyProvider } from "./context/CurrencyContext";
import { NotificationProvider } from "./context/NotificationProvider";
import "./index.css";

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