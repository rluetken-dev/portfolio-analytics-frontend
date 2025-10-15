// src/App.tsx
import { Routes, Route } from "react-router-dom";

// Import pages
import Home from "./pages/Home";
import About from "./pages/About";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";
import Companies from "./pages/Companies";
import CompanyPage from "./pages/Company";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Import components
import NavBar from "./components/NavBar";
// import CurrencyDebug from "./components/CurrencyDebug";

// Import AuthProvider
import { AuthProvider } from "./context/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/health" element={<Health />} />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <Companies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/:symbol"
            element={
              <ProtectedRoute>
                <CompanyPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} /> {/* ✅ NEU */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        {/* <CurrencyDebug /> */}
      </div>
    </AuthProvider>
  );
}

export default App;
