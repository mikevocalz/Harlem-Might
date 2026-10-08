import { MightsHeading, MightsText } from '@acme/ui/mights';

// The empty and could-not-check states for Walks, Stories and Today. Two
// different sentences on purpose: "nothing is published" is only said after
// the database answered (packages/app/content/README.md, failure semantics).
export function ContentNotice({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section aria-labelledby="content-notice" className="flex max-w-content-detail flex-col gap-5 border-l-2 border-rule-rail pl-5">
      <MightsHeading level={2} size="title" id="content-notice">
        {title}
      </MightsHeading>
      <MightsText>{children}</MightsText>
      <div className="flex flex-wrap gap-3">{actions}</div>
    </section>
  );
}
