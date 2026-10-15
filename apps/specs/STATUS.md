# Harlem Might Specs Lens: status

State as of 2026-10-15, branch `feat/specs-map-places` (PR #81). Setup steps
are in [README.md](README.md).

## Architecture

- Lens Studio 5.24.1, SPECS 27 target.
- Lens Studio draws every pixel. ViroCore doesn't run on the glasses.
- `@viro-external/specs` is the UI layer. `HarlemMightSpecsEntry` builds
  portable nodes and calls `ViroSpecsPresentationHost.present()`:
  - `panel` becomes a UI Kit frame prefab
  - `text` becomes Lens Text with `textStyle`
  - `image` becomes a Lens Image from `ViroSpecsAssetRegistry`
  - `group` becomes a SceneObject; a group with `scroll` becomes a UI Kit
    ScrollWindow
  - `targets` become SIK Interactables, bound one frame later
- Outside Viro, the entry drives Snap's Navigation Kit (arrow,
  `ManualPlaceList`), Snap's map (`[MapComponent]` from the Navigation Kit
  sample), the WebView video screen, `InternetModule` fetches to Payload, and
  `RemoteMediaModule` photo downloads, which it hands to Viro with
  `registerImage`.
- viro-external dependencies: #68 is merged (textStyle, deferred SIK
  binding). #69 (`ViroSpecsAssetRegistry.registerImage`) and #70 (`scroll` on
  groups, rendered as a UI Kit ScrollWindow) are open. #70 adds no ScrollBar,
  because ScrollBar's `scrollWindow` and orientation are private inputs.

## Data

`HarlemMightContent` reads the same public Payload REST API as the mobile app
(`packages/app/content/rest-source.ts`, `readers.ts`) with anonymous GETs.
Payload's read access serves published documents.

| Tab | Query |
|---|---|
| Explore | featured places (9), images at depth 1 |
| Walks | published walks (3) |
| Stories | stories (25), newest first; image order: own, then places, then archive |
| Music | music artists sorted `name,id`, 24 per page, depth 1 |
| Today | events today in New York; if none, the next 90 days, scheduled first |

- `apiBase` on the entry is the Lens equivalent of
  `EXPO_PUBLIC_PAYLOAD_API_BASE` and ends in `/payload-api`. The committed
  default is `http://localhost:3200/payload-api`: the Harlem web app run
  locally on port 3200 against the Neon database from the repo `.env`.
- No public Payload host exists yet. `harlemmight.com` does not resolve and
  there is no Harlem Might Vercel project. Spectacles need a public https
  host. For a device run on the same Wi-Fi, the Lens project was pointed at
  `http://<Mac LAN IP>:3200/payload-api`.
- Lens fetches https only unless Experimental API is on. The setting lives in
  the `.esproj` as `EXPERIMENTAL_API` in `metaInfo.lensDescriptors`. Editing
  `spkPrivilegeLevel` in the file doesn't work; Lens Studio overwrites it on
  save. Tick it in Project Settings > Experimental API. It is required for
  http to a local server and for WebView.
- Lens has no `Intl` time zones. The New York day bounds, `eventWhen`,
  `storyDate` and `todayHeading` are ported by hand and tested against `Intl`
  output.
- Music portraits use the stored headshot unless the mobile
  `REJECTED_STORED_SOURCES` rule rejects it; otherwise they use the site's
  `/api/music/artist-photo` service and show its credit line.
- Artists whose `shortBio` or `biography` starts with "Editorial candidate
  pending verification" are hidden on Specs. That is 84 of 102 published
  artists, leaving 18. Those records need real bios in Payload.
- Curated artist-photo URLs can come back as `localhost` links, which won't
  load on glasses.

## Screens

The Specs card is about 50 x 50 cm at 1.1 m.

**Header.** The landscape logo PNG at 21 x 7 cm (30% smaller than before),
never recolored.

**Tab rail.** A left rail like the Quest rail window, 8.5 cm wide. Each tab
shows the mobile tab bar's Lucide icon (MapPinned, Footprints, BookOpen,
Music, CalendarClock), rendered to PNGs in `Assets/HarlemMight/Images/TabIcons`
(gold when active, muted when idle), over its label. A gold bar marks the
current tab.

**Lists.** No title or subtitle. Two columns of 23 x 12 cm photo cards scroll
in a 48 x 37 cm ScrollWindow, and the scroll offset survives redraws. Music
loads the next 24 artists when the list nears the bottom, or immediately if
the window isn't full. The mobile Today title and count copy ("Today in
Harlem, Thursday, October 15th" and so on) was added, then removed from the
lists along with every other list title at the user's request. Detail headers
keep their titles.

**Detail pages.** A fixed header and Back/action row over a scrolling page
with the mobile screen's content:

- Place: photo, summary or the mobile fallback copy, location pending.
- Walk: photo, a facts line ("1.2 miles, 54 min, 3 stops"), start and end,
  numbered stops with street and note.
- Story: photo, dek, byline with dates, full body via `storyParagraphs`.
- Artist: portrait and featured-song slot, photo credit, full biography via
  `biographyParagraphs`, and The record album art.
- Event: photo, time range, venue.

**Map.** Snap's map shows only on Explore and hides during a walk.

**Walking.** The Navigation Kit arrow is lifted into view: 14 cm below eye
level, tilted 60 degrees, at 5x scale. The walking card sits above eye level.
Walks reuse the `ManualPlaceList` entries (Apollo Theater, Schomburg Center),
so the map shows one pin per place. The arrow is a straight-line bearing to
the entrance, not a street route.

## Video

Play opens a popup with the song title and artist, a 44 x 24.75 cm (16:9)
area showing the video's YouTube thumbnail (`i.ytimg.com` `hqdefault`) as a
poster, and Close.

`HarlemMightVideoScreen`:

- creates a WebView with `InternetModule.createWebViewOptions` at 1280 x 720;
- loads `https://www.youtube-nocookie.com/embed/<id>?rel=0&playsinline=1&controls=1&fs=1&autoplay=1`
  as soon as the texture exists, because `onReady` can arrive late or never;
- forwards SIK pinches to the WebView as touches, so YouTube's own controls
  work;
- hides itself by disabling the Image component, not the object. A disabled
  object would stop the script's own callbacks.

Lens Studio Preview creates the WebView and accepts the URL, but renders the
page blank. An isolated capture of the screen after 20 s is empty, while the
poster captures fine. In the editor the popup says the video plays with
YouTube controls on Spectacles.

Other routes are closed: YouTube offers no direct file that
`loadResourceAsVideoTexture` could play, and Payload has 0 video media.

## Verified in Lens Studio Preview

Checked through the Lens Studio MCP with hand-simulator pinches, runtime scene
queries and panel captures:

- live Payload data on Explore, Music and Today
- CMS photos on cards and detail pages
- artist portraits, including ones from the photo service
- the left rail and its icons
- the map on Explore only
- scrolling lists
- a scrolling detail page (Duke Ellington's biography)
- the Play popup with poster and Close
- the walking card and the Navigation Kit label

## Built, not verified (needs Spectacles)

- Video playback in the WebView, and YouTube's touch controls.
- Everything on hardware: fit, readability, location, the arrow in the street,
  fetches over Wi-Fi to the LAN host.
- Pushing to the glasses. `LensStudio:PushToDevice` reported
  `isSpectaclesConnected()` false, so no push has happened.

Not yet checked in Preview either:

- Story and Walk detail pages on screen.
- Music's second page of artists arriving.

## Tests

`apps/specs/tests/content.test.ts` runs in the `specs-portable-contracts` CI
step together with the `packages/app/features/specs` tests: 17 of 17 pass.

```sh
node --experimental-strip-types --test packages/app/features/specs/*.test.ts apps/specs/tests/*.test.ts
```

## Known noise

SIK logs "Object is null" from `PhysicalInteractionProvider` and
`InteractableScoring` after page swaps. The error comes from inside SIK, and
pinches keep working.
