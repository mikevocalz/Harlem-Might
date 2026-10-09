'use client';

// Structure references (layout only), pulled from Mobbin on 2026-10-08:
// - Garmin Connect, map with recenter/route controls stacked over a bottom
//   summary sheet: https://mobbin.com/screens/99a39061-4602-48dc-b819-65fad11f3b59
// - Oura outdoor walk, a quiet "GPS acquired" status chip above the main
//   action: https://mobbin.com/screens/d67ae2a3-9b80-4a75-83ff-d9de9dd252e2

import { MotionView, transitionFor, useReducedMotion } from '@acme/ui';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { useExploreType } from '../../explore/explore-type';
import type { HudNotice } from '../view/hudView';
import { useNavigationUi } from '../view/navigationUi.store';
import { endNavigation, navigationController } from '../view/runtime';
import { useHudView } from './hooks';
import { ManeuverIcon } from './ManeuverIcon';

export interface NavigationHudProps {
  /** Opens the full step list. Pass where the list is not already beside the map (phones). */
  onShowSteps?: () => void;
  /** Puts the camera back on the position. Pass only for a map with a camera to move. */
  onRecenter?: () => void;
  /** Arrival's "Place details": the host ends the trip and opens the place. */
  onShowPlace: (placeId: string) => void;
  /** Arrival's "Save". Omit where saving is not built (the site). */
  onSave?: (placeId: string) => void;
  /** Whether the destination is already saved, so Save reads as a toggle. */
  isSaved?: boolean;
  /** Room taken by other chrome over the map, in dp. */
  insets?: { top: number; right: number; bottom: number; left: number };
}

const ENTER = { type: 'timing', duration: 200 } as const;

/**
 * The guidance HUD drawn over the map: the next maneuver with distance to
 * it and the street being walked, then notices (safety first), then the
 * remaining time and distance with Steps, Recenter, Pause and End. On
 * arrival it becomes the arrival card.
 *
 * Reads the shared session and progress only. The per-fix store (position,
 * heading) is drawn by the map's puck, so a GPS fix never re-renders the HUD.
 */
export function NavigationHud({ onShowSteps, onRecenter, onShowPlace, onSave, isSaved, insets }: NavigationHudProps) {
  const type = useExploreType();
  const view = useHudView();
  const followUser = useNavigationUi((s) => s.followUser);
  const reduceMotion = useReducedMotion();
  const pad = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };

  if (view.kind === 'hidden') return null;

  const edge = { left: pad.left + 12, right: pad.right + 12 };

  if (view.kind === 'arrived') {
    const { arrival } = view;
    return (
      <View pointerEvents="box-none" className="absolute inset-0">
        <MotionView
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionFor(reduceMotion, ENTER)}
          className="absolute bg-primary pt-rail"
          style={{ ...edge, bottom: pad.bottom + 12 }}
        >
          <View role="alert" className={'bg-surface-raised p-4 ' + type.stackGap}>
            <Text className={type.title + ' font-sans-semibold text-text'}>{arrival.title}</Text>
            <Text className={type.body + ' font-sans text-text-muted'}>{arrival.body}</Text>
            <View className={'flex-row flex-wrap ' + type.inlineGap}>
              {arrival.placeId ? (
                <MightsButton size={type.buttons.primary} onPress={() => onShowPlace(arrival.placeId!)}>
                  Place details
                </MightsButton>
              ) : null}
              {arrival.placeId && onSave ? (
                <MightsButton
                  size={type.buttons.control}
                  variant="secondary"
                  pressed={isSaved}
                  onPress={() => onSave(arrival.placeId!)}
                >
                  {isSaved ? 'Saved' : 'Save'}
                </MightsButton>
              ) : null}
              <MightsButton size={type.buttons.control} variant="outline" onPress={endNavigation}>
                End
              </MightsButton>
            </View>
          </View>
        </MotionView>
      </View>
    );
  }

  const { maneuver, remaining, notices, statusText } = view;
  const paused = view.kind === 'paused';

  return (
    <View pointerEvents="box-none" className="absolute inset-0">
      <View pointerEvents="box-none" className="absolute gap-2" style={{ ...edge, top: pad.top + 12 }}>
        <MotionView
          key={`${view.generation}:${maneuver.instruction}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionFor(reduceMotion, ENTER)}
          className="bg-primary pl-rail"
        >
          <View accessible aria-label={maneuver.accessibilityLabel} className="flex-row items-center gap-3 bg-surface-raised p-3">
            <ManeuverIcon glyph={maneuver.glyph} size="hud" />
            <View className="min-w-0 flex-1 gap-0.5">
              {maneuver.distanceText ? (
                <Text className={type.title + ' font-sans-bold text-primary'}>{maneuver.distanceText}</Text>
              ) : null}
              <Text numberOfLines={2} className={type.body + ' font-sans-semibold text-text'}>
                {maneuver.instruction}
              </Text>
              <Text numberOfLines={1} className={type.caption + ' font-sans text-text-muted'}>
                On {maneuver.street}
              </Text>
            </View>
          </View>
        </MotionView>

        {statusText ? (
          <Text role="status" aria-live="polite" className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans-semibold text-text'}>
            {statusText}
          </Text>
        ) : null}
        {notices.map((notice) => (
          <Notice key={notice.id} notice={notice} />
        ))}
      </View>

      <View
        className="absolute flex-row flex-wrap items-center justify-between gap-3 border-t-2 border-primary bg-surface-raised p-3"
        style={{ ...edge, bottom: pad.bottom + 12 }}
      >
        <View accessible aria-label={`Left to go: ${remaining.accessibilityLabel}`} className="min-w-0 shrink gap-0.5">
          <Text className={type.title + ' font-sans-bold text-text'}>{remaining.durationText}</Text>
          <Text className={type.caption + ' font-sans text-text-muted'}>
            {remaining.distanceText}, arrive {remaining.etaText}
          </Text>
        </View>
        <View className={'flex-row flex-wrap ' + type.inlineGap}>
          {onRecenter && !followUser ? (
            <MightsButton size={type.buttons.control} variant="outline" onPress={onRecenter} aria-label="Recenter the map on your position">
              Recenter
            </MightsButton>
          ) : null}
          {onShowSteps ? (
            <MightsButton size={type.buttons.control} variant="outline" onPress={onShowSteps}>
              Steps
            </MightsButton>
          ) : null}
          <MightsButton
            size={type.buttons.control}
            variant="outline"
            onPress={() => (paused ? navigationController().resume() : navigationController().pause())}
            aria-label={paused ? 'Resume guidance' : 'Pause guidance'}
          >
            {paused ? 'Resume' : 'Pause'}
          </MightsButton>
          <MightsButton size={type.buttons.primary} variant="secondary" onPress={endNavigation} aria-label="End the trip">
            End
          </MightsButton>
        </View>
      </View>
    </View>
  );
}

function Notice({ notice }: { notice: HudNotice }) {
  const type = useExploreType();
  const acknowledge = useNavigationUi((s) => s.acknowledgeAwareness);
  const warning = notice.tone === 'warning';
  return (
    <View
      role={warning ? 'alert' : 'status'}
      className={'flex-row items-center gap-3 border-l-2 bg-surface-raised py-2 pl-3 pr-2 ' + (warning ? 'border-primary' : 'border-rule-rail')}
    >
      <Text className={type.caption + ' min-w-0 flex-1 font-sans ' + (warning ? 'font-sans-semibold text-text' : 'text-text')}>
        {notice.text}
      </Text>
      {notice.dismissible ? (
        <MightsButton size={type.buttons.control} variant="ghost" onPress={acknowledge} aria-label="Dismiss the safety reminder">
          OK
        </MightsButton>
      ) : null}
    </View>
  );
}
