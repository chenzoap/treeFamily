import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Person, type Relationship } from '../types/family';

interface TreeState {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  treeId: string | null;
  loading: boolean;
  setPersons: (persons: Person[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  setRootPersonId: (id: string | null) => void;
  setTreeId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  // Acción combinada para facilitar la creación inicial
  setTreeData: (treeId: string, rootPersonId: string) => void;
}

export const useTreeStore = create<TreeState>()(
  persist(
    (set) => ({
      persons: [],
      relationships: [],
      rootPersonId: null,
      treeId: null,
      loading: false,

      setPersons: (persons) => set({ persons }),
      setRelationships: (relationships) => set({ relationships }),
      setRootPersonId: (id) => set({ rootPersonId: id }),
      setTreeId: (id) => set({ treeId: id }),
      setLoading: (loading) => set({ loading }),
      setTreeData: (treeId, rootPersonId) => set({ treeId, rootPersonId }),
    }),
    {
      name: 'family-tree-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);