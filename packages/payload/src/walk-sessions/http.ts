import { executeWalkCommand, readWalkSession, WalkSessionError } from './service.ts';
import type { WalkSessionDependencies } from './service.ts';

const MAX_COMMAND_BYTES = 4096;
const privateHeaders = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Origin' };
export function walkSessionResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: privateHeaders });
}

function failure(error: unknown): Response {
  if (error instanceof WalkSessionError) {
    return walkSessionResponse({ schemaVersion: 1, code: error.code, ...(error.session ? { session: error.session } : {}) }, error.status);
  }
  // Never send database, credential, stack or member details back to a client.
  return walkSessionResponse({ schemaVersion: 1, code: 'session-unavailable' }, 503);
}

export async function handleWalkCommand(
  req: { headers: Headers; body?: ReadableStream<Uint8Array> | null },
  deps: WalkSessionDependencies,
  trustedOrigins: readonly string[],
): Promise<Response> {
  try {
    const origin = req.headers.get('origin');
    if (!origin || !trustedOrigins.includes(origin)
      || req.headers.get('sec-fetch-site') === 'cross-site') {
      throw new WalkSessionError(403, 'origin-not-allowed');
    }
    if (req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') {
      throw new WalkSessionError(415, 'json-required');
    }
    if (!req.body) throw new WalkSessionError(400, 'invalid-command');
    const reader = req.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0;
    let json = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_COMMAND_BYTES) {
          await reader.cancel();
          throw new WalkSessionError(413, 'command-too-large');
        }
        json += decoder.decode(value, { stream: true });
      }
      json += decoder.decode();
    } catch (error) {
      if (error instanceof WalkSessionError) throw error;
      throw new WalkSessionError(400, 'invalid-command');
    } finally { reader.releaseLock(); }
    let command: unknown;
    try { command = JSON.parse(json); } catch { throw new WalkSessionError(400, 'invalid-command'); }
    return walkSessionResponse(await executeWalkCommand(deps, command));
  } catch (error) { return failure(error); }
}

export async function handleReadWalkSession(deps: WalkSessionDependencies, sessionId: unknown): Promise<Response> {
  try {
    if (typeof sessionId !== 'string') throw new WalkSessionError(400, 'invalid-session-id');
    return walkSessionResponse(await readWalkSession(deps, sessionId));
  } catch (error) { return failure(error); }
}

/** There is no approved standalone-watch credential/pairing lifecycle yet. */
export function unsupportedWatchSession(): Response {
  return walkSessionResponse({ schemaVersion: 1, code: 'watch-session-unsupported' }, 501);
}
