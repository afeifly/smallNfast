import { Link, Outlet, useLocation } from "react-router-dom";
import { FileText, FolderOpen, Key } from "lucide-react";

export default function Layout() {
  const location = useLocation();
  const isProjects = location.pathname === "/" || location.pathname.startsWith("/projects");
  const isKeys = location.pathname.startsWith("/keys");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80">
            <FileText className="w-5 h-5 text-blue-600" />
            Creator Center
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${isProjects ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <FolderOpen className="w-4 h-4" />
              Projects
            </Link>
            <Link
              to="/keys"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${isKeys ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
            >
              <Key className="w-4 h-4" />
              Translation Keys
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
