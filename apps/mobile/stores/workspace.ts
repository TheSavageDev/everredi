import type { Workspace } from '@everredi/types';
import { create } from 'zustand';

interface State {
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;
}

export const useWorkspaceStore = create<State>((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}));
