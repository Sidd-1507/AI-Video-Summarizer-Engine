import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { McqSet, QuizSubmitResult } from '../types/api';

export function useMcqs(noteId: string, topicId: string) {
  return useQuery({
    queryKey: QK.mcqs(noteId, topicId),
    queryFn:  () =>
      api.get<{ mcqSet: McqSet }>(`/api/notes/${noteId}/topics/${topicId}/mcqs`)
         .then((r) => r.data.mcqSet),
    enabled: !!noteId && !!topicId,
    retry:   false, // 404 = not generated yet, don't retry
  });
}

export function useGenerateMcqs(noteId: string, topicId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ mcqSet: McqSet }>(`/api/notes/${noteId}/topics/${topicId}/mcqs`, { count: 5 })
         .then((r) => r.data.mcqSet),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.mcqs(noteId, topicId) });
    },
  });
}

export function useSubmitMcqs(noteId: string, topicId: string) {
  return useMutation({
    mutationFn: (answers: Array<{ questionIndex: number; selected: string }>) =>
      api.post<QuizSubmitResult>(`/api/notes/${noteId}/topics/${topicId}/mcqs/submit`, { answers })
         .then((r) => r.data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.mcqs(noteId, topicId) });
    },
  });
}
