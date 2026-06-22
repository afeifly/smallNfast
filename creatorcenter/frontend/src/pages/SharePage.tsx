import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import { Home, Share2, FileText, ChevronLeft, Check, Copy } from "lucide-react";
import * as api from "../api/client";
import type { SharedProject } from "../api/client";
import * as React from "react";
import mermaid from "mermaid";

const MermaidCode = ({ code }: { code: string }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const renderChart = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });
        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to render mermaid diagram");
        }
      }
    };

    renderChart();
    return () => {
      active = false;
    };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 my-2 border border-red-200 bg-red-50 text-red-700 rounded text-xs">
        <div className="font-semibold mb-1">Mermaid Render Error:</div>
        <pre className="overflow-x-auto whitespace-pre-wrap">{code}</pre>
        <div className="mt-1 text-[10px] text-red-500">{error}</div>
      </div>
    );
  }

  if (!svg) {
    return <div className="p-4 text-xs text-gray-400">Rendering diagram...</div>;
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center my-4 overflow-x-auto bg-white p-4 border border-gray-100 rounded-lg shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

const getCodeText = (children: any): string => {
  if (children === null || children === undefined) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(getCodeText).join("");
  }
  if (typeof children === "object") {
    if (children.props && children.props.children !== undefined) {
      return getCodeText(children.props.children);
    }
    if (children.value !== undefined) {
      return String(children.value);
    }
  }
  return "";
};

const renderCode = ({ className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const isMermaid = match && match[1] === "mermaid";
  if (isMermaid) {
    const codeStr = getCodeText(children).replace(/\n$/, "");
    return <MermaidCode code={codeStr} />;
  }
  return <code className={className} {...props}>{children}</code>;
};

const codeComponent = {
  code: renderCode
};

interface SharedSegment {
  paragraph_index: number;
  container_type: string;
  table_row: number | null;
  table_col: number | null;
  text: string;
  formatting: Record<string, any>;
}

// DOCX renderer component that formats parsed segments back to standard HTML blocks
function DocxDocumentRenderer({ contentJson }: { contentJson: string }) {
  let segments: SharedSegment[] = [];
  try {
    segments = JSON.parse(contentJson);
  } catch (e) {
    return <div className="text-red-500">Failed to parse document segments.</div>;
  }

  // Group segments by container type and index
  // We want to group normal paragraphs by paragraph_index, and tables by row/col.
  // To keep order, let's group consecutive segments that belong to the same block/table.
  const blocks: React.ReactNode[] = [];
  let currentBlockType: string | null = null;
  let currentParaIdx: number | null = null;
  let currentRuns: SharedSegment[] = [];
  let currentTableRows: Record<number, Record<number, SharedSegment[]>> = {}; // row -> col -> runs

  const flushParagraph = (key: string) => {
    if (currentRuns.length === 0) return;
    
    // Check if it's a heading based on bold / font size
    const isHeading = currentRuns.some(r => r.formatting?.bold && (r.formatting?.font_size_pt && r.formatting.font_size_pt > 14));
    
    blocks.push(
      <p 
        key={key} 
        className={`${isHeading ? "text-xl font-bold text-slate-900 mt-6 mb-3" : "text-slate-800 leading-relaxed mb-4 text-justify"}`}
      >
        {currentRuns.map((run, idx) => {
          const style: React.CSSProperties = {};
          if (run.formatting?.bold) style.fontWeight = "bold";
          if (run.formatting?.italic) style.fontStyle = "italic";
          if (run.formatting?.underline) style.textDecoration = "underline";
          if (run.formatting?.color_rgb) {
            style.color = `#${run.formatting.color_rgb}`;
          }
          if (run.formatting?.font_size_pt) {
            style.fontSize = `${run.formatting.font_size_pt}pt`;
          }
          return (
            <span key={idx} style={style}>
              {run.text}
            </span>
          );
        })}
      </p>
    );
    currentRuns = [];
  };

  const flushTable = (key: string) => {
    if (Object.keys(currentTableRows).length === 0) return;
    const sortedRowIdxs = Object.keys(currentTableRows).map(Number).sort((a, b) => a - b);
    
    blocks.push(
      <div key={key} className="my-6 overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-sm text-left text-slate-700 divide-y divide-slate-200">
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedRowIdxs.map((rIdx) => {
              const row = currentTableRows[rIdx];
              const sortedColIdxs = Object.keys(row).map(Number).sort((a, b) => a - b);
              return (
                <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                  {sortedColIdxs.map((cIdx) => {
                    const cellRuns = row[cIdx];
                    return (
                      <td key={cIdx} className="px-4 py-3 border-r border-slate-100 last:border-0 align-top">
                        {cellRuns.map((run, idx) => {
                          const style: React.CSSProperties = {};
                          if (run.formatting?.bold) style.fontWeight = "bold";
                          if (run.formatting?.italic) style.fontStyle = "italic";
                          if (run.formatting?.underline) style.textDecoration = "underline";
                          return (
                            <span key={idx} style={style}>
                              {run.text}
                            </span>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    currentTableRows = {};
  };

  segments.forEach((seg, index) => {
    const key = `seg-${index}`;
    if (seg.container_type === "paragraph" || seg.container_type === "header" || seg.container_type === "footer") {
      if (currentBlockType === "table_cell") {
        flushTable(`table-${index}`);
      }
      
      if (currentParaIdx !== null && currentParaIdx !== seg.paragraph_index) {
        flushParagraph(`para-${currentParaIdx}`);
      }
      
      currentBlockType = "paragraph";
      currentParaIdx = seg.paragraph_index;
      currentRuns.push(seg);
    } else if (seg.container_type === "table_cell" || seg.container_type === "header_table_cell" || seg.container_type === "footer_table_cell") {
      if (currentBlockType === "paragraph") {
        flushParagraph(`para-${currentParaIdx}`);
      }
      
      currentBlockType = "table_cell";
      const r = seg.table_row ?? 0;
      const c = seg.table_col ?? 0;
      
      if (!currentTableRows[r]) {
        currentTableRows[r] = {};
      }
      if (!currentTableRows[r][c]) {
        currentTableRows[r][c] = [];
      }
      currentTableRows[r][c].push(seg);
    }
  });

  // Flush remaining
  if (currentBlockType === "paragraph") {
    flushParagraph("para-last");
  } else if (currentBlockType === "table_cell") {
    flushTable("table-last");
  }

  return <div className="space-y-1">{blocks}</div>;
}

export default function SharePage() {
  const { code } = useParams<{ code: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError("");
    api.getSharedProject(code)
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "This shared page does not exist or has been unpublished.");
        setLoading(false);
      });
  }, [code]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Document Unavailable</h2>
          <p className="text-sm text-slate-500">{error || "The requested link could not be loaded."}</p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Go to Home Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800">
      {/* Public restricted header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-800 font-bold hover:opacity-80 transition-opacity">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="tracking-wide">Creator Center</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-blue-500/10 transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main content reading view */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 md:p-10 space-y-6">
          {/* Metadata banner */}
          <div className="border-b border-slate-100 pb-5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {project.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-2 font-medium">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {project.target_lang}
              </span>
              <span>&middot;</span>
              <span>Translated from {project.source_lang}</span>
              <span>&middot;</span>
              <span className="capitalize">{project.content_type} document</span>
            </div>
          </div>

          {/* Rendered content */}
          <div className="prose prose-slate max-w-none pt-2">
            {project.content_type === "markdown" ? (
              <MDEditor.Markdown source={project.content} components={codeComponent} />
            ) : (
              <DocxDocumentRenderer contentJson={project.content} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        <p>Published with Creator Center &middot; Read-only share link</p>
      </footer>
    </div>
  );
}
