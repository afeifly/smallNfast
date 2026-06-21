import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { FileText, FolderOpen, Key, Lock, LogOut } from "lucide-react";
import * as api from "../api/client";

export default function Layout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const location = useLocation();
  const isProjects = location.pathname === "/" || location.pathname.startsWith("/projects");
  const isKeys = location.pathname.startsWith("/keys");

  useEffect(() => {
    api.checkAuthStatus()
      .then((res) => setIsAuthenticated(res.authenticated))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await api.login(password.trim());
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setIsAuthenticated(false);
      setPassword("");
      setError("");
    } catch {
      // silent
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-gray-400 font-medium">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
        <div className="relative backdrop-blur-md bg-white/10 border border-white/10 rounded-2xl shadow-2xl p-8 max-w-sm w-full transition-all duration-300 hover:border-white/20">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg border border-white/10">
            <Lock className="w-10 h-10 text-white" />
          </div>
          
          <div className="mt-8 flex flex-col items-center text-center space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-wide">Creator Center</h2>
            <p className="text-xs text-gray-400">Please enter password to unlock workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-center"
              autoFocus
            />
            {error && <p className="text-xs text-red-400 text-center font-medium animate-pulse">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 duration-200"
            >
              {submitting ? "Unlocking..." : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80">
            <FileText className="w-5 h-5 text-blue-600" />
            Creator Center
          </Link>
          <nav className="flex items-center gap-2">
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Logout from workspace"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
