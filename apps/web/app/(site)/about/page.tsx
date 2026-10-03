import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { MightsButton, MightsFigure, MightsPage, MightsProse, routes } from '@acme/ui/mights';
import { ABOUT_LEAD, ABOUT_SECTIONS } from '../../../content/about';
import { companyImage } from '../../../lib/companyImage';

export const metadata: Metadata = {
  title: 'About',
  description: 'Who makes Harlem Might, how every place is researched, and where the facts come from.',
};

// Illustrations attach to sections by id; see docs/design/IMAGE_PROMPTS.md.
const FIGURES: Record<string, { slug: string; alt: string }> = {
  'one-place': { slug: 'about-one-place', alt: 'Illustration of a brownstone, a phone map and a walking route linked by one gold line' },
  history: { slug: 'about-history', alt: 'Illustration of a theater marquee layered over the building that stands there today' },
  method: { slug: 'about-method', alt: 'Illustration of archival photographs, notes and a street map spread across a research table' },
  sources: { slug: 'about-sources', alt: 'Illustration of a library reading room with archive boxes and long tables' },
};

export default function AboutPage() {
  const sections = ABOUT_SECTIONS.map((s) => {
    const f = FIGURES[s.id];
    return f ? { ...s, figure: { src: companyImage(f.slug), alt: f.alt } } : s;
  });
  return (
    <MightsPage title="About Harlem Might" lead={ABOUT_LEAD}>
      <MightsFigure
        src={companyImage('about-hero')}
        alt="Illustration of a row of Harlem brownstones at dusk drawn in gold line work"
        priority
      />
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
