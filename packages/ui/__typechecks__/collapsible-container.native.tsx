import type { ComponentProps } from 'react';
import { Text as NativeText, type CollapsibleProps as ExpoCollapsibleProps } from '@expo/ui';
import { Collapsible } from '../Collapsible';
import { List, ListItem } from '../List';

const onOpenChange: ExpoCollapsibleProps['onOpenChange'] = (_isOpen: boolean) => {};

// Public native resolution must retain the controlled contract and add no RN
// event object or platform-specific styling escape hatch to the shared surface.
export const nativeDisclosure = <Collapsible label="Travel details" isOpen={false}
  onOpenChange={onOpenChange} className="mt-4 p-4 bg-surface-raised">
  <NativeText>Bring your pass</NativeText>
</Collapsible>;
export const hiddenDisclosure = <Collapsible label="Travel details" isOpen
  onOpenChange={onOpenChange} className="hidden" />;
export const defaultDisclosure = <Collapsible label="Travel details" isOpen
  onOpenChange={onOpenChange} />;

// Other behavior-owned adapters still accept the existing refresh/press contract.
export const nativeList = <List onRefresh={async () => {}}>
  <ListItem onPress={() => {}} supportingText="Harlem">Apollo</ListItem>
</List>;

// The adapter must not claim internal Expo styles or uncontrolled expansion.
// @ts-expect-error Expansion remains caller-controlled.
export const uncontrolled = <Collapsible label="Travel details" onOpenChange={onOpenChange} />;
// @ts-expect-error Native control callbacks carry booleans, not event objects.
export const eventCallback = <Collapsible label="Travel details" isOpen onOpenChange={(_event: { nativeEvent: boolean }) => {}} />;
// @ts-expect-error Class names target the outer box; Expo labelStyle is not exposed.
export const labelStyle: ComponentProps<typeof Collapsible> = { label: 'Travel details', isOpen: true, onOpenChange, labelStyle: { color: 'red' } };
