'use client';

// Shared plumbing for the Explore workspace regions. The workspace split
// (ADR-024 update: map / master / sheet each suspend on their own promise)
// means the list, the map and the sheet are three components that all push
// and close selections — the URL helpers and focus plumbing live here so no
// region carries a second copy.

import { usePathname, useRouter, useSearchParams } from 'solito/navigation';
import { DEFAULT_SHEET_DETENT, useExplore } from '@acme/app/features/explore/explore.store.ts';
import { routes } from '@acme/ui/mights';
import { exploreHref } from './explore-url';

export const SHEET_TITLE_ID = 'explore-sheet-title';
export const SEARCH_FOCUS = 'search';

// Phones get one pane at a time below Material medium (me, 600px); the
// full-height sheet there is the only place the rest of the page goes inert.
export const PHONE = '(width < 37.5rem)';
// From lg the sheet docks beside the map as the inspector.
export const DOCKED = '(width >= 64rem)';

const EMPTY_SEARCH_PARAMS = new URLSearchParams();

/**
 * The sheet element, shared between regions: the map reads it as the bottom
 * occluder for fit-padding, the sheet region assigns it and runs the modal
 * inert walk from it. A plain ref object (not a hook) because the two
 * regions render under different Suspense boundaries.
 */
export const sheetElementRef: { current: HTMLElement | null } = { current: null };

export const focusSearch = () =>
  document.querySelector<HTMLElement>(`[data-explore-focus="${SEARCH_FOCUS}"]`)?.focus();

const isVisible = (el: Element) => el.getClientRects().length > 0 && !el.closest('[inert]');

export function focusFirst(ids: string[]) {
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-explore-focus="${CSS.escape(id)}"]`);
    if (el && isVisible(el)) {
      el.focus();
      return;
    }
  }
  focusSearch();
}

/**
 * URL read/write shared by every region. `select`/`close` read the pushed
 * flag from the store because any region can select and only the sheet
 * closes.
 */
export function useExploreActions() {
  const params = useSearchParams() ?? EMPTY_SEARCH_PARAMS;
  const router = useRouter();
  const pathname = usePathname() ?? routes.explore();

  const href = (patch: Record<string, string | null>) => exploreHref(pathname, params.toString(), patch);
  // Query-only state stays client-side: native history updates useSearchParams
  // without re-running the page's dynamic server reader on every selection.
  const replace = (patch: Record<string, string | null>) => window.history.replaceState(null, '', href(patch));
  const select = (id: string, opener: string) => {
    const { sheet, openSheet, setSelectionPushed, pushRecent } = useExplore.getState();
    openSheet(sheet.open ? sheet.detent : DEFAULT_SHEET_DETENT, opener);
    setSelectionPushed(true);
    pushRecent(id);
    window.history.pushState(null, '', href({ place: id }));
  };
  // Focus and the store follow the URL in the sheet region, so Close, Escape
  // and browser Back all take the same path.
  const close = () => {
    const { selectionPushed, setSelectionPushed } = useExplore.getState();
    if (selectionPushed) {
      setSelectionPushed(false);
      router.back();
    } else {
      replace({ place: null });
    }
  };
  const commitQuery = (text: string) => window.history.replaceState(null, '', href({ q: text || null }));

  return { params, href, replace, select, close, commitQuery };
}
