import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('projshow_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Sharing Mode detection from URL
  const [isSharedView, setIsSharedView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('share');
  });

  const [sharedUserId, setSharedUserId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });

  const [sharedSpaceName, setSharedSpaceName] = useState('');

  // Fetch all projects with their tasks and milestones
  const fetchProjects = useCallback(async () => {
    if (!currentUser && !isSharedView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let list;
      if (isSharedView && sharedUserId) {
        list = await api.getPublicProjects(sharedUserId);
        const spaceInfo = await api.getSpace(sharedUserId).catch(() => null);
        if (spaceInfo) {
          setSharedSpaceName(spaceInfo.space_name);
        }
      } else {
        list = await api.getProjects();
      }

      // Fetch tasks and milestones for each project
      const full = await Promise.all(
        list.map(async (p) => {
          const [tasks, milestones] = await Promise.all([
            isSharedView ? api.getPublicTasks(p.id) : api.getTasks(p.id),
            isSharedView ? api.getPublicMilestones(p.id) : api.getMilestones(p.id),
          ]);
          return { ...p, tasks, milestones };
        })
      );
      setProjects(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isSharedView, sharedUserId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auth Operations
  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('projshow_token', data.token);
    localStorage.setItem('projshow_user', JSON.stringify(data));
    setCurrentUser(data);
  };

  const logout = () => {
    localStorage.removeItem('projshow_token');
    localStorage.removeItem('projshow_user');
    setCurrentUser(null);
    setProjects([]);
  };

  // Admin: login as another user (impersonation)
  const loginAs = async (userId) => {
    const data = await api.impersonateUser(userId);
    localStorage.setItem('projshow_token', data.token);
    localStorage.setItem('projshow_user', JSON.stringify(data));
    setCurrentUser(data);
    setSelectedProject(null);
  };

  // Exit sharing mode to view own dashboard
  const exitSharedView = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, document.title, url.pathname);
    setIsSharedView(false);
    setSharedUserId(null);
    setSharedSpaceName('');
  };

  // Update a single project in state without full refetch
  const refreshProject = useCallback(async (id) => {
    if (isSharedView) return; // Cannot mutate in shared view
    const updated = await api.getProject(id);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (selectedProject?.id === id) setSelectedProject(updated);
    return updated;
  }, [selectedProject, isSharedView]);

  const updateProject = useCallback(async (id, data) => {
    if (isSharedView) return;
    await api.updateProject(id, data);
    return refreshProject(id);
  }, [refreshProject, isSharedView]);

  const deleteProject = useCallback(async (id) => {
    if (isSharedView) return;
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);
  }, [selectedProject, isSharedView]);

  const createProject = useCallback(async (data) => {
    if (isSharedView) return;
    const created = await api.createProject(data);
    setProjects((prev) => [...prev, created]);
    return created;
  }, [isSharedView]);

  // Tasks
  const createTask = useCallback(async (projectId, data) => {
    if (isSharedView) return;
    await api.createTask(projectId, data);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  const updateTask = useCallback(async (taskId, data, projectId) => {
    if (isSharedView) return;
    await api.updateTask(taskId, data);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  const deleteTask = useCallback(async (taskId, projectId) => {
    if (isSharedView) return;
    await api.deleteTask(taskId);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  // Milestones
  const createMilestone = useCallback(async (projectId, data) => {
    if (isSharedView) return;
    await api.createMilestone(projectId, data);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  const updateMilestone = useCallback(async (milestoneId, data, projectId) => {
    if (isSharedView) return;
    await api.updateMilestone(milestoneId, data);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  const deleteMilestone = useCallback(async (milestoneId, projectId) => {
    if (isSharedView) return;
    await api.deleteMilestone(milestoneId);
    return refreshProject(projectId);
  }, [refreshProject, isSharedView]);

  // Reset
  const resetAll = useCallback(async () => {
    if (isSharedView) return;
    await api.resetAll();
    setSelectedProject(null);
    return fetchProjects();
  }, [fetchProjects, isSharedView]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProject,
        loading,
        error,
        fetchProjects,
        updateProject,
        deleteProject,
        createProject,
        createTask,
        updateTask,
        deleteTask,
        createMilestone,
        updateMilestone,
        deleteMilestone,
        resetAll,
        currentUser,
        isSharedView,
        sharedSpaceName,
        login,
        logout,
        loginAs,
        exitSharedView,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
