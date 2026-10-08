import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { getHarlemPlacePreview } from './explore.store.ts';
import {
  ASSISTANT_RIVE_ACTIVITY,
  assistantBarLabel,
  assistantSuggestions,
  nearbyAnswer,
  useMightsAssistant,
} from './mights-assistant.store.ts';

beforeEach(() => useMightsAssistant.setState(useMightsAssistant.getInitialState(), true));

const apollo = getHarlemPlacePreview('apollo-theater')!;
const strivers = getHarlemPlacePreview('strivers-row')!;

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
      assistantSuggestions(apollo, '').map((s) => s.kind),
      ['show-details', 'nearby', 'show-on-map'],
    );
  });

  it('drops "What\'s nearby" for a place with no coordinates', () => {
    assert.deepEqual(
      assistantSuggestions(strivers, '').map((s) => s.kind),
      ['show-details', 'show-on-map'],
    );
  });

  it('suggests nothing until the user types, then real matches only', () => {
    assert.deepEqual(assistantSuggestions(null, '   '), []);
    const matches = assistantSuggestions(null, 'malcolm x');
    assert.ok(matches.length > 0 && matches.length <= 3);
    assert.ok(matches.every((s) => s.kind === 'open-place'));
    assert.deepEqual(assistantSuggestions(null, 'no such place zz'), []);
  });
});

describe('copy', () => {
  it('names the selected place on the bar', () => {
    assert.equal(assistantBarLabel(null), 'Ask Harlem Might');
    assert.equal(assistantBarLabel(apollo), 'Ask about Apollo Theater');
  });

  it('answers "What\'s nearby" from coordinates, or says the place is not mapped', () => {
    assert.match(nearbyAnswer(apollo, 'en-GB'), /^Closest on the map: .+ \(\d/);
    assert.equal(
      nearbyAnswer(strivers),
      "Strivers' Row isn't on the map yet, so I can't tell you what's nearby.",
    );
  });
});
