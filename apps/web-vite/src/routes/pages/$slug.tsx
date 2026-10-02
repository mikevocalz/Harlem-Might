/**
 * `/pages/$slug` — one published CMS page. The loader fetches by slug and
 * throws notFound when it resolves to nothing (unpublished, missing, or the
 * CMS down), which the router renders through the registered 404.
 *
 * SOT-KEYWORDS: web-vite page detail payload slug
 */
import { createFileRoute, notFound } from '@tanstack/react-router';
import { Heading, Text } from '@acme/ui';
import { Article, Main, Section } from '@acme/ui/tw';
import { getPage } from '@/lib/payload';

export const Route = createFileRoute('/pages/$slug')({
  loader: async ({ params }) => {
    const page = await getPage(params.slug);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? 'Page'} — Harlem Might` },
      ...(loaderData?.summary
        ? [{ name: 'description', content: loaderData.summary }]
        : []),
    ],
  }),
  component: PageDetail,
});

function PageDetail() {
  const page = Route.useLoaderData();

  return (
    <Main className="flex-1">
      <Section className="mx-auto w-full max-w-3xl gap-5 px-4 py-16 sm:px-6">
        <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
          Harlem Might / {page.slug}
        </Text>
        <Heading level={1} size="display-sm" className="text-white">
          {page.title}
        </Heading>
        {page.summary ? (
          <Text className="text-base leading-relaxed text-cyan-100/60">{page.summary}</Text>
        ) : null}
        <Article className="gap-4 border-t border-cyan-400/15 pt-8">
          {(page.body ?? '').split('\n\n').map((paragraph, index) => (
            <Text key={index} className="text-base leading-relaxed text-cyan-100/80">
              {paragraph}
            </Text>
          ))}
        </Article>
      </Section>
    </Main>
  );
}
