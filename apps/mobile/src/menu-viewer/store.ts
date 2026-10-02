import { create } from 'zustand';
import {
  payloadApiBase,
  type MenuRecord,
  type PlaceWithMenus,
} from './types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface MenuViewerState {
  status: LoadState;
  place: PlaceWithMenus | null;
  menu: MenuRecord | null;
  error: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  currentUrl: string | null;
  loadingWeb: boolean;
  securityMessage: string | null;
  pdfUri: string | null;
  pdfLoading: boolean;
  pdfError: string | null;
  pdfPage: number;
  pdfPageCount: number;

  load: (placeId: string, menuId: string) => Promise<void>;
  reset: () => void;
  setNavigation: (state: {
    canGoBack: boolean;
    canGoForward: boolean;
    url: string;
    loading: boolean;
  }) => void;
  setSecurityMessage: (message: string | null) => void;
  setPdfLoading: (loading: boolean) => void;
  setPdfUri: (uri: string | null) => void;
  setPdfError: (message: string | null) => void;
  setPdfPage: (page: number, pageCount: number) => void;
}

export const useMenuViewerStore = create<MenuViewerState>((set) => ({
  status: 'idle',
  place: null,
  menu: null,
  error: null,
  canGoBack: false,
  canGoForward: false,
  currentUrl: null,
  loadingWeb: false,
  securityMessage: null,
  pdfUri: null,
  pdfLoading: false,
  pdfError: null,
  pdfPage: 1,
  pdfPageCount: 0,

  load: async (placeId, menuId) => {
    set({
      status: 'loading',
      place: null,
      menu: null,
      error: null,
      securityMessage: null,
      pdfUri: null,
      pdfError: null,
      pdfPage: 1,
      pdfPageCount: 0,
    });

    try {
      const response = await fetch(
        `${payloadApiBase}/places/${encodeURIComponent(placeId)}?depth=2`,
      );
      if (!response.ok) {
        throw new Error(`Menu request failed with status ${response.status}`);
      }

      const place = (await response.json()) as PlaceWithMenus;
      const menu = place.menus?.find((item) => item.id === menuId && item.active !== false);

      if (!menu) {
        throw new Error('This menu is no longer available.');
      }

      set({
        status: 'ready',
        place,
        menu,
        currentUrl: menu.url ?? null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not load this menu.',
      });
    }
  },

  reset: () =>
    set({
      status: 'idle',
      place: null,
      menu: null,
      error: null,
      canGoBack: false,
      canGoForward: false,
      currentUrl: null,
      loadingWeb: false,
      securityMessage: null,
      pdfUri: null,
      pdfLoading: false,
      pdfError: null,
      pdfPage: 1,
      pdfPageCount: 0,
    }),

  setNavigation: ({ canGoBack, canGoForward, url, loading }) =>
    set({
      canGoBack,
      canGoForward,
      currentUrl: url,
      loadingWeb: loading,
    }),

  setSecurityMessage: (securityMessage) => set({ securityMessage }),
  setPdfLoading: (pdfLoading) => set({ pdfLoading }),
  setPdfUri: (pdfUri) => set({ pdfUri, pdfLoading: false }),
  setPdfError: (pdfError) => set({ pdfError, pdfLoading: false }),
  setPdfPage: (pdfPage, pdfPageCount) => set({ pdfPage, pdfPageCount }),
}));
