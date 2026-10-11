interface DraftArtist {
  id: number | string;
  _status?: 'draft' | 'published' | null;
  name?: string | null;
  slug?: string | null;
}

interface MusicPublisher {
  find: (args: { collection: 'music-artists'; limit: number; page: number; depth: 0; overrideAccess: true; draft: true; sort: 'id' }) => Promise<{ docs: DraftArtist[]; hasNextPage: boolean }>;
  update: (args: { collection: 'music-artists'; id: number | string; overrideAccess: true; data: { _status: 'published' } }) => Promise<unknown>;
}

/** Read a stable snapshot before writes; one invalid draft must not hide later failures. */
export async function publishMusicArtists(payload: MusicPublisher, apply: boolean, log: Pick<Console, 'info' | 'error'> = console) {
  const drafts: DraftArtist[] = [];
  for (let page = 1; ; page++) {
    const result = await payload.find({ collection: 'music-artists', limit: 100, page, depth: 0, overrideAccess: true, draft: true, sort: 'id' });
    drafts.push(...result.docs);
    if (!result.hasNextPage) break;
  }
  let published = 0;
  let failed = 0;
  for (const doc of drafts) {
    if (doc._status === 'published') continue;
    if (!doc.name?.trim() || !doc.slug?.trim()) {
      log.info(`Skipping artist ${doc.id} — no name or slug.`);
      continue;
    }
    if (!apply) {
      log.info(`Draft artist ${doc.slug} — ${doc.name}`);
      continue;
    }
    try {
      await payload.update({ collection: 'music-artists', id: doc.id, overrideAccess: true, data: { _status: 'published' } });
      published++;
    } catch (error) {
      failed++;
      log.error(`Could not publish artist ${doc.id}.`, error);
    }
  }
  log.info(apply ? `Published ${published} music artists; ${failed} failed.` : 'Preview only; pass --apply to publish.');
  return { published, failed };
}
