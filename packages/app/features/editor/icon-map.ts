import * as Icons from '@acme/ui/icons';

/**
 * Registry icon names resolved to components.
 *
 * The registry stores a NAME rather than a component so it stays a plain,
 * serialisable value that the settings screen and the tests can import without
 * pulling the icon set — and so a missing icon is a lookup that fails loudly
 * here rather than an undefined element deep in a render.
 */
const ICONS = Icons as unknown as Record<string, React.FC<{ size?: number; className?: string }>>;

export function iconFor(name: string): React.FC<{ size?: number; className?: string }> {
  const icon = ICONS[name];
  if (icon === undefined) {
    throw new Error(`Unknown icon "${name}" in the editor capability registry.`);
  }
  return icon;
}
