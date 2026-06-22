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
import { Copy, Check, ExternalLink } from "lucide-react";
import * as api from "../api/client";

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
  const [publishing, setPublishing] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const handlePublishToggle = async () => {
    if (!project) return;
    setPublishing(true);
    try {
      if (project.is_published) {
        await api.unpublishProject(projectId);
      } else {
        await api.publishProject(projectId);
      }
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (err: any) {
      alert("Action failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!project || !project.share_code) return;
    const link = `${window.location.origin}/share/${project.share_code}`;
    navigator.clipboard.writeText(link);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

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

      {/* Publishing Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${project.is_published ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
            <h3 className="text-sm font-semibold text-slate-800">
              {project.is_published ? "Project is Publicly Published" : "Project is Private"}
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {project.is_published 
              ? "Anyone with the share link can read the translated document." 
              : "Only logged-in workspace members can view or edit this project."}
          </p>
          {project.is_published && project.share_code && (
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="font-mono bg-white border border-slate-200 px-2.5 py-1 rounded text-slate-600 select-all font-medium">
                {`${window.location.origin}/share/${project.share_code}`}
              </span>
              <button
                onClick={handleCopyShareLink}
                className="p-1 hover:bg-slate-200 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Copy share link"
              >
                {copiedShare ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={`/share/${project.share_code}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 hover:bg-slate-200 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Open public page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
        <button
          onClick={handlePublishToggle}
          disabled={publishing}
          className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer ${
            project.is_published
              ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {publishing ? "Processing..." : project.is_published ? "Unpublish Project" : "Publish Project"}
        </button>
      </div>

      {resultMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg ${resultMsg.startsWith("Error")
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
