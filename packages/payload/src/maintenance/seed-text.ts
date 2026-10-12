// Feeds publish HTML entities in titles and venues (&#8217;, &nbsp;).
const HTML_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};

/** Decode the feeds' supported text references; this is not an HTML sanitizer. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (reference, digits) => {
      const codePoint = Number(digits);
      // Keep unsupported references visible for curator review instead of
      // aborting an entire feed on String.fromCodePoint's RangeError.
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : reference;
    })
    .replace(/&(\w+);/g, (reference, name) => Object.hasOwn(HTML_ENTITIES, name) ? HTML_ENTITIES[name]! : reference)
    .trim();
}

export function stripHtml(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
