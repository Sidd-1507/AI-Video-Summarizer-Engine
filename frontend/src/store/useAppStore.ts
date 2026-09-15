import { create } from 'zustand';

interface AppStore {
  activeTopicId:    string | null;
  sidebarCollapsed: boolean;
  setActiveTopic:   (id: string | null) => void;
  toggleSidebar:    () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTopicId:    null,
  sidebarCollapsed: false,
  setActiveTopic:   (id) => set({ activeTopicId: id }),
  toggleSidebar:    () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
