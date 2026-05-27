import axios from "axios";
import type {
  Project,
  ProjectDetail,
  PaginatedSegments,
  Segment,
  TranslationPair,
  TranslateStatus,
} from "../types";

const api = axios.create({ baseURL: "/api" });

// Projects
export async function uploadProject(file: File, sourceLang = "EN"): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  form.append("source_lang", sourceLang);
  const res = await api.post("/projects", form);
  return res.data;
}

export async function listProjects(): Promise<Project[]> {
  const res = await api.get("/projects");
  return res.data;
}

export async function getProject(id: number): Promise<ProjectDetail> {
  const res = await api.get(`/projects/${id}`);
  return res.data;
}

export async function updateProject(
  id: number,
  data: { name?: string; target_lang?: string; source_lang?: string }
): Promise<Project> {
  const res = await api.patch(`/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// Segments
export async function getSegments(
  projectId: number,
  page = 1,
  pageSize = 200
): Promise<PaginatedSegments> {
  const res = await api.get(`/projects/${projectId}/segments`, {
    params: { page, page_size: pageSize },
  });
  return res.data;
}

export async function getSegment(projectId: number, segmentId: number): Promise<Segment> {
  const res = await api.get(`/projects/${projectId}/segments/${segmentId}`);
  return res.data;
}

export async function editSegment(
  projectId: number,
  segmentId: number,
  translatedText: string
): Promise<Segment> {
  const res = await api.put(`/projects/${projectId}/segments/${segmentId}`, {
    translated_text: translatedText,
  });
  return res.data;
}

export async function toggleIgnoreSegment(
  projectId: number,
  segmentId: number,
  ignored: boolean
): Promise<Segment> {
  const res = await api.put(`/projects/${projectId}/segments/${segmentId}/ignore`, {
    ignored,
  });
  return res.data;
}

export interface GlobalKey {
  key_id: number;
  source_text: string;
  occurrence_count: number;
  translations: Record<string, string>;
}

export async function getAllKeys(): Promise<GlobalKey[]> {
  const res = await api.get("/keys");
  return res.data;
}

export async function deleteKey(keyId: number): Promise<void> {
  await api.delete(`/keys/${keyId}`);
}

// Project-specific translation keys
export async function getTranslationKeys(
  projectId: number,
  lang: string
): Promise<TranslationPair[]> {
  const res = await api.get(`/projects/${projectId}/keys`, { params: { lang } });
  return res.data;
}

export async function editTranslationKey(
  projectId: number,
  keyId: number,
  translatedText: string
): Promise<{ key_id: number; propagated_to_n_segments: number }> {
  const res = await api.put(`/projects/${projectId}/keys/${keyId}`, {
    translated_text: translatedText,
  });
  return res.data;
}

// Translation trigger
export async function triggerTranslate(
  projectId: number,
  targetLang: string,
  provider: string
): Promise<{ status: string; total_keys: number }> {
  const res = await api.post(`/projects/${projectId}/translate`, {
    target_lang: targetLang,
    provider,
  });
  return res.data;
}

export async function getTranslateStatus(projectId: number): Promise<TranslateStatus> {
  const res = await api.get(`/projects/${projectId}/translate/status`);
  return res.data;
}

// Markdown projects
export async function createMarkdownProject(name: string, content: string): Promise<Project> {
  const res = await api.post("/projects/markdown", {
    name,
    markdown_content: content,
  });
  return res.data;
}

export async function updateMarkdownContent(projectId: number, markdown_content: string): Promise<Project> {
  const res = await api.put(`/projects/${projectId}/content`, { markdown_content });
  return res.data;
}

// Export
export async function exportPdf(projectId: number, targetLang: string): Promise<Blob> {
  const res = await api.post(
    `/projects/${projectId}/export`,
    { target_lang: targetLang },
    { responseType: "blob" }
  );
  return res.data;
}
