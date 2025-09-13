// src/App.tsx

import React from "react";

// Import routing components
import { Routes, Route, Link } from "react-router-dom";

// Import our new pages
import Home from "./pages/Home";
import About from "./pages/About";

function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      {/* Navigation Menu */}
      <nav style={{ marginBottom: "1rem" }}>
        {/* Link components create client-side navigation */}
        <Link to="/" style={{ marginRight: "1rem" }}>
          Home
        </Link>
        <Link to="/about">About</Link>
      </nav>

      {/* Route Definitions */}
      <Routes>
        {/* Default page */}
        <Route path="/" element={<Home />} />
        {/* About page */}
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  );
}

export default App;
