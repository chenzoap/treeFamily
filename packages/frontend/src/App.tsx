import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CreateProfilePage from "./pages/CreateProfilePage";
import TreeViewPage from "./pages/TreeViewPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/create-profile" element={<CreateProfilePage />} />
          <Route path="/create-me" element={<Navigate to="/create-profile" replace />} />
          <Route path="/tree" element={<TreeViewPage />} />
          <Route path="/" element={<Navigate to="/tree" replace />} />
          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
