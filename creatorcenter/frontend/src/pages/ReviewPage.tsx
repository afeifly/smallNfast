import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProject } from "../hooks/useProject";
import { useTranslationKeys, useEditTranslationKey } from "../hooks/useTranslation";
import LanguageSelector from "../components/LanguageSelector";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();

  const { data: project } = useProject(projectId);
  const [lang, setLang] = useState(project?.target_lang || "");
  const { data: pairs, isLoading } = useTranslationKeys(projectId, lang);
  const editKey = useEditTranslationKey(projectId, lang);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  if (!project) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-gray-400">Loading...</div>;
  }

  const handleEdit = (keyId: number, currentText: string) => {
    setEditingId(keyId);
    setEditValue(currentText);
  };

  const handleSave = (keyId: number) => {
    if (editValue.trim()) {
      editKey.mutate({ keyId, text: editValue.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Review Translations — {project.name}</h1>
          <p className="text-sm text-gray-500">
            Edit translations here — changes propagate to all matching segments automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector value={lang || project.target_lang || ""} onChange={setLang} disabled={editKey.isPending} />
          <button
            onClick={() => navigate(`/projects/${projectId}/export`)}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            Export
          </button>
        </div>
      </div>

      {!lang ? (
        <p className="text-gray-400">Select a target language above.</p>
      ) : isLoading ? (
        <p className="text-gray-400">Loading translations...</p>
      ) : !pairs || pairs.length === 0 ? (
        <p className="text-gray-400">No translations yet. Run translation from the project page.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500 w-5/12">Source (EN)</th>
                <th className="px-4 py-2 font-medium text-gray-500 w-5/12">Translation ({lang})</th>
                <th className="px-4 py-2 font-medium text-gray-500 w-1/12 text-center">Uses</th>
                <th className="px-4 py-2 font-medium text-gray-500 w-1/12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pairs.map((pair) => (
                <tr key={pair.key_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 align-top">{pair.source_text}</td>
                  <td className="px-4 py-2 align-top">
                    {editingId === pair.key_id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(pair.key_id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className={pair.translated_text ? "" : "text-gray-300 italic"}>
                        {pair.translated_text || "not translated"}
                      </span>
                    )}
                    {pair.is_edited && (
                      <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1 rounded">edited</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-400 align-top">
                    {pair.occurrence_count}
                  </td>
                  <td className="px-4 py-2 align-top">
                    {editingId === pair.key_id ? (
                      <button
                        onClick={() => handleSave(pair.key_id)}
                        className="text-blue-600 text-xs hover:underline"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(pair.key_id, pair.translated_text || "")}
                        className="text-gray-400 hover:text-blue-600 text-xs"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
