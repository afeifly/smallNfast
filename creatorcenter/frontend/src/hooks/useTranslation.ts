import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export function useTranslationKeys(projectId: number, lang: string) {
  return useQuery({
    queryKey: ["keys", projectId, lang],
    queryFn: () => api.getTranslationKeys(projectId, lang),
    enabled: !!lang,
  });
}

export function useEditTranslationKey(projectId: number, lang: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, text }: { keyId: number; text: string }) =>
      api.editTranslationKey(projectId, keyId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["keys", projectId, lang] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["segments", projectId] });
    },
  });
}

export function useTriggerTranslate(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetLang, provider }: { targetLang: string; provider: string }) =>
      api.triggerTranslate(projectId, targetLang, provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useTranslateStatus(projectId: number) {
  return useQuery({
    queryKey: ["translateStatus", projectId],
    queryFn: () => api.getTranslateStatus(projectId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "translated" || data.status === "error")) {
        return false;
      }
      return 2000;
    },
  });
}
