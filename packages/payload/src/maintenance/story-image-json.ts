const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Read object JSON without importing or initializing the Payload seed entrypoint. */
export async function fetchStoryImageJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith('{')) {
      try {
        return JSON.parse(text) as T;
      } catch {
        // Truncated or malformed JSON shares the same bounded retry budget.
      }
    }
    if (attempt === 3) throw new Error(`${new URL(url).host} answered ${res.status}`);
    await sleep(5_000 * (attempt + 1)); // Wikimedia rate limit
  }
}
