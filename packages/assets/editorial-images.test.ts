import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  HARLEM_ARCHIVAL_IMAGES,
  editorialImageContentFit,
  imageAspect,
  isDisplayableEditorialImage,
} from './editorial-images.ts';

test('the NYPL archival image retains creator, date, rights limits and attribution', () => {
  const [image] = HARLEM_ARCHIVAL_IMAGES;

  assert.equal(image?.creator, 'Sid Grossman, 1915–1955');
  assert.equal(image?.capturedAt, '1939');
  assert.equal(image?.attributionText, 'From The New York Public Library');
  assert.match(image?.license ?? '', /public domain under the laws of the United States/i);
  assert.match(image?.license ?? '', /did not make a determination/i);
  assert.equal(isDisplayableEditorialImage(image), true);
  assert.equal(HARLEM_ARCHIVAL_IMAGES.every(isDisplayableEditorialImage), true);
});

test('displayability fails closed without a source, license, credit, attribution or alt text', () => {
  const [image] = HARLEM_ARCHIVAL_IMAGES;
  assert.ok(image);

  assert.equal(isDisplayableEditorialImage({ ...image, sourceUrl: '' }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, licenseUrl: '' }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, license: '' }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, credit: '' }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, attributionText: '' }), false);
  assert.equal(isDisplayableEditorialImage({ ...image, altText: '' }), false);
});

test('image aspect is derived only from valid intrinsic dimensions', () => {
  assert.equal(imageAspect(760, 510), 760 / 510);
  assert.equal(imageAspect(undefined, 510), undefined);
  assert.equal(imageAspect(760, 0), undefined);
});

test('no-derivative and unknown-aspect images are never cover-cropped', () => {
  const [image] = HARLEM_ARCHIVAL_IMAGES;
  assert.ok(image);

  assert.equal(editorialImageContentFit(image), 'cover');
  assert.equal(editorialImageContentFit({ ...image, noDerivatives: true }), 'contain');
  assert.equal(editorialImageContentFit({ ...image, aspect: undefined }), 'contain');
  assert.equal(editorialImageContentFit({ ...image, aspect: 2 }), 'cover');
});


test('the asset package entry imports in a data-only server without presentation dependencies', () => {
  const entry = new URL('./index.ts', import.meta.url).href;
  const probe = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'react' || specifier.startsWith('react/') ||
            specifier === 'zustand' || specifier.startsWith('zustand/')) {
          throw new Error('Data-only assets must not load presentation dependency: ' + specifier);
        }
        return nextResolve(specifier, context);
      },
    });
    const assets = await import(${JSON.stringify(entry)});
    assert.ok(assets.HARLEM_ARCHIVAL_IMAGES.length > 0);
    assert.equal(assets.isDisplayableEditorialImage(assets.HARLEM_ARCHIVAL_IMAGES[0]), true);
  `;
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    stdio: 'pipe',
    timeout: 5_000,
  }));
});
