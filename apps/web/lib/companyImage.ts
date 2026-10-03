import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'public', 'images', 'company');
const EXT = ['webp', 'jpg', 'png'] as const;

/**
 * Public URL for a generated Company-page illustration, or null until the
 * file exists. A missing image renders nothing rather than a placeholder;
 * the slot list and prompts are in docs/design/IMAGE_PROMPTS.md.
 */
export function companyImage(slug: string): string | null {
  for (const ext of EXT) {
    if (existsSync(join(DIR, `${slug}.${ext}`))) return `/images/company/${slug}.${ext}`;
  }
  return null;
}
