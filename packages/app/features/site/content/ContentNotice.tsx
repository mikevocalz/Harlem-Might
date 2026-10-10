import { HARLEM_ARCHIVAL_IMAGES, type EditorialImage } from '@acme/app/content';
import { Section } from '@acme/ui/html';
import { MightsEditorialImage, MightsHeading, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';

// The empty and could-not-check states for Walks, Stories and Today. Two
// different sentences on purpose: "nothing is published" is only said after
// the database answered (packages/app/content/README.md, failure semantics).
// The archival image is context, not a stand-in for a current listing.
export function ContentNotice({
  title,
  children,
  actions,
  image,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  image?: EditorialImage;
}) {
  const visual = image ?? HARLEM_ARCHIVAL_IMAGES[0];
  return (
    <Section
      aria-labelledby="content-notice"
      className="grid gap-8 border-t border-rule-rail py-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center"
    >
      <View className="flex max-w-content-detail flex-col gap-5">
        <MightsText size="small" className="font-semibold uppercase tracking-[0.16em] text-primary">
          Harlem archive
        </MightsText>
        <MightsHeading level={2} size="title" id="content-notice">
          {title}
        </MightsHeading>
        <MightsText>{children}</MightsText>
        <View className="flex flex-wrap gap-3">{actions}</View>
      </View>
      {visual ? (
        <MightsEditorialImage image={visual} screenId="content-notice" ratio="standard" sizes="(min-width: 768px) 40vw, 100vw" />
      ) : null}
    </Section>
  );
}
