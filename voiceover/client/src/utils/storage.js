const STORAGE_KEY = 'suto_voiceover_projects';

export function getProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load projects from localStorage:', e);
    return [];
  }
}

export function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage:', e);
  }
}

export function createNewProject(name) {
  const projects = getProjects();
  const newProj = {
    id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: name.trim() || 'Untitled Video Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    videoName: '',
    duration: 0,
    tracks: [
      {
        id: 'track_' + Date.now(),
        time: 0,
        text: 'Welcome to SUTO iTEC compressed air solutions.',
        voiceId: 'male-qn-qingse'
      }
    ]
  };
  projects.unshift(newProj);
  saveProjects(projects);
  return newProj;
}

export function updateProject(updatedProj) {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === updatedProj.id);
  if (index !== -1) {
    // We store metadata only (excluding actual binary ArrayBuffers which live in runtime memory)
    const cleanedTracks = (updatedProj.tracks || []).map(t => ({
      id: t.id,
      time: t.time,
      text: t.text,
      voiceId: t.voiceId
    }));

    projects[index] = {
      ...updatedProj,
      tracks: cleanedTracks,
      updatedAt: new Date().toISOString()
    };
    saveProjects(projects);
  }
}

export function deleteProject(id) {
  const projects = getProjects();
  const filtered = projects.filter(p => p.id !== id);
  saveProjects(filtered);
  return filtered;
}
