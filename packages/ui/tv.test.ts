import assert from 'node:assert/strict';
import { it } from 'node:test';

import { tv } from './tv.ts';

it('keeps a colour class next to a type-step size class', () => {
  const label = tv({ base: 'text-on-primary', variants: { size: { sm: 'text-small' } } });
  assert.equal(label({ size: 'sm' }), 'text-on-primary text-small');
});

it('still lets a later type step replace an earlier one', () => {
  const label = tv({ base: 'text-ui', variants: { size: { sm: 'text-small' } } });
  assert.equal(label({ size: 'sm' }), 'text-small');
});
