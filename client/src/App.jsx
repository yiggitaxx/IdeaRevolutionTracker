import { Navigate, Route, Routes } from 'react-router-dom';
import IdeaListPage from './components/IdeaListPage';
import IdeaDetailPage from './components/IdeaDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IdeaListPage />} />
      <Route path="/ideas/:id" element={<IdeaDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
