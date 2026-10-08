import { typeScale } from '@acme/theme';
import { createTV } from 'tailwind-variants';

// tailwind-merge only knows Tailwind's default font sizes, so it reads
// `text-small` or `text-ui` as a colour and drops the real colour class
// (`text-on-primary`) as a conflict. Registering the type steps keeps size
// and colour in separate merge groups.
export const tv = createTV({
  twMergeConfig: {
    extend: { theme: { text: Object.keys(typeScale) } },
  },
});

export type { VariantProps } from 'tailwind-variants';
