import 'server-only';
import { getPayload } from 'payload';
import type { PayloadWithAuth } from '@delmaredigital/payload-better-auth';
import config from '@payload-config';

// The Better Auth instance of record is owned by the
// @delmaredigital/payload-better-auth plugin: it is created in Payload's onInit,
// mounted under `${routes.api}/auth` (i.e. /payload-api/auth), and stores its
// tables as Payload collections — there is no separate better_auth schema.
export async function getAuth() {
  const payload = (await getPayload({ config })) as PayloadWithAuth;
  return payload.betterAuth;
}
