import { useQuery } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import type { Flashcard } from '../types/api';

export function useDueFlashcards() {
  return useQuery({
    queryKey: QK.dueCards(),
    queryFn:  () =>
      api.get<{ flashcards: Flashcard[]; count: number }>('/api/flashcards/due')
        .then((r) => r.data.flashcards),
  });
}
