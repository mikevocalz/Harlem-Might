// Compiler-only SDK/adapter checks; no database instance is initialized.
import type { Payload, TransformCollectionWithSelect } from 'payload';
import { createRestContentSource, type ContentDocument, type ContentSource } from '@acme/app/content';
import { createPayloadContentSource, type CheckedContentDocs } from '../content-source.ts';

export async function transports(payload: Payload) {
  const rest: ContentSource = createRestContentSource({ apiUrl: undefined, fetch });
  const local = createPayloadContentSource({ isConfigured: () => true, getPayload: async () => payload });
  const generated: CheckedContentDocs['places'] = await payload.findByID({ collection: 'places', id: 1 });
  const pinned = await payload.findByID({ collection: 'places', id: 1, select: { name: true } });
  const projected: ContentDocument<'places', readonly ['name']> = pinned;
  // @ts-expect-error the pinned SDK also omits unselected fields for literal selects
  void pinned.slug;
  const selectedSdk: TransformCollectionWithSelect<'places', { name: true }> = projected;
  const localRows = await local.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: ['name'] });
  const restRows = await rest.findPage({ collection: 'places', where: {}, depth: 0, limit: 1, select: ['name'] });
  const localName: string = localRows[0]!.name;
  const restName: string = restRows.docs[0]!.name;
  // @ts-expect-error the concrete Local API adapter must not restore complete documents
  void localRows[0]!.slug;
  // @ts-expect-error the concrete REST adapter must not restore complete documents
  void restRows.docs[0]!.slug;
  return { rest, local, generated, selectedSdk, localName, restName };
}
