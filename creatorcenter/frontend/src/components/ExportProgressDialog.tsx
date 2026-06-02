import { useEffect, useState } from "react";
import { getExportDownloadUrl } from "../api/client";

interface Props {
  projectId: number;
  jobId: string;
  onClose: () => void;
}

export default function ExportProgressDialog({ projectId, jobId, onClose }: Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const source = new EventSource(`/api/projects/${projectId}/export/progress/${jobId}`);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          setStatus("failed");
          source.close();
          return;
        }

        setProgress(data.progress || 0);
        setStatus(data.status);

        if (data.status === "completed") {
          source.close();
          // Automatically trigger download
          window.location.href = getExportDownloadUrl(projectId, jobId);
          setTimeout(onClose, 1500); // Close dialog after a short delay
        } else if (data.status === "failed") {
          setError(data.error || "Export failed.");
          source.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    source.onerror = () => {
      setError("Lost connection to server.");
      setStatus("failed");
      source.close();
    };

    return () => {
      source.close();
    };
  }, [projectId, jobId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Exporting PDF...</h3>
        
        {status === "processing" && (
          <div className="space-y-4">
            <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-600">
              Generating PDF... {progress}%
            </p>
            <p className="text-center text-xs text-gray-400">
              Please wait, formatting CJK fonts may take up to a minute.
            </p>
          </div>
        )}

        {status === "completed" && (
          <div className="text-center text-green-600 space-y-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="font-medium">Export complete! Downloading...</p>
          </div>
        )}

        {status === "failed" && (
          <div className="text-center text-red-600 space-y-4">
            <p className="font-medium">Export Failed</p>
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
