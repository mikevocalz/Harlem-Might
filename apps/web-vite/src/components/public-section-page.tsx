import { Card, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';

export interface PublicSectionItem {
  title: string;
  body: string;
}

export interface PublicSectionPageProps {
  headline: string;
  intro: string;
  items: PublicSectionItem[];
  closing?: string;
}

export function PublicSectionPage({
  headline,
  intro,
  items,
  closing,
}: PublicSectionPageProps) {
  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <View className="max-w-4xl gap-4">
          <Heading level={1} size="display-lg" className="tracking-[-0.035em] text-text">
            {headline}
          </Heading>
          <Text className="max-w-3xl text-base leading-7 text-text-muted md:text-lg md:leading-8">
            {intro}
          </Text>
        </View>

        <View className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <Card
              key={item.title}
              elevation={index === 0 ? 'raised' : 'flat'}
              className="min-h-48 gap-4 border-border bg-surface-raised p-5 md:p-6"
            >
              <Text className="text-xs font-semibold tabular-nums text-primary">
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Heading level={2} size="title" className="text-text">
                {item.title}
              </Heading>
              <Text className="text-sm leading-6 text-text-muted md:text-base md:leading-7">
                {item.body}
              </Text>
            </Card>
          ))}
        </View>

        {closing ? (
          <View className="max-w-4xl border-l-2 border-l-primary pl-5">
            <Text className="text-base leading-7 text-text md:text-lg">{closing}</Text>
          </View>
        ) : null}
      </Section>
    </Main>
  );
}
