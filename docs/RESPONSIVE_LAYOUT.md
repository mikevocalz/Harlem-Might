# Responsive layout contract

Mike's requirements, 2026-10-10. These supersede older width-only rail and
Quest drawer rules.

- Ordinary phones have bottom tabs. Tablets and all foldables have a right
  rail, including the cover display when folded. A small window is not evidence
  that a device is an ordinary phone.
- On the iPhone Duo, the reserved hardware column owns the rail. Use that
  column's width, center the items vertically, and consume its inset once.
  This follows MoyoLearn's rail implementation.
- Tab content retains an app header with the bundled landscape Harlem Might
  logo. Do not replace the logo with text.
- Editorial content fills the available pane when compact and is centered at
  `max-w-4xl` on larger panes. Stories uses responsive masonry cards below a
  masthead with the image on the left (60%) and text on the right (40%). The
  compact masthead stacks at full width. Measure the actual container.
- Wide Explore divides its list/map workspace 40/60. Selected-place content
  belongs in the trailing inspector. In this app specifically, the inline
  inspector overlays the map at 30% of the available Explore width and consumes
  no layout width. Opening/closing
  it must not alter the underlying 40/60 split. Compact flat displays show one pane
  at full width, with Back returning from the selected place.
- Quest always keeps the list and map visible, including during resizing.
  Its selected inspector opens in the separate detail panel; if opening fails,
  it is a trailing overlay inspector. The main window remains 1440×900dp,
  orientation `default`, and the detail window remains 400×600dp.
- All React state uses Zustand, including per-instance measurement and gallery
  state. Native resources and imperative handles stay in refs.

At the 1440dp Quest window default, the list is 576dp and the map is 864dp
when the inspector is absent or promoted. The inline inspector is a 432dp overlay (30%); the list stays 576dp
and the map stays 864dp while it is open. The app window itself never changes.

## Verification and remaining device work

The Duo simulator showed the right rail both open and folded. After the final
layout reload, it showed the restored app header, 60/40 Stories masthead and
two-column story grid in the open posture. A subsequent folded capture showed
the actual bundled landscape logo and full-width content beside the right rail. The native map also rendered 3D
buildings on the Duo. The earlier Quest capture showed streets and real
catalogue markers; selected-place building appearance and the latest panel
spacing remain unverified after its USB connection was lost.

The right-edge rail, 40/60 workspace, inspector selection/promotion, and resize
rules have focused tests, including unchanged list/map widths with the overlay
open or closed. These 32 tests passed; six catalogue tests, the masonry test,
mobile/shared/UI typechecks and affected-file lint checks also passed. Android's `DeviceCapabilities` module compiled and
uses hardware hinge/posture capabilities, not the currently folded width. It
requires a rebuilt Android app; physical Android fold/unfold validation is
still outstanding. The final Quest debug APK rebuilt successfully (932 tasks),
with merged window dimensions and Horizon metadata preserved. It has not been
installed on the disconnected headset. The gallery controls respect the safe area, including the Duo hardware column.
Opening a real three-photo gallery and tapping Close returned to the inspector
on the Duo. The inspector measured 30% of the Explore content width, and the
underlying map frame was identical before and after opening it. These latest
JavaScript changes were checked through Metro; the previously built Quest APK
predates the 30% adjustment and safe-area gallery change.

## Local content source

Native Explore now uses the shared Payload catalogue reader rather than eight
preview records. This session's read returned 1688 places (1686 with map
coordinates), 25 stories, three walks and zero events. Empty events were a
successful response. No seeding or database migration was performed.

For a local backend, run the web app with `PAYLOAD_PUSH=false`, configure
`EXPO_PUBLIC_PAYLOAD_API_BASE` as documented in `apps/mobile/.env.example`, and
forward port 3000 for a USB Android device. Keep Metro's separate port 8081
forward. A catalogue failure is visible and retains the last successful data;
it is not silently replaced with fixtures.
