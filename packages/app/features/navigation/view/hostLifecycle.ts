/** One foreground feed may be owned by overlapping Explore/Walk route hosts. */
export function createNavigationHostLifecycle(feed: {
  running(): boolean;
  start(): void;
  stop(): void;
  /** Must include current session intent and permission; never prompt on reentry. */
  mayResume(): boolean;
}) {
  let hosts = 0;
  let active = true;
  let resume = false;
  const suspend = () => {
    if (feed.running()) {
      resume = feed.mayResume();
      feed.stop();
    }
  };
  const restore = () => {
    if (!active || hosts === 0 || !resume) return;
    resume = false;
    if (feed.mayResume()) feed.start();
  };
  return {
    mount(isActive: boolean) {
      hosts += 1;
      active = isActive;
      if (!active) suspend();
      else restore();
      let mounted = true;
      return () => {
        if (!mounted) return;
        mounted = false;
        hosts -= 1;
        if (hosts === 0) suspend();
      };
    },
    setActive(value: boolean) {
      active = value;
      if (!active) suspend();
      else restore();
    },
  };
}
