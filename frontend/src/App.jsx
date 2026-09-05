import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import StudyPage from './pages/StudyPage';
import CardsPage from './pages/CardsPage';
import ResourcesPage from './pages/ResourcesPage';
import KnowledgeFieldsPage from './pages/KnowledgeFieldsPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<StudyPage />} />
        <Route path="cards" element={<CardsPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="fields" element={<KnowledgeFieldsPage />} />
      </Route>
    </Routes>
  );
}
