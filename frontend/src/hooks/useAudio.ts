import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { useAudioStore } from '../store/useAudioStore';

export function useAudioStatus(noteId: string) {
  const setTrack = useAudioStore((s) => s.setTrack);

  return useQuery({
    queryKey: QK.audioStatus(noteId),
    queryFn:  () =>
      api.get<{ audioStatus: string; audioOverview?: { deepDive?: string; brief?: string } }>(
        `/api/notes/${noteId}/audio`
      ).then((r) => r.data),
    enabled:  !!noteId,
    refetchInterval: (query) => {
      const status = query.state.data?.audioStatus;
      if (status === 'pending') return 2000;
      if (status === 'ready') {
        const url = query.state.data?.audioOverview?.deepDive || query.state.data?.audioOverview?.brief;
        if (url) setTrack(url, 'Audio Overview');
        return false;
      }
      return false;
    },
  });
}

export function useGenerateAudio(noteId: string) {
  return useMutation({
    mutationFn: (format: 'deepDive' | 'brief' | 'all') =>
      api.post(`/api/notes/${noteId}/audio`, { format }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QK.audioStatus(noteId) });
    },
  });
}
