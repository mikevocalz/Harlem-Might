import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../../ViroSpecs/lens/ViroSpecsPresentationHost";
import { ARNavigation } from "SpecsNavigationKit.lspkg/ARNavigationComponent/Scripts/ARNavigation";
import { GeoLocationPlace } from "SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace";
import { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";

/**
 * Native Lens Studio entrypoint. Offline it shows a small Preview story and
 * walks to a place with Snap's Navigation Kit arrow; acceptFrame() replaces
 * it with the projection produced from the real Harlem Might catalogue and
 * navigation session.
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

  private presentation: ViroSpecsPresentationHost | null = null;
  private navigation: NavigationDataComponent | null = null;
  private arrow: ARNavigation | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly commandListeners = new Set<(command: string) => void>();
  private readonly allowedLiveActions = new Set<string>();
  private tab: TabId = "explore";
  private previewPlace: PreviewPlace | null = null;
  private walk: { place: PreviewPlace; target: GeoLocationPlace; arrived: boolean } | null = null;
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
    if (!this.navigation || !this.arrow) {
      throw new Error("Harlem Might requires Navigation Kit's NavigationDataComponent and ARNavigation.");
    }

    this.raiseArrowIntoView();
    this.createEvent("OnStartEvent").bind(() => {
      this.unsubscribe = this.presentation!.subscribeAction((command) => this.onAction(command));
      this.navigation!.onArrivedAtPlace.add((place) => {
        if (!this.walk || place !== this.walk.target) return;
        this.walk.arrived = true;
        this.showPreview();
      });
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
      this.previewPlace = null;
    } else if (command === "preview:back") {
      this.previewPlace = null;
    } else if (command.startsWith("preview:place:")) {
      const id = command.slice("preview:place:".length);
      this.previewPlace = PREVIEW_PLACES.find((place) => place.id === id) ?? null;
    } else if (command === "preview:walk" && this.previewPlace) {
      this.startWalk(this.previewPlace);
    } else if (command === "preview:end-walk") {
      this.endWalk();
    } else return;
    this.showPreview();
  }

  // The Navigation Kit arrow points in a straight line to the entrance using
  // the Lens's own location. It is a bearing, not a street route; route
  // geometry still waits for the phone's route provider and its safety gates.
  private startWalk(place: PreviewPlace): void {
    this.endWalk();
    const geo = GeoPosition.create();
    geo.latitude = place.latitude;
    geo.longitude = place.longitude;
    const target = new GeoLocationPlace(geo, ARRIVAL_RADIUS_METERS, place.name, this.placeIcon,
      place.address, this.navigation!.getUserPosition());
    this.walk = { place, target, arrived: false };
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

  private endWalk(): void {
    if (!this.walk) return;
    this.arrow?.setVisible(false);
    this.navigation?.stopNavigation();
    this.navigation?.removePlace(this.walk.target);
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
    nodes.push({ id: "hm-frame", kind: "panel", parentId: "hm-root", position: [0, 0.05, -0.03], scale: FRAME_SCALE });
    // The app header: the landscape logo, as on mobile, never a text stand-in.
    nodes.push({ id: "hm-logo", kind: "image", parentId: "hm-root", source: LOGO_IMAGE_ID,
      position: [0, 0.225, 0.01], scale: LOGO_SCALE });
    // The app's tab bar, in the app's order, under the header.
    TABS.forEach((tab, index) => {
      const active = tab.id === this.tab;
      pinchable("hm-tab-" + tab.id, tab.label, "preview:tab:" + tab.id,
        (index - (TABS.length - 1) / 2) * TAB_SPACING, 0.135, TAB_SCALE, 48, active ? GOLD : MUTED);
    });

    const place = this.previewPlace;
    if (this.tab === "explore" && place) {
      text("hm-title", place.name, 0, 0.065, 104, GOLD);
      text("hm-subtitle", place.address, 0, 0.02, 60, IVORY);
      button(0, "Start walking", "preview:walk", -0.05);
      button(1, "Back to places", "preview:back", -0.135);
    } else if (this.tab === "explore") {
      text("hm-title", "Explore", 0, 0.065, 104, GOLD);
      text("hm-subtitle", "Offline preview", 0, 0.02, 52, MUTED);
      PREVIEW_PLACES.forEach((p, index) => button(index, p.name, "preview:place:" + p.id, -0.05 - index * 0.085));
    } else if (this.tab === "today") {
      const fact = nearestHistoryFact(new Date());
      text("hm-title", "From Harlem\u2019s past", 0, 0.065, 80, GOLD);
      text("hm-date", formatFactDate(fact.date), 0, 0.02, 56, MUTED);
      text("hm-body", wrap(fact.text, 40), 0, -0.06, 60, IVORY);
      text("hm-source", "Source: " + fact.sourceLabel, 0, -0.145, 44, MUTED);
    } else {
      // Walks, Stories and Music are catalogue content; offline there is none
      // to show, so the tab says where it comes from instead of faking it.
      const tab = TABS.find((t) => t.id === this.tab)!;
      text("hm-title", tab.label, 0, 0.065, 116, GOLD);
      text("hm-body", wrap(tab.offline, 40), 0, -0.01, 60, IVORY);
      button(0, "Explore places", "preview:tab:explore", -0.11);
    }
    this.presentation.present({ scene: { version: 1, nodes }, targets });
  }
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
type PreviewPlace = (typeof PREVIEW_PLACES)[number];
type TabId = (typeof TABS)[number]["id"];
type HistoryFact = (typeof HISTORY_FACTS)[number];

// Same tabs, labels and order as the app and site (`primaryNav`). More stays
// on the phone.
const TABS = [
  { id: "explore", label: "Explore", offline: "" },
  { id: "walks", label: "Walks", offline: "Guided walks load from the Harlem Might app once your phone is connected." },
  { id: "stories", label: "Stories", offline: "Stories load from the Harlem Might app once your phone is connected." },
  { id: "music", label: "Music", offline: "Music loads from the Harlem Might app once your phone is connected." },
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
// UI Kit BackPlate is 24 x 12 cm at scale 1: frame 50 x 48 cm, walking card
// 40 x 16 cm, buttons 32 x 7 cm, tabs 9 x 6.5 cm. Every pinch target clears
// the 64 mm minimum for hands.
const FRAME_SCALE: [number, number, number] = [2.08, 4, 1];
const WALK_FRAME_SCALE: [number, number, number] = [1.67, 1.33, 1];
const BUTTON_SCALE: [number, number, number] = [1.33, 0.58, 1];
const TAB_SCALE: [number, number, number] = [0.375, 0.54, 1];
const TAB_SPACING = 0.096;
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

// Demonstration content only; live frames come from projectHarlemSpecs.
// Coordinates match the Harlem Might route fixtures for these places.
const PREVIEW_PLACES = [
  { id: "apollo", name: "Apollo Theater", address: "253 West 125th Street",
    latitude: 40.8100895, longitude: -73.9499948 },
  { id: "schomburg", name: "Schomburg Center", address: "515 Malcolm X Boulevard",
    latitude: 40.8146476, longitude: -73.9409874 },
] as const;

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
