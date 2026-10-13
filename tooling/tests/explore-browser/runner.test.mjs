import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromeArgs, parseReport, requireMutationFailure } from './run.mjs';
const names = [
  'real browser, responsive media and React ref ownership',
  'Back restores the newly committed heading, repeatedly and while modal',
  'Back requests superseded by a different or removed URL selection cannot replay',
  'guidance supersedes Back; ending it cannot replay an old focus request',
  'full phone modal releases and reacquires inert when guidance hides/reveals it',
  'native History Back/Forward, Escape guards and focus return',
  'actual useSyncExternalStore owns updates, selectors, StrictMode cleanup and shared clock',
];
const report = () => ({ viewport: 'phone', reactVersion: '19.3.0', userAgent: 'HeadlessChrome/154.0', results: names.map((name) => ({ name, passed: true })) });
const html = (data, status = data.results.every((item) => item.passed) ? 'passed' : 'failed') => `<pre id="browser-results" data-status="${status}">${Buffer.from(JSON.stringify(data)).toString('base64')}</pre>`;
test('runner retains browser sandbox and bounds execution to requested viewport', () => {
  const args = chromeArgs({ profile: '/tmp/isolated', viewport: 'phone', url: 'http://127.0.0.1:4000/explore' });
  assert(args.includes('--headless') && args.includes('--window-size=500,900'));
  assert(!args.some((arg) => /no-sandbox|disable-web-security|ignore-certificate|disable-site-isolation|remote-debugging/.test(arg)));
  assert.throws(() => chromeArgs({ viewport: 'native' }), /Unknown viewport/);
});
test('blank, incomplete and malformed reports never count as browser acceptance', () => {
  for (const value of ['', '<pre id="browser-results" data-status="running">Running</pre>', '<pre>passed</pre>']) assert.throws(() => parseReport(value, 'phone'));
  const missing = report(); missing.results.pop(); assert.throws(() => parseReport(html(missing), 'phone'), /omitted/);
  const duplicate = report(); duplicate.results.push(duplicate.results[0]); assert.throws(() => parseReport(html(duplicate), 'phone'), /duplicated/);
});
test('runner verifies runtime identity and preserves failed browser assertions', () => {
  assert.equal(parseReport(html(report()), 'phone').passed, true);
  const failed = report(); failed.results[1].passed = false; failed.results[1].error = 'Focus stayed on body';
  assert.equal(parseReport(html(failed), 'phone').passed, false);
  assert.throws(() => parseReport(html(failed, 'passed'), 'phone'), /contradicts/);
  assert.throws(() => parseReport(html(report()), 'desktop'), /expected viewport/);
  const fake = report(); fake.userAgent = 'jsdom'; assert.throws(() => parseReport(html(fake), 'phone'), /Chrome runtime/);
});
test('mutants must fail their targeted contract; unrelated crashes are insufficient', () => {
  assert.throws(() => requireMutationFailure(report(), 'focus-before-commit'));
  const wrong = report(); wrong.results[0].passed = false; assert.throws(() => requireMutationFailure(wrong, 'focus-before-commit'));
  const focus = report(); focus.results[1].passed = false; requireMutationFailure(focus, 'focus-before-commit');
  const guidance = report(); guidance.results[3].passed = false; requireMutationFailure(guidance, 'ignore-guidance');
  const modal = report(); modal.results[4].passed = false; requireMutationFailure(modal, 'old-modal-policy');
  assert.throws(() => requireMutationFailure(modal, 'unknown'), /Unknown mutation/);
});
