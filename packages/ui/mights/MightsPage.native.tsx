import type { ReactNode } from 'react';
import { ScrollView, View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { Container } from '../layout/Container';
import { MightsHeading, MightsText } from './MightsType';

// Native fork of MightsPage.tsx: same props. One scrolling column; the
// breadcrumb is dropped because the native stack header already shows the
// way back. `media` leads above the title so every page opens on an image.
export function MightsPage({
  title,
  lead,
  media,
  mediaLayout = 'stacked',
  children,
}: {
  title: string;
  lead?: ReactNode;
  crumbs?: unknown;
  media?: ReactNode;
  mediaLayout?: 'stacked' | 'leading';
  children?: ReactNode;
}) {
  const store = useInstanceStore(() => ({ width: 0 }));
  const width = useStore(store, (state) => state.width);
  const split = Boolean(media) && mediaLayout === 'leading' && width >= 600;
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="pb-24"
    >
      <Container
        width="editorial"
        className="px-0 sm:px-0"
        onLayout={(event) => store.setState({ width: event.nativeEvent.layout.width })}
      >
        <View className="border-b border-rule-hairline bg-paper/45" style={{ flexDirection: split ? 'row' : 'column' }}>
          {media ? <View style={{ width: split ? '60%' : '100%' }}>{media}</View> : null}
          <View className="justify-center px-5 pb-10 pt-8" style={{ width: split ? '40%' : '100%' }}>
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
        </View>
        <View className="gap-14 px-4 pt-8">{children}</View>
      </Container>
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
