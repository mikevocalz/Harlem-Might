import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  musicConnectionLabel,
  youTubeVideoId,
} from './music-format.ts';

describe('youTubeVideoId', () => {
  it('parses watch, share, and embed URLs', () => {
    assert.equal(youTubeVideoId('https://www.youtube.com/watch?v=m60XKqEEnfg'), 'm60XKqEEnfg');
    assert.equal(youTubeVideoId('https://youtu.be/m60XKqEEnfg'), 'm60XKqEEnfg');
    assert.equal(youTubeVideoId('https://www.youtube-nocookie.com/embed/m60XKqEEnfg'), 'm60XKqEEnfg');
  });

  it('rejects URLs without a valid 11-character video id', () => {
    assert.equal(youTubeVideoId('https://www.youtube.com/watch?v=short'), undefined);
  });
});

it('labels the shared CMS born-raised enum without overstating both conditions', () => {
  assert.equal(musicConnectionLabel('born-raised'), 'Born or raised in Harlem');
});
