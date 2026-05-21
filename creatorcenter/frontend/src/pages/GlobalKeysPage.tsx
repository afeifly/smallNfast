import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import { Trash2 } from "lucide-react";

export default function GlobalKeysPage() {
  const qc = useQueryClient();

  const { data: keys, isLoading } = useQuery({
    queryKey: ["allKeys"],
    queryFn: api.getAllKeys,
  });

  const deleteMutation = useMutation({
    mutationFn: (keyId: number) => api.deleteKey(keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allKeys"] });
      qc.invalidateQueries({ queryKey: ["segments"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleDelete = (keyId: number, source: string) => {
    if (confirm(`Delete this key?\n\n"${source}"\n\nIt will be removed from all projects.`)) {
      deleteMutation.mutate(keyId);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Translation Keys</h1>
          <p className="text-sm text-gray-500">
            Global — shared across all projects. Hover over a badge to see the translation.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : !keys || keys.length === 0 ? (
        <p className="text-gray-400 text-sm">No keys yet. Upload a document first.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">Source (EN)</th>
                <th className="px-4 py-2 font-medium text-gray-500">Translations</th>
                <th className="px-4 py-2 font-medium text-gray-500 w-16 text-center">Uses</th>
                <th className="px-4 py-2 font-medium text-gray-500 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((key) => {
                const langs = Object.entries(key.translations || {});
                return (
                  <tr key={key.key_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{key.source_text}</td>
                    <td className="px-4 py-2">
                      {langs.length === 0 ? (
                        <span className="text-gray-300 italic text-xs">not translated</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {langs.map(([lang, text]) => (
                            <span
                              key={lang}
                              title={text}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded cursor-default
                                bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-400">
                      {key.occurrence_count}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDelete(key.key_id, key.source_text)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete this key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
