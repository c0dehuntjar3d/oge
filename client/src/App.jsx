import { Navigate, Route, Routes } from 'react-router-dom';
import TopNav from './components/TopNav';
import HomePage from './pages/HomePage';
import PracticePage from './pages/PracticePage';
import VariantPage from './pages/VariantPage';

export default function App() {
  return (
    <div className="app-shell">
      <TopNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/variant" element={<VariantPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
