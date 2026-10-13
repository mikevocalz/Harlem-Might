type Release = () => void | Promise<void>;

export interface CanvasSession {
  readonly active: boolean;
  /** Register each acquired resource before the next await. Released in reverse order. */
  own: (release: Release) => void;
  fail: (reason: string) => void;
}

/**
 * An effect owns one startup and its resources. Unmount/failure disables callbacks
 * immediately, but disposal waits for startup to settle: Three and GLTF loaders
 * can still allocate after an await. The next effect waits for that disposal so
 * an obsolete backend cannot reconfigure the replacement's canvas surface.
 */
export function startCanvasSession(
  previousClose: Promise<void> | undefined,
  start: (session: CanvasSession) => Promise<void>,
  onUnavailable: (reason: string) => void = (reason) => {
    console.warn(`GPU canvas unavailable: ${reason}`);
  },
) {
  let active = true;
  let settled = false;
  let releasing = false;
  const releases: Release[] = [];
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });

  const release = async () => {
    if (releasing) return;
    releasing = true;
    for (const dispose of releases.reverse()) {
      try {
        await dispose();
      } catch (error) {
        // A failing renderer teardown must not strand the owned browser device.
        console.warn('GPU canvas cleanup failed', error);
      }
    }
    resolveClosed();
  };
  const close = () => {
    active = false;
    if (settled) void release();
  };
  const session: CanvasSession = {
    get active() { return active; },
    own(dispose) { releases.push(dispose); },
    fail(reason) {
      if (!active) return;
      close();
      try {
        onUnavailable(reason);
      } catch (error) {
        console.warn('GPU canvas fallback callback failed', error);
      }
    },
  };

  void (async () => {
    try {
      await previousClose;
      if (active) await start(session);
    } catch {
      session.fail('init-failed');
    } finally {
      settled = true;
      if (!active) await release();
    }
  })();

  return { close, closed };
}
