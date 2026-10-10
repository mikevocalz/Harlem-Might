import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const header = resolve(root, 'node_modules/react-native/React/Views/UIView+React.h');
if (!existsSync(header)) {
  console.log('react-native-enriched-html patch: UIView+React.h not found, skipping');
  process.exit(0);
}

const files = [
  'node_modules/react-native-enriched-html/ios/utils/ZeroWidthSpaceUtils.mm',
  'node_modules/react-native-enriched-html/ios/utils/TextInsertionUtils.mm',
  'node_modules/react-native-enriched-html/ios/styles/LinkStyle.mm',
  'node_modules/react-native-enriched-html/ios/styles/MentionStyle.mm',
  'node_modules/react-native-enriched-html/ios/EnrichedTextInputView.mm',
];

for (const file of files) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  const rel = relative(dirname(path), header);
  const fixed = rel.startsWith('.') ? rel : `./${rel}`;
  const source = readFileSync(path, 'utf8');
  if (!source.includes('#import "UIView+React.h"')) continue;
  writeFileSync(path, source.replace('#import "UIView+React.h"', `#import "${fixed}"`));
  console.log(`patched ${file} -> ${fixed}`);
}
