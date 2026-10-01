// Web fork — no-op: the browser needs no safe-area context.
export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
