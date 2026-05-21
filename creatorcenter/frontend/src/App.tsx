import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ReviewPage from "./pages/ReviewPage";
import ExportPage from "./pages/ExportPage";
import GlobalKeysPage from "./pages/GlobalKeysPage";
import MarkdownProject from "./pages/MarkdownProject";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects/:id/review" element={<ReviewPage />} />
            <Route path="/projects/:id/export" element={<ExportPage />} />
            <Route path="/keys" element={<GlobalKeysPage />} />
            <Route path="/projects/:id/md" element={<MarkdownProject />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
