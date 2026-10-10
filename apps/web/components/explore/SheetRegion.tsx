'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_SHEET_DETENT,
  useExplore,
  type ExplorePlace,
  type SheetDetent,
} from '@acme/app/features/explore/explore.store.ts';
import { DirectionsPanel } from '@acme/app/features/navigation/ui/DirectionsPanel.tsx';
import { useDirectionsPlaceId, useIsGuiding } from '@acme/app/features/navigation/ui/hooks.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { openDirections } from '@acme/app/features/navigation/view/runtime.ts';
import { ScrollView, View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsButton,
  MightsHeading,
  MightsLocationStamp,
  MightsMapImage,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { focusId, focusReturnOrder, isFocusFor, parseExploreParams } from './explore-url';
import {
  DOCKED,
  PHONE,
  SEARCH_FOCUS,
  SHEET_TITLE_ID,
  focusFirst,
  sheetElementRef,
  useExploreActions,
} from './explore-actions';
import { useMediaQuery } from './use-media-query';

// Detents in raise order; the sheet steps through them with Less / More.
const DETENTS: readonly SheetDetent[] = ['peek', 'half', 'full'];

/**
 * The place sheet / docked inspector. Renders only when the URL selects a
 * place. Owns the URL→store sheet sync, focus return, Escape and the modal
 * inert walk.
 */
export function SheetRegion({ catalogue }: { catalogue: readonly ExplorePlace[] }) {
  const { params, replace, close } = useExploreActions();
  const placeId = params.get('place');
  const places = placeId ? catalogue : null;
  const selected = places?.find((p) => p.id === placeId) ?? null;

  const detent = useExplore((s) => s.sheet.detent);
  const setSheetDetent = useExplore((s) => s.setSheetDetent);
  const phone = useMediaQuery(PHONE);
  const docked = useMediaQuery(DOCKED);
  const directionsPlaceId = useDirectionsPlaceId();
  const guiding = useIsGuiding();
  const stepsOpen = useNavigationUi((s) => s.stepsOpen);
  const view = parseExploreParams(params, [], 'All').view;

  const mapped = useMemo(
    () => (places ?? []).flatMap((p) => (p.lngLat ? [{ id: p.id, name: p.name, lngLat: p.lngLat }] : [])),
    [places],
  );

  // URL → sheet slice and focus. Opening (click, reload, shared link) moves
  // focus to the sheet heading; closing returns it to whatever opened it.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const was = shownId.current;
    shownId.current = selected?.id ?? null;
    if (selected) {
      // A deep link or reload counts as a view even when nothing clicked.
      useExplore.getState().pushRecent(selected.id);
      const sheetNow = useExplore.getState().sheet;
      if (!sheetNow.open) useExplore.getState().openSheet(DEFAULT_SHEET_DETENT, null);
      // Back/Forward between two pushed selections changes the place without a
      // click, so the stored opener still names the previous place's control.
      else if (sheetNow.returnFocusId && !isFocusFor(sheetNow.returnFocusId, selected.id))
        useExplore.getState().openSheet(sheetNow.detent, focusId.row(selected.id));
      // Same place again: an Activity reveal after browser Back. Keep focus
      // where it was (usually the link that left) unless it fell to <body>.
      if (was === selected.id && document.activeElement && document.activeElement !== document.body) return;
      const heading = document.getElementById(SHEET_TITLE_ID);
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    } else if (was) {
      // Browser Back can drop the place too; the pushed entry is gone either
      // way, so a later Close must not step back off the page.
      useExplore.getState().setSelectionPushed(false);
      useExplore.getState().closeSheet();
      focusFirst(focusReturnOrder(useExplore.getState().sheet.returnFocusId, was));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      // Escape in the search field keeps its native clear-the-field behaviour.
      if (e.target instanceof Element && e.target.closest(`[data-explore-focus="${SEARCH_FOCUS}"]`)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // close reads the store and the current URL; selection is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Only the phone's full-height sheet is modal: everything outside it goes
  // inert so Tab can't reach the hidden map. Docked or partial, the map and
  // list stay usable beside it.
  const modal = !!selected && phone && detent === 'full';
  useEffect(() => {
    const sheet = sheetElementRef.current;
    if (!modal || !sheet) return;
    const touched: Element[] = [];
    for (let node: Element = sheet; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          touched.push(sibling);
        }
      }
    }
    return () => touched.forEach((el) => el.removeAttribute('inert'));
  }, [modal]);

  // Guidance below lg: the map and HUD own the screen; Steps brings the sheet back.
  if (!selected || (guiding && !docked && !stepsOpen)) return null;

  const step = (dir: 1 | -1) => DETENTS[DETENTS.indexOf(detent) + dir];
  const lower = step(-1);
  const higher = step(1);

  // Below lg the sheet overlays the stage (whole width on phones, the map
  // column from md) at a detent; from lg it docks as the inspector column so
  // row, marker and detail sit side by side and nothing covers the map.
  const sheetPosition = {
    peek: '',
    half: 'max-h-1/2',
    full: 'top-0',
  }[detent];
  const showDirections = directionsPlaceId === selected.id;

  return (
    <View
      ref={sheetElementRef as never}
      role="dialog"
      aria-modal={modal}
      aria-labelledby={SHEET_TITLE_ID}
      className={`absolute inset-x-0 bottom-0 z-(--z-raised) flex-col bg-primary pt-rail me:left-(--container-pane-primary-narrow) xp:left-(--container-pane-primary) lg:static lg:inset-auto lg:max-h-none lg:w-pane-inspector lg:shrink-0 lg:pl-rail lg:pt-0 ${sheetPosition}`}
    >
      {showDirections ? (
        <DirectionsPanel
          place={selected}
          originPlaces={mapped}
          frame="none"
          onDismiss={
            guiding
              ? docked
                ? undefined
                : () => useNavigationUi.getState().setStepsOpen(false)
              : () => document.getElementById(SHEET_TITLE_ID)?.focus()
          }
          onStarted={() => {
            useNavigationUi.getState().setStepsOpen(false);
            if (!docked) setSheetDetent('peek');
            // The HUD lives on the map; a phone showing the list switches to it.
            if (view === 'list') replace({ view: null });
          }}
        />
      ) : (
        <View className="min-h-0 flex-1 bg-surface-raised">
          <View className="gap-3 border-b border-rule-hairline p-4 me:p-5">
            <View className="flex-row items-start justify-between gap-4">
              <MightsHeading id={SHEET_TITLE_ID} level={2} size="title" className="min-w-0 flex-1 outline-none">
                {selected.name}
              </MightsHeading>
              <MightsButton size="sm" variant="ghost" onPress={close} aria-label={`Close ${selected.name}`}>
                Close
              </MightsButton>
            </View>
            {/* Detents are switched by buttons, not dragged, so there is no grabber. */}
            <View className="flex-row gap-2 lg:hidden">
              {lower ? (
                <MightsButton
                  size="sm"
                  variant="outline"
                  onPress={() => setSheetDetent(lower)}
                  aria-label={`Show less of ${selected.name}`}
                >
                  Less
                </MightsButton>
              ) : null}
              {higher ? (
                <MightsButton
                  size="sm"
                  variant="outline"
                  onPress={() => setSheetDetent(higher)}
                  aria-label={`Show more of ${selected.name}`}
                >
                  More
                </MightsButton>
              ) : null}
            </View>
          </View>
          <ScrollView
            className={`min-h-0 flex-1 ${detent === 'peek' ? 'hidden lg:flex' : ''}`}
            contentContainerClassName="gap-5 p-4 md:p-5"
          >
            {selected.lngLat ? (
              <View className="overflow-hidden border border-rule-hairline">
                <View className="aspect-video">
                  <MightsMapImage
                    center={selected.lngLat}
                    zoom={17.4}
                    pitch={45}
                    bearing={-14}
                    width={640}
                    height={360}
                    sizes="(min-width: 1024px) 24rem, 100vw"
                    pins={[{ lngLat: selected.lngLat }]}
                    alt={`Aerial map around ${selected.name}`}
                  />
                </View>
                <MapAttribution className="block border-t border-rule-hairline px-3 py-2" />
              </View>
            ) : null}
            <MightsLocationStamp name={selected.category} street={selected.street ?? selected.area} className="self-start" />
            {/* shortDescription, not whyItMatters: the fixture's whyItMatters is
                planning copy about the product, not a fact about the place.
                Imported rows often have no summary yet; the name, category and
                area above already carry the sheet. */}
            {selected.shortDescription ? <MightsText tone="default">{selected.shortDescription}</MightsText> : null}
            {selected.lngLat ? null : <MightsText size="small">Location pending verification.</MightsText>}
            {/* No Save until saved places are wired to the member session, and
                no AR button on web because there is no AR runtime here. */}
            <View className="flex-row flex-wrap gap-3">
              {selected.lngLat ? (
                <MightsButton
                  size="sm"
                  onPress={() => {
                    openDirections(selected.id);
                    if (detent === 'peek') setSheetDetent('half');
                  }}
                >
                  Directions
                </MightsButton>
              ) : null}
              <MightsButton href={routes.place(selected.id)} size="sm" variant="secondary">
                Open place page
              </MightsButton>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
