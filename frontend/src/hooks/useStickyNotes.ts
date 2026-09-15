import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { StickyNote } from '../types/api';

export function useStickyNotes(noteId: string) {
  return useQuery({
    queryKey: QK.stickyNotes(noteId),
    queryFn:  () =>
      api.get<{ stickyNotes: StickyNote[] }>(`/api/notes/${noteId}/sticky-notes`)
         .then((r) => r.data.stickyNotes),
    enabled: !!noteId,
  });
}

export function useAddStickyNote(noteId: string) {
  return useMutation({
    mutationFn: (input: { topicId: string; content: string; color?: string; youtubeTimestamp?: number }) =>
      api.post<{ stickyNote: StickyNote }>(`/api/notes/${noteId}/sticky-notes`, input)
         .then((r) => r.data.stickyNote),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: QK.stickyNotes(noteId) });
      const previous = queryClient.getQueryData<StickyNote[]>(QK.stickyNotes(noteId));
      const optimistic: StickyNote = {
        _id:              `optimistic-${Date.now()}`,
        noteId,
        topicId:          input.topicId,
        content:          input.content,
        color:            (input.color ?? 'yellow') as StickyNote['color'],
        youtubeTimestamp: input.youtubeTimestamp ?? null,
        _optimistic:      true,
      };
      queryClient.setQueryData<StickyNote[]>(QK.stickyNotes(noteId), (old = []) => [...old, optimistic]);
      return { previous };
    },
    onError:   (_, __, ctx) => { queryClient.setQueryData(QK.stickyNotes(noteId), ctx?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: QK.stickyNotes(noteId) }); },
  });
}

export function useUpdateStickyNote() {
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<StickyNote> & { id: string }) =>
      api.patch<{ stickyNote: StickyNote }>(`/api/sticky-notes/${id}`, patch)
         .then((r) => r.data.stickyNote),
    // Optimistic update handled locally in the component; settled refetch syncs
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteStickyNote(noteId: string) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/sticky-notes/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QK.stickyNotes(noteId) });
      const previous = queryClient.getQueryData<StickyNote[]>(QK.stickyNotes(noteId));
      queryClient.setQueryData<StickyNote[]>(QK.stickyNotes(noteId), (old = []) => old.filter((s) => s._id !== id));
      return { previous };
    },
    onError:   (_, __, ctx) => { queryClient.setQueryData(QK.stickyNotes(noteId), ctx?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: QK.stickyNotes(noteId) }); },
  });
}
