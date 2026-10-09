import type { ReactNode } from 'react';
import { ScrollView, View } from '../tw';
import { MightsHeading, MightsText } from './MightsType';

// Native fork of MightsPage.tsx: same props. One scrolling column; the
// breadcrumb is dropped because the native stack header already shows the
// way back. `media` leads above the title so every page opens on an image.
export function MightsPage({
  title,
  lead,
  media,
  children,
}: {
  title: string;
  lead?: ReactNode;
  crumbs?: unknown;
  media?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-24"
    >
      {media ? <View className="w-full">{media}</View> : null}
      <View className="border-b border-rule-hairline bg-paper/45 px-5 pb-10 pt-8">
        <View className="border-l-2 border-primary pl-5">
          <MightsHeading level={1} size="display-lg">
            {title}
          </MightsHeading>
          {lead ? (
            <MightsText size="lead" className="mt-4">
              {lead}
            </MightsText>
          ) : null}
        </View>
      </View>
      <View className="gap-14 px-5 pt-8">{children}</View>
    </ScrollView>
  );
}

/** A titled band inside a page: hairline on top, heading, then content. */
export function MightsBand({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-6 border-t border-rule-rail pt-6">
      <View className="gap-4">
        <MightsHeading>{title}</MightsHeading>
        {action}
      </View>
      {children}
    </View>
  );
}
