import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  splitNoteSegments,
  videoIdFromThumbnail,
  youTubeThumbnail,
  youTubeVideoId,
} from './youtube.ts';


describe('youTubeVideoId', () => {
  it('reads every URL shape YouTube hands out', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
    ]) {
      assert.equal(youTubeVideoId(url), id, url);
    }
  });

  it('finds v= behind the tracking parameters share links carry', () => {
    assert.equal(
      youTubeVideoId('https://www.youtube.com/watch?si=abc&list=PL123&v=dQw4w9WgXcQ&t=42'),
      'dQw4w9WgXcQ',
    );
  });

  it('returns null for anything else, including near-misses', () => {
    assert.equal(youTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(youTubeVideoId('https://vimeo.com/123456'), null);
    assert.equal(youTubeVideoId(''), null);
  });
});

describe('splitNoteSegments', () => {
  const VIDEO = 'https://youtu.be/dQw4w9WgXcQ';

  it('returns one html segment when there is no video', () => {
    const html = '<p>Just notes</p>';
    assert.deepEqual(splitNoteSegments(html), [{ kind: 'html', value: html }]);
  });

  it('replaces the anchor with a video segment rather than keeping both', () => {
    const segments = splitNoteSegments(`<p>Before</p><a href="${VIDEO}">${VIDEO}</a><p>After</p>`);
    assert.deepEqual(segments, [
      { kind: 'html', value: '<p>Before</p>' },
      { kind: 'video', value: 'dQw4w9WgXcQ' },
      { kind: 'html', value: '<p>After</p>' },
    ]);
  });

  it('leaves non-YouTube links alone', () => {
    const html = '<p>See <a href="https://example.com">this</a></p>';
    assert.deepEqual(splitNoteSegments(html), [{ kind: 'html', value: html }]);
  });

  it('handles several videos in one note', () => {
    const html = `<a href="${VIDEO}">a</a><p>mid</p><a href="https://youtu.be/aBcDeFgHiJk">b</a>`;
    const segments = splitNoteSegments(html);
    assert.deepEqual(segments.map((s) => s.kind), ['video', 'html', 'video']);
    assert.equal(segments[2]?.value, 'aBcDeFgHiJk');
  });

  it('drops whitespace-only html between segments', () => {
    const segments = splitNoteSegments(`<a href="${VIDEO}">a</a>   `);
    assert.deepEqual(segments, [{ kind: 'video', value: 'dQw4w9WgXcQ' }]);
  });
});

describe('splitNoteSegments — audio', () => {
  const AUDIO = 'file:///data/recordings/note-1.m4a';

  it('turns an audio link into a player segment, keeping its label', () => {
    const segments = splitNoteSegments(`<p>Before</p><a href="${AUDIO}">Voice note (0:12)</a>`);
    assert.deepEqual(segments, [
      { kind: 'html', value: '<p>Before</p>' },
      { kind: 'audio', value: AUDIO, label: 'Voice note (0:12)' },
    ]);
  });

  it('recognises every format the recorder and attachments produce', () => {
    for (const ext of ['m4a', 'mp3', 'wav', 'aac', 'caf', 'ogg']) {
      const segments = splitNoteSegments(`<a href="file:///note.${ext}">clip</a>`);
      assert.equal(segments[0]?.kind, 'audio', ext);
    }
  });

  it('ignores a query string when matching the extension', () => {
    const segments = splitNoteSegments('<a href="https://cdn.example.com/a.mp3?token=abc">clip</a>');
    assert.equal(segments[0]?.kind, 'audio');
  });

  it('leaves a document link alone', () => {
    const html = '<p>See <a href="file:///notes.pdf">the brief</a></p>';
    assert.deepEqual(splitNoteSegments(html), [{ kind: 'html', value: html }]);
  });

  it('handles a note holding both a video and a recording', () => {
    const html = `<a href="https://youtu.be/dQw4w9WgXcQ">v</a><a href="${AUDIO}">a</a>`;
    assert.deepEqual(splitNoteSegments(html).map((s) => s.kind), ['video', 'audio']);
  });
});

describe('inline video nodes', () => {
  it('reads a YouTube thumbnail image as a video segment', () => {
    const html = `<p>before</p><img src="${youTubeThumbnail('dQw4w9WgXcQ')}" /><p>after</p>`;
    const segments = splitNoteSegments(html);
    assert.deepEqual(
      segments.map((segment) => segment.kind),
      ['html', 'video', 'html'],
    );
    assert.equal(segments[1]?.value, 'dQw4w9WgXcQ');
  });

  it('leaves an ordinary inline image in the HTML', () => {
    const segments = splitNoteSegments('<p>a</p><img src="https://example.com/cat.png" />');
    assert.ok(segments.every((segment) => segment.kind === 'html'));
  });

  it('rejects a non-thumbnail URL', () => {
    assert.equal(videoIdFromThumbnail('https://example.com/x.jpg'), null);
  });
});

describe('inline voice notes', () => {
  it('reads a waveform image node as an audio segment pointing at the audio', () => {
    const html = '<p>notes</p><img src="https://cdn.example.com/n/abc/waveform.png" />';
    const segments = splitNoteSegments(html);
    assert.deepEqual(segments.map((segment) => segment.kind), ['html', 'audio']);
    assert.equal(segments[1]?.value, 'https://cdn.example.com/n/abc/audio.m4a');
  });

  it('still reads an older note that links a local recording', () => {
    const html = '<a href="file:///data/rec.m4a">Voice note (0:12)</a>';
    const segments = splitNoteSegments(html);
    assert.deepEqual(segments.map((segment) => segment.kind), ['audio']);
    assert.equal(segments[0]?.label, 'Voice note (0:12)');
  });

  it('keeps a video thumbnail a video, not audio', () => {
    const html = '<img src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" />';
    assert.deepEqual(splitNoteSegments(html).map((s) => s.kind), ['video']);
  });
});
