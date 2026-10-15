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

  private control: WebPageTextureProvider | null = null;
  private ready = false;
  private pendingUrl: string | null = null;
  private creating = false;

  onAwake(): void {
    this.screen.getSceneObject().enabled = false;
    // Own material, so the web texture never lands on other images.
    this.screen.mainMaterial = this.screen.mainMaterial.clone();
  }

  /** World position (cm) and size (cm) of the screen, e.g. beside an artist portrait. */
  place(position: vec3, size: vec2): void {
    const transform = this.getSceneObject().getTransform();
    transform.setWorldPosition(position);
    transform.setWorldScale(new vec3(size.x, size.y, 1));
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
      this.screen.getSceneObject().enabled = true;
      this.flush();
    }
    else this.create();
  }

  stop(): void {
    this.pendingUrl = null;
    this.screen.getSceneObject().enabled = false;
    // Loading a blank https page stops playback; WebView only accepts https.
    if (this.ready) this.control!.loadUrl("https://www.youtube-nocookie.com/embed/");
  }

  private create(): void {
    if (this.creating) return;
    this.creating = true;
    let options: WebViewOptions;
    try {
      // Throws unless Project Settings > Experimental APIs is on.
      options = InternetModule.createWebViewOptions(new vec2(1280, 720));
    } catch (error) {
      this.creating = false;
      print("[HarlemMightVideoScreen] WebView unavailable: " + error);
      return;
    }
    this.internetModule.createWebView(
      options,
      (texture) => {
        this.screen.mainPass.baseTex = texture;
        this.control = texture.control as WebPageTextureProvider;
        this.control.onReady.add(() => {
          this.ready = true;
          // Show the screen only once it has a page; until then the image
          // has no texture and would render Lens's missing-texture checker.
          if (this.pendingUrl) this.screen.getSceneObject().enabled = true;
          this.flush();
        });
      },
      (message) => {
        this.creating = false;
        this.screen.getSceneObject().enabled = false;
        print("[HarlemMightVideoScreen] WebView unavailable: " + message);
      },
    );
  }

  private flush(): void {
    if (this.pendingUrl) this.control!.loadUrl(this.pendingUrl);
  }
}

function youTubeVideoId(url: string): string | null {
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/.exec(url);
  return match ? match[1] : null;
}
