'use client';

// Structure references (layout only, no visual borrowing), pulled from Mobbin
// on 2026-10-08:
// - Fly Delta, place sheet with one filled "Get Directions" action:
//   https://mobbin.com/screens/01c43dd1-fbdc-4553-902a-c4e7aee59ce8
// - Waymo, route overview with origin and destination labels on the line:
//   https://mobbin.com/screens/ba739e29-bfd7-40b5-b497-d3734a8baa3c
// - Garmin Connect, route summary sheet under the map with distance first:
//   https://mobbin.com/screens/99a39061-4602-48dc-b819-65fad11f3b59
// - Places and Mindtrip, external maps handoff as a plain choice of apps:
//   https://mobbin.com/screens/1993b1ae-740c-455e-ba58-ee62f16defc3
//   https://mobbin.com/screens/ea43a2d0-45d3-49ae-aac5-5227aaa9d4e0

import { useEffect, type ReactNode } from 'react';
import { MightsButton, MightsHeading, MightsText } from '@acme/ui/mights';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { useExploreType } from '../../explore/explore-type';
import type { TravelMode } from '../model/route';
import { MODE_LABEL, MODE_ORDER, type DirectionsView, type RouteSummary, type StepRow } from '../view/directionsView';
import { useNavigationUi } from '../view/navigationUi.store';
import {
  closeDirections,
  endNavigation,
  navigationController,
  requestDirections,
  startGuidance,
  startLocation,
} from '../view/runtime';
import { useDirectionsView, useHasDevicePosition, type DirectionsPlace } from './hooks';
import { ManeuverIcon } from './ManeuverIcon';

export interface DirectionsPanelProps {
  /** The destination. */
  place: DirectionsPlace;
  /** Places the person can start from instead of their location. Places without coordinates are skipped. */
  originPlaces: readonly DirectionsPlace[];
  /**
   * Leaves the panel. Before guidance it abandons planning and the host shows
   * Place Detail again; during guidance it only uncovers the map (phones).
   * Omit during guidance where the panel sits beside the map.
   */
  onDismiss?: () => void;
  /** Guidance started. Phones use it to bring the map forward. */
  onStarted?: () => void;
  /**
   * The host's AR entry for this route, shown beside Start once a route
   * exists. It must read the shared session, never fetch its own route.
   * Omit where this build has no AR view.
   */
  arAction?: ReactNode;
  /** `window` (24dp) in a Horizon window, `pane` (16dp) elsewhere. */
  padding?: 'window' | 'pane';
  /**
   * `rail-top` where the panel covers the map, `rail-leading` beside it,
   * `none` inside a host surface that already draws the rail (the site's sheet).
   */
  frame?: 'rail-top' | 'rail-leading' | 'none';
}

const toCoordinate = (lngLat: readonly [number, number]) => ({ latitude: lngLat[1], longitude: lngLat[0] });

/**
 * Directions for one place: mode, origin, destination and entrance, the
 * route overview with alternatives, ETA, every step, Start, the AR entry and
 * external maps. Six states (default, loading, error, empty, success,
 * offline) plus the transit handoff and the step list during guidance.
 *
 * Routes are requested automatically once an origin is known and again when
 * the mode or origin changes, so there is no "Get route" button to find.
 * Every route comes from the one shared session (`useNavigationStore`); the
 * map line, the HUD and AR all draw that same route.
 */
export function DirectionsPanel({
  place,
  originPlaces,
  onDismiss,
  onStarted,
  arAction,
  padding = 'pane',
  frame = 'rail-leading',
}: DirectionsPanelProps) {
  const type = useExploreType();
  const mode = useNavigationUi((s) => s.mode);
  const originChoice = useNavigationUi((s) => s.originChoice);
  const location = useNavigationUi((s) => s.location);
  const pickerOpen = useNavigationUi((s) => s.originPickerOpen);
  const originPlace = originChoice.kind === 'place' ? originPlaces.find((p) => p.id === originChoice.placeId) : undefined;
  const view = useDirectionsView(place, originPlace);
  const hasDevicePosition = useHasDevicePosition();
  const pad = padding === 'window' ? 'px-window' : 'px-4';
  const guiding = view.kind === 'guiding';

  const destination = place.lngLat ? { name: place.name, placeId: place.id, coordinate: toCoordinate(place.lngLat) } : undefined;
  const origin = originPlace?.lngLat ? { id: originPlace.id, name: originPlace.name, coordinate: toCoordinate(originPlace.lngLat) } : undefined;
  const request = () => {
    if (destination && mode !== 'transit') requestDirections({ destination, mode, originChoice, ...(origin ? { originPlace: origin } : {}) });
  };

  // Ask once an origin exists, and again when mode or origin changes.
  const originKey = originChoice.kind === 'place' ? `place:${originChoice.placeId}:${origin ? 1 : 0}` : `device:${hasDevicePosition ? 1 : 0}`;
  const hasOrigin = originChoice.kind === 'place' ? origin !== undefined : hasDevicePosition;
  useEffect(() => {
    if (!guiding && hasOrigin) request();
    // request reads the latest store values; these are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, mode, originKey]);

  // No location source at all, or access refused: open the place list so the
  // panel never sits on a dead "Your location".
  const locationUnusable = location === 'unsupported' || location === 'denied';
  const showPicker = !guiding && originChoice.kind === 'device' && (pickerOpen || locationUnusable);

  const dismiss = () => {
    if (!guiding) closeDirections();
    onDismiss?.();
  };
  const dismissLabel = guiding ? 'Map' : 'Back';

  return (
    <View
      className={'min-h-0 flex-1 bg-primary ' + (frame === 'rail-top' ? 'pt-rail' : frame === 'rail-leading' ? 'pl-rail' : '')}
      aria-label={`Directions to ${place.name}`}
    >
      <View className="min-h-0 flex-1 bg-surface-raised">
        <View className={'justify-center border-b border-rule-hairline ' + type.header + ' ' + pad}>
          <View className="flex-row items-center justify-between gap-4">
            <View className="min-w-0 flex-1">
              <Text className={type.meta + ' font-sans text-text-muted'}>{guiding ? 'On the way to' : 'Directions to'}</Text>
              <MightsHeading level={2} size="title" className={type.heading}>
                {place.name}
              </MightsHeading>
            </View>
            {onDismiss ? (
              <MightsButton
                size={type.buttons.primary}
                variant="ghost"
                onPress={dismiss}
                aria-label={guiding ? 'Show the map' : `Back to ${place.name}`}
              >
                {dismissLabel}
              </MightsButton>
            ) : null}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName={'max-w-content-prose py-5 pb-12 ' + type.sectionGap + ' ' + pad}
          showsVerticalScrollIndicator={false}
        >
          {view.kind === 'empty' ? (
            <View className={type.stackGap}>
              <MightsHeading level={3} size="card" className={type.title}>
                {view.title}
              </MightsHeading>
              <MightsText tone="default" className={type.body}>
                {view.body}
              </MightsText>
            </View>
          ) : (
            <>
              {guiding ? null : <ModePicker mode={mode} />}
              {view.kind === 'default' ? (
                <OriginBlock view={view} onAskLocation={startLocation} />
              ) : null}
              {showPicker ? (
                <OriginPicker places={originPlaces.filter((p) => p.lngLat && p.id !== place.id)} />
              ) : null}
              <Body view={view} onRetry={request} onStarted={onStarted} arAction={arAction} />
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ModePicker({ mode }: { mode: TravelMode }) {
  const type = useExploreType();
  const setMode = useNavigationUi((s) => s.setMode);
  return (
    <View role="group" aria-label="How you’re getting there" className={'flex-row flex-wrap ' + type.inlineGap}>
      {MODE_ORDER.map((m) => (
        <MightsButton
          key={m}
          size={type.buttons.control}
          pressed={m === mode}
          variant={m === mode ? 'primary' : 'outline'}
          onPress={() => setMode(m)}
        >
          {MODE_LABEL[m]}
        </MightsButton>
      ))}
    </View>
  );
}

/** From and To, joined by the gold rail the route line uses on the map. */
function OriginBlock({ view, onAskLocation }: { view: Extract<DirectionsView, { kind: 'default' }>; onAskLocation: () => void }) {
  const type = useExploreType();
  const choice = useNavigationUi((s) => s.originChoice);
  const { setOriginChoice, setOriginPickerOpen } = useNavigationUi.getState();
  return (
    <View className={type.stackGap}>
      <View className="flex-row gap-3">
        <View aria-hidden className="items-center pt-1.5">
          <View className="size-2.5 rounded-full border-2 border-primary" />
          <View className="my-1 w-0.5 flex-1 bg-primary/60" />
          <View className="size-2.5 rotate-45 bg-primary" />
        </View>
        <View className={'min-w-0 flex-1 ' + type.stackGap}>
          <View className="gap-0.5">
            <Text className={type.meta + ' font-sans text-text-muted'}>From</Text>
            <Text className={type.body + ' font-sans-semibold text-text'}>{view.origin.text}</Text>
            {view.origin.notice ? (
              <Text
                role={view.origin.notice.tone === 'warning' ? 'alert' : 'status'}
                className={type.caption + ' font-sans ' + (view.origin.notice.tone === 'warning' ? 'text-text' : 'text-text-muted')}
              >
                {view.origin.notice.text}
              </Text>
            ) : null}
            <View className={'flex-row flex-wrap pt-1 ' + type.inlineGap}>
              {view.origin.canAskLocation && choice.kind === 'device' ? (
                <MightsButton size={type.buttons.control} variant="secondary" onPress={onAskLocation}>
                  Use my location
                </MightsButton>
              ) : null}
              {choice.kind === 'place' ? (
                <MightsButton size={type.buttons.control} variant="outline" onPress={() => setOriginChoice({ kind: 'device' })}>
                  Start from my location
                </MightsButton>
              ) : (
                <MightsButton size={type.buttons.control} variant="outline" onPress={() => setOriginPickerOpen(true)}>
                  Start from a place
                </MightsButton>
              )}
            </View>
          </View>
          <View className="gap-0.5">
            <Text className={type.meta + ' font-sans text-text-muted'}>To</Text>
            <Text className={type.body + ' font-sans-semibold text-text'}>{view.destination.name}</Text>
            <Text className={type.caption + ' font-sans text-text-muted'}>
              {view.destination.entranceVerified ? `Verified entrance. ${view.destination.entranceText}` : view.destination.entranceText}
            </Text>
          </View>
        </View>
      </View>
      {view.busyText ? (
        <Text role="status" className={type.caption + ' border-l-2 border-primary pl-3 font-sans text-text'}>
          {view.busyText}
        </Text>
      ) : null}
    </View>
  );
}

function OriginPicker({ places }: { places: readonly DirectionsPlace[] }) {
  const type = useExploreType();
  const { setOriginChoice, setOriginPickerOpen } = useNavigationUi.getState();
  return (
    <View className={'gap-1 border-t border-rule-hairline ' + type.sectionTop}>
      <MightsHeading level={3} size="card" className={type.title}>
        Start from a place
      </MightsHeading>
      <MightsText size="small" className={type.caption}>
        The route starts there, not where you are, and guidance won’t follow you.
      </MightsText>
      {places.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => {
            setOriginChoice({ kind: 'place', placeId: p.id });
            setOriginPickerOpen(false);
          }}
          aria-label={`Start from ${p.name}`}
          className="min-h-target flex-row items-center gap-3 active:bg-surface-sunken"
        >
          <View aria-hidden className="size-2 rotate-45 bg-rule-rail" />
          <Text className={type.body + ' flex-1 font-sans text-text'}>{p.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Summary({ summary, lead }: { summary: RouteSummary; lead: string }) {
  const type = useExploreType();
  return (
    <View accessible aria-label={`${lead}: ${summary.accessibilityLabel}`} className="gap-0.5">
      <Text className={type.meta + ' font-sans text-text-muted'}>{lead}</Text>
      <View className="flex-row flex-wrap items-baseline gap-x-3">
        <Text className={type.heading + ' font-display text-primary'}>{summary.durationText}</Text>
        <Text className={type.body + ' font-sans-semibold text-text'}>{summary.distanceText}</Text>
      </View>
      <Text className={type.caption + ' font-sans text-text-muted'}>Arrive around {summary.etaText}</Text>
    </View>
  );
}

function ExternalLinks({ external, lead }: { external: { appleMapsUrl: string; googleMapsUrl: string }; lead?: string }) {
  const type = useExploreType();
  return (
    <View className={type.stackGap}>
      {lead ? <MightsText size="small" className={type.caption}>{lead}</MightsText> : null}
      <View className={'flex-row flex-wrap ' + type.inlineGap}>
        <MightsButton size={type.buttons.control} variant="outline" href={external.appleMapsUrl} external>
          Apple Maps
        </MightsButton>
        <MightsButton size={type.buttons.control} variant="outline" href={external.googleMapsUrl} external>
          Google Maps
        </MightsButton>
      </View>
    </View>
  );
}

function Steps({ steps, heading }: { steps: readonly StepRow[]; heading: string }) {
  const type = useExploreType();
  return (
    <View className={'gap-1 border-t border-rule-hairline ' + type.sectionTop}>
      <MightsHeading level={3} size="card" className={type.title}>
        {heading}
      </MightsHeading>
      {steps.map((step) => {
        const active = step.status === 'active';
        const passed = step.status === 'passed';
        return (
          <View
            key={step.index}
            accessible
            aria-label={`${passed ? 'Done. ' : active ? 'Now. ' : ''}${step.instruction}${step.distanceText ? `, ${step.distanceText}` : ''}`}
            className={
              'min-h-target flex-row items-start gap-3 border-l-2 py-2 pl-3 ' +
              (active ? 'border-primary bg-surface-sunken' : 'border-transparent')
            }
          >
            <ManeuverIcon glyph={step.glyph} muted={passed} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className={type.body + ' font-sans ' + (passed ? 'text-text-muted' : 'text-text')}>{step.instruction}</Text>
              {step.distanceText ? (
                <Text className={type.caption + ' font-sans text-text-muted'}>{step.distanceText}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Body({
  view,
  onRetry,
  onStarted,
  arAction,
}: {
  view: DirectionsView;
  onRetry: () => void;
  onStarted?: () => void;
  arAction?: ReactNode;
}) {
  const type = useExploreType();
  switch (view.kind) {
    case 'empty':
      return null;
    case 'default':
      return <ExternalLinks external={view.external} lead="Prefer another app?" />;
    case 'loading':
      return (
        <View className={type.stackGap}>
          <Text role="status" aria-live="polite" className={type.body + ' font-sans text-text-muted'}>
            {view.statusText}
          </Text>
          {/* Placeholder bars where the summary and steps will land. */}
          <View aria-hidden className={type.stackGap}>
            <View className="h-8 w-28 animate-pulse bg-surface-sunken motion-reduce:animate-none" />
            <View className="h-4 w-48 animate-pulse bg-surface-sunken motion-reduce:animate-none" />
            <View className="h-12 w-full animate-pulse bg-surface-sunken motion-reduce:animate-none" />
            <View className="h-12 w-full animate-pulse bg-surface-sunken motion-reduce:animate-none" />
          </View>
        </View>
      );
    case 'error':
    case 'offline':
      return (
        <View className={type.stackGap}>
          <View role="alert" className="gap-1 border-l-2 border-primary pl-3">
            <Text className={type.title + ' font-sans-semibold text-text'}>{view.title}</Text>
            <Text className={type.body + ' font-sans text-text-muted'}>{view.body}</Text>
          </View>
          {view.canRetry ? (
            <View className="flex-row">
              <MightsButton size={type.buttons.primary} variant="secondary" onPress={onRetry}>
                Try again
              </MightsButton>
            </View>
          ) : null}
          <ExternalLinks external={view.external} />
        </View>
      );
    case 'handoff':
      return (
        <View className={type.stackGap}>
          <View className="gap-1 border-l-2 border-primary pl-3">
            <Text className={type.title + ' font-sans-semibold text-text'}>{view.title}</Text>
            <Text className={type.body + ' font-sans text-text-muted'}>{view.body}</Text>
          </View>
          <ExternalLinks external={view.external} />
        </View>
      );
    case 'success':
      return (
        <>
          <Summary summary={view.summary} lead={`${MODE_LABEL[view.mode]} from ${view.originText.replace(/^Your /, 'your ')}`} />
          <Text className={type.caption + ' font-sans text-text-muted'}>
            {view.destination.entranceVerified ? `Verified entrance. ${view.destination.entranceText}` : view.destination.entranceText}
          </Text>
          {view.options.length > 1 ? (
            <View role="radiogroup" aria-label="Routes" className="gap-1">
              {view.options.map((option) => (
                <Pressable
                  key={option.index}
                  role="radio"
                  aria-checked={option.selected}
                  aria-label={option.accessibilityLabel}
                  onPress={() => navigationController().selectRoute(option.index)}
                  className={
                    'min-h-target flex-row items-center justify-between gap-3 border-l-2 px-3 py-2 ' +
                    (option.selected ? 'border-primary bg-surface-sunken' : 'border-rule-hairline active:bg-surface-sunken')
                  }
                >
                  <Text className={type.body + ' font-sans-semibold text-text'}>{option.label}</Text>
                  <Text className={type.meta + ' font-sans text-text-muted'}>
                    {option.durationText}, {option.distanceText}
                    {option.deltaText ? ` (${option.deltaText})` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View className={type.stackGap}>
            <View className={'flex-row flex-wrap ' + type.inlineGap}>
              <MightsButton
                size={type.buttons.primary}
                onPress={() => {
                  if (startGuidance()) onStarted?.();
                }}
              >
                Start
              </MightsButton>
              {arAction}
            </View>
            {view.guidanceNote ? (
              <Text className={type.caption + ' font-sans text-text-muted'}>{view.guidanceNote}</Text>
            ) : null}
          </View>
          <Steps steps={view.steps} heading="Steps" />
          <ExternalLinks external={view.external} lead="Or open this trip in another app." />
        </>
      );
    case 'guiding':
      return (
        <>
          <Summary summary={view.summary} lead="Left to go" />
          <View className={'flex-row flex-wrap ' + type.inlineGap}>
            {arAction}
            <MightsButton size={type.buttons.primary} variant="secondary" onPress={endNavigation}>
              End trip
            </MightsButton>
          </View>
          <Steps steps={view.steps} heading="Steps" />
          <ExternalLinks external={view.external} lead="Or finish this trip in another app." />
        </>
      );
  }
}
