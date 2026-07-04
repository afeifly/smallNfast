import React, { useState } from 'react';
import Layout from './components/Layout.jsx';
import BoardView from './components/BoardView.jsx';
import GanttChart from './components/GanttChart.jsx';
import DetailDrawer from './components/DetailDrawer.jsx';
import CreateProjectModal from './components/CreateProjectModal.jsx';
import Login from './components/Login.jsx';
import { useProjects } from './context/ProjectContext.jsx';
import './App.css';

export default function App() {
  const [view, setView] = useState('board');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { selectedProject, currentUser, isSharedView } = useProjects();

  if (!currentUser && !isSharedView) {
    return <Login />;
  }

  return (
    <Layout view={view} onToggleView={setView} onAddProject={() => setIsCreateOpen(true)}>
      <div className="app-view-content">
        {view === 'board' ? <BoardView /> : <GanttChart />}
      </div>
      {selectedProject && <DetailDrawer />}
      <CreateProjectModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </Layout>
  );
}
