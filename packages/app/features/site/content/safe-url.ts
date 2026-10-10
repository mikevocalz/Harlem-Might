// Content links come from editors and imported listings, so a stored URL is
// untrusted: only absolute http(s) URLs reach an href. Everything else
// (javascript:, data:, relative paths, unparseable text) renders unlinked.
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
