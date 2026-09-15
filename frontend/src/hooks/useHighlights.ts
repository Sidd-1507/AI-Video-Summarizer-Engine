import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { Highlight } from '../types/api';

export function useHighlights(noteId: string) {
  return useQuery({
    queryKey: QK.highlights(noteId),
    queryFn:  () =>
      api.get<{ highlights: Highlight[] }>(`/api/notes/${noteId}/highlights`)
         .then((r) => r.data.highlights),
    enabled: !!noteId,
  });
}

export function useAddHighlight(noteId: string) {
  return useMutation({
    mutationFn: (input: { topicId: string; text: string; startOffset: number; endOffset: number; color?: string }) =>
      api.post<{ highlight: Highlight }>(`/api/notes/${noteId}/highlights`, input)
         .then((r) => r.data.highlight),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: QK.highlights(noteId) });
      const previous = queryClient.getQueryData<Highlight[]>(QK.highlights(noteId));
      const optimistic: Highlight = {
        _id: `optimistic-${Date.now()}`,
        noteId,
        ...input,
        color:       (input.color ?? 'yellow') as Highlight['color'],
        _optimistic: true,
      };
      queryClient.setQueryData<Highlight[]>(QK.highlights(noteId), (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError:   (_, __, ctx) => { queryClient.setQueryData(QK.highlights(noteId), ctx?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: QK.highlights(noteId) }); },
  });
}

export function useDeleteHighlight(noteId: string) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/highlights/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QK.highlights(noteId) });
      const previous = queryClient.getQueryData<Highlight[]>(QK.highlights(noteId));
      queryClient.setQueryData<Highlight[]>(QK.highlights(noteId), (old = []) => old.filter((h) => h._id !== id));
      return { previous };
    },
    onError:   (_, __, ctx) => { queryClient.setQueryData(QK.highlights(noteId), ctx?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: QK.highlights(noteId) }); },
  });
}
