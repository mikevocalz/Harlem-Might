'use client';
// Explore — mirrors the liquid-glass template (title, search, category pills,
// featured rail, resource grid) on kit tokens with Legend Motion staggers.
import { Heart, Eye } from '@acme/ui/icons';
import { Section, View, Text as TWText, ScrollView, Pressable } from '@acme/ui/tw';
import { Heading, PressScale, SearchBar, Text, FadeIn, ScaleIn } from '@acme/ui';
import { WELL, INK } from '../home/home.data';
import { CATEGORIES, FEATURED, CARDS, useExplore } from './explore.store';

export function ExploreContent() {
  const { query, category, setQuery, setCategory } = useExplore();
  const visible = CARDS.filter(
    (card) =>
      (category === 'All' || card.category === category) &&
      (!query || card.title.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <View className="gap-6 md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Explore</Heading>
          <Text tone="muted">Discover templates and resources.</Text>
        </Section>
      </FadeIn>

      <FadeIn delay={60}>
        <SearchBar value={query} onChangeText={setQuery} debounceMs={250} placeholder="Search resources…" />
      </FadeIn>

      {/* Category pills */}
      <FadeIn delay={100}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2">
          {CATEGORIES.map((cat) => {
            const active = category === cat.label;
            return (
              <Pressable
                key={cat.label}
                role="tab"
                aria-label={cat.label}
                onPress={() => setCategory(cat.label)}
                className={`flex-row items-center gap-1.5 rounded-md border-2 px-4 py-2 transition-colors duration-fast ${
                  active
                    ? 'border-primary bg-primary'
                    : 'border-border bg-surface-raised hover:bg-surface-sunken'
                }`}
              >
                <cat.icon size={14} className={active ? 'text-on-primary' : 'text-text-muted'} />
                <TWText className={`text-sm font-medium ${active ? 'text-on-primary' : 'text-text-muted'}`}>
                  {cat.label}
                </TWText>
              </Pressable>
            );
          })}
        </ScrollView>
      </FadeIn>

      {/* Featured rail */}
      <FadeIn delay={140}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-3 pb-1.5 pr-1.5">
            {FEATURED.map((item, i) => (
              <ScaleIn key={item.title} delay={160 + i * 60}>
                <PressScale
                  className={`w-48 gap-8 overflow-hidden rounded-card p-5 shadow-card ${item.bg}`}
                  outerClassName="self-start"
                >
                  <View aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-ink-50/10" />
                  <item.icon size={26} className="text-ink-50" />
                  <View className="gap-0.5">
                    <TWText className="text-base font-bold text-ink-50">{item.title}</TWText>
                    <TWText className="text-xs text-ink-50/80">{item.subtitle}</TWText>
                  </View>
                </PressScale>
              </ScaleIn>
            ))}
          </ScrollView>
        </Section>
      </FadeIn>

      {/* Resource grid */}
      <Section className="gap-3">
        <Text variant="label" tone="muted">Resources</Text>
        <View className="flex-row flex-wrap gap-3">
          {visible.map((card, i) => (
            <FadeIn key={card.title} delay={200 + i * 50} className="min-w-40 flex-1 basis-[45%]">
              <PressScale
                className="w-full gap-3 rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
                outerClassName="w-full"
              >
                <View className="flex-row items-start justify-between">
                  <View className={`h-10 w-10 items-center justify-center rounded-xl ${WELL[card.tone]}`}>
                    <card.icon size={20} className={INK[card.tone]} />
                  </View>
                  <View className="rounded-sm bg-surface-sunken px-2.5 py-1">
                    <TWText className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      {card.tag}
                    </TWText>
                  </View>
                </View>
                <TWText className="text-base font-semibold text-text">{card.title}</TWText>
                <View className="flex-row items-center gap-4">
                  <View className="flex-row items-center gap-1">
                    <Heart size={13} className="text-text-muted" />
                    <Text variant="caption" tone="muted">{card.likes}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Eye size={13} className="text-text-muted" />
                    <Text variant="caption" tone="muted">{card.views}</Text>
                  </View>
                </View>
              </PressScale>
            </FadeIn>
          ))}
        </View>
      </Section>
    </View>
  );
}
