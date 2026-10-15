import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { it } from 'node:test';

// Only the unavailable file-system SDK is replaced. These production native
// adapters must retain durable URIs and never treat them as browser URLs.
const files = { cancelled: false, uri: 'file:///documents/attachments/file.txt' };
Object.assign(globalThis, { attachmentNativeTest: files });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo-file-system' && /\/(pick-file|download)\.native\.ts$/.test(context.parentURL ?? '')) {
      return { url: 'attachment-native-test:files', shortCircuit: true };
    }
    if (specifier === './download' && context.parentURL?.endsWith('/attachment.ts')) return next('./download.native.ts', context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'attachment-native-test:files') return { format: 'module', shortCircuit: true, source: `
      const state = globalThis.attachmentNativeTest;
      export const Paths = { document: 'file:///documents/' };
      export class Directory { exists = true; create() {} }
      export class File {
        static async pickFileAsync() { return { canceled: state.cancelled, result: { uri: state.uri } }; }
        static createDownloadTask(_url, _destination, options) {
          return { async downloadAsync() {
            options.onProgress({ bytesWritten: 4, totalBytes: 4 });
            return state.cancelled ? null : { uri: state.uri, delete() { throw new Error('Durable file deleted'); } };
          } };
        }
      }
    ` };
    return next(url, context);
  },
});
const { pickFile } = await import('./pick-file.native.ts');
const { downloadAttachment } = await import('./download.native.ts');
const { attach } = await import('./attachment.ts');

it('native picker and download keep the original durable-file contract without URL cleanup', async () => {
  const picked = await pickFile();
  assert.deepEqual(picked, { uri: files.uri, name: 'file.txt' });
  assert.deepEqual(await attach(picked!, () => {}), picked);
  let releasePublished = false;
  assert.equal(await downloadAttachment('https://example.invalid/file.txt', 'file.txt', () => {}, () => {
    releasePublished = true;
  }), files.uri);
  assert.equal(releasePublished, false);
  assert.deepEqual(await attach({ uri: 'https://example.invalid/file.txt' }, () => {}), picked);
});

it('native cancellation remains null for both the picker and download', async () => {
  files.cancelled = true;
  assert.equal(await pickFile(), null);
  assert.equal(await downloadAttachment('https://example.invalid/file.txt', 'file.txt', () => {}), null);
});
