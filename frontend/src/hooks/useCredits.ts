import { useQuery } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import type { CreditTransaction } from '../types/api';

export function useCredits() {
  return useQuery({
    queryKey: QK.credits(),
    queryFn:  () => api.get<{ credits: number }>('/api/credits/balance').then((r) => r.data.credits),
    staleTime: 1000 * 60, // credits don't change often
  });
}

export function useCreditHistory() {
  return useQuery({
    queryKey: QK.history(),
    queryFn:  () =>
      api.get<{ transactions: CreditTransaction[]; total: number }>('/api/credits/history')
         .then((r) => r.data),
  });
}
