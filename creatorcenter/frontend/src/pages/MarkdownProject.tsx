import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import { useQueryClient } from "@tanstack/react-query";
import { useProject } from "../hooks/useProject";
import { useSegments, useToggleIgnore } from "../hooks/useSegments";
import {
  useTriggerTranslate,
  useTranslateStatus,
} from "../hooks/useTranslation";
import * as api from "../api/client";
import LanguageSelector from "../components/LanguageSelector";
import TranslationProgress from "../components/TranslationProgress";
import SegmentTable from "../components/SegmentTable";
import { Eye, PenLine, List, Download, ImageIcon, Scissors, ChevronDown, Check, X } from "lucide-react";
import * as React from "react";
import axios from "axios";

type Mode = "preview" | "edit" | "segments";

const PROVIDERS = [
  { id: "minimax", name: "MiniMax" },
  { id: "openl", name: "OpenL" },
];

export default function MarkdownProject() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const qc = useQueryClient();

  const { data: project, isLoading } = useProject(projectId);
  const triggerTranslate = useTriggerTranslate(projectId);
  const { data: status } = useTranslateStatus(projectId);

  const [mode, setMode] = useState<Mode>("preview");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [lang, setLang] = useState(project?.target_lang || "");
  const [provider, setProvider] = useState("minimax");
  const [msg, setMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Close export dropdown on outside click / escape
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExportOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [exportOpen]);

  // Segments state
  const [page, setPage] = useState(1);
  const { data: segData } = useSegments(projectId, page);
  const toggleIgnore = useToggleIgnore(projectId);

  useEffect(() => {
    if (project?.markdown_content) setContent(project.markdown_content);
    if (project?.target_lang) setLang(project.target_lang);
  }, [project]);

  // Auto-refresh segments when translate completes
  useEffect(() => {
    if (status?.status === "translated") {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    }
  }, [status?.status, projectId, qc]);

  // Auto-save on edit
  const doSave = useCallback(async (text: string) => {
    try {
      await api.updateMarkdownContent(projectId, text);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch { /* silent */ }
  }, [projectId, qc]);

  const handleEditorChange = useCallback((val?: string) => {
    const text = val || "";
    setContent(text);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(text), 2000);
  }, [doSave]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const width = prompt("Image width? (e.g. 400 or 50%)", "400");
      const form = new FormData(); form.append("file", file);
      try {
        const res = await axios.post("/api/images/upload", form);
        const sizeAttr = width && /^\d/.test(width) ? `width="${width}"` : `width="400"`;
        setContent((prev) => prev + `\n<img src="${res.data.url}" ${sizeAttr} alt="${file.name}" />\n`);
        setSaved(false);
      } catch { /* silent */ }
    };
    input.click();
  };

  const handleTranslate = () => {
    if (!lang) return;
    setMsg("");
    triggerTranslate.mutate(
      { targetLang: lang, provider },
      {
        onSuccess: (data: any) => {
          setMsg(data.total_count === 0
            ? `All already translated to ${lang}.`
            : `Translated ${data.translated_count} to ${lang}.`);
        },
        onError: (err: any) => setMsg(`Error: ${err?.response?.data?.detail || err.message}`),
      }
    );
  };

  const handleExport = async (exportLang: string) => {
    setExportOpen(false);
    try {
      const blob = await api.exportPdf(projectId, exportLang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "document"}_${exportLang}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export failed: " + (err?.response?.data?.detail || err.message));
    }
  };

  if (isLoading || !project) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-gray-400">Loading...</div>;
  }

  const pendingCount = status ? status.total_count - status.translated_count : 0;
  const modes: { key: Mode; icon: React.ReactNode; label: string }[] = [
    { key: "preview", icon: <Eye className="w-4 h-4" />, label: "Preview" },
    { key: "edit", icon: <PenLine className="w-4 h-4" />, label: "Edit" },
    { key: "segments", icon: <List className="w-4 h-4" />, label: "Segments" },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar — fixed, content centered */}
      <div className="border-b border-gray-200 bg-white shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap px-4 py-3">
        {editingName ? (
          <form onSubmit={async (e) => { e.preventDefault();
            if (nameInput.trim()) {
              await api.updateProject(projectId, { name: nameInput.trim() });
              qc.invalidateQueries({ queryKey: ["project", projectId] });
            }
            setEditingName(false);
          }} className="flex items-center gap-1">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              className="text-lg font-bold border-b-2 border-blue-400 bg-transparent outline-none w-64 px-1" autoFocus />
            <button type="submit" className="p-0.5 text-green-600"><Check className="w-4 h-4" /></button>
            <button type="button" onClick={() => setEditingName(false)} className="p-0.5 text-gray-400"><X className="w-4 h-4" /></button>
          </form>
        ) : (
          <h1 className="text-lg font-bold truncate max-w-xs cursor-pointer hover:text-blue-600"
            onClick={() => { setNameInput(project.name); setEditingName(true); }}
            title="Click to rename">
            {project.name}
          </h1>
        )}

        {/* Mode tabs */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === m.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Edit-only toolbar */}
        {mode === "edit" && (
          <>
            <span className={`text-xs ${saved ? "text-green-600" : "text-amber-600"}`}>
              {saved ? "Saved" : "Unsaved"}
            </span>
            <button onClick={handleImageUpload} className="p-1.5 border rounded hover:bg-gray-50" title="Upload image">
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setContent((p) => p + "\n---newpage---\n")} className="p-1.5 border rounded hover:bg-gray-50" title="Page break">
              <Scissors className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {mode === "segments" && (
          <>
            <LanguageSelector value={lang || project.target_lang || ""} onChange={setLang} />
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleTranslate}
              disabled={!lang || triggerTranslate.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {triggerTranslate.isPending ? "..." : `Translate${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
            </button>
          </>
        )}

        {/* Export dropdown — not on edit tab */}
        {mode !== "edit" && (
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
            <ChevronDown className="w-3 h-3" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
              <div className="px-3 py-1 text-xs text-gray-400">Download PDF</div>
              <button
                onClick={() => handleExport(project.source_lang)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between"
              >
                {project.source_lang}
                <span className="text-xs text-gray-400">original</span>
              </button>
              {project.available_languages.map((l: string) => (
                <button
                  key={l}
                  onClick={() => handleExport(l)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {l}
                  <span className="text-xs text-green-600">translated</span>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        </div>
      </div>

      {/* Messages + progress (above scroll area) */}
      {msg && (
        <div className={`text-xs px-4 py-1.5 shrink-0 ${msg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
          {msg}
        </div>
      )}
      {mode === "segments" && status && status.total_count > 0 && (
        <div className="px-4 pt-2 shrink-0">
          <TranslationProgress translatedCount={status.translated_count} totalCount={status.total_count} status={status.status} />
        </div>
      )}

      {/* Content area */}
      {mode === "preview" && (
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="max-w-4xl mx-auto border border-gray-200 rounded-lg bg-white p-6">
            <MDEditor.Markdown source={project.markdown_content || "*No content yet*"} />
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="flex-1 overflow-hidden">
          <MDEditor value={content} onChange={handleEditorChange} height="100%" visibleDragbar={false} />
        </div>
      )}

      {mode === "segments" && (
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="max-w-5xl mx-auto">
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
        </div>
      )}
    </div>
  );
}
