import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  loading: boolean;
}

export default function UploadZone({ onUpload, loading }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onUpload(accepted[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/markdown": [".md", ".markdown"],
    },
    maxFiles: 1,
    disabled: loading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
        ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${loading ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input {...getInputProps()} />
      <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
      {loading ? (
        <p className="text-gray-500">Uploading and parsing...</p>
      ) : isDragActive ? (
        <p className="text-blue-600 font-medium">Drop your .docx file here</p>
      ) : (
        <>
          <p className="text-gray-600 font-medium">Drag & drop a .docx or .md file here</p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
        </>
      )}
    </div>
  );
}
