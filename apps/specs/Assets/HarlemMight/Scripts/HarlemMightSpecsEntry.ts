import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../../ViroSpecs/lens/ViroSpecsPresentationHost";

/**
 * Native Lens Studio entrypoint. This first wave deliberately has a small
 * offline Preview story; acceptFrame() replaces it with the projection
 * produced from the real Harlem Might catalogue and navigation session.
 */
@component
export class HarlemMightSpecsEntry extends BaseScriptComponent {
  @ui.label("Harlem Might — Specs spatial experience")

  @input
  @hint("SceneObject hosting ViroSpecsPresentationHost")
  presentationHostObject: SceneObject;

  private presentation: ViroSpecsPresentationHost | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly commandListeners = new Set<(command: string) => void>();
  private previewPlace: string | null = null;
  private usingLiveFrame = false;

  onAwake(): void {
    this.presentation = this.presentationHostObject.getComponent(
      ViroSpecsPresentationHost.getTypeName()
    ) as ViroSpecsPresentationHost | null;
    if (!this.presentation) throw new Error("Harlem Might requires ViroSpecsPresentationHost.");

    this.createEvent("OnStartEvent").bind(() => {
      this.unsubscribe = this.presentation!.subscribeAction((command) => this.onAction(command));
      this.showPreview();
    });
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.commandListeners.clear();
    });
  }

  /** Called by a permissioned app transport once real state becomes available. */
  acceptFrame(frame: ViroSpecsPresentationSnapshot): void {
    if (!this.presentation) throw new Error("Harlem Specs scene is not ready.");
    this.presentation.present(frame);
    this.usingLiveFrame = true;
  }

  /** The connected app is the only authority allowed to act on live commands. */
  subscribeCommand(listener: (command: string) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  private onAction(command: string): void {
    if (this.usingLiveFrame) {
      for (const listener of this.commandListeners) listener(command);
      return;
    }
    // Lens-only Preview navigation; it cannot start a real walking route.
    if (command === "preview:back") this.previewPlace = null;
    else if (command === "preview:apollo") this.previewPlace = "Apollo Theater";
    else if (command === "preview:schomburg") this.previewPlace = "Schomburg Center";
    else return;
    this.showPreview();
  }

  private showPreview(): void {
    if (!this.presentation || this.usingLiveFrame) return;
    const nodes: ViroSpecsPresentationSnapshot["scene"]["nodes"] = [
      { id: "hm-root", kind: "group", position: [0, -0.08, -1.1] },
      { id: "hm-frame", kind: "panel", parentId: "hm-root", scale: [0.54, 0.43, 1] },
      { id: "hm-caption", kind: "text", parentId: "hm-root",
        text: "OFFLINE PREVIEW", position: [0, 0.17, 0.02] },
      { id: "hm-title", kind: "text", parentId: "hm-root",
        text: this.previewPlace ?? "Harlem Might", position: [0, 0.09, 0.025] },
    ];
    const items = this.previewPlace
      ? [{ label: "Back to Explore", command: "preview:back" }]
      : [
          { label: "Apollo Theater", command: "preview:apollo" },
          { label: "Schomburg Center", command: "preview:schomburg" },
        ];
    const targets: ViroSpecsPresentationSnapshot["targets"] = [];
    items.forEach((item, index) => {
      const id = "hm-button-" + index;
      nodes.push({ id, kind: "group", parentId: "hm-root", position: [0, -0.01 - index * 0.08, 0.035] });
      nodes.push({ id: id + "-label", kind: "text", parentId: id, text: item.label, position: [0, 0, 0.008] });
      targets.push({ targetId: id, action: item.command });
    });
    this.presentation.present({ scene: { version: 1, nodes }, targets });
  }
}
