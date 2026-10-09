import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { getHarlemArchivalImage } from '@acme/app/content';
import { MightsButton, MightsEditorialImage, MightsPage, MightsProse, routes } from '@acme/ui/mights';
import { ABOUT_LEAD, ABOUT_SECTIONS } from '../../../content/about';
import { companyImage } from '../../../lib/companyImage';

export const metadata: Metadata = {
  title: 'About',
  description: 'Who makes Harlem Might, how every place is researched, and where the facts come from.',
};

// Illustrations attach to sections by id; see docs/design/IMAGE_PROMPTS.md.
const FIGURES: Record<string, { slug: string; alt: string }> = {
  'one-place': { slug: 'about-one-place', alt: 'A hand holding a phone with a map in front of a brownstone entrance' },
  history: { slug: 'about-history', alt: 'An old theater marquee lit at night on a Harlem avenue' },
  method: { slug: 'about-method', alt: 'Old black-and-white street photographs, a notebook and a map on a wooden table' },
  sources: { slug: 'about-sources', alt: 'A quiet library reading room with long tables and archive boxes' },
};
const archive = getHarlemArchivalImage('nypl-harlem-tenement-summer-1930s');

export default function AboutPage() {
  const sections = ABOUT_SECTIONS.map((s) => {
    const f = FIGURES[s.id];
    return f ? { ...s, figure: { src: companyImage(f.slug), alt: f.alt } } : s;
  });
  return (
    <MightsPage
      title="About Harlem Might"
      lead={ABOUT_LEAD}
      media={archive ? (
        <MightsEditorialImage image={archive} screenId="about" ratio="standard" sizes="(min-width: 768px) 40vw, 100vw" priority />
      ) : undefined}
    >
      <MightsProse sections={sections} />
      <View className="flex-row flex-wrap gap-3 border-t border-rule-rail pt-8">
        <MightsButton href={routes.explore()}>Open the map</MightsButton>
        <MightsButton href={routes.press()} variant="secondary">
          Press
        </MightsButton>
      </View>
    </MightsPage>
  );
}
