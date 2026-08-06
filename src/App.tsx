import { Route, Routes } from "react-router-dom";

import NavBar from "./components/NavBar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthProvider";
import About from "./pages/About";
import Companies from "./pages/Companies";
import CompanyPage from "./pages/Company";
import Health from "./pages/Health";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import "./styles/currencyFade.css";

export default function App() {
  return (
    <AuthProvider>
      <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <NavBar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/health" element={<Health />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}