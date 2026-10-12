import { isDeepStrictEqual } from 'node:util';
import type { CollectionAfterChangeHook, Payload, PayloadRequest, Plugin } from 'payload';

const noVideo = { stream: { videoId: null } };

/** Bunny's storage-only raster upload returns its input plus a null video marker.
 * There is no Stream field to persist in this configuration. Reject any other
 * difference so a plugin upgrade cannot silently turn this into a write bypass.
 */
function isRedundantMetadata(data: unknown, stored: Record<string, unknown>): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const metadata = { ...data } as Record<string, unknown>;
  if (stored.bunnyData == null && isDeepStrictEqual(metadata.bunnyData, noVideo)) {
    if ('bunnyData' in stored) metadata.bunnyData = stored.bunnyData;
    else delete metadata.bunnyData;
  }
  return isDeepStrictEqual(metadata, stored);
}

function wrapStorageHook(hook: CollectionAfterChangeHook): CollectionAfterChangeHook {
  return async (args) => {
    if (args.operation !== 'create' || args.req.user?.collection !== 'members') return hook(args);
    // The adapter mutates doc in place, so compare against the persisted snapshot.
    const stored = structuredClone(args.doc) as Record<string, unknown>;
    const originalPayload = args.req.payload;
    let localReq: PayloadRequest;
    const localPayload = new Proxy(originalPayload, {
      get(target, property) {
        if (property !== 'update') return Reflect.get(target, property, target);
        return ((options: Parameters<Payload['update']>[0]) => {
          if (options.collection === 'media' && 'id' in options && options.id === stored.id
            && options.req === localReq && localReq.context?.skipCloudStorage === true
            && isRedundantMetadata(options.data, stored)) {
            // No database write or elevated access: the newly created document
            // already contains every persisted field returned by the adapter.
            return Promise.resolve(structuredClone(stored));
          }
          return target.update(options);
        }) as Payload['update'];
      },
    });
    localReq = new Proxy(args.req, {
      get(target, property) {
        return property === 'payload' ? localPayload : Reflect.get(target, property, target);
      },
    });
    return hook({ ...args, req: localReq });
  };
}

/** Use only around the storage-only Bunny plugin configured by this app. Existing
 * collection hooks retain their original request and all edit access is unchanged.
 */
export const withMemberAvatarStorage = (storagePlugin: Plugin): Plugin => async (config) => {
  const existing = new Set(config.collections?.find(({ slug }) => slug === 'media')?.hooks?.afterChange ?? []);
  const result = await storagePlugin(config);
  return {
    ...result,
    collections: result.collections?.map((collection) => collection.slug !== 'media' ? collection : {
      ...collection,
      hooks: {
        ...collection.hooks,
        afterChange: collection.hooks?.afterChange?.map((hook) => existing.has(hook) ? hook : wrapStorageHook(hook)),
      },
    }),
  };
};
