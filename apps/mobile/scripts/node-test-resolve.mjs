// node:test loads the linked @viro-external TypeScript sources the way Metro
// does: their relative imports are extensionless, so map them to .ts/.tsx.
// Node strips the types itself. Used by `pnpm --filter mobile test`.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.ts', '.tsx'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && context.parentURL?.startsWith('file:') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of EXTENSIONS) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
