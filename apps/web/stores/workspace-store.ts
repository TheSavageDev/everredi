import type { Workspace } from '@everredi/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: null,
      setWorkspace: (workspace) => set({ workspace }),
    }),
    { name: 'everredi-workspace' },
  ),
);
