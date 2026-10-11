import { applyWalkCommand, validateWalkSession, type WalkCommand, type WalkSession } from '@acme/widgets';
import type { ContentReaders } from '../../content/readers.ts';
import type { PlaceRecord, StoryRecord } from '../../content/records.ts';
import { planFromWalk, storiesForStop, type JourneyPlan, type RouteSynopsis } from './model.ts';

export interface JourneyStorage { getString(key: string): string | undefined; set(key: string, value: string): void; remove(key: string): void }
export interface JourneyTransport {
  /** Checks an actual login. An unavailable auth service must not silently become anonymous. */
  identity(): Promise<'local' | 'member'>;
  send(command: WalkCommand): Promise<WalkSession>;
  verifyIdentity?(): Promise<void>;
  /** Revoke all identity lookups and commands from an earlier controller lifetime. */
  invalidateIdentity?(): void;
  /** True only for the owner verified in this transport lifetime, never a pending lookup. */
  matchesIdentity?(owner: string): boolean;
}
export class JourneyIdentityChanged extends Error {
  constructor() { super('Your login changed or expired. The previous walk has been cleared from this device.'); }
}
export class JourneyConflict extends Error {
  readonly session: WalkSession;
  constructor(session: WalkSession) { super('The walk changed on another device. Review the current stop before trying again.'); this.session = session; }
}
export interface JourneyState {
  plan: JourneyPlan | null;
  session: WalkSession | null;
  mode: 'local' | 'member' | null;
  busy: boolean;
  error: string | null;
  storageAvailable: boolean;
  hapticsEnabled: boolean;
  place: PlaceRecord | null;
  stories: readonly StoryRecord[];
  contentStatus: 'idle' | 'loading' | 'ready' | 'offline' | 'unpublished';
  synopsis: RouteSynopsis | null;
}
const EMPTY: JourneyState = { plan: null, session: null, mode: null, busy: false, error: null, storageAvailable: true, hapticsEnabled: true, place: null, stories: [], contentStatus: 'idle', synopsis: null };
const CACHE_KEY = 'anonymous-walk-v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Session ids are correlation ids, never bearer credentials. A watch handoff uses a native random epoch instead. */
export function commandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function readLocalJourney(raw: string | undefined, now = Date.now()): Pick<JourneyState, 'plan' | 'session' | 'synopsis'> | undefined {
  if (!raw || raw.length > 100_000) return undefined;
  try {
    const data = JSON.parse(raw);
    validateWalkSession(data.session);
    const plan = data.plan as JourneyPlan;
    if (data.schemaVersion !== 1 || !plan || plan.id !== data.session.walkId || plan.slug !== data.session.walkSlug ||
        typeof plan.title !== 'string' || plan.title.length > 300 || !Array.isArray(plan.stops) || plan.stops.length !== data.session.stopIds.length ||
        plan.stops.some((stop, i) => typeof stop.title !== 'string' || typeof stop.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stop.slug) || stop.title.length > 300 || stop.id !== data.session.stopIds[i]) ||
        now - Date.parse(data.savedAt) < 0 || now - Date.parse(data.savedAt) > CACHE_MAX_AGE_MS || !Number.isFinite(Date.parse(data.savedAt))) return undefined;
    const cached = data.synopsis;
    const synopsis = cached && cached.schemaVersion === 1 && typeof cached.stopId === 'string' && plan.stops.some(stop => stop.id === cached.stopId) &&
      Number.isFinite(cached.distanceM) && cached.distanceM >= 0 && Number.isFinite(cached.durationS) && cached.durationS >= 0 &&
      Number.isFinite(Date.parse(cached.generatedAt)) && Array.isArray(cached.instructions) && cached.instructions.length <= 200 &&
      cached.instructions.every((line: unknown) => typeof line === 'string' && line.length < 2000) ? { schemaVersion: 1 as const, stopId: cached.stopId as string, generatedAt: cached.generatedAt as string, distanceM: cached.distanceM as number, durationS: cached.durationS as number, instructions: cached.instructions as string[] } : null;
    // Project the cache, rather than hydrating arbitrary saved fields into runtime state.
    return { plan: { id: plan.id, slug: plan.slug, title: plan.title, updatedAt: plan.updatedAt, stops: plan.stops.map(stop => ({ id: stop.id, slug: stop.slug, title: stop.title, ...(typeof stop.note === 'string' ? { note: stop.note } : {}) })) }, session: data.session, synopsis };
  } catch { return undefined; }
}

/** Owns tour confirmation, not GPS/navigation. A single navigation controller remains authoritative for every route. */
export function createJourneyController(options: {
  readers: Pick<ContentReaders, 'getWalk' | 'getPlace' | 'listStories'>;
  storage: JourneyStorage;
  transport?: JourneyTransport;
  onTransition?: (previous: WalkSession | null, next: WalkSession, command: WalkCommand) => void;
  onClear?: () => void;
}) {
  let state: JourneyState = EMPTY;
  let epoch = 0;
  let contentEpoch = 0;
  let hydrated = false;
  let starting = false;
  let startAttempt: { slug: string; command: Extract<WalkCommand, { type: 'start' }> } | undefined;
  const listeners = new Set<() => void>();
  const receipts = new Map<string, string>();
  const update = (patch: Partial<JourneyState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const clear = (error: string | null = null) => {
    epoch++; contentEpoch++; starting = false; startAttempt = undefined; receipts.clear();
    options.transport?.invalidateIdentity?.();
    options.onClear?.();
    try { options.storage.remove(CACHE_KEY); } catch { /* No further writes after clear. */ }
    update({ ...EMPTY, hapticsEnabled: state.hapticsEnabled, error });
  };
  const persist = () => {
    if (state.mode !== 'local' || !state.session || !state.plan) return;
    try {
      options.storage.set(CACHE_KEY, JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), plan: state.plan, session: state.session, synopsis: state.synopsis }));
    } catch { update({ storageAvailable: false }); }
  };
  const loadStop = async () => {
    const session = state.session;
    const stop = state.plan?.stops[session?.completedStopIds.length ?? 0];
    if (!stop || !session) { update({ place: null, stories: [], contentStatus: 'idle' }); return; }
    const version = ++contentEpoch;
    update({ place: null, stories: [], contentStatus: 'loading' });
    const [place, stories] = await Promise.all([options.readers.getPlace(stop.slug), options.readers.listStories()]);
    if (version !== contentEpoch || state.session?.sessionId !== session.sessionId) return;
    update({ place: place.status === 'ok' ? place.data : null,
      stories: stories.status === 'ok' ? storiesForStop(stories.data, stop.id) : [],
      contentStatus: place.status === 'not-found' ? 'unpublished' : place.status !== 'ok' || stories.status !== 'ok' ? 'offline' : 'ready' });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate() {
      if (hydrated) return;
      hydrated = true;
      try {
        update({ hapticsEnabled: options.storage.getString('walk-haptics') !== 'off' });
        const cached = readLocalJourney(options.storage.getString(CACHE_KEY));
        if (cached) { update({ ...cached, mode: 'local', contentStatus: 'offline' }); void loadStop(); }
        else options.storage.remove(CACHE_KEY);
      } catch { update({ storageAvailable: false }); }
    },
    async begin(slug: string) {
      if (state.busy) return;
      if (state.session && ['active', 'paused'].includes(state.session.status)) {
        if (state.plan?.slug !== slug) update({ error: 'Finish or stop your current walk before starting another.' });
        return;
      }
      starting = true;
      const version = ++epoch;
      update({ busy: true, error: null });
      try {
        const result = await options.readers.getWalk(slug);
        if (result.status !== 'ok') throw new Error(result.status === 'not-found' ? 'This walk is no longer published.' : 'Connect to check the published stops before starting a new walk.');
        if (version !== epoch) return;
        const plan = planFromWalk(result.data);
        const mode = await options.transport?.identity() ?? 'local';
        if (version !== epoch) return;
        if (!startAttempt || startAttempt.slug !== slug || startAttempt.command.walkId !== plan.id) startAttempt = { slug, command: { schemaVersion: 1, commandId: commandId(), sessionId: commandId(), expectedRevision: null, type: 'start', walkId: plan.id } };
        const command = startAttempt.command;
        const summary = { id: plan.id, slug: plan.slug, title: plan.title, stopIds: plan.stops.map(stop => stop.id), published: true, sourceUrl: result.data.sources.find(source => source.url)?.url ?? '' };
        const session = mode === 'member' ? await options.transport!.send(command) : applyWalkCommand(null, command, new Date().toISOString(), summary);
        if (version !== epoch) return;
        if (session.walkId !== plan.id || session.walkSlug !== plan.slug || session.walkTitle !== plan.title || session.stopIds.join('|') !== plan.stops.map(stop => stop.id).join('|')) {
          startAttempt = undefined;
          throw new Error('The published walk changed. Refresh it before starting again.');
        }
        starting = false;
        update({ plan, session, mode, busy: false, synopsis: null });
        startAttempt = undefined; receipts.clear(); persist(); options.onTransition?.(null, session, command);
        void loadStop();
      } catch (error) {
        if (version !== epoch) return;
        starting = false;
        if (error instanceof JourneyIdentityChanged) clear(error.message);
        else update({ busy: false, error: error instanceof Error ? error.message : 'Could not start this walk.' });
      }
    },
    async dispatch(command: WalkCommand) {
      if (!state.session || state.busy) return false;
      const fingerprint = JSON.stringify(command);
      const seen = receipts.get(command.commandId);
      if (seen) {
        if (seen !== fingerprint) update({ error: 'That command id was already used. Review the walk and try again.' });
        return seen === fingerprint;
      }
      const previous = state.session;
      const version = epoch;
      update({ busy: true, error: null });
      try {
        const session = state.mode === 'member' ? await options.transport!.send(command) : applyWalkCommand(previous, command, new Date().toISOString());
        if (version !== epoch) return false;
        receipts.set(command.commandId, fingerprint);
        if (receipts.size > 256) receipts.delete(receipts.keys().next().value!);
        const changedStop = previous.completedStopIds.length !== session.completedStopIds.length;
        update({ session, busy: false, ...(changedStop ? { synopsis: null } : {}) });
        persist();
        if (previous.revision !== session.revision) options.onTransition?.(previous, session, command);
        if (changedStop) void loadStop();
        return true;
      } catch (error) {
        if (version !== epoch) return false;
        if (error instanceof JourneyIdentityChanged) {
          clear(error.message);
        } else if (error instanceof JourneyConflict) {
          update({ session: error.session, busy: false, error: error.message, synopsis: null });
          options.onClear?.(); void loadStop();
        } else update({ busy: false, error: error instanceof Error ? error.message : 'Could not update the walk.' });
        return false;
      }
    },
    refresh: loadStop,
    /** A known account boundary revokes pending starts synchronously, before another HTTP check. */
    identityChanged(owner: string | null = null) {
      if (!options.transport) return;
      // The session mirror can hydrate after a journey independently verified
      // this same owner. That first observation is not an account switch.
      if (owner !== null && options.transport.matchesIdentity?.(owner)) return;
      if (state.mode === 'local' && !starting) options.transport.invalidateIdentity?.();
      else clear();
    },
    async checkIdentity(trigger: 'mount' | 'boundary' = 'boundary') {
      // Remounting a screen is not an account boundary. An in-flight begin
      // authenticates before it commits; focus/auth boundaries still revoke it.
      if (starting && options.transport) {
        if (trigger === 'boundary') clear();
        return;
      }
      if (state.mode !== 'member' || !options.transport?.verifyIdentity) return;
      const version = epoch;
      try { await options.transport.verifyIdentity(); } catch {
        if (version !== epoch) return;
        clear('We could not verify the same login. Reopen your walk after signing in.');
      }
    },
    cacheRoute(synopsis: RouteSynopsis) { if (state.synopsis?.generatedAt === synopsis.generatedAt && state.synopsis?.stopId === synopsis.stopId) return; update({ synopsis }); persist(); },
    setHapticsEnabled(hapticsEnabled: boolean) { update({ hapticsEnabled }); try { options.storage.set('walk-haptics', hapticsEnabled ? 'on' : 'off'); } catch { /* In-memory preference still applies. */ } },
    setError(error: string | null) { update({ error }); },
    clear: () => clear(),
  };
}
export type JourneyController = ReturnType<typeof createJourneyController>;
