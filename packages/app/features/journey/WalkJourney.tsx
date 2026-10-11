'use client';
import { useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { WalkCommand } from '@acme/widgets';
import { MightsButton, MightsHeading, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { SourcesList } from '../site/content/SourcesList.tsx';
import { navigationFixStore, selectDestination, useNavigationStore } from '../navigation/session/navigationStore.ts';
import { useNavigationUi } from '../navigation/view/navigationUi.store.ts';
import { startGuidance } from '../navigation/view/runtime.ts';
import { formatArrivalClock, formatRouteDistance, formatRouteDuration } from '../navigation/view/format.ts';
import { verifiedArrival } from './cues.ts';
import { commandId } from './controller.ts';
import { liveProgress } from './model.ts';
import { currentJourneyStop, journeyCommand, journeyController, requestJourneyDirections } from './runtime.ts';
import { useJourneyClock } from './useJourneyClock.ts';
import { useJourney } from './useJourney.ts';
import { useJourneyPlatform } from './useJourneyPlatform';

/** One tour surface for phone, web and tablet. Apps contribute only platform actions. */
export function WalkJourney({ slug, platformActions }: { slug: string; platformActions?: ReactNode }) {
  useJourneyPlatform();
  const state = useJourney();
  const navigation = useNavigationStore();
  const fixes = useStore(navigationFixStore);
  const online = useNavigationUi(s => s.online);
  const location = useNavigationUi(s => s.location);
  const [confirmation, setConfirmation] = useState<{ command: WalkCommand; title: string } | null>(null);
  const now = useJourneyClock();
  const controller = journeyController();
  const { session, plan } = state;
  const belongs = plan?.slug === slug;
  const stop = belongs ? currentJourneyStop() : undefined;
  const progress = stop && belongs && session?.status === 'active' ? liveProgress(navigation, fixes, now, online, stop.slug, location) : undefined;
  const matchingRoute = stop && selectDestination(navigation)?.placeId === stop.slug;
  const arrived = stop && session?.status === 'active' && verifiedArrival(navigation, fixes, now, stop.slug, location, online);
  const routeReady = matchingRoute && navigation.session.phase === 'routeReady';
  const routeError = matchingRoute && navigation.routeLoading.kind === 'failed' ? navigation.routeLoading : null;
  const synopsis = belongs && state.synopsis?.stopId === stop?.id ? state.synopsis : null;
  const closed = session?.status === 'completed' || session?.status === 'stopped';
  const confirm = (type: 'stop' | 'confirm-stop') => {
    if (!session) return;
    const base = { schemaVersion: 1 as const, commandId: commandId(), sessionId: session.sessionId, expectedRevision: session.revision, confirmed: true as const };
    setConfirmation({ command: type === 'stop' ? { ...base, type } : { ...base, type, stopId: stop?.id ?? '' },
      title: type === 'stop' ? 'Stop this walk?' : `Confirm your visit to ${stop?.title ?? 'this stop'}?` });
  };
  const confirmationCurrent = confirmation && confirmation.command.sessionId === session?.sessionId && confirmation.command.expectedRevision === session?.revision;

  return <View className="gap-5 border-l-2 border-primary bg-surface-raised p-5" aria-label="Take Me There">
    <MightsHeading level={2} size="card">Take Me There</MightsHeading>
    {!belongs || !session ? <>
      <MightsText>Walk the stops in order. Location is optional; a visit is saved only when you confirm it.</MightsText>
      {session && !closed ? <MightsButton href={routes.walk(plan!.slug)} variant="secondary">Return to {plan!.title}</MightsButton> :
        <MightsButton disabled={state.busy} onPress={() => void controller.begin(slug)}>{state.busy ? 'Checking published stops…' : 'Take Me There'}</MightsButton>}
    </> : <>
      <MightsText tone="default">{session.status === 'completed' ? 'Walk completed' : session.status === 'stopped' ? 'Walk stopped' : session.status === 'paused' ? 'Walk paused' : 'Walk active'} · {session.completedStopIds.length} of {session.stopIds.length} visits confirmed</MightsText>
      <MightsText size="small">{state.mode === 'member' ? 'Saved to your signed-in account.' : state.storageAvailable ? 'Anonymous walk saved only on this device. It is not linked to your account.' : 'Local storage is unavailable. This walk lasts only while the app stays open.'}</MightsText>
      {stop && !closed ? <>
        <MightsHeading level={3} size="card">{stop.title}</MightsHeading>
        {stop.note ? <MightsText>{stop.note}</MightsText> : null}
        {state.contentStatus === 'offline' ? <MightsText>Saved stop synopsis. We couldn’t check the latest content. Reconnect for updated stories and routing.</MightsText> : null}
        {state.contentStatus === 'unpublished' ? <MightsText>This stop is no longer available in the catalogue. We can’t route to it.</MightsText> : null}
        <View className="flex-row flex-wrap gap-3">
          <MightsButton href={routes.explore({ place: stop.slug })} variant="outline">See this stop on the map</MightsButton>
          {session.status === 'active' ? <MightsButton disabled={state.busy} variant="secondary" onPress={() => confirm('confirm-stop')}>Confirm visit</MightsButton> : null}
        </View>
        {arrived ? <MightsText tone="default">Navigation places you at this stop’s map point. Check the surroundings and confirm your visit when ready.</MightsText> : null}
        {progress ? <View role="status" className="gap-1">
          <MightsText tone="default">{progress.nextManeuver?.instruction ?? progress.activeStep.maneuver.instruction}</MightsText>
          <MightsText>{formatRouteDistance(progress.distanceRemainingM)} left · {formatRouteDuration(progress.durationRemainingS)} · estimated arrival {formatArrivalClock(progress.etaMs)}</MightsText>
        </View> : <MightsText size="small">{session.status === 'paused' ? 'Guidance is paused.' : 'Live progress and arrival time need a fresh, precise location matched to this route.'}</MightsText>}
        {location === 'denied' || location === 'disabled' || location === 'unsupported' || location === 'approximate' ? <MightsText size="small">{location === 'denied' ? 'Location access was declined.' : location === 'approximate' ? 'Your location is too approximate for live guidance.' : 'Precise location is unavailable in this build or device state.'} You can keep reading and confirm visits yourself.</MightsText> : null}
        {routeError ? <MightsText>{routeError.reason === 'network' ? 'Routing needs a connection. Saved instructions remain below.' : 'Walking directions are unavailable. Check the map or try again later.'}</MightsText> : null}
        {session.status === 'active' ? <View className="flex-row flex-wrap gap-3">
          <MightsButton disabled={state.busy || state.contentStatus === 'loading' || !state.place || (navigation.session.phase === 'calculatingRoute' || navigation.session.phase === 'rerouting')} onPress={requestJourneyDirections} variant="secondary">{navigation.session.phase === 'calculatingRoute' || navigation.session.phase === 'rerouting' ? 'Finding walking route…' : matchingRoute && 'activeRoute' in navigation.session ? 'Update walking route' : 'Use location for walking directions'}</MightsButton>
          {routeReady ? <MightsButton onPress={() => { if (!startGuidance()) controller.setError('The route changed. Request directions again.'); }}>Start guidance</MightsButton> : null}
        </View> : null}
        <MightsText size="small">Routes end at the sourced map point. No verified entrance or step-free route is on record. Watch traffic and check crossings.</MightsText>
        {synopsis ? <View className="gap-2">
          <MightsHeading level={3} size="card">Saved route synopsis</MightsHeading>
          <MightsText size="small">Calculated {new Date(synopsis.generatedAt).toLocaleString()}. {formatRouteDistance(synopsis.distanceM)}; provider estimate {formatRouteDuration(synopsis.durationS)}. These are saved instructions, not live guidance or proof of arrival.</MightsText>
          {synopsis.instructions.map((instruction, index) => <MightsText key={index} size="small">{index + 1}. {instruction}</MightsText>)}
        </View> : null}
        <View className="gap-3 border-t border-rule-hairline pt-4">
          <MightsHeading level={3} size="card">Story of this block</MightsHeading>
          {state.contentStatus === 'loading' ? <MightsText>Checking published stories…</MightsText> : state.stories.length ? state.stories.map(story => <View key={story.id} className="gap-2">
            <MightsHeading level={3} size="card">{story.title}</MightsHeading>
            <MightsText>{story.dek ?? story.body.split('\n\n')[0]}</MightsText>
            <MightsText size="small">By {story.author}. Updated {story.updatedAt.slice(0, 10)}.</MightsText>
            <SourcesList sources={story.sources} />
            <MightsButton href={routes.story(story.slug)} variant="outline">Read the full story</MightsButton>
          </View>) : <MightsText>No published, sourced story is available here. The walk’s stop notes remain readable without AR.</MightsText>}
          {platformActions}
          <MightsText size="small">Reading works without camera access, motion, notifications or AR. No licensed story audio is published in this experience.</MightsText>
        </View>
      </> : null}
      {!closed ? <View className="flex-row flex-wrap gap-3">
        <MightsButton disabled={state.busy} variant="secondary" onPress={() => void journeyCommand(session.status === 'paused' ? 'resume' : 'pause')}>{session.status === 'paused' ? 'Resume walk' : 'Pause walk'}</MightsButton>
        <MightsButton disabled={state.busy} variant="outline" onPress={() => confirm('stop')}>Stop walk</MightsButton>
      </View> : <MightsButton onPress={() => controller.clear()} variant="outline">Dismiss finished walk</MightsButton>}
      <MightsButton pressed={state.hapticsEnabled} variant="outline" onPress={() => controller.setHapticsEnabled(!state.hapticsEnabled)}>{state.hapticsEnabled ? 'Turn walk haptics off' : 'Turn walk haptics on'}</MightsButton>
      <MightsButton disabled={state.contentStatus === 'loading'} variant="outline" onPress={() => void controller.refresh()}>Refresh stop and sources</MightsButton>
    </>}
    {confirmation ? <View role="alert" className="gap-3 border-t border-rule-hairline pt-4">
      <MightsHeading level={3} size="card">{confirmation.title}</MightsHeading>
      <MightsText>{!confirmationCurrent ? 'The walk changed. Cancel and review the current stop before confirming.' : confirmation.command.type === 'stop' ? 'This ends guidance and the watch handoff. Confirmed visits are kept in the session.' : 'Confirm only if you visited this stop. This does not claim GPS-verified arrival.'}</MightsText>
      <View className="flex-row flex-wrap gap-3">
        <MightsButton disabled={!confirmationCurrent || state.busy} onPress={() => { const pending = confirmation.command; setConfirmation(null); void controller.dispatch(pending); }}>Confirm</MightsButton>
        <MightsButton variant="outline" onPress={() => setConfirmation(null)}>Cancel</MightsButton>
      </View>
    </View> : null}
    {state.error ? <View role="alert"><MightsText>{state.error}</MightsText></View> : null}
  </View>;
}
