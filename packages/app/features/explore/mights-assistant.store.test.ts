import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { ExplorePlace } from './place-model.ts';
import { createPlaceCatalogueStore } from './place-catalogue.store.ts';
import {
  ASSISTANT_RIVE_ACTIVITY,
  assistantBarLabel,
  assistantCatalogueNotice,
  assistantSuggestions,
  nearbyAnswer,
  useMightsAssistant,
} from './mights-assistant.store.ts';

beforeEach(() => useMightsAssistant.setState(useMightsAssistant.getInitialState(), true));

const gallery: ExplorePlace = {
  id: 'new-neighborhood-gallery', name: 'Neighborhood Gallery', category: 'Culture', area: 'East Harlem',
  lngLat: [-73.94, 40.8], tags: ['art'],
};
const cafe: ExplorePlace = {
  id: 'new-neighborhood-cafe', name: 'Neighborhood Cafe', category: 'Food', area: 'East Harlem',
  street: 'East 110th Street', lngLat: [-73.941, 40.8], tags: ['coffee'],
};
const unmapped: ExplorePlace = {
  id: 'new-neighborhood-workshop', name: 'Neighborhood Workshop', category: 'Community', area: 'East Harlem', tags: [],
};
const catalogue = [gallery, cafe, unmapped];

describe('useMightsAssistant', () => {
  it('starts collapsed and idle, with no walk', () => {
    const state = useMightsAssistant.getState();
    assert.equal(state.open, false);
    assert.equal(state.activity, 'idle');
    assert.equal(state.walk, null);
  });

  it('close() collapses and forgets the answer and the draft', () => {
    const { setOpen, setDraft, answerNearby, close } = useMightsAssistant.getState();
    setOpen(true);
    setDraft('125th');
    answerNearby('apollo-theater');
    close();
    const state = useMightsAssistant.getState();
    assert.equal(state.open, false);
    assert.equal(state.draft, '');
    assert.deepEqual(state.answer, { kind: 'none' });
  });
});

describe('Rive contract', () => {
  it('maps every activity to a distinct 0–4 input', () => {
    const values = Object.values(ASSISTANT_RIVE_ACTIVITY).sort();
    assert.deepEqual(values, [0, 1, 2, 3, 4]);
    assert.equal(ASSISTANT_RIVE_ACTIVITY.idle, 0);
  });
});

describe('assistantSuggestions', () => {
  it('offers details, nearby and map for a mapped place', () => {
    assert.deepEqual(
      assistantSuggestions(gallery, '', catalogue).map((s) => s.kind),
      ['show-details', 'nearby', 'show-on-map'],
    );
  });

  it('drops "What\'s nearby" for a place with no coordinates', () => {
    assert.deepEqual(
      assistantSuggestions(unmapped, '', catalogue).map((s) => s.kind),
      ['show-details', 'show-on-map'],
    );
  });

  it('suggests nothing until the user types, then real matches only', () => {
    assert.deepEqual(assistantSuggestions(null, '   ', catalogue), []);
    const matches = assistantSuggestions(null, '110th', catalogue);
    assert.ok(matches.length > 0 && matches.length <= 3);
    assert.ok(matches.every((s) => s.kind === 'open-place'));
    assert.deepEqual(assistantSuggestions(null, 'no such place zz', catalogue), []);
  });
});

describe('copy', () => {
  it('names the selected place on the bar', () => {
    assert.equal(assistantBarLabel(null), 'Ask Harlem Might');
    assert.equal(assistantBarLabel(gallery), 'Ask about Neighborhood Gallery');
  });

  it('answers "What\'s nearby" from coordinates, or says the place is not mapped', () => {
    assert.match(nearbyAnswer(gallery, catalogue, 'en-GB'), /^Closest on the map: .+ \(\d/);
    assert.equal(
      nearbyAnswer(unmapped, catalogue),
      "Neighborhood Workshop isn't on the map yet, so I can't tell you what's nearby.",
    );
  });
});

describe('catalogue boundary and continuity', () => {
  it('never offers fixture matches when the catalogue is empty or unrelated', () => {
    assert.deepEqual(assistantSuggestions(null, 'Apollo', []), []);
    assert.deepEqual(assistantSuggestions(null, 'Apollo', catalogue), []);
    assert.deepEqual(assistantSuggestions(null, 'gallery', catalogue), [
      { kind: 'open-place', label: gallery.name, placeId: gallery.id },
    ]);
    const many = Array.from({ length: 5 }, (_, i) => ({ ...gallery, id: `gallery-${i}` }));
    assert.equal(assistantSuggestions(null, 'gallery', many).length, 3);
  });

  it('uses only loaded catalogue neighbours and distinguishes an isolated mapped place', () => {
    assert.equal(nearbyAnswer(gallery, [gallery]), 'There are no other mapped places in the loaded catalogue yet.');
    const answer = nearbyAnswer(gallery, catalogue, 'en-US');
    assert.match(answer, /Neighborhood Cafe/);
    assert.doesNotMatch(answer, /Workshop|Apollo|Neighborhood Gallery/);
  });

  it('exposes load failures, retains searchable places and preserves the panel state across refreshes', async () => {
    const store = createPlaceCatalogueStore();
    let offline = false;
    store.getState().connect({
      listExploreCatalogue: async () => {
        if (offline) throw new Error('offline');
        return { status: 'ok', data: [{
          id: 401, slug: gallery.id, name: gallery.name, kind: 'culture', lifecycle: 'open',
          locationAccuracy: 'verified', location: gallery.lngLat, images: [], featured: false,
        }] };
      },
      getPlace: async () => ({ status: 'not-found' }),
    });
    const { setOpen, setDraft, answerNearby } = useMightsAssistant.getState();
    setOpen(true);
    setDraft('gallery');
    answerNearby(gallery.id);
    await store.getState().refresh();
    assert.equal(assistantCatalogueNotice(store.getState().loadState, true), null);
    offline = true;
    await store.getState().refresh();
    const { places, loadState } = store.getState();
    assert.match(assistantCatalogueNotice(loadState, true)!, /Showing the last loaded places/);
    assert.equal(assistantSuggestions(null, 'gallery', places)[0]?.placeId, gallery.id);
    const panel = useMightsAssistant.getState();
    assert.equal(panel.open, true);
    assert.equal(panel.draft, 'gallery');
    assert.deepEqual(panel.answer, { kind: 'nearby', placeId: gallery.id });
    offline = false;
    await store.getState().refresh();
    assert.equal(assistantCatalogueNotice(store.getState().loadState, true), null);
  });

  it('distinguishes loading and unavailable catalogues from a genuine empty ready result', () => {
    assert.equal(assistantCatalogueNotice({ status: 'idle' }, false), 'Loading places…');
    assert.equal(assistantCatalogueNotice({ status: 'loading' }, false), 'Loading places…');
    assert.equal(assistantCatalogueNotice({ status: 'unavailable', message: 'Offline.' }, false), 'Offline.');
    assert.equal(assistantCatalogueNotice({ status: 'ready' }, false), null);
  });
});
