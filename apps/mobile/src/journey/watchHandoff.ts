import { AppState } from 'react-native';
import { journeyController, currentJourneyStop } from '@acme/app/features/journey/runtime.ts';
import { liveProgress } from '@acme/app/features/journey/model.ts';
import { navigationFixStore, useNavigationStore } from '@acme/app/features/navigation/session/navigationStore.ts';
import { useNavigationUi } from '@acme/app/features/navigation/view/navigationUi.store.ts';
import { validateWalkCommand } from '@acme/widgets';
import { watchTransport } from '../../modules/walk-companion';

interface HandoffState { enabled: boolean; busy: boolean; message: string }
let state: HandoffState = { enabled: false, busy: false, message: 'Paired-watch guidance is optional. No independent watch login or background guidance is available.' };
let handoff: { id: string; sessionId: string } | null = null;
let generation = 0;
let nativeQueue: Promise<unknown> = Promise.resolve();
const nativeCall = <T,>(call: () => Promise<T>): Promise<T> => {
  const next = nativeQueue.then(call, call); nativeQueue = next.catch(() => {}); return next;
};
const listeners = new Set<() => void>();
const update = (patch: Partial<HandoffState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
export const watchHandoffState = { getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };

export async function stopWatchHandoff(message = 'Watch handoff ended. Keep reading on your phone or opt in again.') {
  generation++; handoff = null; update({ enabled: false, busy: false, message });
  try { await nativeCall(() => watchTransport.clear()); } catch { /* The native/watch expiry also clears stale state. */ }
}
let publishing = false;
let republish = false;
async function publish() {
  if (!handoff || AppState.currentState !== 'active') return;
  if (publishing) { republish = true; return; }
  const current = handoff;
  const journey = journeyController().getSnapshot();
  const session = journey.session;
  if (!session || current.sessionId !== session.sessionId) { await stopWatchHandoff(); return; }
  const stop = currentJourneyStop();
  const now = Date.now();
  const ui = useNavigationUi.getState();
  const progress = stop && session.status === 'active' ? liveProgress(useNavigationStore.getState(), navigationFixStore.getState(), now, ui.online, stop.slug, ui.location) : undefined;
  publishing = true;
  try {
    await nativeCall(async () => {
      if (handoff?.id !== current.id || AppState.currentState !== 'active') return;
      await watchTransport.publish({ schemaVersion: 1, handoffId: current.id, sessionId: session.sessionId, revision: session.revision,
      status: session.status, walkTitle: session.walkTitle.slice(0, 160), nextStopId: stop?.id ?? null, nextStopTitle: stop?.title.slice(0, 160) ?? null,
      completedCount: session.completedStopIds.length, totalStops: session.stopIds.length,
      updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30_000).toISOString(),
      routeState: progress ? 'ready' : journey.synopsis ? 'offline' : 'unavailable',
      instruction: progress ? (progress.nextManeuver?.instruction ?? progress.activeStep.maneuver.instruction).slice(0, 500) : null,
      hapticsEnabled: journey.hapticsEnabled,
      });
    });
    if (handoff?.id === current.id && (session.status === 'stopped' || session.status === 'completed')) await stopWatchHandoff('The walk ended. Watch handoff is closed.');
  } catch { if (handoff?.id === current.id) await stopWatchHandoff('The paired watch disconnected. Reopen both apps and hand off again.'); }
  finally { publishing = false; if (republish) { republish = false; void publish(); } }
}
export async function startWatchHandoff() {
  if (state.busy || handoff) return;
  const session = journeyController().getSnapshot().session;
  if (!session || !['active', 'paused'].includes(session.status)) return;
  const epoch = ++generation;
  update({ busy: true });
  try {
    const status = await nativeCall(() => watchTransport.getStatus());
    if (epoch !== generation || AppState.currentState !== 'active') return;
    if (!status.available || !status.reachable) { update({ busy: false, message: status.available ? 'Open Harlem Might on your paired watch and try again.' : 'Paired-watch support is not available in this build.' }); return; }
    const id = await nativeCall(() => watchTransport.createHandoffId());
    if (epoch !== generation || AppState.currentState !== 'active' || journeyController().getSnapshot().session?.sessionId !== session.sessionId) { if (epoch === generation) update({ busy: false }); return; }
    handoff = { id, sessionId: session.sessionId };
    update({ enabled: true, busy: false, message: 'Sharing this walk with your paired watch while both apps stay open.' });
    await publish();
  } catch { if (epoch === generation) update({ busy: false, message: 'Could not connect to the paired watch. Your phone walk is unchanged.' }); }
}
export function mountWatchCompanion() {
  const command = watchTransport.addCommandListener(async value => {
    const current = handoff;
    const session = journeyController().getSnapshot().session;
    if (AppState.currentState !== 'active' || !current || !session || value.handoffId !== current.id || value.sessionId !== current.sessionId || value.expectedRevision !== session.revision) { void publish(); return; }
    const { handoffId: _id, ...request } = value;
    try { validateWalkCommand(request); await journeyController().dispatch(request); }
    catch { /* Strict shared validation rejects malformed commands before any mutation. */ }
    void publish();
  });
  const journey = journeyController().subscribe(() => { void publish(); });
  const navigation = useNavigationStore.subscribe(() => { void publish(); });
  // Foreground expiry/freshness only; no background task, notification or haptic loop.
  const timer = setInterval(() => { if (handoff) void publish(); }, 10_000);
  return () => { command.remove(); journey(); navigation(); clearInterval(timer); };
}
