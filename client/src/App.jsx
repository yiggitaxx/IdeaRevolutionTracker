import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import AuthPage from './components/AuthPage';
import IdeaListPage from './components/IdeaListPage';
import IdeaDetailPage from './components/IdeaDetailPage';

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = api.getToken();
      if (!token) {
        setBooting(false);
        return;
      }

      try {
        const me = await api.me();
        setUser(me);
      } catch {
        api.setToken('');
      } finally {
        setBooting(false);
      }
    }

    bootstrap();
  }, []);

  if (booting) {
    return <div className="loading-screen">Launching Idea Evolution Tracker...</div>;
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage onAuthSuccess={setUser} />} />
      <Route
        path="/"
        element={(
          <ProtectedRoute user={user}>
            <IdeaListPage user={user} onUserChange={setUser} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/ideas/:id"
        element={(
          <ProtectedRoute user={user}>
            <IdeaDetailPage user={user} onUserChange={setUser} />
          </ProtectedRoute>
        )}
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  );
}
