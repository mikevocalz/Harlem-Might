'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  HARLEM_CATEGORIES,
  HARLEM_PLACE_PREVIEWS,
  MAPPED_PLACES,
  getHarlemPlacePreview,
  useExplore,
  type HarlemPlacePreview,
} from '@acme/app/features/explore/explore.store.ts';
import { Pressable, ScrollView, Text, TextInput, View } from '@acme/ui/tw';
import {
  MightsButton,
  MightsHeading,
  MightsLocationStamp,
  MightsText,
  cornerCutSm,
  expanded,
  notch,
  routes,
} from '@acme/ui/mights';
import { ExploreMap, type MapPlace } from './ExploreMap';

type Category = (typeof HARLEM_CATEGORIES)[number];
const MAP_PLACES = MAPPED_PLACES as unknown as readonly MapPlace[];

function matches(place: HarlemPlacePreview, q: string, category: Category) {
  if (category !== 'All' && place.category !== category) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [place.name, place.area, place.category, place.shortDescription, ...place.tags].some((v) =>
    v.toLowerCase().includes(needle),
  );
}

// The URL is the source of truth for view, q, category and place: reload
// restores the workspace, the address is the share link, and Back closes a
// selection because selecting pushes while typing and filtering replace.
export function ExploreWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The search draft lives in zustand so typing never fights the router; the
  // URL is updated with a debounced history.replaceState (no navigation).
  const q = useExplore((s) => s.query);
  const setQuery = useExplore((s) => s.setQuery);
  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    setQuery(urlQ);
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
  const rawCategory = params.get('category');
  const category: Category = (HARLEM_CATEGORIES as readonly string[]).includes(rawCategory ?? '')
    ? (rawCategory as Category)
    : 'All';
  const view = params.get('view') === 'list' ? 'list' : 'map';
  const selected = getHarlemPlacePreview(params.get('place'));

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const search = next.toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  const replace = (patch: Record<string, string | null>) => router.replace(href(patch), { scroll: false });
  const select = (id: string) => {
    pushed.current = true;
    router.push(href({ place: id }), { scroll: false });
  };
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
    } else replace({ place: null });
  };
  const onType = (text: string) => {
    setQuery(text);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => window.history.replaceState(null, '', href({ q: text || null })), 250);
  };

  const results = HARLEM_PLACE_PREVIEWS.filter((p) => matches(p, q, category));

  const list = (
    <View className="h-full min-h-0 flex-1 bg-surface">
      <View className="gap-4 border-b border-rule-hairline p-5 pt-16 lg:pt-5">
        {/* Visible title; the h1 lives at the workspace root so it exists at every breakpoint. */}
        <Text aria-hidden className="font-sans text-title-lg font-bold text-text [font-stretch:75%] md:text-display-sm">
          Explore
        </Text>
        <View className="gap-2">
          <Text className="sr-only">Search places</Text>
          <TextInput
            aria-label="Search places"
            value={q}
            onChangeText={onType}
            placeholder="Search places, like Apollo"
            className="h-12 border border-border-strong bg-surface-raised px-4 text-base text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </View>
        <View className="flex-row flex-wrap gap-2" role="group" aria-label="Filter by category">
          {HARLEM_CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => replace({ category: c === 'All' ? null : c })}
                aria-pressed={on}
                className="mights-focus group"
              >
                <View
                  className={`h-9 justify-center px-4 ${cornerCutSm} ${
                    on ? 'bg-primary' : 'bg-surface-raised group-hover:bg-border'
                  }`}
                >
                  <Text className={`text-[13px] font-semibold ${expanded} ${on ? 'text-on-primary' : 'text-text'}`}>
                    {c}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView className="flex-1">
        {results.length === 0 ? (
          <View className="gap-2 p-5">
            <MightsText tone="default">No places match {q ? `“${q}”` : 'this filter'}.</MightsText>
            <Pressable
              onPress={() => {
                setQuery('');
                replace({ q: null, category: null });
              }}
              className="mights-focus self-start"
            >
              <Text className="text-[15px] font-semibold text-primary">Clear search and filters</Text>
            </Pressable>
          </View>
        ) : (
          results.map((place) => {
            const on = place.id === selected?.id;
            return (
              <Pressable
                key={place.id}
                onPress={() => select(place.id)}
                aria-current={on ? 'true' : undefined}
                className={`mights-focus flex-row items-start gap-4 border-b border-rule-hairline px-5 py-4 text-left ${
                  on ? 'bg-surface-raised' : 'hover:bg-surface-raised'
                }`}
              >
                <View className={`mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 ${on ? 'bg-primary' : 'bg-rule-rail'}`} />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-[17px] font-semibold text-text">{place.name}</Text>
                  <Text className="text-[14px] text-text-muted">
                    {place.category}, {place.street ?? place.area}
                    {place.lngLat ? '' : ', location pending'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const sheet = selected ? (
    <View className={`h-full bg-rule-rail p-[2px] lg:h-auto lg:max-h-full ${notch}`}>
      <ScrollView className={`h-full bg-surface-raised lg:h-auto ${notch}`} contentContainerClassName="gap-5 p-6 pt-8">
        <View className="flex-row items-start justify-between gap-4">
          <MightsHeading level={2} size="title">
            {selected.name}
          </MightsHeading>
          <Pressable
            onPress={close}
            aria-label={`Close ${selected.name}`}
            className="mights-focus min-h-11 justify-center px-2"
          >
            <Text className="text-[14px] font-semibold text-primary">Close</Text>
          </Pressable>
        </View>
        <MightsLocationStamp name={selected.category} street={selected.street ?? selected.area} />
        <MightsText tone="default">{selected.shortDescription}</MightsText>
        <MightsText>{selected.whyItMatters}</MightsText>
        {selected.lngLat ? null : <MightsText size="small">Location pending verification.</MightsText>}
        <View className="flex-row flex-wrap gap-3">
          <MightsButton href={routes.place(selected.id)} size="sm">
            Open place
          </MightsButton>
          {selected.lngLat ? (
            <MightsButton
              external
              size="sm"
              variant="secondary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lngLat[1]},${selected.lngLat[0]}`}
            >
              Get directions
            </MightsButton>
          ) : null}
        </View>
      </ScrollView>
    </View>
  ) : null;

  return (
    <View className="relative h-[calc(100dvh-4rem-56px-env(safe-area-inset-bottom))] flex-row overflow-hidden md:h-[calc(100dvh-4rem)]">
      <MightsHeading level={1} className="sr-only">
        Explore
      </MightsHeading>
      {/* ≥1024: list pane | <1024: list only when view=list */}
      <View
        className={`w-full border-r border-rule-hairline lg:flex lg:w-[400px] lg:shrink-0 ${
          view === 'list' ? 'flex' : 'hidden'
        }`}
      >
        {list}
      </View>

      <View className={`relative min-w-0 flex-1 lg:flex ${view === 'list' ? 'hidden' : 'flex'}`}>
        <ExploreMap
          places={MAP_PLACES}
          selectedId={selected?.lngLat ? selected.id : null}
          onSelect={select}
          rightInset={selected ? 460 : 0}
          bottomInset={0}
        />
      </View>

      {sheet ? (
        <View className="absolute inset-x-3 bottom-3 top-[40%] z-10 lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:max-h-[calc(100%-2rem)] lg:w-[440px]">
          {sheet}
        </View>
      ) : null}

      {/* <1024: map/list toggle */}
      <View className="absolute right-3 top-3 z-10 flex-row gap-2 lg:hidden">
        {(['map', 'list'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => replace({ view: v === 'map' ? null : 'list' })}
            aria-pressed={view === v}
            className="mights-focus"
          >
            <View className={`h-10 justify-center px-5 ${cornerCutSm} ${view === v ? 'bg-primary' : 'bg-surface-raised'}`}>
              <Text className={`text-[14px] font-semibold ${expanded} ${view === v ? 'text-on-primary' : 'text-text'}`}>
                {v === 'map' ? 'Map' : 'List'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
