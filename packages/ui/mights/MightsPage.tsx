import { MightsBreadcrumb, type Crumb } from './MightsBreadcrumb';
import { MightsHeading, MightsText } from './MightsType';

// Shared frame for content routes: breadcrumb, one h1, an optional lead.
export function MightsPage({
  title,
  lead,
  crumbs,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  crumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col bg-surface pb-24">
      {crumbs ? <MightsBreadcrumb items={crumbs} /> : null}
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 pb-14 pt-12 sm:px-6 md:pt-20">
        <MightsHeading level={1} size="display-lg" className="max-w-[18ch]">
          {title}
        </MightsHeading>
        {lead ? <MightsText size="lead">{lead}</MightsText> : null}
      </div>
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-16 px-4 sm:px-6">{children}</div>
    </main>
  );
}

/** A titled band inside a page: hairline on top, heading, then content. */
export function MightsBand({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-8 border-t border-rule-rail pt-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <MightsHeading>{title}</MightsHeading>
        {action}
      </div>
      {children}
    </section>
  );
}
