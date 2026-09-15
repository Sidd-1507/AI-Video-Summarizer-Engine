import { useQuery, useMutation } from '@tanstack/react-query';
import { api, QK } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import type { GenerateTopicPayload, GenerateYoutubePayload, Job, Note } from '../types/api';

const IN_FLIGHT: NoteStatusLike[] = ['pending', 'generating'];
type NoteStatusLike = Note['status'];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReadyNote(noteId: string, jobId?: string): Promise<Note> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (jobId && jobId !== 'guest') {
      const { data } = await api.get<{ job: Job }>(`/api/jobs/${jobId}`);
      if (data.job.status === 'failed') {
        throw new Error(data.job.error || 'Generation failed');
      }
    }
    const { data } = await api.get<{ note: Note }>(`/api/notes/${noteId}`);
    if (data.note.status === 'ready') return data.note;
    if (data.note.status === 'failed') throw new Error('Generation failed');
    await sleep(1500);
  }
  throw new Error('Generation timed out');
}

async function startAndWait(path: string, payload: object): Promise<Note> {
  const { data } = await api.post<{ note: Note; jobId?: string }>(path, payload);
  if (data.note.status === 'ready') return data.note;
  return waitForReadyNote(data.note._id, data.jobId);
}

export function useNotes() {
  return useQuery({
    queryKey: QK.notes(),
    queryFn:  () => api.get<{ notes: Note[] }>('/api/notes').then((r) => r.data.notes),
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: QK.note(id),
    queryFn:  () => api.get<{ note: Note }>(`/api/notes/${id}`).then((r) => r.data.note),
    enabled:  !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && IN_FLIGHT.includes(status) ? 2000 : false;
    },
  });
}

export function useGenerateNote() {
  return useMutation({
    mutationFn: (payload: GenerateYoutubePayload) => startAndWait('/api/youtube-notes', payload),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: QK.notes() });
      queryClient.setQueryData(QK.note(note._id), note);
    },
  });
}

export function useGenerateTopicNote() {
  return useMutation({
    mutationFn: (payload: GenerateTopicPayload) => startAndWait('/api/topic-notes', payload),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: QK.notes() });
      queryClient.setQueryData(QK.note(note._id), note);
    },
  });
}
