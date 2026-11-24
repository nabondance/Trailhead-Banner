import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Client-side video capture of the globe canvas, two paths:
 *
 * 1. WebCodecs VideoEncoder + mp4-muxer → progressive faststart MP4 with
 *    exact per-frame timestamps. QuickTime/AVFoundation-compatible. Preferred.
 * 2. MediaRecorder → fragmented MP4 (or WebM where mp4 is unavailable).
 *    Fallback for browsers without WebCodecs.
 *
 * Both record a downscaled mirror of the source canvas so the encoder isn't
 * fed the supersampled backing buffer, at a fixed output size so every
 * device produces the same LinkedIn-vertical file (1080×1350 on the 4:5 box).
 */

// Explicit avc1 entries FIRST: bare 'video/mp4' lets Chrome pick the codec,
// and it picks VP9 for WebGL sources — a file QuickTime and LinkedIn refuse
const MEDIA_RECORDER_TYPES = ['video/mp4;codecs="avc1.42E01E"', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm'];

// H.264: baseline first for decoder reach, then high profile; level 4.0+ for 1080px+ frames
const AVC_CODECS = ['avc1.420028', 'avc1.42002a', 'avc1.640028', 'avc1.640033'];

const RECORD_SECONDS = 5;
const FPS = 30;
const BITRATE = 6_000_000;
const TARGET_WIDTH = 1080;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Fixed-size mirror of the source canvas: even dimensions (H.264) */
function makeMirror(source) {
  const scale = TARGET_WIDTH / source.width;
  const mirror = document.createElement('canvas');
  mirror.width = Math.floor((source.width * scale) / 2) * 2;
  mirror.height = Math.floor((source.height * scale) / 2) * 2;
  const ctx = mirror.getContext('2d');
  const tick = () => ctx.drawImage(source, 0, 0, mirror.width, mirror.height);
  tick();
  return { mirror, tick };
}

/* What this browser can do — cheap, safe to call anywhere client-side */
function videoSupport() {
  const hasWebCodecs = typeof VideoEncoder !== 'undefined';
  const mediaRecorderType =
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
      ? MEDIA_RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;
  return { hasWebCodecs, mediaRecorderType, supported: hasWebCodecs || Boolean(mediaRecorderType) };
}

/* Path 1: exact-timestamp frames through VideoEncoder into a progressive MP4 */
async function recordWebCodecs(source) {
  const { mirror, tick } = makeMirror(source);
  let codec = null;
  for (const candidate of AVC_CODECS) {
    const { supported } = await VideoEncoder.isConfigSupported({
      codec: candidate,
      width: mirror.width,
      height: mirror.height,
      bitrate: BITRATE,
      framerate: FPS,
    });
    if (supported) {
      codec = candidate;
      break;
    }
  }
  if (!codec) throw new Error('No supported H.264 encoder config');

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: mirror.width, height: mirror.height },
    fastStart: 'in-memory',
  });
  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure({ codec, width: mirror.width, height: mirror.height, bitrate: BITRATE, framerate: FPS });

  const totalFrames = RECORD_SECONDS * FPS;
  for (let i = 0; i < totalFrames && !encodeError; i++) {
    tick();
    const frame = new VideoFrame(mirror, { timestamp: (i * 1e6) / FPS, duration: 1e6 / FPS });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    await sleep(1000 / FPS);
  }
  if (encodeError) throw encodeError;
  await encoder.flush();
  muxer.finalize();
  encoder.close();
  return {
    blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }),
    detail: `${codec} ${mirror.width}×${mirror.height} ${totalFrames}f via WebCodecs+mp4-muxer`,
    suffix: 'webcodecs',
  };
}

/* Path 2: MediaRecorder on the mirror canvas (fragmented MP4 in Chrome) */
function recordMediaRecorder(source, mimeType) {
  return new Promise((resolve, reject) => {
    const { mirror, tick } = makeMirror(source);
    const painter = setInterval(tick, 1000 / FPS);
    let recorder;
    try {
      recorder = new MediaRecorder(mirror.captureStream(FPS), { mimeType, videoBitsPerSecond: BITRATE });
    } catch (e) {
      clearInterval(painter);
      reject(new Error(`Recorder setup failed: ${e.message}`));
      return;
    }
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = (e) => {
      clearInterval(painter);
      reject(new Error(`Recorder error: ${e.error?.message || 'unknown'}`));
    };
    recorder.onstop = () => {
      clearInterval(painter);
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      if (blob.size === 0) {
        reject(
          new Error(
            document.hidden
              ? 'Empty file — the page was in a background tab, so no frames were painted'
              : 'Empty file — captureStream delivered no frames'
          )
        );
        return;
      }
      resolve({
        blob,
        detail: `${mimeType} ${mirror.width}×${mirror.height} via MediaRecorder (fragmented — QuickTime will refuse it)`,
        suffix: 'mediarecorder',
      });
    };
    // 1s timeslice: Safari has a history of empty single-blob recordings
    recorder.start(1000);
    setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), RECORD_SECONDS * 1000);
  });
}

/* Auto-pick the best available path */
async function recordGlobeVideo(source) {
  const support = videoSupport();
  if (support.hasWebCodecs) {
    try {
      return await recordWebCodecs(source);
    } catch (error) {
      if (!support.mediaRecorderType) throw error;
      console.warn('[Snowglobe] WebCodecs recording failed, falling back to MediaRecorder:', error.message);
    }
  }
  if (support.mediaRecorderType) return recordMediaRecorder(source, support.mediaRecorderType);
  throw new Error('Video recording is not supported in this browser');
}

export {
  MEDIA_RECORDER_TYPES,
  RECORD_SECONDS,
  FPS,
  videoSupport,
  recordWebCodecs,
  recordMediaRecorder,
  recordGlobeVideo,
};
