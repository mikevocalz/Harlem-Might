import { create } from 'zustand';

export type EditorialImageStatus = 'loaded' | 'error';

interface EditorialImageState {
  statuses: Record<string, EditorialImageStatus>;
  setStatus: (screenId: string, imageId: string | number, status: EditorialImageStatus) => void;
}

export const editorialImageStateKey = (screenId: string, imageId: string | number) => `${screenId}:${imageId}`;

export const createEditorialImageStore = () =>
  create<EditorialImageState>()((set) => ({
    statuses: {},
    setStatus: (screenId, imageId, status) =>
      set((state) => ({
        statuses: { ...state.statuses, [editorialImageStateKey(screenId, imageId)]: status },
      })),
  }));

export const useEditorialImageStore = createEditorialImageStore();
