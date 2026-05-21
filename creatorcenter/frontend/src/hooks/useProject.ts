import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export function useProject(id: number) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id),
  });
}

export function useProjectList() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { target_lang?: string }) => api.updateProject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
}
