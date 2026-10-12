import { Figcaption, Figure } from '@acme/ui/html';
import { Image } from '@acme/ui';
import { MightsAccentFrame } from '@acme/ui/mights';

const LABEL =
  'Concept render of Sightline: AR glasses over a street view, showing a walking route to the Apollo Theater, four minutes, and Sylvia’s Restaurant, seven minutes.';

// The Three.js/WebGPU concept demo is replaced by the static Sightline render —
// a plain image paints everywhere, needs no GPU feature detection, and carries
// no client chunk. Sizing goes on Image's own className: its fill branch
// renders its own wrapper, so an outer box leaves the image at zero height.
// The figure caps at the content-screen width so the render never stretches
// across the band.
export function SightlineIsland() {
  return (
    <Figure className="flex max-w-content-screen flex-col gap-3">
      <MightsAccentFrame tone="iron" className="p-3">
        <Image
          src="/ar/sightline-concept.jpg"
          alt={LABEL}
          fill
          className="aspect-[3/2] bg-surface-sunken"
          sizes="(min-width: 1024px) 56rem, 100vw"
        />
      </MightsAccentFrame>
      <Figcaption className="text-label text-text-muted">
        Concept render. The glasses and puck don’t exist; nobody can buy them and we haven’t built for them.
      </Figcaption>
    </Figure>
  );
}
