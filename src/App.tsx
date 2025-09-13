// src/App.tsx

import React from "react";
import { Routes, Route } from "react-router-dom";

// Import pages
import Home from "./pages/Home";
import About from "./pages/About";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";
import Companies from "./pages/Companies";

// Import components
import NavBar from "./components/NavBar";

/**
 * Main App component.
 * Wraps navigation and route definitions.
 */
function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      {/* Top navigation (separate component) */}
      <NavBar />

      {/* Route definitions */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/health" element={<Health />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/companies" element={<Companies />} />
      </Routes>
    </div>
  );
}

export default App;
