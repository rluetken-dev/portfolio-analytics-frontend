// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";

// Import BrowserRouter for routing
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";

// Entry point for the React app
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Wrap the whole app with BrowserRouter to enable routing */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
