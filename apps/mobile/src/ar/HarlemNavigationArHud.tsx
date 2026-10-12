import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { palette } from '@acme/theme';
import { formatDistance } from '@acme/app/features/explore/explore.store.ts';
import { hasActiveTrip } from '@acme/app/features/navigation/model/session.ts';
import { resumeGuidance } from '@acme/app/features/navigation/view/runtime.ts';
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
  maneuverTurnDeg,
  navArPresentation,
  isCurrentNavFrame,
  isFreshSample,
  MAX_CAMERA_AGE_MS,
  MAX_MATCH_AGE_MS,
  type CalibrationChecklist,
} from './navAr';
import { useNavAr } from './navAr.store';
import { navigationArrow, navigationArRecovery } from './navArRecovery';
import { getNavigationController } from './navigationRuntime';
import { finishArNavigation } from './navigationArVisit';

const GOLD = palette.mights.gold;
const PAPER = palette.mights.paper;
const LIMESTONE = palette.mights.limestone;
const AMBER = palette.mights['sodium-amber'];
/** Warm black at 88%, so camera content stays faintly visible behind cards. */
const CARD = 'rgba(11, 9, 6, 0.88)';

export interface HarlemNavigationArHudProps {
  /** Only safe areas and overlay space not already consumed by the containing shell. */
  readonly contentInsets?: Readonly<EdgeInsets>;
  /** Leaves AR and returns to the map. The navigation session keeps running. */
  readonly onBackToMap: () => void;
  /** After arrival: open the destination's place page. */
  readonly onExplorePlace: (placeId: string | undefined) => void;
}

/** Opaque-enough backing keeps guidance readable over a changing camera image. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }}>
      {children}
    </View>
  );
}

/** Shared high-contrast guidance text using the existing semantic palette. */
function Line({ children, tone = 'paper', size = 16 }: { children: React.ReactNode; tone?: 'paper' | 'gold' | 'muted' | 'amber'; size?: number }) {
  const color = tone === 'gold' ? GOLD : tone === 'amber' ? AMBER : tone === 'muted' ? LIMESTONE : PAPER;
  return <Text style={{ color, fontSize: size, lineHeight: Math.round(size * 1.3) }}>{children}</Text>;
}

/** A gold chevron-arrow drawn with views, rotated clockwise by `deg`. */
function Arrow({ deg, size }: { deg: number; size: number }) {
  const bar = { position: 'absolute' as const, width: size * 0.16, height: size * 0.62, backgroundColor: GOLD, borderRadius: size * 0.08 };
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: `${deg}deg` }] }} accessibilityElementsHidden>
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
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ready ? GOLD : 'transparent', borderWidth: 2, borderColor: GOLD }}
      />
      <Line tone={ready ? 'paper' : 'muted'}>{text}</Line>
    </View>
  );
}

/**
 * The 2D layer over the AR camera: calibration checklist, next-turn card,
 * low-confidence arrow, progress, safety states and arrival. Reads the shared
 * navigation session; the only commands it sends are the controller's
 * pause/resume/exit/cancel.
 */
export function HarlemNavigationArHud({ onBackToMap, onExplorePlace, contentInsets }: HarlemNavigationArHudProps) {
  const rootInsets = useSafeAreaInsets();
  const insets = contentInsets ?? rootInsets;
  const controller = getNavigationController();
  const session = useNavigationStore(selectSession);
  const positioning = useNavigationStore(selectPositioning);
  const arTracking = useNavigationStore(selectArTracking);
  const progress = useNavigationStore(selectProgress);
  const match = useStore(navigationFixStore, (s) => s.match);
  const heading = useStore(navigationFixStore, (s) => s.heading);
  const world = useNavAr((s) => s.world);
  const observations = useNavAr((s) => s.observations);
  const alongM = useNavAr((s) => s.alongM);
  const geospatial = useNavAr((s) => s.geospatial);
  const acknowledged = useNavAr((s) => s.isAwarenessAcknowledged);

  const frameCurrent = isCurrentNavFrame(world?.frame, hasActiveTrip(session) ? session.activeRoute : undefined);
  const presentation = navArPresentation({
    session,
    positioning,
    arTracking,
    placement: frameCurrent ? world?.target : undefined,
    isMatched: frameCurrent && match?.kind === 'matched',
    headingConfidence: heading?.confidence,
    observations,
  });

  // Driving-speed guard: pause guidance; the person resumes when walking again.
  useEffect(() => {
    if (presentation.kind === 'speed-paused' && (session.phase === 'navigatingAR' || session.phase === 'calibratingAR')) {
      controller.pause();
    }
  }, [controller, presentation.kind, session.phase]);

  const arrow = useMemo(() => {
    if (!world || !frameCurrent || alongM === undefined) return undefined;
    return navigationArrow({
      bearingDeg: guidanceBearingDeg(world.frame, alongM, chevronStopAlongTrackM(alongM, progress)),
      heading,
      positioning,
      isMatched: match?.kind === 'matched',
      matchTimestampMs: match?.timestampMs,
      nowMs: observations.nowMs,
    });
  }, [alongM, frameCurrent, heading, match, observations.nowMs, positioning, progress, world]);
  const cameraFresh = isFreshSample(observations.cameraTimestampMs, observations.nowMs, MAX_CAMERA_AGE_MS);
  const recovery = navigationArRecovery({
    positioning,
    arTracking: arTracking.kind === 'normal' && !cameraFresh ? { kind: 'limited', reason: 'relocalizing' } : arTracking,
    hasDirection: arrow !== undefined,
  });
  const freshProgress = frameCurrent && positioning.kind === 'tracking' && positioning.confidence !== 'low' &&
    match?.kind === 'matched' && isFreshSample(match.timestampMs, observations.nowMs, MAX_MATCH_AGE_MS);

  const source = frameCurrent ? world?.target?.source : undefined;
  const alignmentLine =
    source === 'geospatial'
      ? 'Street-level alignment is approximate. Height is estimated.'
      : source === 'compass'
        ? 'Compass alignment is approximate. Height is estimated.'
        : geospatial === 'checking'
          ? 'Checking alignment. Use the map while it settles.'
          : 'Aligning by compass. Use the map while it settles.';

  const destinationName = hasActiveTrip(session) ? session.destination.name : undefined;
  const placeId = hasActiveTrip(session) ? session.destination.placeId : undefined;
  const turnDeg = maneuverTurnDeg(progress?.nextManeuver);

  return (
    <View pointerEvents="box-none" className="absolute inset-0 justify-between" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
      {/* Top: what to do next. */}
      <View pointerEvents="box-none" className="gap-3">
        {presentation.kind === 'calibrating' ? (
          <Card>
            <Line tone="gold" size={18}>Point your phone at the street ahead</Line>
            <CheckRow ready={presentation.checklist.gps === 'ready'} text={GPS_COPY[presentation.checklist.gps]} />
            <CheckRow ready={presentation.checklist.camera === 'ready'} text={CAMERA_COPY[presentation.checklist.camera]} />
            <CheckRow ready={presentation.checklist.heading === 'ready'} text={HEADING_COPY[presentation.checklist.heading]} />
            <Line tone="muted" size={13}>{alignmentLine}</Line>
          </Card>
        ) : null}

        {(presentation.kind === 'guidance' || presentation.kind === 'rerouting') && progress && freshProgress ? (
          <Card>
            <View className="flex-row items-center gap-3">
              {turnDeg !== undefined ? <Arrow deg={turnDeg} size={36} /> : null}
              <View className="flex-1">
                <Line size={18}>{progress.nextManeuver?.instruction ?? progress.activeStep.maneuver.instruction}</Line>
                <Line tone="gold" size={15}>
                  {progress.distanceToNextManeuverM < 10 ? 'Now' : `In ${formatDistance(progress.distanceToNextManeuverM)}`}
                </Line>
              </View>
            </View>
            {presentation.kind === 'rerouting' ? <Line tone="amber" size={14}>Finding a new route from here</Line> : null}
            {presentation.kind === 'guidance' && presentation.confidence !== 'high' ? (
              <Line tone="muted" size={13}>{alignmentLine}</Line>
            ) : null}
          </Card>
        ) : null}
      </View>

      {/* Middle: low-confidence arrow and blocking states. */}
      <View pointerEvents="box-none" className="items-center gap-3">
        {presentation.kind === 'guidance' && presentation.render === 'arrow-2d' ? (
          <Card>
            <View className="items-center gap-2">
              {arrow ? <Arrow deg={arrow.rotationDeg} size={96} /> : null}
              <Line size={16}>{arrow?.instruction ?? recovery?.title ?? 'Direction is uncertain'}</Line>
              <Line tone="muted" size={14}>
                {arrow
                  ? 'Direction is approximate. Check street signs and the map before continuing.'
                  : recovery?.body ?? 'No directional arrow is available. Stop somewhere safe and check the map.'}
              </Line>
            </View>
          </Card>
        ) : null}

        {presentation.kind === 'speed-paused' || presentation.kind === 'paused' ? (
          <Card>
            <Line tone="gold" size={18}>AR guidance is paused</Line>
            <Line>
              {presentation.kind === 'speed-paused'
                ? 'You’re moving faster than walking pace. AR directions are for walking only.'
                : 'Resume when you’re ready to keep walking.'}
            </Line>
            <View className="flex-row gap-3">
              <MightsButton variant="primary" disabled={presentation.kind === 'speed-paused'} onPress={() => { resumeGuidance(); }}>
                Resume
              </MightsButton>
              <MightsButton variant="ghost" onPress={onBackToMap}>
                Back to map
              </MightsButton>
            </View>
          </Card>
        ) : null}

        {presentation.kind === 'arrived' ? (
          <Card>
            <Line tone="gold" size={20}>
              {presentation.confidence === 'confirmed' ? `You’ve arrived at ${destinationName}` : `${destinationName} is nearby`}
            </Line>
            {hasActiveTrip(session) && session.destination.entrance?.description ? (
              <Line>{session.destination.entrance.description}</Line>
            ) : null}
            <View className="flex-row gap-3">
              <MightsButton variant="primary" onPress={() => onExplorePlace(placeId)}>
                Explore place
              </MightsButton>
              <MightsButton
                variant="ghost"
                onPress={() => {
                  // Cancel the shared trip, then close the AR route. Otherwise this
                  // same screen silently reopens the unrelated tabletop scene.
                  finishArNavigation();
                  onBackToMap();
                }}
              >
                End navigation
              </MightsButton>
            </View>
          </Card>
        ) : null}

        {!acknowledged && presentation.kind !== 'arrived' ? (
          <Card>
            <Line tone="gold" size={18}>Watch the street, not the screen</Line>
            <Line>
              Arrows are approximate. Cross only at crosswalks, follow walk signals, and lower the phone when you’re near traffic.
            </Line>
            <MightsButton variant="primary" onPress={() => useNavAr.getState().acknowledgeAwareness()}>
              I’ll stay aware
            </MightsButton>
          </Card>
        ) : null}
      </View>

      {/* Bottom: progress and the way out. */}
      <View className="flex-row items-center gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: CARD }}>
        <View className="flex-1">
          {progress && freshProgress ? (
            <>
              <Line size={16}>{`${formatDistance(progress.distanceRemainingM)} to ${destinationName ?? 'destination'}`}</Line>
              <Line tone="muted" size={13}>{`About ${Math.max(1, Math.round(progress.durationRemainingS / 60))} min walking`}</Line>
            </>
          ) : (
            <Line tone="muted" size={14}>{positioning.kind === 'lost' ? 'Location lost. Hold on while it comes back.' : 'Waiting for your position on the route'}</Line>
          )}
        </View>
        <MightsButton variant="secondary" size="sm" onPress={onBackToMap}>
          Back to map
        </MightsButton>
      </View>
    </View>
  );
}
