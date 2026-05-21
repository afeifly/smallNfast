import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProject, useUpdateProject } from "../hooks/useProject";
import { useSegments, useToggleIgnore } from "../hooks/useSegments";
import {
  useTriggerTranslate,
  useTranslateStatus,
} from "../hooks/useTranslation";
import LanguageSelector from "../components/LanguageSelector";
import TranslationProgress from "../components/TranslationProgress";
import SegmentTable from "../components/SegmentTable";

const PROVIDERS = [
  { id: "minimax", name: "MiniMax (M2.5)" },
  { id: "openl", name: "OpenL (RapidAPI)" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const triggerTranslate = useTriggerTranslate(projectId);
  const { data: status } = useTranslateStatus(projectId);

  const [page, setPage] = useState(1);
  const { data: segData } = useSegments(projectId, page);
  const toggleIgnore = useToggleIgnore(projectId);

  const [lang, setLang] = useState(project?.target_lang || "");
  const [provider, setProvider] = useState("minimax");
  const [resultMsg, setResultMsg] = useState("");

  // Auto-refresh segments and project when translation completes
  useEffect(() => {
    if (status?.status === "translated") {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    }
  }, [status?.status, projectId, qc]);

  if (isLoading || !project) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-gray-400">Loading...</div>;
  }

  const handleLangChange = (code: string) => {
    setLang(code);
    setResultMsg("");
    updateProject.mutate({ target_lang: code });
  };

  const handleTranslate = () => {
    if (!lang) return;
    setResultMsg("");
    triggerTranslate.mutate(
      { targetLang: lang, provider },
      {
        onSuccess: (data: any) => {
          if (data.total_count === 0) {
            setResultMsg(`All sources already translated to ${lang}. No new translations needed.`);
          } else {
            setResultMsg(`Translated ${data.translated_count} sources to ${lang}.`);
          }
        },
        onError: (err: any) => {
          setResultMsg(`Error: ${err?.response?.data?.detail || err.message}`);
        },
      }
    );
  };

  const pendingCount = status ? status.total_count - status.translated_count : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-gray-500">
            {project.segment_count} segments &middot; Source: {project.source_lang}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector value={lang || project.target_lang || ""} onChange={handleLangChange} />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleTranslate}
            disabled={!lang || triggerTranslate.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {triggerTranslate.isPending
              ? "Translating..."
              : pendingCount > 0
                ? `Translate (${pendingCount} left)`
                : "Translate"}
          </button>
          {project.content_type === "markdown" && (
            <button
              onClick={() => navigate(`/projects/${projectId}/md`)}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              Markdown Editor
            </button>
          )}
          <button
            onClick={() => navigate(`/projects/${projectId}/export`)}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            disabled={project.status !== "translated" && project.status !== "reviewed" && project.status !== "exported"}
          >
            Export PDF
          </button>
        </div>
      </div>

      {resultMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${
          resultMsg.startsWith("Error")
            ? "bg-red-50 text-red-700 border border-red-200"
            : resultMsg.includes("Already") || resultMsg.includes("already")
              ? "bg-gray-50 text-gray-600 border border-gray-200"
              : "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {resultMsg}
        </div>
      )}

      {status && status.total_count > 0 && (
        <TranslationProgress
          translatedCount={status.translated_count}
          totalCount={status.total_count}
          status={status.status}
        />
      )}

      {segData && (
        <SegmentTable
          segments={segData.items}
          page={segData.page}
          pageSize={segData.page_size}
          total={segData.total}
          onPageChange={setPage}
          onToggleIgnore={(segId, ignored) => toggleIgnore.mutate({ segId, ignored })}
        />
      )}
    </div>
  );
}
