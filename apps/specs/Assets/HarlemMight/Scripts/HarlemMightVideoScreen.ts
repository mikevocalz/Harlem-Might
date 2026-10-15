/**
 * Plays a YouTube video for the Harlem Might Music tab in a Spectacles WebView.
 * WebView is an experimental, device-only API: in Lens Studio Preview creation
 * fails and the screen stays hidden; the Music card under it says the video
 * plays on Spectacles.
 */
@component
export class HarlemMightVideoScreen extends BaseScriptComponent {
  @input
  @hint("Internet Module asset (Asset Browser > + > Internet Module)")
  internetModule: InternetModule;

  @input
  @hint("Image or mesh visual that shows the web page texture; hidden until a video plays")
  screen: Image;

  /** "idle" until a song is cued; "unavailable" when the WebView can't start (Preview, no network). */
  status: "idle" | "loading" | "ready" | "unavailable" = "idle";
  onStatusChanged: (() => void) | null = null;

  private control: WebPageTextureProvider | null = null;
  private inView = true;
  private ready = false;
  private pendingUrl: string | null = null;
  private creating = false;

  onAwake(): void {
    // Hide the Image component, not the object: this script lives on the same
    // object, and a disabled object would stop its timeout and WebView callbacks.
    this.screen.enabled = false;
    // Own material, so the web texture never lands on other images.
    this.screen.mainMaterial = this.screen.mainMaterial.clone();
  }

  /** World position (cm) and size (cm) of the screen, e.g. beside an artist portrait. */
  place(position: vec3, size: vec2): void {
    const transform = this.getSceneObject().getTransform();
    transform.setWorldPosition(position);
    transform.setWorldScale(new vec3(size.x, size.y, 1));
  }

  /** Shows or hides the screen without stopping playback, e.g. while its slot is scrolled away. */
  setInView(inView: boolean): void {
    this.inView = inView;
    this.screen.enabled = inView && this.ready && this.pendingUrl !== null;
  }

  /** Loads the video's embed player; `autoplay` starts it, otherwise it waits cued. */
  play(youtubeUrl: string, autoplay = true): void {
    const id = youTubeVideoId(youtubeUrl);
    if (!id) return;
    // The privacy-enhanced embed the mobile app uses (music-format.ts),
    // which fills the WebView without YouTube's page chrome.
    this.pendingUrl = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&playsinline=1"
      + (autoplay ? "&autoplay=1" : "");
    if (this.ready) {
      this.screen.enabled = this.inView;
      this.flush();
    }
    else this.create();
  }

  stop(): void {
    this.pendingUrl = null;
    this.screen.enabled = false;
    // Loading a blank https page stops playback; WebView only accepts https.
    if (this.ready) this.control!.loadUrl("https://www.youtube-nocookie.com/embed/");
  }

  private setStatus(status: HarlemMightVideoScreen["status"]): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatusChanged?.();
  }

  private create(): void {
    if (this.creating) return;
    this.creating = true;
    this.setStatus("loading");
    // Lens Studio Preview neither creates the WebView nor reports a failure,
    // so a creation that hasn't answered in a few seconds counts as unavailable.
    const timeout = this.createEvent("DelayedCallbackEvent");
    timeout.bind(() => {
      if (this.status !== "loading") return;
      this.creating = false;
      print("[HarlemMightVideoScreen] WebView did not start within " + CREATE_TIMEOUT_S + " s");
      this.setStatus("unavailable");
    });
    timeout.reset(CREATE_TIMEOUT_S);
    let options: WebViewOptions;
    try {
      // Throws unless Project Settings > Experimental APIs is on.
      options = InternetModule.createWebViewOptions(new vec2(1280, 720));
    } catch (error) {
      this.creating = false;
      print("[HarlemMightVideoScreen] WebView unavailable: " + error);
      this.setStatus("unavailable");
      return;
    }
    this.internetModule.createWebView(
      options,
      (texture) => {
        this.screen.mainPass.baseTex = texture;
        this.control = texture.control as WebPageTextureProvider;
        this.control.onReady.add(() => {
          this.ready = true;
          this.setStatus("ready");
          // Show the screen only once it has a page; until then the image
          // has no texture and would render Lens's missing-texture checker.
          if (this.pendingUrl) this.screen.enabled = this.inView;
          this.flush();
        });
      },
      (message) => {
        this.creating = false;
        this.screen.enabled = false;
        print("[HarlemMightVideoScreen] WebView unavailable: " + message);
        this.setStatus("unavailable");
      },
    );
  }

  private flush(): void {
    if (this.pendingUrl) this.control!.loadUrl(this.pendingUrl);
  }
}

const CREATE_TIMEOUT_S = 5;

function youTubeVideoId(url: string): string | null {
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/.exec(url);
  return match ? match[1] : null;
}
