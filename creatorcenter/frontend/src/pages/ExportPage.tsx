import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProject } from "../hooks/useProject";
import { exportPdf } from "../api/client";
import LanguageSelector from "../components/LanguageSelector";
import { Download, FileText } from "lucide-react";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { data: project } = useProject(projectId);

  const [lang, setLang] = useState(project?.target_lang || "");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  if (!project) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Loading...</div>;
  }

  const handleExport = async () => {
    if (!lang) return;
    setExporting(true);
    setError("");
    try {
      const blob = await exportPdf(projectId, lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = project.name.replace(/\.(docx|md)$/i, "");
      a.download = `${baseName}_${lang}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Export failed";
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <h1 className="text-xl font-bold">Export PDF — {project.name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Generate a translated PDF with formatting preserved.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Language</label>
          <LanguageSelector value={lang || project.target_lang || ""} onChange={setLang} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleExport}
          disabled={!lang || exporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          <Download className="w-5 h-5" />
          {exporting ? "Generating..." : "Download Translated PDF"}
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 space-y-1">
        <p><strong>What gets preserved:</strong></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Fonts, sizes, bold/italic/underline</li>
          <li>Paragraph alignment, indentation, spacing</li>
          <li>Images, tables, hyperlinks</li>
          <li>Headers, footers, page layout</li>
          <li>List numbering and styles</li>
        </ul>
      </div>
    </div>
  );
}
