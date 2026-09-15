import { create } from 'zustand';

interface AudioStore {
  url:      string | null;
  title:    string;
  playing:  boolean;
  setTrack: (url: string, title: string) => void;
  toggle:   () => void;
  clear:    () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  url:      null,
  title:    '',
  playing:  false,
  setTrack: (url, title) => set({ url, title, playing: true }),
  toggle:   () => set((s) => ({ playing: !s.playing })),
  clear:    () => set({ url: null, title: '', playing: false }),
}));
