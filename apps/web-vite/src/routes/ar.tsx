import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/ar')({
  head: () => ({ meta: [{ title: 'AR — Harlem Might' }] }),
  component: ArPage,
});

function ArPage() {
  return (
    <PublicSectionPage
      headline="From the map to the sidewalk."
      intro="Choose a place, walk the route and carry the destination into AR. Harlem Might targets the real entrance when we have one—not the middle of the parcel."
      items={[
        { title: 'Choose a place', body: 'The same Place ID powers the map pin, detail panel, route session, AR anchor, story and tour stop.' },
        { title: 'Find the right entrance', body: 'Primary, accessible and alternate entrances are separate anchors with their own verification and source history.' },
        { title: 'See context in place', body: 'Rive presents compact route state while Viro owns world tracking and the shared Three/WebGPU stack handles premium spatial visuals.' },
      ]}
      closing="The web explains and previews the experience. Camera AR remains an app/spatial-device mode rather than a browser gimmick in v1."
    />
  );
}
