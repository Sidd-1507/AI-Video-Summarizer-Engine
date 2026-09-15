import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';

export function useImageStatus(noteId: string, topicId: string) {
  return useQuery({
    queryKey: QK.imageStatus(noteId, topicId),
    queryFn:  () =>
      api.get<{ imageStatus: string; imageUrl?: string }>(`/api/notes/${noteId}/topics/${topicId}/image`)
         .then((r) => r.data),
    enabled:  !!noteId && !!topicId,
    refetchInterval: (query) =>
      query.state.data?.imageStatus === 'pending' ? 2000 : false,
  });
}

export function useGenerateImage(noteId: string, topicId: string) {
  return useMutation({
    mutationFn: () => api.post(`/api/notes/${noteId}/topics/${topicId}/image`),
    onSettled:  () => {
      queryClient.invalidateQueries({ queryKey: QK.imageStatus(noteId, topicId) });
      queryClient.invalidateQueries({ queryKey: QK.note(noteId) });
    },
  });
}
