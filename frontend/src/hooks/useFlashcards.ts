import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { calculateNextReview } from '../lib/sm2';
import type { Flashcard } from '../types/api';

export function useFlashcards(noteId: string) {
  return useQuery({
    queryKey: QK.flashcards(noteId),
    queryFn:  () =>
      api.get<{ flashcards: Flashcard[]; count: number }>(`/api/notes/${noteId}/flashcards`)
         .then((r) => r.data.flashcards),
    enabled: !!noteId,
  });
}

export function useGenerateFlashcards(noteId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ created: number; flashcards: Flashcard[] }>(`/api/notes/${noteId}/flashcards/generate`)
         .then((r) => r.data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.flashcards(noteId) });
    },
  });
}

export function useReviewFlashcard(noteId: string) {
  return useMutation({
    mutationFn: ({ cardId, quality }: { cardId: string; quality: number }) =>
      api.post<{ flashcard: Flashcard }>(`/api/flashcards/${cardId}/review`, { quality })
         .then((r) => r.data.flashcard),

    // Optimistic: apply SM-2 math immediately on the client
    onMutate: async ({ cardId, quality }) => {
      await queryClient.cancelQueries({ queryKey: QK.flashcards(noteId) });
      const previous = queryClient.getQueryData<Flashcard[]>(QK.flashcards(noteId));
      queryClient.setQueryData<Flashcard[]>(QK.flashcards(noteId), (old = []) =>
        old.map((card) =>
          card._id === cardId
            ? { ...card, ...calculateNextReview(card, quality), _optimistic: true }
            : card
        )
      );
      return { previous };
    },
    onError:   (_, __, ctx) => { queryClient.setQueryData(QK.flashcards(noteId), ctx?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: QK.flashcards(noteId) }); },
  });
}

export function useDeleteFlashcard(noteId: string) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/flashcards/${id}`),
    onSettled:  () => { queryClient.invalidateQueries({ queryKey: QK.flashcards(noteId) }); },
  });
}
