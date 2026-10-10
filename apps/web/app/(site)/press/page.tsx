import type { Metadata } from 'next';
import { Image } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { getHarlemArchivalImage } from '@acme/app/content';
import { MightsBand, MightsButton, MightsEditorialImage, MightsNotchCard, MightsPage, MightsProse, MightsText } from '@acme/ui/mights';
import { PRESS_BOILERPLATE, PRESS_SECTIONS } from '../../../content/press';

export const metadata: Metadata = {
  title: 'Press',
  description: 'The Harlem Might story, fact sheet and logo for press and media.',
};

const LOGOS = [
  { name: 'Landscape logo', file: '/brand/Harlem-Might-Logo-landscape.png', preview: '/brand/harlem-might-landscape-144.webp', size: '2172 × 724 PNG' },
  { name: 'Portrait logo', file: '/brand/Harlem-Might-Logo-portrait.png', preview: '/brand/Harlem-Might-Logo-portrait.png', size: '1254 × 1254 PNG' },
] as const;
const archive = getHarlemArchivalImage('nypl-pushcart-vendors-eighth-avenue-1939');

export default function PressPage() {
  return (
    <MightsPage
      title="Press"
      lead={PRESS_BOILERPLATE}
      media={archive ? (
        <MightsEditorialImage image={archive} screenId="press" ratio="standard" sizes="(min-width: 768px) 40vw, 100vw" priority />
      ) : undefined}
    >
      <MightsProse sections={PRESS_SECTIONS} />
      <MightsBand title="Download the logo">
        <View className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LOGOS.map((logo) => (
            <MightsNotchCard key={logo.file}>
              <View className="h-56 items-center justify-center border-b border-rule-hairline bg-surface-sunken p-8">
                <Image
                  src={logo.preview}
                  alt={`Harlem Might ${logo.name.toLowerCase()}`}
                  fill
                  contentFit="contain"
                  className="h-full w-full"
                />
              </View>
              <View className="flex-row items-center justify-between gap-4 p-5">
                <View className="gap-1">
                  <MightsText tone="default">{logo.name}</MightsText>
                  <MightsText size="small">{logo.size}, transparent background</MightsText>
                </View>
                <MightsButton href={logo.file} external size="sm" variant="secondary">
                  Download
                </MightsButton>
              </View>
            </MightsNotchCard>
          ))}
        </View>
      </MightsBand>
    </MightsPage>
  );
}
