import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { palette } from '@acme/theme';
import { formatDistance } from '@acme/app/features/explore/place-model.ts';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import { resumeGuidance } from '@acme/app/features/navigation/view/runtime.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import {
  navigationFixStore,
  selectArTracking,
  selectPositioning,
  selectProgress,
  selectSession,
  useNavigationStore,
} from '@acme/app/features/navigation/session/navigationStore.ts';
import {
  guidanceBearingDeg,
  chevronStopAlongTrackM,
  isFreshSample,
  MAX_CAMERA_AGE_MS,
  MAX_MATCH_AGE_MS,
  maneuverTurnDeg,
  navArPresentation,
  type CalibrationChecklist,
} from './navAr';
import { useNavAr } from './navAr.store';
import { navigationArrow, navigationArRecovery } from './navArRecovery';
import { canCheckWalkingPace, checkWalkingPace } from './navArPaceRecovery';
import { finishArNavigation } from './navigationArVisit';
import { getNavigationController } from './navigationRuntime';

const GOLD = palette.mights.gold;
const PAPER = palette.mights.paper;
const LIMESTONE = palette.mights.limestone;
const AMBER = palette.mights['sodium-amber'];
/** Warm black at 88%, so camera content stays faintly visible behind cards. */
const CARD = 'rgba(11, 9, 6, 0.88)';

/** Per-HUD feedback state for the asynchronous, non-prompting pace check. */
function createPaceCheckState() {
  return createStore(() => ({ checking: false, message: undefined as string | undefined }));
}

export interface HarlemNavigationArHudProps {
  /** Insets still inside this host; replaces root safe areas already consumed by the shell. */
  readonly contentInsets?: Readonly<EdgeInsets>;
  /** Leaves AR and returns to the map. The navigation session keeps running. */
  readonly onBackToMap: () => void;
  /** After arrival: end navigation and open the destination's place page. */
  readonly onExplorePlace: (placeId: string | undefined) => void;
}

/** Opaque-enough backing keeps guidance readable over a changing camera image. */
function Card({ children, announce = false }: { children: React.ReactNode; announce?: boolean }) {
  return (
    <View className="gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }} accessibilityLiveRegion={announce ? 'polite' : 'none'}>
      {children}
    </View>
  );
}

/** Shared high-contrast guidance text using the existing semantic palette. */
function Line({ children, tone = 'paper', size = 16 }: { children: React.ReactNode; tone?: 'paper' | 'gold' | 'muted' | 'amber'; size?: number }) {
  const color = tone === 'gold' ? GOLD : tone === 'amber' ? AMBER : tone === 'muted' ? LIMESTONE : PAPER;
  return <Text style={{ color, fontSize: size, lineHeight: Math.round(size * 1.3), flexShrink: 1 }}>{children}</Text>;
}

/**
 * HUD controls need wrapping labels and intrinsic height at large text sizes.
 * The shared MightsButton's fixed-height, one-line label cannot provide that.
 * Keep the existing semantic primitive and palette, with a 48dp minimum target.
 */
function Action({ children, onPress, disabled = false, primary = false }: {
  children: string; onPress: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      accessibilityState={{ disabled }}
      className="rounded-xl px-4 py-3"
      style={{ minHeight: 48, justifyContent: 'center', backgroundColor: primary ? GOLD : CARD, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="font-ui" style={{ color: primary ? palette.mights['warm-black'] : GOLD, fontSize: 16, flexShrink: 1 }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** The adjacent instruction carries direction for screen readers. */
function Arrow({ deg, size }: { deg: number; size: number }) {
  const bar = { position: 'absolute' as const, width: size * 0.16, height: size * 0.62, backgroundColor: GOLD, borderRadius: size * 0.08 };
  return (
    <View style={{ width: size, height: size, flexShrink: 0, transform: [{ rotate: `${deg}deg` }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ ...bar, left: size * 0.29, top: size * 0.06, transform: [{ rotate: '-35deg' }] }} />
      <View style={{ ...bar, right: size * 0.29, top: size * 0.06, transform: [{ rotate: '35deg' }] }} />
      <View style={{ ...bar, left: size * 0.42, top: size * 0.3, height: size * 0.64 }} />
    </View>
  );
}

const GPS_COPY: Record<CalibrationChecklist['gps'], string> = {
  acquiring: 'Finding your location',
  weak: 'Location is weak. Step away from tall buildings if you can.',
  ready: 'Location found',
};
const CAMERA_COPY: Record<CalibrationChecklist['camera'], string> = {
  starting: 'Starting the camera',
  limited: 'Move the phone slowly across the street ahead',
  ready: 'Camera tracking',
};
const HEADING_COPY: Record<CalibrationChecklist['heading'], string> = {
  waiting: 'Hold the phone up, facing the street',
  low: 'Direction is uncertain. Keep the phone away from cars and railings.',
  ready: 'Direction set',
};

/** Presents one calibration requirement with a visible readiness indicator. */
function CheckRow({ ready, text }: { ready: boolean; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 10, height: 10, flexShrink: 0, borderRadius: 5, backgroundColor: ready ? GOLD : 'transparent', borderWidth: 2, borderColor: GOLD }} />
      <Line tone={ready ? 'paper' : 'muted'}>{text}</Line>
    </View>
  );
}

/** The camera HUD reads and controls the same trip as the map. */
export function HarlemNavigationArHud({ onBackToMap, onExplorePlace, contentInsets }: HarlemNavigationArHudProps) {
  const controller = getNavigationController();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const paceCheckRef = useRef<ReturnType<typeof createPaceCheckState> | null>(null);
  if (paceCheckRef.current === null) paceCheckRef.current = createPaceCheckState();
  // A ref owns the per-HUD external store; useStore subscribes to its snapshot.
  // eslint-disable-next-line react-hooks/refs
  const paceCheck = useStore(paceCheckRef.current);
  const safeAreaInsets = useSafeAreaInsets();
  const insets = contentInsets ?? safeAreaInsets;
  const location = useNavigationUi((state) => state.location);
  const session = useNavigationStore(selectSession);
  const positioning = useNavigationStore(selectPositioning);
  const arTracking = useNavigationStore(selectArTracking);
  const progress = useNavigationStore(selectProgress);
  const world = useNavAr((s) => s.world);
  const alongM = useNavAr((s) => s.alongM);
  const geospatial = useNavAr((s) => s.geospatial);
  const observations = useNavAr((s) => s.observations);
  // The scene's observation clock samples at 4Hz, including stalled streams.
  // Reading the fix snapshot here avoids a full HUD render per raw sensor event.
  const { match, heading } = navigationFixStore.getState();
  const acknowledged = useNavAr((s) => s.isAwarenessAcknowledged);
  const active = hasActiveTrip(session);

  const presentation = navArPresentation({
    session, positioning, arTracking, placement: world?.target,
    isMatched: match?.kind === 'matched', headingConfidence: heading?.confidence, observations,
  });

  useEffect(() => {
    if (presentation.kind === 'speed-paused' && (session.phase === 'navigatingAR' || session.phase === 'calibratingAR')) controller.pause();
  }, [controller, presentation.kind, session.phase]);

  const arrow = useMemo(() => {
    if (!world || alongM === undefined || !hasActiveTrip(session) ||
      world.frame.routeId !== session.activeRoute.route.id || world.frame.generation !== session.activeRoute.generation) return undefined;
    return navigationArrow({
      bearingDeg: guidanceBearingDeg(world.frame, alongM, chevronStopAlongTrackM(alongM, progress)),
      heading, positioning, isMatched: match?.kind === 'matched', matchTimestampMs: match?.timestampMs, nowMs: observations.nowMs,
    });
  }, [alongM, heading, match, observations.nowMs, positioning, progress, session, world]);

  const cameraFresh = isFreshSample(observations.cameraTimestampMs, observations.nowMs, MAX_CAMERA_AGE_MS);
  const recovery = navigationArRecovery({
    positioning,
    arTracking: arTracking.kind === 'normal' && !cameraFresh ? { kind: 'limited', reason: 'relocalizing' } : arTracking,
    hasDirection: arrow !== undefined || (presentation.kind === 'guidance' && presentation.render === '3d'),
  });
  const destinationName = active ? session.destination.name : 'your destination';
  const placeId = active ? session.destination.placeId : undefined;
  const turnDeg = maneuverTurnDeg(progress?.nextManeuver);
  const guiding = session.phase === 'navigatingAR' || session.phase === 'calibratingAR';
  const movingTooFast = positioning.kind === 'tracking' && positioning.isMovingTooFast;
  const canReroute = guiding && positioning.kind === 'tracking' && positioning.confidence !== 'low' && !movingTooFast;
  const freshProgress = positioning.kind === 'tracking' && positioning.confidence !== 'low' && match?.kind === 'matched' &&
    isFreshSample(match.timestampMs, observations.nowMs, MAX_MATCH_AGE_MS);
  const rerouteFailed = active && session.reroute.kind === 'failed';
  const source = world?.target?.source;
  const alignmentLine = source === 'geospatial'
    ? 'Street-level alignment is approximate.'
    : source === 'compass'
      ? 'Compass alignment is approximate. Check street signs.'
      : geospatial === 'checking' ? 'Checking for street-level alignment.' : 'Aligning the route by compass.';

  return (
    <ScrollView
      className="absolute inset-0"
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1, gap: 16, justifyContent: 'space-between',
        paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16,
        paddingLeft: insets.left + 16, paddingRight: insets.right + 16,
      }}
    >
      <View className="gap-3">
        <Action onPress={onBackToMap}>Back to map</Action>

        {presentation.kind === 'ended' ? (
          <Card announce>
            <Line tone="gold" size={20}>{active ? 'Continue on the map' : 'Navigation has ended'}</Line>
            <Line>{active ? 'AR guidance is unavailable. Your walking route is still on the map.' : 'Return to Explore to choose another destination.'}</Line>
          </Card>
        ) : null}

        {presentation.kind === 'calibrating' ? (
          <Card>
            <Line tone="gold" size={18}>Point your phone at the street ahead</Line>
            <CheckRow ready={presentation.checklist.gps === 'ready'} text={GPS_COPY[presentation.checklist.gps]} />
            <CheckRow ready={presentation.checklist.camera === 'ready'} text={CAMERA_COPY[presentation.checklist.camera]} />
            <CheckRow ready={presentation.checklist.heading === 'ready'} text={HEADING_COPY[presentation.checklist.heading]} />
          </Card>
        ) : null}

        {presentation.kind === 'guidance' && progress && freshProgress && !movingTooFast ? (
          <Card>
            <View className="flex-row items-center gap-3">
              {turnDeg !== undefined ? <Arrow deg={turnDeg} size={36} /> : null}
              <View className="flex-1">
                <Line size={18}>{progress.nextManeuver?.instruction ?? progress.activeStep.maneuver.instruction}</Line>
                <Line tone="gold">{progress.distanceToNextManeuverM < 10 ? 'Now' : `In ${formatDistance(progress.distanceToNextManeuverM)}`}</Line>
              </View>
            </View>
            <Line tone="muted" size={14}>{alignmentLine}</Line>
            {world?.target?.heightReference === 'estimated-eye-height' ? (
              <Line tone="muted" size={14}>Height is estimated. Floating cues do not mark the pavement or an exact entrance.</Line>
            ) : null}
          </Card>
        ) : null}

        {presentation.kind === 'rerouting' ? (
          <Card announce>
            <Line tone="gold" size={18}>Finding a new route</Line>
            <Line>Wait somewhere safe. Directions will return when the new route is ready.</Line>
          </Card>
        ) : null}
        {rerouteFailed ? (
          <Card announce>
            <Line tone="amber" size={18}>Couldn’t update the route</Line>
            <Line>The previous route is still saved. Check the map before continuing, or try the route again.</Line>
            <Action disabled={!canReroute} onPress={() => { controller.reroute(); }}>Retry route</Action>
          </Card>
        ) : null}
      </View>

      <View className="gap-3">
        {guiding && recovery ? (
          <Card announce><Line tone="amber" size={18}>{recovery.title}</Line><Line>{recovery.body}</Line></Card>
        ) : null}
        {presentation.kind === 'guidance' && presentation.render === 'arrow-2d' && arrow ? (
          <Card>
            <View className="items-center gap-3">
              <Arrow deg={arrow.rotationDeg} size={80} />
              <Line>{arrow.instruction}</Line>
              <Line tone="muted" size={14}>AR placement is approximate. Check the street and walk signals before moving.</Line>
            </View>
          </Card>
        ) : null}
        {guiding && !world?.target ? (
          <Card><Line tone="gold" size={18}>Aligning the route</Line><Line>Stand somewhere safe and move the phone slowly. You can keep walking with the map.</Line></Card>
        ) : null}

        {presentation.kind === 'speed-paused' || presentation.kind === 'paused' ? (
          <Card announce>
            <Line tone="gold" size={18}>AR guidance is paused</Line>
            <Line>{presentation.kind === 'speed-paused' ? 'The last speed reading was above walking pace. Lower the phone. AR directions are for walking only.' : 'Resume when you’re ready to keep walking.'}</Line>
            {movingTooFast ? (
              <>
                <Line>Check your walking pace after slowing down. Guidance will stay paused.</Line>
                <Action
                  disabled={paceCheck.checking || !canCheckWalkingPace({ session })}
                  onPress={() => {
                    const state = paceCheckRef.current!;
                    state.setState({ checking: true, message: undefined });
                    const isForeground = () => mounted.current && AppState.currentState === 'active';
                    void checkWalkingPace(isForeground).then((started) => {
                      state.setState({ checking: false });
                      if (isForeground() && useNavigationStore.getState().session === session && !started) {
                        state.setState({ message: 'Couldn’t check your pace. Check location access, try again, or use the map.' });
                      }
                    });
                  }}
                >{paceCheck.checking ? 'Checking walking pace…' : 'Check walking pace'}</Action>
                {location !== 'granted' && location !== 'approximate' ? <Line>If location access or services are off, restore them in Settings, then check your pace again.</Line> : null}
                {paceCheck.message ? <Line tone="amber">{paceCheck.message}</Line> : null}
              </>
            ) : null}
            <Action primary disabled={movingTooFast || session.phase !== 'paused'} onPress={() => { resumeGuidance(); }}>Resume navigation</Action>
          </Card>
        ) : null}

        {presentation.kind === 'arrived' ? (
          <Card announce>
            <Line tone="gold" size={20}>{presentation.confidence === 'confirmed' ? `You’ve arrived at ${destinationName}` : `${destinationName} is nearby`}</Line>
            {presentation.confidence === 'estimated' ? <Line>Check the building and entrance. Your location is approximate.</Line> : null}
            {active && session.destination.entrance?.description ? <Line>{session.destination.entrance.description}</Line> : null}
            {placeId ? <Action primary onPress={() => onExplorePlace(placeId)}>Explore place</Action> : null}
          </Card>
        ) : null}

        {!acknowledged && presentation.kind !== 'arrived' && presentation.kind !== 'ended' ? (
          <Card>
            <Line tone="gold" size={18}>Watch the street, not the screen</Line>
            <Line>Arrows are approximate. Cross only at crosswalks, follow walk signals, and lower the phone when you’re near traffic.</Line>
            <Action primary onPress={() => useNavAr.getState().acknowledgeAwareness()}>I’ll stay aware</Action>
          </Card>
        ) : null}
      </View>

      {active ? (
        <Card>
          {progress && freshProgress && presentation.kind !== 'arrived' ? (
            <>
              <Line>{`${formatDistance(progress.distanceRemainingM)} to ${destinationName}`}</Line>
              <Line tone="muted" size={14}>{`About ${Math.max(1, Math.round(progress.durationRemainingS / 60))} min walking`}</Line>
            </>
          ) : null}
          {guiding ? <Action onPress={() => { controller.pause(); }}>Pause navigation</Action> : null}
          {guiding ? <Action disabled={movingTooFast} onPress={() => useNavAr.getState().requestRecalibration()}>Recalibrate AR</Action> : null}
          {guiding && !rerouteFailed ? <Action disabled={!canReroute} onPress={() => { controller.reroute(); }}>Find a new route</Action> : null}
          <Action onPress={() => { finishArNavigation(); onBackToMap(); }}>End navigation</Action>
        </Card>
      ) : null}
    </ScrollView>
  );
}
