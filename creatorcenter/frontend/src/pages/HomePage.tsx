import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadZone from "../components/UploadZone";
import { useProjectList, useDeleteProject } from "../hooks/useProject";
import * as api from "../api/client";
import { Trash2, ChevronRight, Plus, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-yellow-100 text-yellow-800",
  parsed: "bg-blue-100 text-blue-800",
  translating: "bg-purple-100 text-purple-800",
  translated: "bg-green-100 text-green-800",
  reviewed: "bg-teal-100 text-teal-800",
  exported: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
};

export default function HomePage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, refetch } = useProjectList();
  const deleteProj = useDeleteProject();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
        const text = await file.text();
        const proj = await api.createMarkdownProject(file.name.replace(/\.(md|markdown)$/i, ""), text);
        navigate(`/projects/${proj.id}/md`);
      } else {
        const proj = await api.uploadProject(file);
        navigate(`/projects/${proj.id}`);
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateMarkdown = async () => {
    try {
      const proj = await api.createMarkdownProject("Untitled", "");
      navigate(`/projects/${proj.id}/md`);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Create failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Translate your documents</h1>
        <p className="text-gray-500">Upload a DOCX or create a markdown document — translate to any language, export as PDF.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <UploadZone onUpload={handleUpload} loading={uploading} />
        <button
          onClick={handleCreateMarkdown}
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer transition-colors hover:border-purple-400 hover:bg-purple-50"
        >
          <Plus className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 font-medium">Create Markdown</p>
          <p className="text-gray-400 text-sm mt-1">Start a new editable document</p>
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : !projects || projects.length === 0 ? (
          <p className="text-gray-400 text-sm">No projects yet. Upload a file above.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(p.content_type === "markdown" ? `/projects/${p.id}/md` : `/projects/${p.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      p.content_type === "markdown" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>{p.content_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {p.segment_count} segments &middot; {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {p.target_lang && (
                    <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p.target_lang}</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this project?")) deleteProj.mutate(p.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
