interface Props {
  translatedCount: number;
  totalCount: number;
  status: string;
}

export default function TranslationProgress({ translatedCount, totalCount, status }: Props) {
  const pct = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-600">
        <span>
          {status === "translating" ? "Translating..." : status === "translated" ? "Complete" : status}
        </span>
        <span>
          {translatedCount} / {totalCount}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === "error" ? "bg-red-500" : status === "translated" ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
