// Emits theme.css + theme-native.css (Tailwind v4 @theme variables) from
// tokens.ts — the single source.
// Run: node build-css.mjs   (both are committed; CI can diff-check for drift)
//
// TWO self-contained outputs, because the two styling engines disagree about
// where a themed variable lives:
//
//   theme.css        web + storybook (plain Tailwind 4 / react-native-css).
//                    Semantic colors are @theme entries using light-dark(), so
//                    system-following is free and [data-theme] flips it by
//                    overriding color-scheme.
//   theme-native.css mobile (Uniwind). Uniwind has no light-dark(); it reads
//                    themes from `@layer theme { :root { @variant <name> } }`
//                    and registers utilities straight from those blocks.
//
// They duplicate the non-semantic tokens on purpose — generated duplication is
// free, whereas cross-file @import resolution inside a package is not.
import { writeFileSync } from 'node:fs';
import {
  palette, semantic, fontFamilies, typeScale, contentWidths,
  radius, shadows, zIndex, motion, breakpoints,
} from './tokens.ts';

const HEADER = '/* GENERATED from tokens.ts — do not edit by hand. `node build-css.mjs` */';

// Everything that is theme-independent: identical in both outputs.
const sharedThemeTokens = () => {
  const out = [];

  // primitive palettes
  for (const [name, scale] of Object.entries(palette)) {
    if (typeof scale === 'string') {
      out.push(`  --color-${name}: ${scale};`);
    } else {
      for (const [step, hex] of Object.entries(scale)) {
        out.push(`  --color-${name}-${step}: ${hex};`);
      }
    }
  }

  // typography
  out.push(`  --font-display: ${fontFamilies.display};`);
  out.push(`  --font-sans: ${fontFamilies.sans};`);
  for (const [name, t] of Object.entries(typeScale)) {
    out.push(`  --text-${name}: ${t.size};`);
    out.push(`  --text-${name}--line-height: ${t.lineHeight};`);
    out.push(`  --text-${name}--letter-spacing: ${t.tracking};`);
  }

  // content widths → max-w-content-* utilities
  for (const [name, width] of Object.entries(contentWidths)) {
    out.push(`  --container-${name}: ${width};`);
  }

  for (const [name, value] of Object.entries(radius)) {
    out.push(`  --radius-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(shadows)) {
    out.push(`  --shadow-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(motion.easing)) {
    out.push(`  --ease-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(breakpoints)) {
    out.push(`  --breakpoint-${name}: ${value};`);
  }
  return out;
};

// non-Tailwind-namespace vars: z-index + durations
const rootVars = () => {
  const out = [];
  for (const [name, value] of Object.entries(zIndex)) {
    out.push(`  --z-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(motion.duration)) {
    out.push(`  --duration-${name}: ${value};`);
  }
  return out;
};

// Default body text color for the tw Text/heading/paragraph wrappers. Lives in
// the base layer so any explicit text-color utility (utilities layer) overrides
// it on web; on native the runtime resolves by class order, where it comes first.
const BODY_TEXT_BASE = `@layer base {
  .text-body-default { color: var(--color-text); }
}`;

// ---------------------------------------------------------------- web ------

const web = [HEADER, '@theme {'];
web.push(...sharedThemeTokens());
// semantic colors — light-dark() gives system-following for free
for (const [name, { light, dark }] of Object.entries(semantic)) {
  web.push(`  --color-${name}: light-dark(${light}, ${dark});`);
}
web.push('}');
web.push('');
web.push(':root {');
web.push('  color-scheme: light dark; /* system-following default; override via [data-theme] */');
web.push(...rootVars());
web.push('}');
web.push('');
web.push('/* user override (persisted): data-theme wins over system */');
web.push("[data-theme='light'] { color-scheme: light; }");
web.push("[data-theme='dark'] { color-scheme: dark; }");
web.push('');
web.push(BODY_TEXT_BASE);
web.push(`
/* @expo/ui BottomSheet (vaul) on web: the drawer hardcodes a white/black
   background and a non-flex inner wrapper, so the kit's SheetSurface can't
   fill or theme it. Stylesheet !important beats the inline styles. */
[data-vaul-drawer] {
  background-color: var(--color-surface-raised) !important;
}
[data-vaul-drawer] > div:last-child {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
`);

writeFileSync(new URL('./theme.css', import.meta.url), web.join('\n'));

// -------------------------------------------------------------- native -----

const native = [HEADER, '@theme {'];
native.push(...sharedThemeTokens());
native.push('}');
native.push('');
native.push(`/* Semantic colors. Uniwind resolves themes from these @variant blocks and
   registers the utilities (bg-surface, text-text, ...) from them too, so they
   are deliberately NOT duplicated into @theme above. Every variant must declare
   the IDENTICAL set of variables or Uniwind raises a runtime error. */`);
native.push('@layer theme {');
native.push('  :root {');
for (const variant of ['light', 'dark']) {
  native.push(`    @variant ${variant} {`);
  for (const [name, values] of Object.entries(semantic)) {
    native.push(`      --color-${name}: ${values[variant]};`);
  }
  native.push('    }');
}
native.push('  }');
native.push('}');
native.push('');
native.push(':root {');
native.push(...rootVars());
native.push('}');
native.push('');
native.push(BODY_TEXT_BASE);
native.push('');

writeFileSync(new URL('./theme-native.css', import.meta.url), native.join('\n'));

console.log('theme.css + theme-native.css written');
