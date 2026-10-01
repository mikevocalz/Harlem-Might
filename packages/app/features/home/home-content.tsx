'use client';
// Dashboard home — mirrors the liquid-glass template's structure (greeting,
// hero, stats grid, quick actions, projects) on the kit's tokens, with
// Legend Motion in place of Reanimated.
import { ArrowUp } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Card, Heading, PressScale, Text, FadeIn, ScaleIn } from '@acme/ui';
import { useProfile } from '../profile/profile.store';
import { STATS, QUICK_ACTIONS, PROJECTS, WELL, INK, BAR } from './home.data';
import { getHours } from 'date-fns';
import { useNow } from '../schedule/use-now';

function greetingFor(now: Date) {
  const hour = getHours(now);
  if (hour < 12) return 'Good morning ☀️';
  if (hour < 18) return 'Good afternoon 🌤️';
  return 'Good evening 🌙';
}

export function HomeContent() {
  const name = useProfile((s) => s.name);
  // The greeting was hardcoded to "Good morning" and read as wrong for most of
  // the day. useNow already ticks for the schedule's current-time line, so the
  // greeting re-renders when the hour rolls over instead of only at mount.
  const greeting = greetingFor(useNow());

  return (
    <View className="gap-7 md:gap-10 lg:gap-12">
      {/* Greeting */}
      <FadeIn>
        {/* Greeting and name sit on ONE line at the same weight — hierarchy
            comes from colour, not from a size or weight jump, so the two read
            as a single sentence rather than a label stacked over a heading. */}
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">{greeting}</Text>
          <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
            {name.split(' ')[0]}
          </Heading>
        </Section>
      </FadeIn>

      {/* Hero banner */}
      <FadeIn delay={80}>
        <PressScale className="w-full overflow-hidden rounded-card bg-primary p-6 shadow-card" outerClassName="w-full">
          <View aria-hidden className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-ink-50/10" />
          <View aria-hidden className="absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-ink-50/5" />
          <View className="gap-1">
            <TWText className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">
              Weekly summary
            </TWText>
            <TWText className="font-display text-4xl font-bold text-on-primary">$24,820</TWText>
            <View className="flex-row items-center gap-1.5">
              <ArrowUp size={14} className="text-on-primary/90" />
              <TWText className="text-sm text-on-primary/90">12.4% vs last week</TWText>
            </View>
          </View>
        </PressScale>
      </FadeIn>

      {/* Stats grid */}
      <FadeIn delay={160}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Overview</Text>
          <View className="flex-row flex-wrap gap-3">
            {STATS.map((stat, i) => (
              <ScaleIn key={stat.label} delay={180 + i * 50} className="min-w-36 flex-1 basis-[45%]">
                <PressScale
                  className="w-full gap-2 rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
                  outerClassName="w-full"
                >
                  <View className={`h-9 w-9 items-center justify-center rounded-lg ${WELL[stat.tone]}`}>
                    <stat.icon size={18} className={INK[stat.tone]} />
                  </View>
                  <TWText className="text-2xl font-bold text-text">{stat.value}</TWText>
                  <View className="flex-row items-center justify-between">
                    <Text variant="caption" tone="muted">{stat.label}</Text>
                    <TWText className={`text-xs font-semibold ${stat.up ? 'text-accent' : 'text-danger'}`}>
                      {stat.change}
                    </TWText>
                  </View>
                </PressScale>
              </ScaleIn>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Quick actions */}
      <FadeIn delay={260}>
        <Section className="gap-3">
          <Text variant="label" tone="muted">Quick actions</Text>
          <View className="flex-row flex-wrap gap-3">
            {QUICK_ACTIONS.map((action, i) => (
              <FadeIn key={action.label} delay={280 + i * 40} className="min-w-20 flex-1">
                <PressScale
                  className="w-full items-center gap-2 rounded-card border-2 border-border bg-surface-raised px-3 py-4"
                  outerClassName="w-full"
                >
                  <View className={`h-11 w-11 items-center justify-center rounded-xl ${WELL[action.tone]}`}>
                    <action.icon size={22} className={INK[action.tone]} />
                  </View>
                  <Text variant="caption" tone="muted">{action.label}</Text>
                </PressScale>
              </FadeIn>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* Active projects */}
      <FadeIn delay={340}>
        <Section className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">Active projects</Text>
            <PressScale onPress={() => {}} className="rounded-md px-2 py-1" outerClassName="self-start">
              <Text variant="caption" className="font-bold text-text underline">See all</Text>
            </PressScale>
          </View>
          <View className="gap-3">
            {PROJECTS.map((project, i) => (
              <FadeIn key={project.name} delay={360 + i * 60}>
                <Card className="gap-3">
                  <View className="flex-row items-center gap-2.5">
                    <View className={`h-2.5 w-2.5 rounded-full ${BAR[project.tone]}`} />
                    <TWText className="flex-1 text-base font-semibold text-text">{project.name}</TWText>
                    <TWText className={`text-sm font-bold ${INK[project.tone]}`}>{project.progress}%</TWText>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <View
                      className={`h-full rounded-full ${BAR[project.tone]} ${
                        project.progress > 90 ? 'w-[95%]' : project.progress > 75 ? 'w-4/5' : 'w-3/5'
                      }`}
                    />
                  </View>
                  <Text variant="caption" tone="muted">{project.members} teammates</Text>
                </Card>
              </FadeIn>
            ))}
          </View>
        </Section>
      </FadeIn>
    </View>
  );
}
