import { Routes, Route } from "react-router-dom";

// Import pages
import Home from "./pages/Home";
import About from "./pages/About";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";
import Companies from "./pages/Companies";
import CompanyPage from "./pages/Company";
import AuthTest from "./components/AuthTest";

// Import components
import NavBar from "./components/NavBar";

// Import AuthProvider
import { AuthProvider } from "./context/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
        <NavBar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/health" element={<Health />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/company/:symbol" element={<CompanyPage />} />
          <Route path="/auth-test" element={<AuthTest />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
