import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../../ViroSpecs/lens/ViroSpecsPresentationHost";
import { ViroSpecsAssetRegistry } from "../../ViroSpecs/lens/ViroSpecsAssetRegistry";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { HarlemMightVideoScreen } from "./HarlemMightVideoScreen";
import {
  HarlemMightContent, formatEventWhen, formatStoryDate, placeRowLine,
  type ContentArtist, type ContentEvent, type ContentImage, type ContentPlace, type ContentStory, type ContentWalk,
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
  @allowUndefined
  @hint("Snap Navigation Kit map ([MapComponent]); shown only on the Explore tab, like the mobile map pane")
  mapObject: SceneObject;

  @input
  @allowUndefined
  @hint("ViroSpecsAssetRegistry object; CMS photos are registered on it at runtime")
  assetRegistryObject: SceneObject;

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
  private loadingArtists = false;
  // Scroll offset from the top of the current list, in cm, kept across redraws.
  private listScrollFromTop = 0;
  private listContentCm = 0;
  private listShownFor: TabId | null = null;
  // Top of the artist page's song slot in content cm; the WebView follows it as the page scrolls.
  private songSlotTopCm: number | null = null;
  // True while the Play popup is open over the artist page.
  private playerOpen = false;
  private selected: string | null = null;
  private registry: ViroSpecsAssetRegistry | null = null;
  private readonly remoteMedia = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
  // url -> registry image id once loaded, or the load's state.
  private readonly photos = new Map<string, string | "loading" | "failed">();
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

    this.registry = (this.assetRegistryObject?.getComponent(
      ViroSpecsAssetRegistry.getTypeName()
    ) as ViroSpecsAssetRegistry | null) ?? null;
    if (this.internetModule && this.apiBase) {
      this.content = new HarlemMightContent(this.apiBase, (url) => this.fetchJson(url));
    }
    this.raiseArrowIntoView();
    this.createEvent("OnStartEvent").bind(() => {
      // Hooked at start, not awake: the video screen sits lower in the scene,
      // so its script initializes after this one and would reset the field.
      if (this.video) this.video.onStatusChanged = () => this.showPreview();
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
      this.playerOpen = false;
      this.listScrollFromTop = 0;
      this.stopSong();
      this.load(id);
    } else if (command === "preview:back") {
      this.selected = null;
      this.playerOpen = false;
      this.stopSong();
    } else if (command.startsWith("preview:open:")) {
      this.selected = command.slice("preview:open:".length);
      if (this.tab === "music") this.cueSong(false);
    } else if (command === "preview:walk") {
      const target = this.walkTarget();
      if (target) this.startWalk(target);
    } else if (command === "preview:play") {
      this.playerOpen = true;
      this.cueSong(true);
    } else if (command === "preview:close-player") {
      this.playerOpen = false;
      this.stopSong();
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
      : tab === "music" ? content.musicArtists(1).then((v) => {
          this.artists = v.artists; this.moreArtists = v.hasNextPage; this.fillArtistPhotos(v.artists); })
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
    if (!this.content || this.loadingArtists) return;
    this.loadingArtists = true;
    this.content.musicArtists(page).then((v) => {
      this.loadingArtists = false;
      this.artists = this.artists.concat(v.artists);
      this.fillArtistPhotos(v.artists);
      this.artistPage = page;
      this.moreArtists = v.hasNextPage;
      this.showPreview();
    }, (error) => {
      this.loadingArtists = false;
      print("[HarlemMightSpecsEntry] music page " + page + ": " + error);
    });
  }

  // The current tab's cards, live when loaded, otherwise the offline preview.
  // Each carries what its mobile card shows: title, one line under it, photo.
  private listItems(): ListItem[] {
    const live = this.status.get(this.tab) === "ready";
    switch (this.tab) {
      case "explore":
        return (live ? this.places : OFFLINE_PLACES).map((p) => ({
          id: p.id, title: p.name, sub: placeRowLine(p), image: p.image }));
      case "walks":
        return live ? this.walks.map((w) => ({ id: w.id, title: w.title, sub: w.facts, image: w.image })) : [];
      case "stories":
        return live ? this.stories.map((st) => ({
          id: st.id, title: st.title, image: st.image,
          sub: [st.author ? "By " + st.author : "", formatStoryDate(st.publishedAt || st.updatedAt)].filter(Boolean).join(", ") })) : [];
      case "music":
        return this.currentArtists().map((a) => ({
          id: a.id, title: a.name, sub: [a.genre, a.era].filter(Boolean).join(" \u00b7 "), image: a.image }));
      case "today":
        return live ? this.events.map((e) => ({
          id: e.id, title: e.title, image: e.image,
          sub: [e.lifecycle === "cancelled" ? "Cancelled" : e.lifecycle === "postponed" ? "Postponed" : "",
            formatEventWhen(e.startsAt, e.endsAt, this.eventsUpcoming)].filter(Boolean).join(". "),
          struck: e.lifecycle !== "scheduled" })) : [];
    }
  }

  // Artists without a usable stored headshot get the site's photo-service
  // portrait, as on the mobile Music grid.
  private fillArtistPhotos(artists: ContentArtist[]): void {
    const missing = artists.filter((a) => !a.image).map((a) => a.name);
    if (!this.content || missing.length === 0) return;
    this.content.artistPhotos(missing).then((photos) => {
      for (const artist of artists) if (!artist.image && photos[artist.name]) artist.image = photos[artist.name];
      this.showPreview();
    }, (error) => print("[HarlemMightSpecsEntry] artist photos: " + error));
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

  /** Registry id of a loaded photo for detail pages; starts the load if needed. */
  photoFor(image: ContentImage | null): string | null {
    return this.photo(image);
  }

  // Returns the registry id of a loaded CMS photo, or null while it loads or
  // when it can't load; a finished load redraws the current view.
  private photo(image: ContentImage | null): string | null {
    if (!image || !this.registry || !this.internetModule) return null;
    const state = this.photos.get(image.url);
    if (state === "loading" || state === "failed") return null;
    if (state) return state;
    this.photos.set(image.url, "loading");
    const resource = this.internetModule.makeResourceFromUrl(image.url);
    this.remoteMedia.loadResourceAsImageTexture(resource, (texture) => {
      const id = "cms-photo:" + image.url;
      this.registry!.registerImage(id, texture);
      this.photos.set(image.url, id);
      this.showPreview();
    }, (message) => {
      print("[HarlemMightSpecsEntry] photo failed: " + image.url + " " + message);
      this.photos.set(image.url, "failed");
    });
    return null;
  }

  // The artist profile's Featured song panel: the YouTube embed sits on the
  // card beside the portrait, cued when the profile opens, playing on Play.
  private cueSong(autoplay: boolean): void {
    const artist = this.currentArtists().find((a) => a.id === this.selected);
    if (!artist?.youtubeUrl) return;
    this.playing = { artist: artist.name, title: artist.songTitle, youtubeUrl: artist.youtubeUrl };
    this.video?.play(artist.youtubeUrl, autoplay);
    this.positionSongScreen(0);
  }

  // Keeps the WebView over the artist page's song slot as the page scrolls,
  // and hides it while the slot is outside the scroll window.
  private positionSongScreen(fromTopCm: number): void {
    if (!this.video || this.songSlotTopCm === null) return;
    const windowTop = DETAIL_CENTER_Y + DETAIL_WINDOW_CM[1] / 200;
    const centerY = windowTop - (this.songSlotTopCm + HERO_ROW_CM / 2 - fromTopCm) / 100;
    this.video.place(new vec3(SONG_SCREEN.x * 100, (ROOT_Y + centerY) * 100, ROOT_Z * 100 + 1),
      new vec2(SONG_SCREEN.w, SONG_SCREEN.w * 9 / 16));
    const slotTop = this.songSlotTopCm - fromTopCm;
    this.video.setInView(slotTop >= -0.5 && slotTop + HERO_ROW_CM <= DETAIL_WINDOW_CM[1] + 0.5);
  }

  private watchDetailScroll(): void {
    if (this.songSlotTopCm === null) return;
    const object = findByName(DETAIL_WINDOW_OBJECT);
    const window = object ? (object.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null) : null;
    if (!window) return;
    const top = (contentCm: number) => -Math.max(contentCm, DETAIL_WINDOW_CM[1]) / 2 + DETAIL_WINDOW_CM[1] / 2;
    const content = window.scrollDimensions.y;
    const update = () => this.positionSongScreen(window.scrollPosition.y - top(content));
    window.onScrollPositionUpdated.add(update);
    update();
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
    const nodes: Node[] = [];
    const targets: ViroSpecsPresentationSnapshot["targets"] = [];
    const ui = new Layout(nodes, targets);
    this.songSlotTopCm = null;
    // Read the old list's offset before renderList replaces listContentCm.
    this.rememberListScroll();
    if (this.mapObject) this.mapObject.enabled = this.tab === "explore" && !this.walk;

    if (this.walk) {
      // While walking the card shrinks and moves above eye level, leaving the
      // lower view to the Navigation Kit arrow, which already shows the place
      // name and distance. The card carries only the next step.
      nodes.push({ id: "hm-root", kind: "group", position: [0, 0.15, ROOT_Z] });
      nodes.push({ id: "hm-frame", kind: "panel", parentId: "hm-root", position: [0, -0.01, -0.03], scale: WALK_FRAME_SCALE });
      const { arrived, place } = this.walk;
      ui.text("hm-note", arrived ? "You're at " + place.name : "Follow the arrow to " + place.name,
        0, 0.035, 60, arrived ? GOLD : IVORY);
      ui.button("hm-end", arrived ? "Done" : "End walk", "preview:end-walk", 0, -0.035, BUTTON_SCALE, 80);
      this.presentation.present({ scene: { version: 1, nodes }, targets });
      return;
    }

    // 1.1 m sits in the comfortable focus band; a little below eye level keeps
    // the street ahead visible above the card.
    nodes.push({ id: "hm-root", kind: "group", position: [0, ROOT_Y, ROOT_Z] });
    nodes.push({ id: "hm-frame", kind: "panel", parentId: "hm-root", position: [0, 0.04, -0.03], scale: FRAME_SCALE });
    // The app header: the landscape logo, as on mobile, never a text stand-in.
    nodes.push({ id: "hm-logo", kind: "image", parentId: "hm-root", source: LOGO_IMAGE_ID,
      position: [0, 0.24, 0.01], scale: LOGO_SCALE });
    this.renderRail(ui);

    const status = this.status.get(this.tab);
    const tabInfo = TABS.find((t) => t.id === this.tab)!;
    if (status === "loading") {
      ui.text("hm-loading", "Loading " + tabInfo.label + "\u2026", 0, 0.04, 44, MUTED);
    } else if (this.selected) {
      this.renderDetail(ui);
    } else {
      this.renderList(ui, tabInfo);
    }
    this.presentation.present({ scene: { version: 1, nodes }, targets });
    this.watchListScroll();
    this.watchDetailScroll();
    if (this.songSlotTopCm === null && !this.playerOpen) this.video?.setInView(false);
  }

  // The list is rebuilt on every redraw (a new page of artists, a photo that
  // finished loading), so the scroll offset is carried over by hand.
  private rememberListScroll(): void {
    // Only carry the offset within the same tab's list.
    if (this.listShownFor !== this.tab) return;
    const window = this.listWindow();
    if (!window) return;
    this.listScrollFromTop = window.scrollPosition.y - topEdgeCm(this.listContentCm);
  }

  private watchListScroll(): void {
    const window = this.selected ? null : this.listWindow();
    this.listShownFor = window ? this.tab : null;
    if (!window) return;
    const maxFromTop = Math.max(0, this.listContentCm - LIST_WINDOW_CM[1]);
    const fromTop = Math.min(maxFromTop, Math.max(0, this.listScrollFromTop));
    window.scrollPosition = new vec2(0, topEdgeCm(this.listContentCm) + fromTop);
    window.onScrollPositionUpdated.add(() => this.maybeLoadMore(window));
    this.maybeLoadMore(window);
  }

  // Music loads its next page of 24 when the list nears its bottom, or at once
  // while the visible artists don't fill the window.
  private maybeLoadMore(window: ScrollWindow): void {
    if (this.tab !== "music" || !this.moreArtists || this.loadingArtists || this.status.get("music") !== "ready") return;
    const fromTop = window.scrollPosition.y - topEdgeCm(this.listContentCm);
    const scrollable = this.listContentCm - LIST_WINDOW_CM[1];
    if (scrollable <= 0 || fromTop >= scrollable - LOAD_MORE_MARGIN_CM) this.loadArtists(this.artistPage + 1);
  }

  private listWindow(): ScrollWindow | null {
    const object = findByName(LIST_WINDOW_OBJECT);
    return object ? (object.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null) : null;
  }

  // The app's tabs as a rail on the card's left edge, like the Quest build's
  // rail window (apps/mobile/src/spatial/railWindow.ts): one narrow column of
  // the mobile tab bar's Lucide icons over short labels, the current tab in gold
  // with a gold bar.
  private renderRail(ui: Layout): void {
    ui.nodes.push({ id: "hm-rail", kind: "panel", parentId: "hm-root",
      position: [RAIL_X, 0.04, -0.03], scale: RAIL_FRAME_SCALE });
    TABS.forEach((tab, index) => {
      const active = tab.id === this.tab;
      const id = "hm-tab-" + tab.id;
      const y = 0.04 + ((TABS.length - 1) / 2 - index) * RAIL_SPACING;
      ui.nodes.push({ id, kind: "group", parentId: "hm-root", position: [RAIL_X, y, 0.005] });
      ui.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: RAIL_ITEM_SCALE });
      ui.nodes.push({ id: id + "-icon", kind: "image", parentId: id,
        source: "tab-" + tab.id + (active ? "-active" : "-idle"),
        position: [0, 0.011, 0.006], scale: [RAIL_ICON_CM, RAIL_ICON_CM, 1] });
      ui.text(id + "-label", tab.label, 0, -0.022, 36, active ? GOLD : MUTED, id);
      ui.targets.push({ targetId: id, action: "preview:tab:" + tab.id });
      if (active) ui.text("hm-tab-bar", "\u258e", RAIL_X - 0.038, y, 110, GOLD);
    });
  }

  private renderList(ui: Layout, tabInfo: (typeof TABS)[number]): void {
    // No title or subtitle over a list: the rail already names the tab, and
    // the cards get the room.
    const items = this.listItems();
    if (items.length === 0 && !(this.tab === "music" && this.moreArtists)) {
      this.listContentCm = 0;
      if (this.tab === "today") {
        // No listings: the app's Today screen still has its history fact.
        const fact = nearestHistoryFact(new Date());
        ui.text("hm-date", "From Harlem\u2019s past \u00b7 " + formatFactDate(fact.date), 0, 0.03, 46, GOLD);
        ui.text("hm-body", wrap(fact.text, 44), 0, -0.04, 46, IVORY);
        ui.text("hm-source", "Source: " + fact.sourceLabel, 0, -0.11, 40, MUTED);
      } else {
        ui.text("hm-body", wrap(tabInfo.offline, 40), 0, -0.02, 52, IVORY);
      }
      return;
    }
    // Every card scrolls in one window under the header; the window's
    // content runs from y = 0 at its top edge downward.
    const rows = Math.ceil(items.length / 2);
    const tail = this.tab === "music" && this.moreArtists ? TILE_PITCH * 0.6 : 0;
    const contentM = rows * TILE_PITCH + tail;
    this.listContentCm = contentM * 100;
    ui.nodes.push({ id: "hm-list", kind: "group", parentId: "hm-root", position: [0, LIST_CENTER_Y, 0.004],
      scroll: { width: LIST_WINDOW_CM[0] / 100, height: LIST_WINDOW_CM[1] / 100, contentHeight: contentM } });
    items.forEach((item, index) => {
      const x = (index % 2 === 0 ? -1 : 1) * TILE_COLUMN_X;
      const y = -(TILE_PITCH / 2 + Math.floor(index / 2) * TILE_PITCH);
      this.renderTile(ui, "hm-item-" + index, item, x, y, "hm-list");
    });
    if (tail) ui.text("hm-more", "Loading more artists\u2026", 0, -(rows * TILE_PITCH + tail / 2), 36, MUTED, "hm-list");
  }

  // A list card: photo on the left when the record has one, title and the
  // mobile card's second line beside it. The whole tile is one pinch target.
  private renderTile(ui: Layout, id: string, item: ListItem, x: number, y: number, parentId = "hm-root"): void {
    ui.nodes.push({ id, kind: "group", parentId, position: [x, y, 0.005] });
    ui.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: TILE_SCALE });
    ui.targets.push({ targetId: id, action: "preview:open:" + item.id });
    const photoId = this.photo(item.image);
    const textX = photoId ? 0.045 : 0;
    const width = photoId ? 13 : 22;
    if (photoId && item.image) {
      const [w, h] = fit(item.image, TILE_PHOTO_CM, TILE_PHOTO_CM);
      ui.nodes.push({ id: id + "-photo", kind: "image", parentId: id, source: photoId,
        position: [-0.06, 0, 0.006], scale: [w, h, 1] });
    }
    const title = wrap(clip(item.title, width * 2 - 2), width);
    ui.text(id + "-title", item.struck ? strike(title) : title, textX, 0.018, 42, IVORY, id);
    if (item.sub) ui.text(id + "-sub", clip(item.sub, Math.round(width * 1.3)), textX, -0.035, 34, MUTED, id);
  }

  // Detail view for the selected item: a fixed header and action row, and a
  // scrolling page in between carrying the item's full mobile screen (Place
  // Detail, walk, story, artist and event pages).
  private renderDetail(ui: Layout): void {
    const id = this.selected;
    const page = new Page();
    let primary: { label: string; action: string } | null = null;
    if (this.tab === "explore") {
      const place = this.currentPlaces().find((p) => p.id === id);
      if (!place) return ui.actions(null);
      ui.header(place.name, [place.category, place.street || place.area].filter(Boolean).join(", "));
      page.image(this, place.image, 30, 17);
      page.paragraph(place.summary || "No description has been published for this place yet.");
      if (place.latitude === null) page.note("Location pending verification.");
      page.note("Description from the Harlem Might place catalogue.");
      if (this.walkTarget()) primary = { label: "Start walking", action: "preview:walk" };
    } else if (this.tab === "walks") {
      const walk = this.walks.find((w) => w.id === id);
      if (!walk) return ui.actions(null);
      ui.header(walk.title, walk.facts);
      page.image(this, walk.image, 30, 17);
      page.paragraph(walk.summary);
      if (walk.startDescription) page.fact("Starts at", walk.startDescription
        + (walk.endDescription ? ". Ends at " + walk.endDescription : ""));
      else if (walk.endDescription) page.fact("Ends at", walk.endDescription);
      if (walk.stops.length) {
        page.heading("Stops");
        walk.stops.forEach((stop, index) => {
          page.line((index + 1) + "  " + stop.name, 44, IVORY);
          if (stop.street) page.line(stop.street, 34, MUTED);
          if (stop.note) page.paragraph(stop.note, 36);
        });
      }
      if (this.walkTarget()) primary = { label: "Walk to first stop", action: "preview:walk" };
    } else if (this.tab === "stories") {
      const story = this.stories.find((st) => st.id === id);
      if (!story) return ui.actions(null);
      const published = formatStoryDate(story.publishedAt);
      const updated = formatStoryDate(story.updatedAt);
      ui.header(story.title, "By " + (story.author || "Harlem Might")
        + (published ? ". Published " + published + (updated && updated !== published ? ", updated " + updated : "") : "") + ".");
      page.image(this, story.image, 30, 17);
      if (story.dek) page.paragraph(story.dek, 44, GOLD);
      for (const paragraph of story.body) page.paragraph(paragraph);
    } else if (this.tab === "music") {
      return this.renderArtist(ui);
    } else {
      const event = this.events.find((e) => e.id === id);
      if (!event) return ui.actions(null);
      const state = event.lifecycle === "scheduled" ? "" : event.lifecycle === "cancelled" ? "Cancelled" : "Postponed";
      ui.header(event.title, [state, formatEventWhen(event.startsAt, event.endsAt, this.eventsUpcoming)].filter(Boolean).join(". "));
      page.image(this, event.image, 30, 17);
      if (event.venue) page.fact("Venue", event.venue);
      page.note("Tickets and the venue listing open on your phone.");
    }
    page.render(ui);
    ui.actions(primary);
  }

  // The Play popup: a large 16:9 video over the card with YouTube's own
  // controls (pinches are forwarded to the WebView), title above, Close below.
  private renderPlayer(ui: Layout, artist: ContentArtist): void {
    ui.header(artist.songTitle || "Featured song", artist.name);
    // The video's YouTube thumbnail as a poster under the WebView, which
    // covers it once the player has a page.
    const posterId = this.photo(youTubePoster(artist.youtubeUrl!));
    if (posterId) {
      ui.nodes.push({ id: "hm-player-poster", kind: "image", parentId: "hm-root", source: posterId,
        position: [0, PLAYER_Y, 0.008], scale: [PLAYER_W_CM, PLAYER_W_CM * 9 / 16, 1] });
    }
    // Lens Studio Preview renders WebView pages blank, even after it accepts the URL.
    const state = global.deviceInfoSystem.isEditor() ? "unavailable" : this.video?.status ?? "unavailable";
    if (state !== "ready") {
      ui.text("hm-player-note", state === "loading" ? "Starting the player\u2026"
        : "Plays with YouTube controls on Spectacles.\nLens Studio Preview can\u2019t show web video.",
        0, PLAYER_Y - 0.085, 34, GOLD);
      // Over the poster's lower edge, in front of it.
      const note = ui.nodes[ui.nodes.length - 1];
      note.position = [0, PLAYER_Y - 0.085, 0.014];
    }
    this.video?.place(new vec3(0, (ROOT_Y + PLAYER_Y) * 100, ROOT_Z * 100 + 1.5),
      new vec2(PLAYER_W_CM, PLAYER_W_CM * 9 / 16));
    this.video?.setInView(true);
    ui.button("hm-close-player", "Close", "preview:close-player", 0, ACTION_Y, HALF_BUTTON_SCALE, 52);
  }

  // The mobile artist profile as a scrolling page: portrait and Featured song
  // side by side, then facts, the full biography and The record.
  private renderArtist(ui: Layout): void {
    const artist = this.currentArtists().find((a) => a.id === this.selected);
    if (!artist) return ui.actions(null);
    if (this.playerOpen && artist.youtubeUrl) return this.renderPlayer(ui, artist);
    ui.header(artist.name, [artist.genre, artist.era, artist.connection].filter(Boolean).join(" \u00b7 "));
    const page = new Page();
    // Row 1: portrait on the left, the song player's slot on the right.
    const rowTop = page.reserve(HERO_ROW_CM);
    const photoId = this.photo(artist.image);
    if (photoId && artist.image) {
      const [w, h] = fit(artist.image, PORTRAIT_CM, PORTRAIT_CM);
      page.place({ id: "hm-portrait", kind: "image", source: photoId,
        position: [PORTRAIT_X, -(rowTop + HERO_ROW_CM / 2) / 100, 0.006], scale: [w, h, 1] });
    } else {
      page.placeText("hm-portrait-note", artist.image ? "Loading photo\u2026" : artist.name + "\nphoto unavailable",
        PORTRAIT_X, rowTop + HERO_ROW_CM / 2, 34, MUTED);
    }
    if (artist.youtubeUrl) {
      // The WebView sits over this slot once it shows a page; until then the
      // text says what the player is doing, so Play is never silent.
      const state = this.video?.status ?? "unavailable";
      const line = state === "ready" ? "" : state === "loading" ? "Starting the player\u2026"
        : "The YouTube player runs on Spectacles.\nIt isn\u2019t available in Lens Studio Preview.";
      page.placeText("hm-song-note", "Featured song\n" + clip(artist.songTitle, 30) + (line ? "\n\n" + line : ""),
        SONG_SCREEN.x, rowTop + HERO_ROW_CM / 2, 32, state === "unavailable" ? IVORY : MUTED);
      this.songSlotTopCm = rowTop;
    }
    if (artist.image?.credit) page.note("Photo: " + artist.image.credit);
    const paragraphs = artist.biography.length ? artist.biography : [artist.shortBio];
    for (const paragraph of paragraphs) page.paragraph(paragraph);
    if (artist.albumArt) {
      page.heading("The record");
      page.image(this, artist.albumArt, 24, 24);
    }
    page.render(ui);
    ui.actions(artist.youtubeUrl ? { label: "Play " + clip(artist.songTitle || "song", 16), action: "preview:play" } : null);
  }
}

type Node = ViroSpecsPresentationSnapshot["scene"]["nodes"][number];
type ListItem = { id: string; title: string; sub: string; image: ContentImage | null; struck?: boolean };

// A detail page's scrolling body: blocks stack from the top of the content
// (y = 0) downward, and their total height sizes the scroll window's content.
// Heights are estimates from Lens text size; long copy wraps to fixed widths.
class Page {
  private readonly blocks: Node[] = [];
  private cursorCm = 0;
  private count = 0;

  reserve(heightCm: number): number {
    const top = this.cursorCm;
    this.cursorCm += heightCm + PAGE_GAP_CM;
    return top;
  }

  place(node: Omit<Node, "parentId">): void {
    this.blocks.push({ ...node, parentId: DETAIL_ID } as Node);
  }

  placeText(id: string, value: string, x: number, centerCm: number, size: number, color: Color): void {
    this.place({ id, kind: "text", text: value, position: [x, -centerCm / 100, 0.006], textStyle: { size, color } });
  }

  // Text centred on the page, wrapped to `width` characters.
  line(value: string, size: number, color: Color, width = 52): void {
    const text = wrap(value, width);
    const height = text.split("\n").length * size * LINE_CM_PER_POINT;
    const top = this.reserve(height);
    this.placeText("hm-page-" + this.count++, text, 0, top + height / 2, size, color);
  }

  paragraph(value: string, size = 40, color: Color = IVORY): void {
    if (value) this.line(value, size, color, Math.round(52 * 40 / size));
  }

  heading(value: string): void {
    this.line(value, 52, GOLD);
  }

  note(value: string): void {
    this.line(value, 30, MUTED, 70);
  }

  fact(label: string, value: string): void {
    this.line(label, 30, MUTED);
    this.paragraph(value, 40);
  }

  image(owner: HarlemMightSpecsEntry, image: ContentImage | null, boxW: number, boxH: number): void {
    const id = owner.photoFor(image);
    if (!id || !image) return;
    const [w, h] = fit(image, boxW, boxH);
    const top = this.reserve(h);
    this.place({ id: "hm-page-" + this.count++, kind: "image", source: id,
      position: [0, -(top + h / 2) / 100, 0.006], scale: [w, h, 1] });
  }

  render(ui: Layout): void {
    const contentM = Math.max(0, this.cursorCm - PAGE_GAP_CM) / 100;
    ui.nodes.push({ id: DETAIL_ID, kind: "group", parentId: "hm-root", position: [0, DETAIL_CENTER_Y, 0.004],
      scroll: { width: DETAIL_WINDOW_CM[0] / 100, height: DETAIL_WINDOW_CM[1] / 100, contentHeight: contentM } });
    ui.nodes.push(...this.blocks);
  }
}

// Node helpers for one presented frame.
class Layout {
  constructor(readonly nodes: Node[], readonly targets: ViroSpecsPresentationSnapshot["targets"]) {}

  text(id: string, value: string, x: number, y: number, size: number, color: Color, parentId = "hm-root"): void {
    this.nodes.push({ id, kind: "text", parentId, text: value, position: [x, y, 0.01], textStyle: { size, color } });
  }

  // The group is the action target and SIK fits its collider to the first
  // visual inside it, the plate, so the whole plate is pinchable. The label
  // is the plate's sibling so it doesn't inherit the plate's non-uniform scale.
  button(id: string, label: string, action: string, x: number, y: number,
    scale: [number, number, number], size: number, color: Color = IVORY): void {
    this.nodes.push({ id, kind: "group", parentId: "hm-root", position: [x, y, 0.005] });
    this.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale });
    this.text(id + "-label", label, 0, 0, size, color, id);
    this.targets.push({ targetId: id, action });
  }

  header(title: string, subtitle: string): void {
    // Long titles step down a size before they are shortened, so headings like
    // "Today in Harlem, Thursday, October 15th" stay whole.
    const size = title.length <= 26 ? 80 : title.length <= 36 ? 64 : 54;
    this.text("hm-title", clip(title, size === 80 ? 26 : size === 64 ? 36 : 46), 0, TITLE_Y, size, GOLD);
    if (subtitle) this.text("hm-subtitle", clip(subtitle, 60), 0, SUBTITLE_Y, 40, MUTED);
  }

  // Bottom row of a detail view: the main action on the left, Back on the right.
  actions(primary: { label: string; action: string } | null): void {
    if (primary) this.button("hm-primary", clip(primary.label, 22), primary.action, -0.12, ACTION_Y, HALF_BUTTON_SCALE, 52);
    this.button("hm-back", "Back", "preview:back", primary ? 0.12 : 0, ACTION_Y, HALF_BUTTON_SCALE, 52);
  }
}

// ScrollWindow's top edge for content of this height in the list window (cm):
// scroll position y at the top of the content.
function topEdgeCm(contentCm: number): number {
  return -Math.max(contentCm, LIST_WINDOW_CM[1]) / 2 + LIST_WINDOW_CM[1] / 2;
}

function findByName(name: string): SceneObject | null {
  const visit = (object: SceneObject): SceneObject | null => {
    if (object.name === name) return object;
    for (let i = 0; i < object.getChildrenCount(); i++) {
      const found = visit(object.getChild(i));
      if (found) return found;
    }
    return null;
  };
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const found = visit(global.scene.getRootObject(i));
    if (found) return found;
  }
  return null;
}

// The video's YouTube thumbnail (480 x 360, letterboxed 16:9 inside).
function youTubePoster(url: string): ContentImage | null {
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/.exec(url);
  return match ? { url: "https://i.ytimg.com/vi/" + match[1] + "/hqdefault.jpg", width: 480, height: 360, alt: "" } : null;
}

// Width and height in cm that fit an image's aspect ratio inside a box.
function fit(image: ContentImage, boxW: number, boxH: number): [number, number] {
  const aspect = image.width > 0 && image.height > 0 ? image.width / image.height : 4 / 3;
  return aspect >= boxW / boxH ? [boxW, boxW / aspect] : [boxH * aspect, boxH];
}

// Cancelled and postponed events are struck through on the mobile Today card.
function strike(value: string): string {
  return value.split("").map((ch) => (ch === "\n" ? ch : ch + "̶")).join("");
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
const HALF_BUTTON_SCALE: [number, number, number] = [0.96, 0.58, 1];
// Card root, in metres from the Lens origin.
const ROOT_Y = -0.06;
const ROOT_Z = -1.1;
const TITLE_Y = 0.16;
const SUBTITLE_Y = 0.127;
const ACTION_Y = -0.168;
// Tab rail left of the card: 8.5 cm wide, 7 x 7 cm items (above the 6.4 cm
// hand-target floor) 7.8 cm apart, 3.2 cm icons.
const RAIL_X = -0.3075;
const RAIL_SPACING = 0.078;
const RAIL_FRAME_SCALE: [number, number, number] = [0.35, 3.5, 1];
const RAIL_ITEM_SCALE: [number, number, number] = [0.29, 0.58, 1];
const RAIL_ICON_CM = 3.2;
// Lists: two columns of 23 x 12 cm tiles scrolling in a 48 x 37 cm window
// from under the logo to the card's foot (y +0.18 to -0.19).
const TILE_SCALE: [number, number, number] = [0.96, 1.0, 1];
const TILE_COLUMN_X = 0.12;
const TILE_PITCH = 0.13;
const TILE_PHOTO_CM = 9;
const LIST_WINDOW_CM = [48, 37] as const;
const LIST_CENTER_Y = -0.005;
const LIST_WINDOW_OBJECT = "viro-scroll:hm-list";
const LOAD_MORE_MARGIN_CM = 15;
// Artist profile: portrait on the left, Featured song player on the right
// (16:9, 26 cm wide), both centred 4 cm below the subtitle.
const PORTRAIT_X = -0.14;
const PORTRAIT_CM = 15;
const SONG_SCREEN = { x: 0.085, w: 26 } as const;
// Detail pages: a 48 x 23 cm scrolling body between the header (top ~0.11)
// and the action row (top ~-0.133).
const DETAIL_ID = "hm-detail";
const DETAIL_WINDOW_CM = [48, 23] as const;
const DETAIL_CENTER_Y = -0.012;
const DETAIL_WINDOW_OBJECT = "viro-scroll:hm-detail";
const PAGE_GAP_CM = 1.6;
const LINE_CM_PER_POINT = 0.052;
const HERO_ROW_CM = 15.5;
// Play popup: a 44 x 24.75 cm (16:9) video centred on the card.
const PLAYER_W_CM = 44;
const PLAYER_Y = -0.005;

// Largest CMS photo in a detail view, in cm (width, height).
const PHOTO_BOX = [18, 11] as const;
const LOGO_IMAGE_ID = "harlem-might-logo";
// Measured against the 50 cm frame in Preview, one image unit is about 1 cm.
// 21 x 7 cm keeps the 3:1 logo whole (never stretched) and its top edge
// where the 30 x 10 cm version had it.
const LOGO_SCALE: [number, number, number] = [21, 7, 1];
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
  { id: "apollo", name: "Apollo Theater", category: "Culture", street: "253 West 125th Street", area: "Harlem",
    summary: "A Harlem performing-arts landmark with a global cultural reach.",
    latitude: 40.8100895, longitude: -73.9499948, image: null },
  { id: "schomburg", name: "Schomburg Center", category: "Books", street: "515 Malcolm X Boulevard", area: "Harlem",
    summary: "", latitude: 40.8146476, longitude: -73.9409874, image: null },
];
const OFFLINE_ARTISTS: ContentArtist[] = [
  { id: "fats-waller", name: "Fats Waller", genre: "Jazz", era: "1920s\u20131940s", shortBio: "", connection: "", biography: [], albumArt: null,
    songTitle: "Ain't Misbehavin'", youtubeUrl: "https://www.youtube.com/watch?v=pZ8fWP6a3Q4", image: null },
  { id: "frankie-lymon", name: "Frankie Lymon", genre: "Doo-wop", era: "1950s\u20131960s", shortBio: "", connection: "", biography: [], albumArt: null,
    songTitle: "Goody Goody", youtubeUrl: "https://www.youtube.com/watch?v=K3VLt_Q5pmA", image: null },
  { id: "big-l", name: "Big L", genre: "Hip-hop", era: "1990s", shortBio: "", connection: "", biography: [], albumArt: null,
    songTitle: "Put It On", youtubeUrl: "https://www.youtube.com/watch?v=WWMjRMJ0dTI", image: null },
  { id: "teyana-taylor", name: "Teyana Taylor", genre: "R&B", era: "2000s\u2013present", shortBio: "", connection: "", biography: [], albumArt: null,
    songTitle: "Gonna Love Me", youtubeUrl: "https://www.youtube.com/watch?v=LwSCplLupTA", image: null },
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
