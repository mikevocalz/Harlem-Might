import type { ListenerPose, SpatialAudioCapabilities, SpatialMusicEngine, SpatialTrack, Vector3 } from './spatial-audio';

/**
 * Browser Web Audio implementation for separately licensed audio assets.
 * Never call this for a YouTube iframe or its audio.
 * Construct/play only in response to an explicit user gesture.
 */
export function createWebSpatialMusicEngine(): SpatialMusicEngine {
  let context: AudioContext | null = null;
  let audio: HTMLAudioElement | null = null;
  let panner: PannerNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let playbackRequest: { audio: HTMLAudioElement } | null = null;
  let lastPosition: Vector3 = { x: 0, y: 0, z: -2 };
  let lastPose: ListenerPose = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  };

  const capabilities = (): SpatialAudioCapabilities => {
    const supported = typeof window !== 'undefined' &&
      typeof window.AudioContext === 'function' &&
      typeof window.AudioContext.prototype.createPanner === 'function';
    return {
      supported, panner: supported, headTracking: false,
      // Browser support varies; this adapter uses equal-power, not HRTF or ambisonics.
      hrtf: false, ambisonics: false,
      ...(!supported ? { reason: 'Browser Web Audio positional sound is unavailable.' } : {}),
    };
  };

  const setParams = (target: { positionX: AudioParam; positionY: AudioParam; positionZ: AudioParam }, v: Vector3) => {
    target.positionX.value = v.x;
    target.positionY.value = v.y;
    target.positionZ.value = v.z;
  };

  const setListener = (pose: ListenerPose) => {
    if (!context) return;
    const listener = context.listener;
    setParams(listener, pose.position);
    listener.forwardX.value = pose.forward.x;
    listener.forwardY.value = pose.forward.y;
    listener.forwardZ.value = pose.forward.z;
    listener.upX.value = pose.up.x;
    listener.upY.value = pose.up.y;
    listener.upZ.value = pose.up.z;
  };

  async function dispose() {
    playbackRequest = null;
    audio?.pause();
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    source?.disconnect();
    panner?.disconnect();
    source = null;
    panner = null;
    audio = null;
    const previous = context;
    context = null;
    if (previous && previous.state !== 'closed') await previous.close();
  }

  return {
    getCapabilities: capabilities,
    async play(track: SpatialTrack) {
      if (!capabilities().supported) throw new Error('Positional audio unavailable');
      if (!track.licenseSourceUrl || !/^https:\/\//.test(track.url)) {
        throw new Error('Spatial playback requires licensed HTTPS media and its provenance');
      }
      if (track.format === 'ambisonic') throw new Error('Ambisonic decoding is not supported');
      playbackRequest = null;
      if (!context) {
        context = new AudioContext();
        panner = context.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.rolloffFactor = 1;
        panner.connect(context.destination);
        setParams(panner, lastPosition);
        setListener(lastPose);
      }
      if (!audio || audio.src !== track.url) {
        audio?.pause();
        source?.disconnect();
        audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'none';
        audio.src = track.url;
        source = context.createMediaElementSource(audio);
        source.connect(panner!);
      }
      const request = { audio };
      const requestContext = context;
      playbackRequest = request;
      try {
        await requestContext.resume();
        // Pause, stop, disposal or a later play revokes this request's intent.
        if (playbackRequest !== request) return;
        await request.audio.play();
        // A late completion may clean up its own element, but must not pause
        // a newer request that has reused the same media element.
        if (playbackRequest !== request && playbackRequest?.audio !== request.audio) {
          request.audio.pause();
        }
      } catch (error) {
        // Browser pause/load/close may reject pending work after cancellation.
        if (playbackRequest !== request) return;
        playbackRequest = null;
        request.audio.pause();
        throw error;
      }
    },
    async pause() { playbackRequest = null; audio?.pause(); },
    async stop() { playbackRequest = null; if (audio) { audio.pause(); audio.currentTime = 0; } },
    setSourcePosition(v) {
      lastPosition = v;
      if (panner) setParams(panner, v);
    },
    setListenerPose(v) {
      lastPose = v;
      setListener(v);
    },
    dispose,
  };
}
