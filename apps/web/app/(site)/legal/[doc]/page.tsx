import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { View } from '@acme/ui/tw';
import { MightsFigure, MightsPage, MightsProse, MightsText, type ProseSection, routes } from '@acme/ui/mights';
import { ACCESSIBILITY, DRAFT_NOTE, LEGAL_UPDATED, PRIVACY, TERMS } from '../../../../content/legal';
import { companyImage } from '../../../../lib/companyImage';

type Doc = 'privacy' | 'terms' | 'accessibility';

const DOCS: Record<Doc, { title: string; description: string; lead: string; sections: readonly ProseSection[]; alt: string; draft: boolean }> = {
  privacy: {
    title: 'Privacy',
    description: 'What Harlem Might collects, what it does not, and how maps are delivered.',
    lead: 'No accounts, no analytics, no advertising and no tracking on the public site.',
    sections: PRIVACY,
    alt: 'A quiet Harlem side street at night with one lit window',
    draft: true,
  },
  terms: {
    title: 'Terms',
    description: 'The terms for using the Harlem Might website.',
    lead: 'Use the guide freely, respect the neighborhood, and check details before you travel.',
    sections: TERMS,
    alt: 'A person on a sidewalk looking up at brownstone cornices',
    draft: true,
  },
  accessibility: {
    title: 'Accessibility',
    description: 'How Harlem Might works for people with disabilities, and where it still falls short.',
    lead: 'Harlem Might aims to meet WCAG 2.2 at level AA, and tells you plainly where it does not yet.',
    sections: ACCESSIBILITY,
    alt: 'A ramp beside a brownstone stoop and a curb cut at the corner',
    draft: false,
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  return entry ? { title: entry.title, description: entry.description } : {};
}

// params are awaited inside Suspense so the route can prerender a shell
// (Cache Components: 'Await params inside <Suspense>').
export default function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  return (
    <Suspense>
      <LegalPageContent params={params} />
    </Suspense>
  );
}

async function LegalPageContent({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  if (!entry) notFound();
  return (
    <MightsPage
      title={entry.title}
      lead={entry.lead}
      crumbs={[
        { label: 'Legal', href: routes.legalIndex() },
        { label: entry.title, href: routes.legal(doc as Doc) },
      ]}
    >
      <MightsFigure src={companyImage(`legal-${doc}`)} alt={entry.alt} priority />
      {entry.draft ? (
        <View className="border-l-2 border-primary bg-surface-raised px-5 py-4">
          <MightsText tone="default">{DRAFT_NOTE}</MightsText>
        </View>
      ) : null}
      <MightsProse sections={entry.sections} updated={LEGAL_UPDATED} />
    </MightsPage>
  );
}
