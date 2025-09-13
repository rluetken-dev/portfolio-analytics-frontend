// src/App.tsx

import React from "react";

// Import routing components
import { Routes, Route, Link } from "react-router-dom";

// Import our new pages
import Home from "./pages/Home";
import About from "./pages/About";
import Health from "./pages/Health";

function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <nav style={{ marginBottom: "1rem" }}>
        <Link to="/" style={{ marginRight: "1rem" }}>
          Home
        </Link>
        <Link to="/about" style={{ marginRight: "1rem" }}>
          About
        </Link>
        <Link to="/health">Health</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        {/* New health check route */}
        <Route path="/health" element={<Health />} />
      </Routes>
    </div>
  );
}

export default App;
