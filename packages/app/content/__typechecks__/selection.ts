// Compiler-only public API consumers. Never executed or imported by the app.
import {
  type ContentQuery,
  type ContentSource,
  type PlaceDoc,
  type WalkDoc,
} from '../index.ts';
import { EXPLORE_PLACE_FIELDS, EXPLORE_POINT_FIELDS } from '../readers.ts';
import { mapPlaceRecord, mapWalk } from '../map.ts';

export async function consumers(source: ContentSource, dynamic: readonly string[], choose: 'name' | 'slug') {
  const walks = await source.find({ collection: 'walks', where: {}, depth: 1, limit: 10 });
  const complete: WalkDoc = walks[0]!;
  complete.summary.toUpperCase();
  walks.map(mapWalk);

  // Existing callers may explicitly specify only the collection generic.
  // Preserve those calls; because the selection type was not supplied/inferred,
  // their projected results must remain conservative.
  const explicit = await source.find<'walks'>({ collection: 'walks', where: {}, depth: 1, limit: 10, select: ['title'] });
  const explicitTitle: string | undefined = explicit[0]!.title;
  // @ts-expect-error an explicit collection generic must not recover a full document
  const explicitSummary: string = explicit[0]!.summary;
  const explicitFull = await source.find<'walks'>({ collection: 'walks', where: {}, depth: 1, limit: 10 });
  explicitFull.map(mapWalk);
  const explicitPage = await source.findPage<'walks'>({ collection: 'walks', where: {}, depth: 1, limit: 10, select: ['title'] });
  // @ts-expect-error explicit collection-only page calls also remain conservative
  explicitPage.docs.map(mapWalk);

  const selected = await source.find({ collection: 'walks', where: {}, depth: 1, limit: 10, select: ['title'] });
  const id: number = selected[0]!.id;
  const title: string = selected[0]!.title;
  // @ts-expect-error summary was not selected
  void selected[0]!.summary;
  // @ts-expect-error a projection is not a complete document
  const falseComplete: WalkDoc = selected[0]!;
  // @ts-expect-error mapping must not smuggle a partial document into a full-document mapper
  selected.map(mapWalk);

  const page = await source.findPage({ collection: 'places', where: {}, depth: 0, limit: 1, select: ['name'], page: 2 });
  const name: string = page.docs[0]!.name;
  const total: number = page.totalDocs;
  const next: boolean = page.hasNextPage;
  // @ts-expect-error page results have the same projection rules as find
  void page.docs[0]!.slug;

  const fullPage = await source.findPage({ collection: 'places', where: {}, depth: 0, limit: 1 });
  const fullPlace: PlaceDoc = fullPage.docs[0]!;
  const optional = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: ['summary', 'locationSource'] });
  const summary: string | null | undefined = optional[0]!.summary;
  // @ts-expect-error selecting an optional field does not make its value required
  const requiredSummary: string = optional[0]!.summary;
  void optional[0]!.locationSource?.url;
  // @ts-expect-error selecting a group does not create unrelated fields
  void optional[0]!.website;

  const catalogue = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: EXPLORE_PLACE_FIELDS });
  const points = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: EXPLORE_POINT_FIELDS });
  catalogue.map(mapPlaceRecord);
  points.map(mapPlaceRecord);
  // @ts-expect-error the point selection does not promise the summary column
  void points[0]!.summary;
  // @ts-expect-error the catalogue selection does not promise detail media
  void catalogue[0]!.images;

  const variable = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: dynamic });
  const possibleName: string | undefined = variable[0]!.name;
  const variableId: number = variable[0]!.id;
  // @ts-expect-error a runtime include-list cannot promise any particular field
  const certainName: string = variable[0]!.name;
  // @ts-expect-error widened selections must not restore complete documents
  variable.map(mapPlaceRecord);

  const array: readonly ('name' | 'slug')[] = [choose];
  const widened = await source.findPage({ collection: 'places', where: {}, depth: 0, limit: 1, select: array });
  const possibleSlug: string | undefined = widened.docs[0]!.slug;
  // @ts-expect-error an element union does not mean every member is selected
  const certainSlug: string = widened.docs[0]!.slug;
  // @ts-expect-error the widened array still cannot select kind
  void widened.docs[0]!.kind;
  const unionEntry = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: [choose] as const });
  // @ts-expect-error even a fixed-length tuple can contain an uncertain field name
  const unionName: string = unionEntry[0]!.name;

  const broadQuery: ContentQuery<'walks'> = { collection: 'walks', where: {}, depth: 1, limit: 1, select: ['title'] };
  const broad = await source.find(broadQuery);
  // @ts-expect-error query annotations must not erase selection uncertainty
  const broadSummary: string = broad[0]!.summary;
  const maybeSelection: readonly ['name'] | undefined = choose === 'name' ? ['name'] : undefined;
  const maybe = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: maybeSelection });
  const maybeName: string = maybe[0]!.name;
  // @ts-expect-error an optional selection can still omit slug
  void maybe[0]!.slug;

  const empty = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: [] });
  const emptyId: number = empty[0]!.id;
  // @ts-expect-error empty include-lists only guarantee id across transports
  void empty[0]!.name;
  const extension = await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: ['createdAt', 'address.formatted'] });
  const extensionId: number = extension[0]!.id;
  // @ts-expect-error pass-through field names outside the reader contract have no invented type
  void extension[0]!.createdAt;
  // @ts-expect-error only a full top-level group selection can promise the group's type
  void extension[0]!.address;
  // @ts-expect-error the contract remains an include-list, not an arbitrary select object
  await source.find({ collection: 'places', where: {}, depth: 0, limit: 1, select: { name: true } });

  return { explicitTitle, explicitSummary, id, title, name, total, next, fullPlace, summary, possibleName, variableId, possibleSlug, maybeName, emptyId, extensionId, falseComplete, requiredSummary, certainName, certainSlug, unionName, broadSummary };
}
