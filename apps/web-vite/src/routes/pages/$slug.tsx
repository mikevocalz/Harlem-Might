import { createFileRoute, notFound } from '@tanstack/react-router';
import { Heading, Text } from '@acme/ui';
import { Article, Main, Section, View } from '@acme/ui/tw';
import { getPage } from '@/lib/payload';

export const Route = createFileRoute('/pages/$slug')({
  loader: async ({ params }) => {
    const page = await getPage(params.slug);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? 'Story'} — Harlem Might` },
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
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-4xl gap-8 px-4 py-12 sm:px-6 md:py-16">
        <View className="gap-4 border-b border-border pb-8">
          <Text className="self-start rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-muted">
            {page.slug}
          </Text>
          <Heading level={1} size="display-md" className="tracking-[-0.035em] text-text">
            {page.title}
          </Heading>
          {page.summary ? (
            <Text className="max-w-3xl text-base leading-7 text-text-muted md:text-lg md:leading-8">
              {page.summary}
            </Text>
          ) : null}
        </View>

        <Article className="max-w-content-prose gap-5">
          {(page.body ?? '').split('\n\n').map((paragraph, index) => (
            <Text key={index} className="text-base leading-7 text-text md:text-lg md:leading-8">
              {paragraph}
            </Text>
          ))}
        </Article>

        <View className="border-l-2 border-l-primary pl-5">
          <Text className="text-sm leading-6 text-text-muted">
            Place-aware sources, related people and map anchors will appear here as the full Stories model lands.
          </Text>
        </View>
      </Section>
    </Main>
  );
}
