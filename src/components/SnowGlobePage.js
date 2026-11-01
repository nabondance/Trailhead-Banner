'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faDownload, faLink, faShareNodes, faSnowflake, faVideo } from '@fortawesome/free-solid-svg-icons';
import { videoSupport, recordGlobeVideo, RECORD_SECONDS } from './snowglobe/recording';
import { extractUsernameFromUrl, validateUsernameFormat } from '../utils/usernameValidation';
import GenerationCount from './GenerationCount';
import GlobeLegend from './snowglobe/GlobeLegend';

const SnowGlobeScene = dynamic(() => import('./SnowGlobeScene'), {
  ssr: false,
  loading: () => <div className='snowglobe-placeholder'>Building your globe…</div>,
});

const YEAR = 2026;

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function errorMessageFor(status, json) {
  switch (status) {
    case 400:
      return json.error || 'Please check the username and try again.';
    case 404:
      return 'Trailhead profile not found. Check the username and that the profile is public.';
    case 429:
      return json.message || 'Too many requests. Please wait a moment and try again.';
    case 503:
      return 'Trailhead is temporarily unavailable. Please try again in a few minutes.';
    default:
      return json.message || json.error || 'Something went wrong. Please try again.';
  }
}

function WebGLHelpPanel({ onRetry }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText('chrome://settings/system');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the address is shown as text anyway */
    }
  };

  return (
    <div className='snowglobe-webgl-help'>
      <h3>Your browser can&apos;t display 3D right now</h3>
      <p>
        The snow globe needs WebGL, which is turned off — usually because hardware acceleration is disabled in your
        browser settings. It&apos;s a quick fix:
      </p>
      <ol>
        <li>
          Open <code>chrome://settings/system</code>{' '}
          <button type='button' className='button snowglobe-small-button' onClick={copyAddress}>
            {copied ? 'Copied ✅' : 'Copy address'}
          </button>{' '}
          in a new tab
        </li>
        <li>
          Turn on <em>&ldquo;Use graphics acceleration when available&rdquo;</em>
        </li>
        <li>Relaunch the browser and come back</li>
      </ol>
      <button type='button' className='button' onClick={onRetry}>
        Check again
      </button>
    </div>
  );
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

// personal link of a globe (same origin, so preview deployments link to themselves)
const personalPath = (username) => `/rewind/${YEAR}/${username}`;
const personalUrl = (username) => `${window.location.origin}${personalPath(username)}`;

/* The phone's motion drives the globe like a real one held in the hand: its
   acceleration (gravity excluded) is passed on continuously, so the globe
   leans with every move and the snow sloshes the other way, with no delay
   and in the right direction. A hard shake also stirs up the full flurry.
   iOS needs a permission tap first; Android and others deliver motion
   events right away. */
const FLURRY_THRESHOLD = 18; // m/s²: a hard shake also tumbles everything
const FLURRY_COOLDOWN_MS = 700;

function motionPermissionNeeded() {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission === 'function';
}

function useDeviceMotion(phoneMotion, onFlurry, enabled) {
  const onFlurryRef = useRef(onFlurry);
  onFlurryRef.current = onFlurry;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.DeviceMotionEvent) return undefined;
    let last = 0;
    let prevG = null; // fallback: change of the gravity-included reading
    // sideways speed (m/s) and position (m) of the phone, both leaking back to
    // 0 so sensor noise never drifts: the globe follows the hand's position
    let vx = 0;
    let px = 0;
    let prevT = 0;
    const handleMotion = (e) => {
      const a = e.acceleration;
      let x;
      let y;
      if (a && a.x != null) {
        x = a.x;
        y = a.y;
      } else {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x == null) return;
        x = prevG ? g.x - prevG.x : 0;
        y = prevG ? g.y - prevG.y : 0;
        prevG = { x: g.x, y: g.y };
      }
      // device axes → screen axes when the phone is turned sideways
      const angle = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
      const sx = x * Math.cos(angle) + y * Math.sin(angle);
      const sy = -x * Math.sin(angle) + y * Math.cos(angle);
      const nowT = performance.now();
      const dt = prevT ? Math.min((nowT - prevT) / 1000, 0.05) : 0.016;
      prevT = nowT;
      vx = (vx + sx * dt) * Math.exp(-dt * 4);
      px = (px + vx * dt) * Math.exp(-dt * 3);
      phoneMotion.current = { x: sx, y: sy, px, t: nowT };

      const magnitude = Math.hypot(x, y, a?.z ?? 0);
      const now = Date.now();
      if (magnitude > FLURRY_THRESHOLD && now - last > FLURRY_COOLDOWN_MS) {
        last = now;
        onFlurryRef.current();
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled, phoneMotion]);
}

/* Two uses: the /rewind form, and the personal link /rewind/2026/<username>
   (linkUsername set), which shows that user's saved globe, builds it once if
   there is none yet during the Rewind period, and has no form. */
export default function SnowGlobePage({
  fallbackCount = null,
  linkUsername = null,
  savedGlobe = null,
  loadFailed = false,
  open = true,
}) {
  const isLink = !!linkUsername;
  const [input, setInput] = useState('');
  const [data, setData] = useState(savedGlobe);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [shakeNonce, setShakeNonce] = useState(0);
  const [shakeSway, setShakeSway] = useState(true); // false: the phone already moves the globe
  const phoneMotion = useRef({ x: 0, y: 0, t: 0 }); // live phone acceleration, screen axes
  const [webglOk, setWebglOk] = useState(null); // null = not checked yet (SSR-safe)
  const [videoOk, setVideoOk] = useState(false); // WebCodecs or MediaRecorder available
  const [busy, setBusy] = useState(''); // '' | 'image' | 'video' | 'share'
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareOk, setShareOk] = useState(false); // native share sheet can take image files
  const [isTouch, setIsTouch] = useState(false);
  const [motionState, setMotionState] = useState('unknown'); // 'unknown' | 'needs-permission' | 'on' | 'denied'
  const pendingShare = useRef(null); // image ready to share when the browser needed a second tap
  const glRef = useRef(null);
  const resultRef = useRef(null);
  const countRef = useRef(null);
  const autoBuilt = useRef(false);

  useEffect(() => {
    setWebglOk(detectWebGL());
    setVideoOk(videoSupport().supported);
    try {
      const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
      setShareOk(!!navigator.canShare?.({ files: [probe] }));
    } catch {
      setShareOk(false);
    }
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    setIsTouch(touch);
    if (touch && window.DeviceMotionEvent) setMotionState(motionPermissionNeeded() ? 'needs-permission' : 'on');
  }, []);

  const shake = (sway = true) => {
    setShakeSway(sway);
    setShakeNonce((n) => n + 1);
  };
  useDeviceMotion(phoneMotion, () => shake(false), !!data && motionState === 'on');

  const enableMotion = async () => {
    try {
      const result = await window.DeviceMotionEvent.requestPermission();
      setMotionState(result === 'granted' ? 'on' : 'denied');
    } catch {
      setMotionState('denied');
    }
  };

  // bring the fresh globe into view: on most screens it starts below the form
  useEffect(() => {
    if (data && !isLink) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data, isLink]);

  // the field keeps the raw text (a pasted or typed profile URL stays readable
  // while editing); the username is extracted from it on submit
  const handleInputChange = (e) => {
    if (error) setError('');
    setInput(e.target.value);
  };

  const buildGlobe = async (username) => {
    setLoading(true);
    setError('');
    setActionStatus('');
    setData(null);
    glRef.current = null;
    try {
      const res = await fetch('/api/snowglobe/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessageFor(res.status, json));
        return;
      }
      setData(json);
      // the address bar becomes the personal link, ready to copy
      if (!isLink) window.history.replaceState(null, '', personalPath(json.username));
      countRef.current?.fetchCount(); // the live broadcast also catches this globe once it is recorded
    } catch {
      setError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // personal link with no saved globe yet: build (and save) it once
  useEffect(() => {
    if (!isLink || savedGlobe || loadFailed || !open || autoBuilt.current) return;
    autoBuilt.current = true;
    buildGlobe(linkUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLink, savedGlobe, loadFailed, open, linkUsername]);

  const loadGlobe = async (e) => {
    e.preventDefault();
    if (loading) return;

    const username = extractUsernameFromUrl(input)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .substring(0, 64);
    const format = validateUsernameFormat(username);
    if (!format.valid) {
      setError(format.message);
      return;
    }

    await buildGlobe(username);
  };

  // High-res PNG of the globe as it is right now (2160×2700, see capture.js)
  const captureImage = () =>
    new Promise((resolve, reject) => {
      const capture = glRef.current?.capture;
      if (!capture) {
        reject(new Error('Globe not ready'));
        return;
      }
      capture((blob) => {
        if (!blob) {
          reject(new Error('Empty capture'));
          return;
        }
        // composite over the page background in case the backdrop hasn't
        // loaded yet, so the PNG never ends up transparent
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#111';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(img.src);
          canvas.toBlob(
            (finalBlob) => (finalBlob ? resolve(finalBlob) : reject(new Error('Encode failed'))),
            'image/png'
          );
        };
        img.onerror = () => reject(new Error('Decode failed'));
        img.src = URL.createObjectURL(blob);
      });
    });

  const imageFileName = () => `snowglobe-${data.username}-${YEAR}.png`;

  const downloadImage = async () => {
    if (busy) return;
    setBusy('image');
    setActionStatus('');
    try {
      downloadBlob(await captureImage(), imageFileName());
      setActionStatus('Image saved ❄️');
    } catch {
      setActionStatus('Image download failed, please try again.');
    } finally {
      setBusy('');
    }
  };

  const openShareSheet = async (file) => {
    try {
      // the image only: with text alongside, some apps (Slack, WhatsApp)
      // keep the text and drop the image. The link is in the watermark.
      await navigator.share({ files: [file] });
      pendingShare.current = null;
      setActionStatus('');
    } catch (err) {
      if (err?.name === 'AbortError') {
        pendingShare.current = null; // the user closed the share sheet
      } else if (err?.name === 'NotAllowedError') {
        // preparing the image took longer than the browser lets a tap count
        // as consent: keep the file so the next tap shares it instantly
        pendingShare.current = file;
        setActionStatus('Your image is ready — tap Share again.');
      } else {
        pendingShare.current = null;
        setActionStatus('Sharing failed, please try again.');
      }
    }
  };

  const shareImage = async () => {
    if (busy) return;
    if (pendingShare.current) {
      await openShareSheet(pendingShare.current);
      return;
    }
    setBusy('share');
    setActionStatus('');
    try {
      const blob = await captureImage();
      await openShareSheet(new File([blob], imageFileName(), { type: 'image/png' }));
    } catch {
      setActionStatus('Sharing failed, please try again.');
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(personalUrl(data.username));
      // the Link part shows "Copied" for a moment instead of a status line
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setActionStatus(personalUrl(data.username));
    }
  };

  const downloadVideo = async () => {
    const canvas = glRef.current?.gl?.domElement;
    if (!canvas || busy) return;
    setBusy('video');
    setActionStatus(`Recording ${RECORD_SECONDS} seconds of snow…`);
    // shake right after the recording starts, so every video catches the
    // flurry and the snow settling, even if nobody touches the globe
    const shakeTimer = setTimeout(() => shake(), 400);
    try {
      const { blob } = await recordGlobeVideo(canvas);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `snowglobe-${data.username}-${YEAR}.${ext}`);
      setActionStatus('Video saved ❄️');
    } catch {
      setActionStatus('Video recording failed, please try again.');
    } finally {
      clearTimeout(shakeTimer);
      setBusy('');
    }
  };

  const snowflake = <FontAwesomeIcon icon={faSnowflake} aria-label='the snowflake button' />;
  const hint =
    motionState === 'on' ? (
      <>Shake your phone, swipe the globe, or tap {snowflake} to make it snow.</>
    ) : isTouch ? (
      <>Swipe the globe sideways or tap {snowflake} to make it snow.</>
    ) : (
      <>Drag the globe sideways, use the ← → keys, or click {snowflake} to make it snow.</>
    );

  // phones share the image through the share sheet (which can also save it);
  // computers download it
  const sharePrimary = shareOk && isTouch;

  return (
    <div className='container snowglobe-page'>
      <div className='snowglobe-header'>
        {isLink ? (
          <h1>
            {linkUsername}&apos;s {YEAR} Trailhead Rewind
          </h1>
        ) : (
          <>
            <h1>Your {YEAR} Trailhead Rewind</h1>
            <p className='snowglobe-tagline'>
              Fill a snow globe with your {YEAR} achievements, shake it, and share it.
            </p>
          </>
        )}
      </div>
      {!isLink && (
        <GenerationCount
          ref={countRef}
          table='rewinds'
          year={YEAR}
          elementId='rewind-countup-element'
          fallbackCount={fallbackCount}
          className='rewind-count'
          before=''
          after={` Rewinds of ${YEAR} already shaken ❄️`}
        />
      )}

      {webglOk === false ? (
        <WebGLHelpPanel onRetry={() => setWebglOk(detectWebGL())} />
      ) : isLink ? null : (
        // same form card as the home page: full-width input, big submit button
        <form className='form' onSubmit={loadGlobe}>
          <div className='input-container'>
            <input
              aria-label='Trailhead username or profile URL'
              className={`input snowglobe-input ${error ? 'input-error' : ''}`}
              value={input}
              onChange={handleInputChange}
              placeholder='Enter Trailhead username or profile URL'
              autoComplete='off'
              autoCapitalize='none'
              spellCheck='false'
              enterKeyHint='go'
              data-lpignore='true'
            />
          </div>
          <button type='submit' className='button submit-button' disabled={loading}>
            {loading ? 'Shoveling snow…' : data ? 'Let it snow again ❄️' : 'Let it snow ❄️'}
          </button>
        </form>
      )}

      {error && <div className='error-message snowglobe-error'>{error}</div>}
      {isLink && !data && !loading && !error && (loadFailed || !open) && (
        <div className='error-message snowglobe-error'>
          {loadFailed ? 'This globe could not be loaded. Please try again later.' : `No ${YEAR} Rewind for this user.`}
        </div>
      )}

      {loading && (
        <div className='loading-container'>
          <p>
            Packing {isLink ? `${linkUsername}'s` : 'your'} {YEAR} into a snow globe…
          </p>
          <div className='loading-icon'></div>
        </div>
      )}

      {data && !loading && webglOk !== false && (
        <section ref={resultRef} className='snowglobe-result'>
          <div className='snowglobe-box'>
            <SnowGlobeScene
              achievements={data.achievements}
              rank={data.rank}
              year={data.year}
              username={data.username}
              // years on Trailhead, counted inclusively (joined this year = 1)
              woodYears={data.firstAchievementYear ? YEAR - data.firstAchievementYear + 1 : 1}
              snowLevel={data.topRank ? 1 : (data.rankProgress ?? 0.45)}
              topRank={data.topRank}
              agentblazerTitle={data.agentblazerTitle}
              isMvp={data.isMvp}
              activity={data.activity}
              stats={data.stats}
              shakeNonce={shakeNonce}
              shakeSway={shakeSway}
              phoneMotion={phoneMotion}
              spinLocked={busy === 'video'}
              onReady={(gl) => {
                glRef.current = gl;
              }}
            />
            {/* on screen only: captures render the 3D scene, not this button */}
            <button
              type='button'
              className='snowglobe-shake-button'
              onClick={() => {
                shake();
                // iOS asks for motion access from a tap: the first tap on the
                // snowflake also turns on shaking with the phone
                if (motionState === 'needs-permission') enableMotion();
              }}
              aria-label='Shake the globe'
            >
              <FontAwesomeIcon icon={faSnowflake} />
            </button>
          </div>
          <p className='snowglobe-hint'>
            {hint}
            {motionState === 'needs-permission' && (
              <>
                {' '}
                <button type='button' className='snowglobe-link-button' onClick={enableMotion}>
                  Shake with your phone 📱
                </button>
              </>
            )}
          </p>
          <div className='snowglobe-segments'>
            {sharePrimary ? (
              <button type='button' onClick={shareImage} disabled={!!busy}>
                <FontAwesomeIcon icon={faShareNodes} />
                {busy === 'share' ? 'Preparing…' : 'Share'}
              </button>
            ) : (
              <button type='button' onClick={downloadImage} disabled={!!busy}>
                <FontAwesomeIcon icon={faDownload} />
                {busy === 'image' ? 'Saving…' : 'Image'}
              </button>
            )}
            {videoOk && (
              <button type='button' onClick={downloadVideo} disabled={!!busy}>
                <FontAwesomeIcon icon={faVideo} />
                {busy === 'video' ? 'Recording…' : 'Video'}
              </button>
            )}
            <button type='button' onClick={copyLink}>
              <FontAwesomeIcon icon={linkCopied ? faCheck : faLink} />
              {linkCopied ? 'Copied' : 'Link'}
            </button>
          </div>
          {actionStatus && (
            <p className='snowglobe-status' role='status'>
              {actionStatus}
            </p>
          )}
          {/* worded for the owner ("your active months"): only on /rewind, a link
              can't tell its owner from a visitor */}
          {!isLink && <GlobeLegend data={data} year={YEAR} />}
        </section>
      )}

      {isLink && !loading && (
        <div className='snowglobe-actions snowglobe-make-own'>
          <a className='button submit-button' href='/rewind'>
            {open ? 'Make your own ❄️' : 'Make your own in December ❄️'}
          </a>
        </div>
      )}
    </div>
  );
}
