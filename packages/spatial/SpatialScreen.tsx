'use client';

import { CircuitButton, GlyphCity, GridCard, GridScene, Heading, Text } from '@acme/ui';
import { ScrollView, Section, View } from '@acme/ui/tw';
import { RiveStage } from './rive/RiveStage';
import { ForkSpatialLayout, getSpatialForkCapabilities } from './ForkSpatialLayout';
import { SpatialViroExperience } from './SpatialViroExperience';
import { TabletopSessionPanel } from './TabletopSessionPanel';
import { gridRace } from './gridRaceStore';
import { tabletopSession, useTabletopSessionStore } from './tabletopSessionStore';

const RIVE_DEMO = require('./rive/assets/learning-question.riv') as number;

export function SpatialScreen() {
  const capabilities = getSpatialForkCapabilities();
  const showRace = useTabletopSessionStore((state) => state.spatialViewOpen);
  const setShowRace = useTabletopSessionStore((state) => state.setSpatialViewOpen);

  const tools = (
    <GridCard eyebrow="Runtime" title="Spatial backend">
      <Text className="text-sm text-white/70">
        {capabilities.metaSpatialWindows ? 'Meta Layout spatial window' : 'Inline / Viro spatial fallback'}
      </Text>
      <Text className="text-xs text-white/50">
        Viro Rive surface: {capabilities.viroRivePanel ? 'fork bridge detected' : 'stock fallback'}
      </Text>
    </GridCard>
  );

  return (
    <ForkSpatialLayout panel={tools}>
      <GridScene
        className="flex-1"
        horizon={0.44}
        gap={0}
        speed={0.6}
        lineColor="#00f3ff"
        glowColor="#00f3ff"
        backgroundColor="#050505"
        opacity={0.88}
        showCeiling={false}
      >
        <View pointerEvents="none" className="absolute inset-x-0 top-0 h-[44%]">
          <GlyphCity
            className="flex-1"
            variant="megacity"
            colorPrimary="#00f3ff"
            colorSecondary="#ff8a00"
            colorTertiary="#fff4b0"
            opacity={0.68}
          />
        </View>
        <View
          pointerEvents="none"
          className="absolute inset-x-0 h-px bg-cyan-200/40"
          style={{ top: '44%' }}
        />
        <ScrollView
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-8 sm:px-6 lg:px-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section className="max-w-4xl gap-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              Harlem Might / Grid Program
            </Text>
            <Heading level={1} size="display-sm" className="text-white">
              Build once for screen, spatial windows, WebXR, Quest and Pico.
            </Heading>
            <Text className="max-w-3xl text-white/65">
              Tailwind 4 + Uniwind for product UI, Skia for universal GPU scenes, Rive for animated surfaces,
              and Viro/OpenXR for the immersive world.
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-3">
              <CircuitButton onPress={() => { tabletopSession.getState().reset(); gridRace.enterGateway(); setShowRace(true); }}>
                Enter VR Grid
              </CircuitButton>
              <CircuitButton
                tone="orange"
                variant="solid"
                onPress={() => {
                  if (showRace) {
                    gridRace.enterGateway();
                    tabletopSession.getState().reset();
                    setShowRace(false);
                  } else {
                    tabletopSession.getState().reset();
                    gridRace.startRace();
                    setShowRace(true);
                  }
                }}
              >
                {showRace ? 'Exit Spatial View' : 'Start 37-Cycle Race'}
              </CircuitButton>
            </View>
          </Section>

          <View className="gap-4 lg:flex-row">
            <GridCard className="flex-1" eyebrow="01 / Universal graphics" title="Skia scenes">
              <Text className="text-sm leading-6 text-white/60">Grid Floor, Grid Scene and Glyph City share one Skia renderer across Expo and web.</Text>
            </GridCard>
            <GridCard className="flex-1" eyebrow="02 / Interface" title="Future controls">
              <Text className="text-sm leading-6 text-white/60">Reusable grid cards and circuit buttons remain semantic, responsive and Uniwind-driven.</Text>
            </GridCard>
            <GridCard className="flex-1" eyebrow="03 / Immersion" title="OpenXR race" tone="orange">
              <Text className="text-sm leading-6 text-white/60">Enter a black-vector arena for 90° light-cycle combat with persistent jetwalls, boost, AI rivals, rounds, and derez collisions.</Text>
            </GridCard>
          </View>

          <TabletopSessionPanel onLaunch={() => setShowRace(true)} />

          {showRace ? (
            <View className="min-h-[460px] overflow-hidden border border-cyan-300/25 bg-black/70">
              <SpatialViroExperience />
            </View>
          ) : (
            <GridCard eyebrow="XR Gateway" title="The portal is armed" tone="orange">
              <Text className="text-sm leading-6 text-white/60">
                Choose Enter VR Grid to mount the shared Viro scene. Quest/Pico use the same scene module as the web preview.
              </Text>
            </GridCard>
          )}

          <View className="gap-3">
            <Text className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-200">
              Universal Rive surface
            </Text>
            <RiveStage source={RIVE_DEMO} artboard="LearningQuestion" stateMachine="QuestionFlow" />
          </View>
        </ScrollView>
      </GridScene>
    </ForkSpatialLayout>
  );
}
