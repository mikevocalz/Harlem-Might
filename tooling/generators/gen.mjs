#!/usr/bin/env node
// §13 generators: `pnpm gen domain <name>` / `pnpm gen feature <name>` / `pnpm gen component <Name>`
// ponytail: plain node script, no generator framework — templates live inline.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [kind, rawName] = process.argv.slice(2);
if (!kind || !rawName) {
  console.error('Usage: pnpm gen domain <kebab-name> | pnpm gen feature <kebab-name> | pnpm gen component <PascalName>');
  process.exit(1);
}

// Validate before writing: names become both paths and TypeScript identifiers.
if ((kind === 'domain' || kind === 'feature') && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/i.test(rawName)) {
  console.error(`${kind} name must be kebab-case, starting with a letter`);
  process.exit(1);
}

const write = (path, content) => {
  if (existsSync(path)) {
    console.error(`refusing to overwrite ${path}`);
    process.exit(1);
  }
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  console.log(`created ${path}`);
};

if (kind === 'domain') {
  const name = rawName.toLowerCase();
  const root = join('packages/app/features', name);
  const keys = `${name.replace(/-./g, (m) => m[1].toUpperCase())}Keys`;
  // Shared domain logic lives beside its feature's screens, under the app compiler boundary.
  write(join(root, `repository/${name}.repository.ts`),
    `// Platform-neutral adapters use @acme/app/content contracts or an injected source.\n// Payload bindings belong in packages/payload; server hosts use @acme/payload/server.\nexport {};\n`);
  write(join(root, `services/${name}.service.ts`),
    `// Orchestration, cross-repo composition, business rules.\nexport {};\n`);
  write(join(root, `queries/${name}.keys.ts`),
    `// Query-key factory — single source of truth for keys.\nexport const ${keys} = {\n  all: ['${name}'] as const,\n};\n`);
  write(join(root, `queries/${name}.queries.ts`), `export {};\n`);
  write(join(root, `schemas/${name}.schema.ts`), `export {};\n`);
  write(join(root, `types/${name}.types.ts`), `export {};\n`);
  write(join(root, `permissions/${name}.permissions.ts`),
    `// Client capability checks are for presentation, not authorization.\n// Reuse session state from packages/app/features/auth/member-session.ts when needed.\n// Enforce access in packages/payload/src/access and the owning collection or server service.\nexport {};\n`);
  write(join(root, `hooks/use-${name}.ts`), `export {};\n`);
  write(join(root, 'index.ts'),
    `// Public feature API — expose only contracts needed by other features or hosts.\nexport { ${keys} } from './queries/${name}.keys.ts';\n`);
  console.log(`\nDomain '${name}' scaffolded in ${root}. Import its public API from '@acme/app/features/${name}/index.ts'. Add mutations/ components/ __tests__/ as they earn their place.`);
} else if (kind === 'feature') {
  const name = rawName.toLowerCase();
  const dir = join('packages/app/features', name);
  const pascal = name.replace(/(^|-)./g, (m) => m.slice(-1).toUpperCase());
  const impl = (fork) => `import { View } from '@acme/ui/tw';\nimport { Text } from '@acme/ui';\n\n// ${fork} fork\nexport function ${pascal}Screen() {\n  return (\n    <View className=\"flex-1 items-center justify-center\">\n      <Text>${pascal}</Text>\n    </View>\n  );\n}\n`;
  write(join(dir, 'screen.native.tsx'), impl('Native'));
  write(join(dir, 'screen.web.tsx'), impl('Web'));
  write(join(dir, 'screen.tsx'),
    `// TS resolution anchor — bundlers load the .native/.web forks.\nexport { ${pascal}Screen } from './screen.web';\n`);
  console.log(`\nExport ${pascal}Screen from packages/app/index.ts and add thin route wrappers in apps/web and apps/mobile.`);
} else if (kind === 'component') {
  const name = rawName;
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    console.error('component name must be PascalCase');
    process.exit(1);
  }
  const dir = 'packages/ui';
  write(join(dir, `${name}.tsx`),
    `import { View } from 'react-native';\n\nexport interface ${name}Props {\n  className?: string;\n}\n\nexport function ${name}({ className }: ${name}Props) {\n  return <View className={className} />;\n}\n`);
  write(join(dir, `${name}.stories.tsx`),
    `import type { Meta, StoryObj } from '@storybook/react-vite';\nimport { ${name} } from './${name}';\n\nconst meta = {\n  title: 'UI/${name}',\n  component: ${name},\n} satisfies Meta<typeof ${name}>;\n\nexport default meta;\ntype Story = StoryObj<typeof meta>;\n\nexport const Default: Story = {};\n`);
  console.log(`\nAdd 'export { ${name} } from './${name}';' to packages/ui/index.ts — a component without a story is incomplete (§7).`);
} else {
  console.error(`unknown generator '${kind}' — use 'domain', 'feature' or 'component'`);
  process.exit(1);
}
