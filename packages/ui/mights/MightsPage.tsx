import { Main, Section } from '../html';
import { View } from '../tw';
import { MightsBreadcrumb, type Crumb } from './MightsBreadcrumb';
import { MightsHeading, MightsText } from './MightsType';

// Shared frame for content routes: breadcrumb, one h1, an optional lead.
export function MightsPage({
  title,
  lead,
  crumbs,
  media,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  crumbs?: Crumb[];
  /** Licensed photo or map module for the masthead; omitted on dense records. */
  media?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Main className="flex flex-1 flex-col bg-surface pb-24">
      {crumbs ? <MightsBreadcrumb items={crumbs} /> : null}
      <View className="border-b border-rule-hairline bg-paper/45">
        <View
          className={`mx-auto grid w-full max-w-screen-2xl gap-10 px-4 pb-14 pt-12 sm:px-6 md:pt-20 ${
            media ? 'md:grid-cols-12 md:items-end md:gap-6' : ''
          }`}
        >
          <View className={`border-l-2 border-primary pl-5 md:pl-7 ${media ? 'md:col-span-7' : ''}`}>
            <MightsHeading level={1} size="display-lg" className="max-w-[18ch]">
              {title}
            </MightsHeading>
            {lead ? <MightsText size="lead" className="mt-5 max-w-content-detail">{lead}</MightsText> : null}
          </View>
          {media ? <View className="md:col-span-5">{media}</View> : null}
        </View>
      </View>
      <View className="mx-auto flex w-full max-w-screen-2xl flex-col gap-16 px-4 pt-10 sm:px-6 md:pt-14">{children}</View>
    </Main>
  );
}

/** A titled band inside a page: hairline on top, heading, then content. */
export function MightsBand({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Section className="flex flex-col gap-8 border-t border-rule-rail pt-6">
      <View className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <MightsHeading>{title}</MightsHeading>
        {action}
      </View>
      {children}
    </Section>
  );
}
