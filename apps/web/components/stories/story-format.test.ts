import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { archiveCaption, rightsLine, storyDates, storyParagraphs } from './story-format.ts';

describe('storyParagraphs', () => {
  it('splits on blank lines and joins soft line breaks', () => {
    assert.deepEqual(storyParagraphs('First line\nstill first.\n\n  Second.  \r\n\r\nThird.\n\n\n'), [
      'First line still first.',
      'Second.',
      'Third.',
    ]);
  });
  it('returns nothing for an empty body', () => assert.deepEqual(storyParagraphs('  \n\n '), []));
});

describe('rightsLine', () => {
  it('names who allows the reuse', () => {
    assert.equal(rightsLine({ rights: 'owned' }), 'Harlem Might');
    assert.equal(rightsLine({ rights: 'licensed', rightsHolder: 'Getty Images' }), 'Licensed from Getty Images');
    assert.equal(rightsLine({ rights: 'venue_supplied' }), 'Courtesy of the venue');
    assert.equal(rightsLine({ rights: 'open_license', license: 'CC BY 4.0' }), 'CC BY 4.0');
    assert.equal(rightsLine({ rights: 'public_domain' }), 'Public domain');
  });
});

describe('archiveCaption', () => {
  it('joins caption, credit and rights as sentences', () => {
    assert.equal(
      archiveCaption({ caption: 'The marquee in 1934', credit: 'Photograph by James Van Der Zee', rights: 'licensed', rightsHolder: 'Donna Van Der Zee' }),
      'The marquee in 1934. Photograph by James Van Der Zee. Licensed from Donna Van Der Zee.',
    );
  });
  it('works without a caption and keeps existing punctuation', () => {
    assert.equal(archiveCaption({ credit: 'NYPL Digital Collections.', rights: 'public_domain' }), 'NYPL Digital Collections. Public domain.');
  });
});

describe('storyDates', () => {
  it('drops "updated" when the edit is on the publish day in New York', () => {
    // 03:00Z on the 4th is still Oct 3 in New York.
    assert.deepEqual(storyDates({ publishedAt: '2026-10-03T14:00:00Z', updatedAt: '2026-10-04T03:00:00Z' }), { published: 'Oct 3, 2026' });
  });
  it('shows both dates when the edit is on a later day', () => {
    assert.deepEqual(storyDates({ publishedAt: '2026-10-03T14:00:00Z', updatedAt: '2026-10-06T14:00:00Z' }), {
      published: 'Oct 3, 2026',
      updated: 'Oct 6, 2026',
    });
  });
  it('falls back to the update date when there is no publish date', () => {
    assert.deepEqual(storyDates({ updatedAt: '2026-10-06T14:00:00Z' }), { updated: 'Oct 6, 2026' });
  });
});
