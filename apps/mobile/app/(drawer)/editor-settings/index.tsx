'use client';
import { SafeArea } from '@acme/ui';
import { EditorSettingsScreen } from '@acme/app';

// Editor settings live on their own route so a toolbar can link to them from
// anywhere an editor is mounted, without each host presenting its own modal.
//
// The screen owns its ScrollView rather than being wrapped in one here: the
// drag-to-reorder gesture needs a ref to that scroller so it can block it while
// a row is lifted.
export default function EditorSettingsRoute() {
  return (
    <SafeArea edges={['bottom']} className="flex-1 bg-surface">
      <EditorSettingsScreen />
    </SafeArea>
  );
}
