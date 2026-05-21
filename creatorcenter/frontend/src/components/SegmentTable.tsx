import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onToggleIgnore: (segId: number, ignored: boolean) => void;
}

function fmtBadge(label: string) {
  return (
    <span className="inline-block bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded mr-1">
      {label}
    </span>
  );
}

export default function SegmentTable({ segments, page, pageSize, total, onPageChange, onToggleIgnore }: Props) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-2 py-2 font-medium text-gray-500 w-12">#</th>
              <th className="px-2 py-2 font-medium text-gray-500 w-10 text-center">Skip</th>
              <th className="px-3 py-2 font-medium text-gray-500">Source</th>
              <th className="px-3 py-2 font-medium text-gray-500">Translations</th>
              <th className="px-3 py-2 font-medium text-gray-500 w-32">Formatting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {segments.map((seg) => {
              const langs = Object.entries(seg.translated_langs || {});
              return (
                <tr
                  key={seg.id}
                  className={`hover:bg-gray-50 ${seg.ignored ? "opacity-40 line-through" : ""}`}
                >
                  <td className="px-2 py-2 text-gray-400">{seg.sequence}</td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={seg.ignored}
                      onChange={(e) => onToggleIgnore(seg.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      title="Ignore this segment during translation"
                    />
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={seg.source_text}>
                    {seg.source_text || <span className="text-gray-300 italic">whitespace</span>}
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {seg.formatting_json.bold && fmtBadge("B")}
                      {seg.formatting_json.italic && fmtBadge("I")}
                      {seg.formatting_json.underline && fmtBadge("U")}
                      {seg.formatting_json.font_size_pt && fmtBadge(seg.formatting_json.font_size_pt + "pt")}
                      {seg.formatting_json.contains_image && fmtBadge("img")}
                      {seg.formatting_json.is_hyperlink && fmtBadge("link")}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
