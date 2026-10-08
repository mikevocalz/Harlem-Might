import { MightsBand, MightsButton, MightsText, routes } from '@acme/ui/mights';
import { SPATIAL_STATUS, statusLabel } from './ar-status';

// B11 (proof cluster) is struck, 2026-10-07: a concept has no proof records to
// put in a bento, and the hardware rows are a compatibility list, which the
// pack keeps out of bentos. Revisit when a place-label AR build has the
// 8-point device record in docs/XR-PLATFORM-MATRIX.md.
// Plain list, no logos: names and status words only.
export function ArStatusList() {
  return (
    <MightsBand
      title="Where each piece stands"
      action={
        <MightsButton href={routes.download()} variant="secondary" size="sm">
          The app
        </MightsButton>
      }
    >
      <dl className="flex max-w-content-screen flex-col">
        {SPATIAL_STATUS.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 gap-2 border-b border-rule-hairline py-6 md:grid-cols-12 md:gap-6"
          >
            <dt className="md:col-span-4">
              <MightsText tone="default" className="font-semibold">
                {row.name}
              </MightsText>
            </dt>
            <dd className="flex flex-col gap-1 md:col-span-8">
              <MightsText tone="default">{statusLabel(row.status)}</MightsText>
              <MightsText>{row.detail}</MightsText>
            </dd>
          </div>
        ))}
      </dl>
      <MightsText size="small">
        Nothing here is verified yet. Verified means it passed an eight-point check on the real device: render, input,
        camera and permissions, window behavior, performance and the rest. Until then we use preview (code on an
        unmerged branch), concept (design only), integration path (merged and builds, not run on the device) and in
        testing (running on a simulator or a stand-in device).
      </MightsText>
    </MightsBand>
  );
}
