// packages/frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CreateMe from './pages/CreateMe';
import TreeViewPage from './pages/TreeViewPage'; // Cambiamos el nombre para diferenciar la página del componente

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/create-me" element={<CreateMe />} />
          
          {/* Esta será la base de operaciones del árbol */}
          <Route path="/tree" element={<TreeViewPage />} />

          <Route path="*" element={<Navigate to="/create-me" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;