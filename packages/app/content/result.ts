/**
 * Why a content read could not answer. Pages render "couldn't check" for
 * these, never the calm empty state, because the content may well exist.
 *
 * - `not-configured`: this process has no content database (DATABASE_URL unset).
 * - `query-failed`: the database or Payload threw while answering.
 */
export type UnavailableReason = 'not-configured' | 'query-failed';

/** A read that could not be answered. See {@linkcode UnavailableReason}. */
export type ContentUnavailable =
  | { status: 'unavailable'; reason: 'not-configured' }
  | { status: 'unavailable'; reason: 'query-failed'; error: Error };

/**
 * Result of a list read such as `listWalks()`. `ok` with an empty array means
 * the database answered and nothing is published, which is different from
 * {@linkcode ContentUnavailable}.
 */
export type ContentResult<T> = { status: 'ok'; data: T } | ContentUnavailable;

/**
 * Result of a single-record read such as `getWalk(slug)`. `not-found` means
 * the database answered and no published record has that slug: the page
 * should call `notFound()`. `unavailable` must not 404.
 */
export type DetailResult<T> = ContentResult<T> | { status: 'not-found' };

export const ok = <T>(data: T): { status: 'ok'; data: T } => ({ status: 'ok', data });

export const notConfigured = (): ContentUnavailable => ({ status: 'unavailable', reason: 'not-configured' });

export const queryFailed = (cause: unknown): ContentUnavailable => ({
  status: 'unavailable',
  reason: 'query-failed',
  error: cause instanceof Error ? cause : new Error(String(cause)),
});
