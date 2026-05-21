import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export function useSegments(projectId: number, page: number) {
  return useQuery({
    queryKey: ["segments", projectId, page],
    queryFn: () => api.getSegments(projectId, page),
  });
}

export function useEditSegment(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ segId, text }: { segId: number; text: string }) =>
      api.editSegment(projectId, segId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
    },
  });
}

export function useToggleIgnore(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ segId, ignored }: { segId: number; ignored: boolean }) =>
      api.toggleIgnoreSegment(projectId, segId, ignored),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
