import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../../ViroSpecs/lens/ViroSpecsPresentationHost";
import { HarlemMightVideoScreen } from "./HarlemMightVideoScreen";
import {
  HarlemMightContent, formatEventTime,
  type ContentArtist, type ContentEvent, type ContentPlace, type ContentStory, type ContentWalk,
} from "./HarlemMightContent";
import { Place } from "SpecsNavigationKit.lspkg/NavigationDataComponent/Place";
import { ARNavigation } from "SpecsNavigationKit.lspkg/ARNavigationComponent/Scripts/ARNavigation";
import { GeoLocationPlace } from "SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace";
import { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";

/**
 * Native Lens Studio entrypoint. Each tab reads the same Payload REST API as
 * the mobile app and walks to places with Snap's Navigation Kit arrow. When
 * the API can't be reached it falls back to a small built-in preview.
 * acceptFrame() replaces all of it with a frame from the connected phone.
 */
@component
export class HarlemMightSpecsEntry extends BaseScriptComponent {
  @ui.label("Harlem Might — Specs spatial experience")

  @input
  @hint("SceneObject hosting ViroSpecsPresentationHost")
  presentationHostObject: SceneObject;

  @input
  @hint("Navigation Kit object with NavigationDataComponent")
  navigationObject: SceneObject;

  @input
  @hint("Navigation Kit AR Navigation object (direction arrow)")
  arNavigationObject: SceneObject;

  @input
  @allowUndefined
  @hint("Optional icon for Navigation Kit places")
  placeIcon: Texture;

  @input
  @allowUndefined
  @hint("Object with HarlemMightVideoScreen; the Music tab plays songs on it")
  videoScreenObject: SceneObject;

  @input
  @allowUndefined
  @hint("Internet Module asset used to read the Payload API")
  internetModule: InternetModule;

  @input
  @hint("Payload REST base the mobile app uses (EXPO_PUBLIC_PAYLOAD_API_BASE). Spectacles need a public https host.")
  apiBase: string = "http://localhost:3200/payload-api";

  private presentation: ViroSpecsPresentationHost | null = null;
  private video: HarlemMightVideoScreen | null = null;
  private playing: { artist: string; title: string; youtubeUrl: string } | null = null;
  private content: HarlemMightContent | null = null;
  private readonly status = new Map<TabId, "loading" | "ready" | "offline">();
  private places: ContentPlace[] = [];
  private walks: ContentWalk[] = [];
  private stories: ContentStory[] = [];
  private artists: ContentArtist[] = [];
  private artistPage = 1;
  private moreArtists = false;
  private events: ContentEvent[] = [];
  private eventsUpcoming = false;
  private readonly page = new Map<TabId, number>();
  private selected: string | null = null;
  private navigation: NavigationDataComponent | null = null;
  private arrow: ARNavigation | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly commandListeners = new Set<(command: string) => void>();
  private readonly allowedLiveActions = new Set<string>();
  private tab: TabId = "explore";
  private walk: { place: WalkTarget; target: Place; owned: boolean; arrived: boolean } | null = null;
  private usingLiveFrame = false;

  onAwake(): void {
    this.presentation = this.presentationHostObject.getComponent(
      ViroSpecsPresentationHost.getTypeName()
    ) as ViroSpecsPresentationHost | null;
    if (!this.presentation) throw new Error("Harlem Might requires ViroSpecsPresentationHost.");
    this.navigation = this.navigationObject.getComponent(
      NavigationDataComponent.getTypeName()
    ) as NavigationDataComponent | null;
    this.arrow = this.arNavigationObject.getComponent(
      ARNavigation.getTypeName()
    ) as ARNavigation | null;
    this.video = (this.videoScreenObject?.getComponent(
      HarlemMightVideoScreen.getTypeName()
    ) as HarlemMightVideoScreen | null) ?? null;
    if (!this.navigation || !this.arrow) {
      throw new Error("Harlem Might requires Navigation Kit's NavigationDataComponent and ARNavigation.");
    }

    if (this.internetModule && this.apiBase) {
      this.content = new HarlemMightContent(this.apiBase, (url) => this.fetchJson(url));
    }
    this.raiseArrowIntoView();
    this.createEvent("OnStartEvent").bind(() => {
      this.unsubscribe = this.presentation!.subscribeAction((command) => this.onAction(command));
      this.navigation!.onArrivedAtPlace.add((place) => {
        if (!this.walk || place !== this.walk.target) return;
        this.walk.arrived = true;
        this.showPreview();
      });
      this.load(this.tab);
      this.showPreview();
    });
    this.createEvent("OnDestroyEvent").bind(() => {
      this.endWalk();
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.commandListeners.clear();
      this.allowedLiveActions.clear();
    });
  }

  /** Called by a permissioned app transport once real state becomes available. */
  acceptFrame(frame: ViroSpecsPresentationSnapshot): void {
    if (!this.presentation) throw new Error("Harlem Specs scene is not ready.");
    // The Viro host validates/installs the scene first. Only then can these
    // semantic actions become eligible for forwarding to the phone.
    this.presentation.present(frame);
    this.endWalk();
    this.allowedLiveActions.clear();
    for (const target of frame.targets) this.allowedLiveActions.add(target.action);
    this.usingLiveFrame = true;
  }

  /** The connected app is the only authority allowed to act on live commands. */
  subscribeCommand(listener: (command: string) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  private onAction(command: string): void {
    if (this.usingLiveFrame) {
      // Drop any delayed callback from an earlier frame. The companion app
      // must still authorize the user's active session and permissions.
      if (!this.allowedLiveActions.has(command)) return;
      for (const listener of this.commandListeners) listener(command);
      return;
    }
    if (command.startsWith("preview:tab:")) {
      const id = command.slice("preview:tab:".length) as TabId;
      if (!TABS.some((t) => t.id === id)) return;
      this.tab = id;
      this.selected = null;
      this.stopSong();
      this.load(id);
    } else if (command === "preview:back") {
      this.selected = null;
      this.stopSong();
    } else if (command.startsWith("preview:open:")) {
      this.selected = command.slice("preview:open:".length);
    } else if (command === "preview:page:next") {
      const items = this.listItems();
      const page = this.page.get(this.tab) ?? 0;
      if ((page + 1) * PAGE_SIZE < items.length) this.page.set(this.tab, page + 1);
      else if (this.tab === "music" && this.moreArtists) {
        this.page.set(this.tab, page + 1);
        this.loadArtists(this.artistPage + 1);
      }
    } else if (command === "preview:page:prev") {
      this.page.set(this.tab, Math.max(0, (this.page.get(this.tab) ?? 0) - 1));
    } else if (command === "preview:walk") {
      const target = this.walkTarget();
      if (target) this.startWalk(target);
    } else if (command === "preview:play") {
      const artist = this.currentArtists().find((a) => a.id === this.selected);
      if (!artist?.youtubeUrl) return;
      this.playing = { artist: artist.name, title: artist.songTitle, youtubeUrl: artist.youtubeUrl };
      this.video?.play(artist.youtubeUrl);
    } else if (command === "preview:stop-song") {
      this.stopSong();
    } else if (command === "preview:end-walk") {
      this.endWalk();
    } else return;
    this.showPreview();
  }

  // The Navigation Kit arrow points in a straight line to the entrance using
  // the Lens's own location. It is a bearing, not a street route; route
  // geometry still waits for the phone's route provider and its safety gates.
  private startWalk(place: WalkTarget): void {
    this.endWalk();
    // Reuse the scene's ManualPlaceList entry so the map shows one pin per
    // place; create a temporary place only when the list doesn't have it.
    let target: Place | undefined = this.navigation!.places.find((p) => p.name === place.name);
    const owned = !target;
    if (!target) {
      const geo = GeoPosition.create();
      geo.latitude = place.latitude;
      geo.longitude = place.longitude;
      target = new GeoLocationPlace(geo, ARRIVAL_RADIUS_METERS, place.name, this.placeIcon,
        place.street, this.navigation!.getUserPosition());
    }
    this.walk = { place, target, owned, arrived: false };
    this.navigation!.navigateToPlace(target);
    this.arrow!.setVisible(true);
  }

  // Navigation Kit's head-locked arrow hangs 35 cm below eye level at 1 m,
  // about 19 degrees down and past the bottom of the Specs display, so you had
  // to tilt your head to find it. Lift the arrow and its name/distance labels
  // into the lower part of the view; the walking card moves above eye level.
  private raiseArrowIntoView(): void {
    const find = (root: SceneObject, name: string): SceneObject | null => {
      for (let i = 0; i < root.getChildrenCount(); i++) {
        const child = root.getChild(i);
        if (child.name === name) return child;
        const found = find(child, name);
        if (found) return found;
      }
      return null;
    };
    for (const name of ["ArrowPivot", "CheckSignPivot"]) {
      const pivot = find(this.arNavigationObject, name);
      if (!pivot) continue;
      const transform = pivot.getTransform();
      const position = transform.getLocalPosition();
      transform.setLocalPosition(new vec3(position.x, -ARROW_DROP_CM, position.z));
    }
    // The kit lays the arrow flat and sets ArrowPivot's world rotation to a
    // pure heading every frame, so at eye level it is seen edge-on. Move the
    // mesh under a display object that copies that heading and tilts it toward
    // the wearer. The kit's reset/arrive animations only touch the arrow's
    // local transform, so they keep working.
    const pivot = find(this.arNavigationObject, "ArrowPivot");
    const arrowMesh = pivot ? find(pivot, "Arrow") : null;
    if (!pivot || !arrowMesh) return;
    const display = global.scene.createSceneObject("HarlemArrowDisplay");
    display.setParent(pivot.getParent());
    const pivotTransform = pivot.getTransform();
    const displayTransform = display.getTransform();
    displayTransform.setLocalPosition(pivotTransform.getLocalPosition());
    displayTransform.setLocalRotation(pivotTransform.getLocalRotation());
    arrowMesh.setParentPreserveWorldTransform(display);
    displayTransform.setLocalScale(vec3.one().uniformScale(ARROW_SCALE));
    const head = pivot.getParent().getTransform();
    this.createEvent("LateUpdateEvent").bind(() => {
      displayTransform.setWorldPosition(pivotTransform.getWorldPosition());
      const tilt = quat.angleAxis(ARROW_TILT_DEGREES * MathUtils.DegToRad, head.right);
      displayTransform.setWorldRotation(tilt.multiply(pivotTransform.getWorldRotation()));
    });
  }

  private async fetchJson(url: string): Promise<any> {
    const response = await this.internetModule.fetch(new Request(url, {
      method: "GET", headers: { accept: "application/json" },
    }));
    if (response.status !== 200) throw new Error("HTTP " + response.status + " for " + url);
    return response.json();
  }

  // Each tab loads the first time it opens and redraws when its data arrives.
  // A failed read shows the offline content and retries the next time the tab opens.
  private load(tab: TabId): void {
    const current = this.status.get(tab);
    if (current === "loading" || current === "ready") return;
    if (!this.content) {
      this.status.set(tab, "offline");
      return;
    }
    this.status.set(tab, "loading");
    const content = this.content;
    const task: Promise<void> =
      tab === "explore" ? content.featuredPlaces().then((v) => { this.places = v; })
      : tab === "walks" ? content.walks().then((v) => { this.walks = v; })
      : tab === "stories" ? content.stories().then((v) => { this.stories = v; })
      : tab === "music" ? content.musicArtists(1).then((v) => { this.artists = v.artists; this.moreArtists = v.hasNextPage; })
      : content.todayEvents(new Date()).then((v) => { this.events = v.events; this.eventsUpcoming = v.upcoming; });
    task.then(
      () => { this.status.set(tab, "ready"); this.showPreview(); },
      (error) => {
        print("[HarlemMightSpecsEntry] " + tab + " offline: " + error);
        this.status.set(tab, "offline");
        this.showPreview();
      },
    );
  }

  private loadArtists(page: number): void {
    if (!this.content) return;
    this.content.musicArtists(page).then((v) => {
      this.artists = this.artists.concat(v.artists);
      this.artistPage = page;
      this.moreArtists = v.hasNextPage;
      this.showPreview();
    }, (error) => print("[HarlemMightSpecsEntry] music page " + page + ": " + error));
  }

  // The current tab's list, live when loaded, otherwise the offline preview.
  private listItems(): { id: string; label: string }[] {
    const live = this.status.get(this.tab) === "ready";
    switch (this.tab) {
      case "explore":
        return (live ? this.places : OFFLINE_PLACES).map((p) => ({ id: p.id, label: p.name }));
      case "walks":
        return live ? this.walks.map((w) => ({ id: w.id, label: w.title })) : [];
      case "stories":
        return live ? this.stories.map((st) => ({ id: st.id, label: st.title })) : [];
      case "music":
        return (live ? this.artists : OFFLINE_ARTISTS).map((a) => ({ id: a.id, label: a.name }));
      case "today":
        return live ? this.events.map((e) => ({ id: e.id, label: e.title })) : [];
    }
  }

  private walkTarget(): WalkTarget | null {
    const located = (p: ContentPlace | null | undefined): WalkTarget | null =>
      p && p.latitude !== null && p.longitude !== null
        ? { name: p.name, street: p.street, latitude: p.latitude, longitude: p.longitude } : null;
    if (this.tab === "explore") return located(this.currentPlaces().find((p) => p.id === this.selected));
    if (this.tab === "walks") return located(this.walks.find((w) => w.id === this.selected)?.firstStop);
    return null;
  }

  private currentPlaces(): ContentPlace[] {
    return this.status.get("explore") === "ready" ? this.places : OFFLINE_PLACES;
  }

  private currentArtists(): ContentArtist[] {
    return this.status.get("music") === "ready" ? this.artists : OFFLINE_ARTISTS;
  }

  private stopSong(): void {
    if (!this.playing) return;
    this.playing = null;
    this.video?.stop();
  }

  private endWalk(): void {
    if (!this.walk) return;
    this.arrow?.setVisible(false);
    this.navigation?.stopNavigation();
    if (this.walk.owned) this.navigation?.removePlace(this.walk.target);
    this.walk = null;
  }

  private showPreview(): void {
    if (!this.presentation || this.usingLiveFrame) return;
    type Node = ViroSpecsPresentationSnapshot["scene"]["nodes"][number];
    const nodes: Node[] = [];
    const targets: ViroSpecsPresentationSnapshot["targets"] = [];
    const text = (id: string, value: string, x: number, y: number, size: number, color: Color, parentId = "hm-root"): void => {
      nodes.push({ id, kind: "text", parentId, text: value,
        position: [x, y, 0.01], textStyle: { size, color } });
    };
    // The group is the action target and SIK fits its collider to the first
    // visual inside it, the plate, so the whole plate is pinchable. The label
    // is the plate's sibling so it doesn't inherit the plate's non-uniform scale.
    const pinchable = (id: string, label: string, action: string, x: number, y: number,
      scale: [number, number, number], size: number, color: Color): void => {
      nodes.push({ id, kind: "group", parentId: "hm-root", position: [x, y, 0.005] });
      nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale });
      text(id + "-label", label, 0, 0, size, color, id);
      targets.push({ targetId: id, action });
    };
    const button = (index: number, label: string, action: string, y: number): void =>
      pinchable("hm-button-" + index, label, action, 0, y, BUTTON_SCALE, 80, IVORY);

    if (this.walk) {
      // While walking the card shrinks and moves above eye level, leaving the
      // lower view to the Navigation Kit arrow, which already shows the place
      // name and distance. The card carries only the next step.
      nodes.push({ id: "hm-root", kind: "group", position: [0, 0.15, -1.1] });
      nodes.push({ id: "hm-frame", kind: "panel", parentId: "hm-root", position: [0, -0.01, -0.03], scale: WALK_FRAME_SCALE });
      const { arrived, place } = this.walk;
      text("hm-note", arrived ? "You're at " + place.name : "Follow the arrow to " + place.name,
        0, 0.035, 60, arrived ? GOLD : IVORY);
      button(0, arrived ? "Done" : "End walk", "preview:end-walk", -0.035);
      this.presentation.present({ scene: { version: 1, nodes }, targets });
      return;
    }

    // 1.1 m sits in the comfortable focus band; a little below eye level keeps
    // the street ahead visible above the card.
    nodes.push({ id: "hm-root", kind: "group", position: [0, -0.06, -1.1] });
    nodes.push({ id: "hm-frame", kind: "panel", parentId: "hm-root", position: [0, 0.04, -0.03], scale: FRAME_SCALE });
    // The app header: the landscape logo, as on mobile, never a text stand-in.
    nodes.push({ id: "hm-logo", kind: "image", parentId: "hm-root", source: LOGO_IMAGE_ID,
      position: [0, 0.225, 0.01], scale: LOGO_SCALE });
    // The app's tab bar, in the app's order, under the header.
    TABS.forEach((tab, index) => {
      const active = tab.id === this.tab;
      pinchable("hm-tab-" + tab.id, tab.label, "preview:tab:" + tab.id,
        (index - (TABS.length - 1) / 2) * TAB_SPACING, 0.135, TAB_SCALE, 48, active ? GOLD : MUTED);
    });

    const half = (index: number, label: string, action: string, x: number, y: number): void =>
      pinchable("hm-item-" + index, clip(label, 22), action, x, y, HALF_BUTTON_SCALE, 52, IVORY);
    const header = (title: string, subtitle: string): void => {
      text("hm-title", clip(title, 26), 0, 0.07, 88, GOLD);
      if (subtitle) text("hm-subtitle", clip(subtitle, 52), 0, 0.03, 46, MUTED);
    };
    const paragraph = (value: string): void => {
      if (value) text("hm-body", wrap(clip(value, 150), 44), 0, -0.05, 46, IVORY);
    };
    // Bottom row of a detail view: the tab's main action on the left, Back on the right.
    const actions = (primary: { label: string; action: string } | null): void => {
      if (primary) half(10, primary.label, primary.action, -COLUMN_X, ROW_Y[2]);
      half(11, "Back", "preview:back", primary ? COLUMN_X : 0, ROW_Y[2]);
    };
    const status = this.status.get(this.tab);
    const tabInfo = TABS.find((t) => t.id === this.tab)!;

    if (status === "loading") {
      header(tabInfo.label, "Loading from Harlem Might\u2026");
    } else if (this.selected) {
      this.renderDetail(header, paragraph, actions, text);
    } else {
      const items = this.listItems();
      const page = this.page.get(this.tab) ?? 0;
      const shown = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      header(tabInfo.label, this.listSubtitle(items.length, page));
      if (items.length === 0) {
        if (this.tab === "today") {
          // No listings: the app's Today screen still has its history fact.
          const fact = nearestHistoryFact(new Date());
          text("hm-date", "From Harlem\u2019s past \u00b7 " + formatFactDate(fact.date), 0, -0.01, 46, GOLD);
          text("hm-body", wrap(fact.text, 44), 0, -0.07, 46, IVORY);
          text("hm-source", "Source: " + fact.sourceLabel, 0, -0.13, 40, MUTED);
        } else {
          text("hm-body", wrap(tabInfo.offline, 40), 0, -0.04, 52, IVORY);
        }
      }
      shown.forEach((item, index) =>
        half(index, item.label, "preview:open:" + item.id,
          (index % 2 === 0 ? -1 : 1) * COLUMN_X, ROW_Y[Math.floor(index / 2)]));
      if (page > 0) half(10, "Previous", "preview:page:prev", -COLUMN_X, ROW_Y[2]);
      const more = (page + 1) * PAGE_SIZE < items.length || (this.tab === "music" && this.moreArtists && status === "ready");
      if (more) half(11, "More", "preview:page:next", COLUMN_X, ROW_Y[2]);
    }
    this.presentation.present({ scene: { version: 1, nodes }, targets });
  }

  private listSubtitle(count: number, page: number): string {
    const live = this.status.get(this.tab) === "ready";
    const range = count > PAGE_SIZE
      ? (page * PAGE_SIZE + 1) + "\u2013" + Math.min(count, (page + 1) * PAGE_SIZE) + " of " + count : String(count);
    switch (this.tab) {
      case "explore": return live ? "Featured places \u00b7 " + range : "Offline preview";
      case "walks": return live ? range + " guided walks" : "";
      case "stories": return live ? range + " stories" : "";
      case "music": return live ? "Harlem artists \u00b7 " + range : "Offline preview";
      case "today":
        if (!live) return "Offline";
        if (count === 0) return "No listings today";
        return (this.eventsUpcoming ? "Upcoming \u00b7 " : "Today \u00b7 ") + range + " listings";
    }
  }

  // Detail view for the selected item, with the same fields as the item's
  // mobile screen (Place Detail, walk, story, artist and event pages).
  private renderDetail(
    header: (title: string, subtitle: string) => void,
    paragraph: (value: string) => void,
    actions: (primary: { label: string; action: string } | null) => void,
    text: (id: string, value: string, x: number, y: number, size: number, color: Color) => void,
  ): void {
    const id = this.selected;
    if (this.tab === "explore") {
      const place = this.currentPlaces().find((p) => p.id === id);
      if (!place) return actions(null);
      header(place.name, [place.category, place.street].filter(Boolean).join(", "));
      paragraph(place.summary);
      actions(this.walkTarget() ? { label: "Start walking", action: "preview:walk" } : null);
    } else if (this.tab === "walks") {
      const walk = this.walks.find((w) => w.id === id);
      if (!walk) return actions(null);
      header(walk.title, walk.facts);
      paragraph(walk.summary);
      actions(this.walkTarget() ? { label: "Walk to first stop", action: "preview:walk" } : null);
    } else if (this.tab === "stories") {
      const story = this.stories.find((st) => st.id === id);
      if (!story) return actions(null);
      header(story.title, story.author ? "By " + story.author : "");
      paragraph(story.dek);
      actions(null);
    } else if (this.tab === "music") {
      const artist = this.currentArtists().find((a) => a.id === id);
      if (!artist) return actions(null);
      if (this.playing) {
        header(this.playing.title, this.playing.artist);
        // The video screen covers the card body on Spectacles; Preview has no WebView.
        text("hm-note", "Video plays on Spectacles", 0, -0.05, 46, MUTED);
        actions({ label: "Stop", action: "preview:stop-song" });
        return;
      }
      header(artist.name, [artist.genre, artist.era].filter(Boolean).join(" \u00b7 "));
      paragraph(artist.shortBio);
      actions(artist.youtubeUrl ? { label: "Play " + (artist.songTitle || "song"), action: "preview:play" } : null);
    } else {
      const event = this.events.find((e) => e.id === id);
      if (!event) return actions(null);
      const time = formatEventTime(event.startsAt);
      const state = event.lifecycle === "scheduled" ? "" : event.lifecycle === "cancelled" ? "Cancelled" : "Postponed";
      header(event.title, [state, time].filter(Boolean).join(" \u00b7 "));
      if (event.venue) text("hm-body", wrap(event.venue, 44), 0, -0.05, 52, IVORY);
      actions(null);
    }
  }
}

// Shorten to fit a label, on a word boundary when one is close.
function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + "\u2026";
}

// Lens Text doesn't wrap inside the frame, so break long copy on word
// boundaries before it reaches the renderer.
function wrap(value: string, width: number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

// The fact whose anniversary comes soonest, counting today.
function nearestHistoryFact(now: Date): HistoryFact {
  const dayOfYear = (month: number, day: number) => month * 31 + day;
  const today = dayOfYear(now.getMonth() + 1, now.getDate());
  const ahead = (fact: HistoryFact) => {
    const [, m, d] = fact.date.split("-").map(Number);
    return (dayOfYear(m, d) - today + 372) % 372;
  };
  return HISTORY_FACTS.reduce((best, fact) => (ahead(fact) < ahead(best) ? fact : best));
}

function formatFactDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return MONTHS[m - 1] + " " + d + ", " + y;
}

type Color = [number, number, number, number];
type WalkTarget = { name: string; street: string; latitude: number; longitude: number };
type TabId = (typeof TABS)[number]["id"];
type HistoryFact = (typeof HISTORY_FACTS)[number];

// Same tabs, labels and order as the app and site (`primaryNav`). More stays
// on the phone.
const TABS = [
  { id: "explore", label: "Explore", offline: "" },
  { id: "walks", label: "Walks", offline: "Walks couldn\u2019t load. Check the Lens is online and try the tab again." },
  { id: "stories", label: "Stories", offline: "Stories couldn\u2019t load. Check the Lens is online and try the tab again." },
  { id: "music", label: "Music", offline: "" },
  { id: "today", label: "Today", offline: "" },
] as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// Brand gold #F8C626. Black is see-through on the additive display, so the
// brand's warm-black ground becomes the street itself.
const GOLD: Color = [0.973, 0.776, 0.149, 1];
// Off-white avoids the glare of pure white on an additive display.
const IVORY: Color = [0.96, 0.94, 0.89, 1];
const MUTED: Color = [0.74, 0.7, 0.62, 1];
// UI Kit BackPlate is 24 x 12 cm at scale 1: frame 50 x 50 cm, walking card
// 40 x 16 cm, buttons 32 x 7 cm, half buttons 23 x 7 cm, tabs 9 x 6.5 cm. Every pinch target clears
// the 64 mm minimum for hands.
const FRAME_SCALE: [number, number, number] = [2.08, 4.17, 1];
const WALK_FRAME_SCALE: [number, number, number] = [1.67, 1.33, 1];
const BUTTON_SCALE: [number, number, number] = [1.33, 0.58, 1];
const TAB_SCALE: [number, number, number] = [0.375, 0.54, 1];
const TAB_SPACING = 0.096;
const HALF_BUTTON_SCALE: [number, number, number] = [0.96, 0.58, 1];
// Lists are two columns by two rows, with a Previous/More or action row below.
const PAGE_SIZE = 4;
const COLUMN_X = 0.12;
const ROW_Y = [-0.02, -0.092, -0.164] as const;
const LOGO_IMAGE_ID = "harlem-might-logo";
// Measured against the 50 cm frame in Preview, one image unit is about 1 cm.
// 30 x 10 cm fills most of the card like the mobile header and fits between
// the frame's top edge and the tab row.
const LOGO_SCALE: [number, number, number] = [30, 10, 1];
const ARRIVAL_RADIUS_METERS = 25;
// Arrow height below eye level at Navigation Kit's 1 m head-lock distance.
const ARROW_DROP_CM = 14;
// Tilt of the flat arrow toward the wearer, so its face reads at eye level.
const ARROW_TILT_DEGREES = 60;
// The kit sizes the arrow for a glance down at 35 cm below; at eye level it
// needs to be larger to read.
const ARROW_SCALE = 5;

// Offline fallback when the Payload API can't be reached. Same records as the
// live catalogue: Apollo and Schomburg from the featured places, songs from
// packages/payload/src/seed/music-artist-candidates.ts.
const OFFLINE_PLACES: ContentPlace[] = [
  { id: "apollo", name: "Apollo Theater", category: "Culture", street: "253 West 125th Street",
    summary: "A Harlem performing-arts landmark with a global cultural reach.",
    latitude: 40.8100895, longitude: -73.9499948 },
  { id: "schomburg", name: "Schomburg Center", category: "Books", street: "515 Malcolm X Boulevard",
    summary: "", latitude: 40.8146476, longitude: -73.9409874 },
];
const OFFLINE_ARTISTS: ContentArtist[] = [
  { id: "fats-waller", name: "Fats Waller", genre: "Jazz", era: "1920s\u20131940s", shortBio: "",
    songTitle: "Ain't Misbehavin'", youtubeUrl: "https://www.youtube.com/watch?v=pZ8fWP6a3Q4" },
  { id: "frankie-lymon", name: "Frankie Lymon", genre: "Doo-wop", era: "1950s\u20131960s", shortBio: "",
    songTitle: "Goody Goody", youtubeUrl: "https://www.youtube.com/watch?v=K3VLt_Q5pmA" },
  { id: "big-l", name: "Big L", genre: "Hip-hop", era: "1990s", shortBio: "",
    songTitle: "Put It On", youtubeUrl: "https://www.youtube.com/watch?v=WWMjRMJ0dTI" },
  { id: "teyana-taylor", name: "Teyana Taylor", genre: "R&B", era: "2000s\u2013present", shortBio: "",
    songTitle: "Gonna Love Me", youtubeUrl: "https://www.youtube.com/watch?v=LwSCplLupTA" },
];

// Copied from packages/app/content/history-facts.ts, where each date was
// checked against its source on 2026-10-09. Live frames replace this.
const HISTORY_FACTS = [
  { date: "1934-01-26", sourceLabel: "Wikipedia: Apollo Theater",
    text: "The Apollo reopened on West 125th Street as the 125th Street Apollo Theatre, programmed for Harlem’s Black audience." },
  { date: "1926-03-12", sourceLabel: "Wikipedia: Savoy Ballroom",
    text: "The Savoy Ballroom opened on Lenox Avenue. It ran until July 10, 1958." },
  { date: "1935-03-19", sourceLabel: "Wikipedia: Harlem riot of 1935",
    text: "The Harlem riot of 1935 broke out." },
  { date: "1943-08-01", sourceLabel: "Wikipedia: Harlem riot of 1943",
    text: "The Harlem riot of 1943 began after a white police officer, James Collins, shot a man. It ran into August 2." },
  { date: "1958-09-20", sourceLabel: "Wikipedia: Izola Curry",
    text: "Martin Luther King Jr. was stabbed at a book signing in Harlem, and survived." },
  { date: "1934-11-21", sourceLabel: "Wikipedia: Ella Fitzgerald",
    text: "Ella Fitzgerald, 17, debuted at one of the first Amateur Nights at the Apollo Theater." },
] as const;
