'use client';

import { use, useEffect, useMemo, useRef } from 'react';
import { filterPlaces, useExplore, type ExplorePlace } from '@acme/app/features/explore/explore.store.ts';
import { exploreCategories } from '@acme/app/features/explore/catalogue.ts';
import { noResultsCopy, placeRowLine, resultsSummary } from '@acme/app/features/explore/explore-copy.ts';
import { Pressable, ScrollView, Text, TextInput, View } from '@acme/ui/tw';
import { MightsButton, MightsText, condensed } from '@acme/ui/mights';
import { focusId, parseExploreParams } from './explore-url';
import { PHONE, SEARCH_FOCUS, focusSearch, useExploreActions } from './explore-actions';
import { useMediaQuery } from './use-media-query';

// Rows rendered before the "keep typing" note; the catalogue has ~1.6k places.
const LIST_ROW_CAP = 250;

/**
 * The search, filters and result list. Suspends on the catalogue promise;
 * the map region never waits on it — instead this region publishes the
 * filtered ids into the store, and the map dims non-matching dots when they
 * arrive.
 */
export function MasterRegion({ cataloguePromise }: { cataloguePromise: Promise<readonly ExplorePlace[]> }) {
  const places = use(cataloguePromise);
  const { params, replace, select, commitQuery } = useExploreActions();
  const categories = useMemo(() => exploreCategories(places), [places]);
  const { view, category } = parseExploreParams(params, categories, 'All');
  const q = useExplore((s) => s.query);
  const setQuery = useExplore((s) => s.setQuery);
  const setSheetDetent = useExplore((s) => s.setSheetDetent);
  const phone = useMediaQuery(PHONE);

  useEffect(() => {
    setQuery(params.get('q') ?? '');
    // Seed once from the URL; afterwards the draft leads and the URL follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (typing.current) clearTimeout(typing.current);
  }, []);

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

  const results = useMemo(() => filterPlaces(places, q, category), [places, q, category]);
  const summary = resultsSummary(results.length, results.filter((p) => p.lngLat).length, q, category, 'All');

  // Recently viewed — session history as real catalogue rows, not a mock.
  const recentIds = useExplore((s) => s.recentIds);
  const recents = useMemo(
    () => recentIds.flatMap((id) => places.filter((p) => p.id === id)),
    [recentIds, places],
  );

  // Publish what the map dims. Written here — not passed — because the map
  // region resolves a lighter points promise and renders before this does.
  useEffect(() => {
    const ids = results.flatMap((p) => (p.lngLat ? [p.id] : []));
    useExplore.getState().setVisibleIds(ids);
    return () => useExplore.getState().setVisibleIds(null);
  }, [results]);

  const selectedId = params.get('place');

  // Phones keep search, chips and the count above both views, so filtering
  // never needs a trip to the list first; only the results swap with the map.
  return (
    <View
      className={`w-full border-rule-hairline md:w-pane-primary md:shrink-0 md:border-r ${
        view === 'list' ? 'min-h-0 flex-1' : 'shrink-0'
      }`}
    >
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
            {categories.map((c) => {
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
          {recents.length > 0 ? (
            <View
              role="group"
              aria-label="Recently viewed"
              className="-mx-4 flex-row items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            >
              <Text className="shrink-0 text-label text-text-muted">Recent</Text>
              {recents.map((place) => (
                <MightsButton
                  key={place.id}
                  size="sm"
                  variant="ghost"
                  pressed={place.id === selectedId}
                  className="shrink-0"
                  aria-label={`Open ${place.name} again`}
                  onPress={() => select(place.id, focusId.row(place.id))}
                >
                  {place.name}
                </MightsButton>
              ))}
            </View>
          ) : null}
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
            <>
              {/* The catalogue runs into the thousands; a long unfiltered list
                  renders the first page of rows and says so, so typing narrows
                  rather than scrolls forever. */}
              {(results.length > LIST_ROW_CAP ? results.slice(0, LIST_ROW_CAP) : results).map((place) => {
                const on = place.id === selectedId;
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
              })}
              {results.length > LIST_ROW_CAP ? (
                <Text className="p-5 text-small text-text-muted">
                  {`Showing the first ${LIST_ROW_CAP} — search or pick a category to narrow it down.`}
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
