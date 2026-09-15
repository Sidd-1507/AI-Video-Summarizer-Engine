import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GuestStore {
  isGuest:      boolean;
  setGuest:     (val: boolean) => void;
  streakCount:  number;
  lastReviewed: string | null;
  incrementStreak: () => void;
  resetStreak:     () => void;
  signInPrompt: boolean;
  openSignInPrompt: () => void;
  closeSignInPrompt: () => void;
}

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      isGuest:      false,
      setGuest:     (val) => set({ isGuest: val, signInPrompt: false }),
      streakCount:  0,
      lastReviewed: null,
      incrementStreak: () => {
        const today = new Date().toDateString();
        const { lastReviewed, streakCount } = get();
        if (lastReviewed === today) return;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const wasYesterday = lastReviewed === yesterday.toDateString();
        set({
          streakCount:  wasYesterday ? streakCount + 1 : 1,
          lastReviewed: today,
        });
      },
      resetStreak: () => set({ streakCount: 0, lastReviewed: null }),
      signInPrompt: false,
      openSignInPrompt: () => set({ signInPrompt: true }),
      closeSignInPrompt: () => set({ signInPrompt: false }),
    }),
    {
      name: 'notewise-streak',
      partialize: (s) => ({
        isGuest: s.isGuest,
        streakCount: s.streakCount,
        lastReviewed: s.lastReviewed,
      }),
    }
  )
);
