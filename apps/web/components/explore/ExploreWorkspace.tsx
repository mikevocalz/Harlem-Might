'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DEFAULT_SHEET_DETENT,
  HARLEM_CATEGORIES,
  MAPPED_PLACES,
  filterHarlemPlacePreviews,
  getHarlemPlacePreview,
  useExplore,
  type SheetDetent,
} from '@acme/app/features/explore/explore.store.ts';
import { noResultsCopy, placeRowLine, resultsSummary } from '@acme/app/features/explore/explore-copy.ts';
import { Main, Pressable, ScrollView, Text, TextInput, View } from '@acme/ui/tw';
import { MightsButton, MightsHeading, MightsLocationStamp, MightsText, condensed, routes } from '@acme/ui/mights';
import { DirectionsPanel } from '@acme/app/features/navigation/ui/DirectionsPanel.tsx';
import { NavigationHud } from '@acme/app/features/navigation/ui/NavigationHud.tsx';
import { useDirectionsPlaceId, useIsGuiding } from '@acme/app/features/navigation/ui/hooks.ts';
import { useNavigationHost } from '@acme/app/features/navigation/ui/useNavigationHost.ts';
import { createBrowserLocationSource } from '@acme/app/features/navigation/view/locationSource.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { endNavigation, openDirections } from '@acme/app/features/navigation/view/runtime.ts';
import { useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { ExploreMap, type MapPlace } from './ExploreMap';
import { exploreHref, focusId, focusReturnOrder, isFocusFor, parseExploreParams } from './explore-url';
import { useMapStatus } from './map-status';
import { useMediaQuery } from './use-media-query';

const MAP_PLACES = MAPPED_PLACES as unknown as readonly MapPlace[];
const SHEET_TITLE_ID = 'explore-sheet-title';
const SEARCH_FOCUS = 'search';
const focusSearch = () =>
  document.querySelector<HTMLElement>(`[data-explore-focus="${SEARCH_FOCUS}"]`)?.focus();
// Detents in raise order; the sheet steps through them with Less / More.
const DETENTS: readonly SheetDetent[] = ['peek', 'half', 'full'];

const isVisible = (el: Element) => el.getClientRects().length > 0 && !el.closest('[inert]');

function focusFirst(ids: string[]) {
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-explore-focus="${CSS.escape(id)}"]`);
    if (el && isVisible(el)) {
      el.focus();
      return;
    }
  }
  focusSearch();
}

// Phones get one pane at a time below md; the full-height sheet there is the
// only place the rest of the page goes inert.
const PHONE = '(width < 48rem)';
// From lg the sheet docks beside the map as the inspector.
const DOCKED = '(width >= 64rem)';

// W3C Geolocation, foreground only. The site never asks for the camera.
const browserLocation = () =>
  createBrowserLocationSource(
    typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
    typeof navigator !== 'undefined' ? (navigator.permissions as never) : undefined,
  );

// The URL is the source of truth for view, q, category and place: reload
// restores the workspace, the address is the share link, and Back closes a
// selection because selecting pushes while typing and filtering replace.
export function ExploreWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { view, category, placeId } = parseExploreParams(params, HARLEM_CATEGORIES, 'All');
  const selected = getHarlemPlacePreview(placeId);

  // The search draft lives in zustand so typing never fights the router; the
  // URL is updated with a debounced history.replaceState (no navigation).
  const q = useExplore((s) => s.query);
  const setQuery = useExplore((s) => s.setQuery);
  const detent = useExplore((s) => s.sheet.detent);
  const sheetOpen = useExplore((s) => s.sheet.open);
  const { openSheet, closeSheet, setSheetDetent } = useExplore.getState();
  const mapStatus = useMapStatus((s) => s.status);
  const phone = useMediaQuery(PHONE);
  const docked = useMediaQuery(DOCKED);

  // The one navigation session: the sheet's directions, the map line and the
  // HUD all read it.
  useNavigationHost(browserLocation);
  const directionsPlaceId = useDirectionsPlaceId();
  const guiding = useIsGuiding();
  const stepsOpen = useNavigationUi((s) => s.stepsOpen);
  const destinationId = useNavigationStore((s) => ('activeRoute' in s.session ? (s.session.destination.placeId ?? null) : null));

  useEffect(() => {
    setQuery(params.get('q') ?? '');
    // Seed once from the URL; afterwards the draft leads and the URL follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (typing.current) clearTimeout(typing.current);
  }, []);
  // True once this session pushed a selection, so Close can step back instead
  // of leaving a duplicate history entry.
  const pushed = useRef(false);
  const sheetRef = useRef<HTMLElement | null>(null);

  const href = (patch: Record<string, string | null>) => exploreHref(pathname, params.toString(), patch);
  const replace = (patch: Record<string, string | null>) => router.replace(href(patch), { scroll: false });
  const select = (id: string, opener: string) => {
    openSheet(sheetOpen ? detent : DEFAULT_SHEET_DETENT, opener);
    pushed.current = true;
    router.push(href({ place: id }), { scroll: false });
  };
  // Focus and the store follow the URL in the effect below, so Close, Escape
  // and browser Back all take the same path.
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
    } else replace({ place: null });
  };
  const commitQuery = (text: string) => window.history.replaceState(null, '', href({ q: text || null }));
  const onType = (text: string) => {
    setQuery(text);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => commitQuery(text), 250);
  };
  const clearAll = () => {
    if (typing.current) clearTimeout(typing.current);
    setQuery('');
    replace({ q: null, category: null });
  };

  // URL → sheet slice and focus. Opening (click, reload, shared link) moves
  // focus to the sheet heading; closing returns it to whatever opened it.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const was = shownId.current;
    shownId.current = selected?.id ?? null;
    if (selected) {
      const sheetNow = useExplore.getState().sheet;
      if (!sheetNow.open) openSheet(DEFAULT_SHEET_DETENT, null);
      // Back/Forward between two pushed selections changes the place without a
      // click, so the stored opener still names the previous place's control.
      else if (sheetNow.returnFocusId && !isFocusFor(sheetNow.returnFocusId, selected.id))
        openSheet(sheetNow.detent, focusId.row(selected.id));
      // Same place again: an Activity reveal after browser Back. Keep focus
      // where it was (usually the link that left) unless it fell to <body>.
      if (was === selected.id && document.activeElement && document.activeElement !== document.body) return;
      const heading = document.getElementById(SHEET_TITLE_ID);
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    } else if (was) {
      // Browser Back can drop the place too; the pushed entry is gone either
      // way, so a later Close must not step back off the page.
      pushed.current = false;
      closeSheet();
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
    // close reads refs and the current URL; selection is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Only the phone's full-height sheet is modal: everything outside it goes
  // inert so Tab can't reach the hidden map. Docked or partial, the map and
  // list stay usable beside it.
  const modal = !!selected && phone && detent === 'full';
  useEffect(() => {
    const sheet = sheetRef.current;
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

  const results = filterHarlemPlacePreviews(q, category);
  const mappedIds = results.filter((p) => p.lngLat).map((p) => p.id);
  const mappedCount = mappedIds.length;
  const summary = resultsSummary(results.length, mappedCount, q, category, 'All');

  // Phones keep search, chips and the count above both views, so filtering
  // never needs a trip to the list first; only the results swap with the map.
  const master = (
    <View className={`min-h-0 bg-surface md:h-full md:flex-1 ${view === 'list' ? 'flex-1' : 'shrink-0'}`}>
      <View className="gap-3 border-b border-rule-hairline p-4 md:gap-4 md:p-5">
        {/* Visible title from md; the h1 lives at the workspace root so it exists at every breakpoint. */}
        <Text aria-hidden className={`hidden font-sans text-title-lg font-bold text-text md:flex ${condensed}`}>
          Explore
        </Text>
        {/* RN's Role union lags ARIA; RNW passes "search" through to the DOM. */}
        <View role={'search' as never} className="flex-row gap-2">
          <Text className="sr-only">Search places</Text>
          <TextInput
            data-explore-focus={SEARCH_FOCUS}
            aria-label="Search places"
            value={q}
            onChangeText={onType}
            onSubmitEditing={() => {
              if (typing.current) clearTimeout(typing.current);
              commitQuery(q);
            }}
            // A raised sheet would cover the results being typed for.
            onFocus={() => {
              if (useExplore.getState().sheet.open && phone) setSheetDetent('peek');
            }}
            returnKeyType="search"
            placeholder="Search places, like Apollo"
            className="h-12 min-w-0 flex-1 border border-border-strong bg-surface-raised px-4 text-body text-text outline-hidden placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          {q ? (
            <MightsButton
              size="sm"
              variant="outline"
              className="self-center"
              aria-label="Clear search"
              onPress={() => {
                if (typing.current) clearTimeout(typing.current);
                setQuery('');
                replace({ q: null });
                focusSearch();
              }}
            >
              Clear
            </MightsButton>
          ) : null}
        </View>
        {/* One row that scrolls sideways on phones, so the list starts higher;
            wraps from md, where the master pane is a fixed column. */}
        <View
          role="group"
          aria-label="Filter by category"
          className="-mx-4 flex-row gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          {HARLEM_CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <MightsButton
                key={c}
                size="sm"
                pressed={on}
                variant={on ? 'primary' : 'outline'}
                onPress={() => replace({ category: c === 'All' ? null : c })}
              >
                {c}
              </MightsButton>
            );
          })}
        </View>
        <Text role="status" aria-live="polite" className="text-label text-text-muted">
          {summary}
        </Text>
      </View>

      <ScrollView className={`flex-1 md:flex ${view === 'list' ? '' : 'hidden'}`}>
        {results.length === 0 ? (
          <View className="items-start gap-3 p-5">
            <MightsText tone="default">{noResultsCopy(q, category, 'All')}</MightsText>
            <MightsButton size="sm" variant="secondary" onPress={clearAll}>
              Clear search and filters
            </MightsButton>
          </View>
        ) : (
          results.map((place) => {
            const on = place.id === selected?.id;
            return (
              <Pressable
                key={place.id}
                data-explore-focus={focusId.row(place.id)}
                onPress={() => select(place.id, focusId.row(place.id))}
                aria-current={on ? 'true' : undefined}
                className={`mights-focus flex-row items-start gap-4 border-b border-l-2 border-b-rule-hairline px-5 py-4 text-left ${
                  on ? 'border-l-primary bg-surface-raised' : 'border-l-transparent hover:bg-surface-raised'
                }`}
              >
                <View className={`mt-2 size-2.5 shrink-0 rotate-45 ${on ? 'bg-primary' : 'bg-rule-rail'}`} />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-body font-semibold text-text">{place.name}</Text>
                  <Text className="text-small text-text-muted">{placeRowLine(place)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

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
  const showDirections = !!selected && directionsPlaceId === selected.id;
  // Guidance below lg: the map and HUD own the screen; Steps brings the sheet back.
  const sheetHidden = guiding && !docked && !stepsOpen;
  const sheet = selected && !sheetHidden ? (
    <View
      ref={sheetRef as never}
      role="dialog"
      aria-modal={modal}
      aria-labelledby={SHEET_TITLE_ID}
      className={`absolute inset-x-0 bottom-0 z-(--z-raised) flex-col bg-primary pt-rail md:left-(--container-pane-primary) lg:static lg:inset-auto lg:max-h-none lg:w-pane-inspector lg:shrink-0 lg:pl-rail lg:pt-0 ${sheetPosition}`}
    >
      {showDirections ? (
        <DirectionsPanel
          place={selected}
          originPlaces={MAPPED_PLACES}
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
        <View className="gap-3 border-b border-rule-hairline p-4 md:p-5">
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
              <MightsButton size="sm" variant="outline" onPress={() => setSheetDetent(lower)} aria-label={`Show less of ${selected.name}`}>
                Less
              </MightsButton>
            ) : null}
            {higher ? (
              <MightsButton size="sm" variant="outline" onPress={() => setSheetDetent(higher)} aria-label={`Show more of ${selected.name}`}>
                More
              </MightsButton>
            ) : null}
          </View>
        </View>
        <ScrollView
          className={`min-h-0 flex-1 ${detent === 'peek' ? 'hidden lg:flex' : ''}`}
          contentContainerClassName="gap-5 p-4 md:p-5"
        >
          <MightsLocationStamp name={selected.category} street={selected.street ?? selected.area} className="self-start" />
          {/* shortDescription, not whyItMatters: the fixture's whyItMatters is
              planning copy about the product, not a fact about the place. */}
          <MightsText tone="default">{selected.shortDescription}</MightsText>
          {selected.lngLat ? null : <MightsText size="small">Location pending verification.</MightsText>}
          {/* No Save (this site has no sign-in) and no AR (no AR runtime on
              the web), so neither shows a button that can't work. */}
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
  ) : null;

  return (
    // grow-0: globals.css grows every main[role=main] to fill the shell, which
    // would push the phone toggle under the fixed dock.
    <Main className="grow-0 h-[calc(100dvh-var(--spacing)*16-var(--spacing-dock)-env(safe-area-inset-bottom))] flex-col overflow-hidden md:h-[calc(100dvh-var(--spacing)*16)]">
      <MightsHeading level={1} className="sr-only">
        Explore
      </MightsHeading>
      <View className="relative min-h-0 flex-1 md:flex-row">
        {/* md+: master column beside the map. Phones: the toggle picks list or map under the filters. */}
        <View
          className={`w-full border-rule-hairline md:w-pane-primary md:shrink-0 md:border-r ${
            view === 'list' ? 'min-h-0 flex-1' : 'shrink-0'
          }`}
        >
          {master}
        </View>

        <View className={`relative min-w-0 flex-1 md:flex ${view === 'list' ? 'hidden' : 'flex'}`}>
          <ExploreMap
            places={MAP_PLACES}
            visibleIds={mappedIds}
            selectedId={selected?.lngLat ? selected.id : null}
            onSelect={(id) => select(id, focusId.marker(id))}
            occluderRef={sheetRef}
            layoutKey={detent}
          />
          <NavigationHud
            onShowSteps={
              docked
                ? undefined
                : () => {
                    if (destinationId && selected?.id !== destinationId) select(destinationId, focusId.marker(destinationId));
                    useNavigationUi.getState().setStepsOpen(true);
                    setSheetDetent('full');
                  }
            }
            onRecenter={() => useNavigationUi.getState().setFollowUser(true)}
            onShowPlace={(id) => {
              endNavigation();
              if (selected?.id !== id) select(id, focusId.marker(id));
            }}
          />
          {mapStatus === 'unavailable' ? (
            <View className="absolute inset-0 items-start justify-end gap-3 bg-surface-sunken p-6">
              <MightsText tone="default">The map didn’t load. Every place is in the list.</MightsText>
              <MightsButton size="sm" variant="secondary" className="md:hidden" onPress={() => replace({ view: 'list' })}>
                Show the list
              </MightsButton>
            </View>
          ) : null}
        </View>

        {sheet}
      </View>

      {/* Phones: the toggle sits just above the dock, in thumb reach, and
          outside the stage so an open sheet never covers it. */}
      <View role="group" aria-label="View" className="flex-row justify-center gap-2 border-t border-rule-hairline bg-surface px-4 py-2 md:hidden">
        {(['map', 'list'] as const).map((v) => (
          <MightsButton
            key={v}
            size="sm"
            pressed={view === v}
            variant={view === v ? 'primary' : 'outline'}
            onPress={() => replace({ view: v === 'map' ? null : 'list' })}
          >
            {v === 'map' ? 'Map' : 'List'}
          </MightsButton>
        ))}
      </View>
    </Main>
  );
}
