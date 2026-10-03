import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Article, P } from '@acme/ui/tw';
import { MightsHeading, MightsPage, routes } from '@acme/ui/mights';

const DOCS = {
  privacy: {
    title: 'Privacy',
    description: 'How Harlem Might handles personal information.',
    body: [
      'This privacy policy is being prepared and is not yet in effect.',
      'This page will set out what the site and the app collect, why, and how to ask for your data to be removed.',
    ],
  },
  terms: {
    title: 'Terms',
    description: 'Terms of use for Harlem Might.',
    body: [
      'These terms of use are being prepared and are not yet in effect.',
      'This page will set out the conditions for using the site and the app.',
    ],
  },
  accessibility: {
    title: 'Accessibility',
    description: 'Accessibility statement for Harlem Might.',
    body: [
      'Harlem Might aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.',
      'Every map on the site has a list alternative, and every page can be used with a keyboard.',
      'A contact address for reporting barriers is being set up and will be listed here.',
    ],
  },
} as const;

type Doc = keyof typeof DOCS;
const UPDATED = '3 October 2026';

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  return entry ? { title: entry.title, description: entry.description } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc as Doc];
  if (!entry) notFound();
  return (
    <MightsPage
      title={entry.title}
      crumbs={[{ label: 'Legal', href: routes.legalIndex() }, { label: entry.title, href: routes.legal(doc as Doc) }]}
    >
      <Article className="max-w-[80ch] gap-5">
        <MightsHeading level={2} size="title">
          Draft, last updated {UPDATED}
        </MightsHeading>
        {entry.body.map((line) => (
          <P key={line} className="font-serif text-[19px] leading-[1.75] text-text">
            {line}
          </P>
        ))}
      </Article>
    </MightsPage>
  );
}
