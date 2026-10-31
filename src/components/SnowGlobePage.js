'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Mp4Spike from './Mp4Spike';
import { videoSupport, recordGlobeVideo, RECORD_SECONDS } from './snowglobe/recording';
import { extractUsernameFromUrl, validateUsernameFormat } from '../utils/usernameValidation';

const SnowGlobeScene = dynamic(() => import('./SnowGlobeScene'), {
  ssr: false,
  loading: () => <div className='snowglobe-placeholder'>Building your globe…</div>,
});

const YEAR = 2026;

function detectWebGL() {
  // ?nowebgl=1 forces the unsupported panel, for testing it on capable browsers
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false;
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
      return 'Trailhead profile not found. Check the username, and that the profile is public.';
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

export default function SnowGlobePage() {
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [shakeNonce, setShakeNonce] = useState(0);
  const [webglOk, setWebglOk] = useState(null); // null = not checked yet (SSR-safe)
  const [spikeMode, setSpikeMode] = useState(false); // ?mp4spike=1 — MediaRecorder MP4 test rig
  const [videoOk, setVideoOk] = useState(false); // WebCodecs or MediaRecorder available
  const [busy, setBusy] = useState(''); // '' | 'image' | 'video'
  const glRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    setWebglOk(detectWebGL());
    setSpikeMode(new URLSearchParams(window.location.search).has('mp4spike'));
    setVideoOk(videoSupport().supported);
  }, []);

  // bring the fresh globe into view: on most screens it starts below the form
  useEffect(() => {
    if (data) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data]);

  // the field keeps the raw text (a pasted or typed profile URL stays readable
  // while editing); the username is extracted from it on submit
  const handleInputChange = (e) => {
    if (error) setError('');
    setInput(e.target.value);
  };

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
    } catch {
      setError('Unable to reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    const capture = glRef.current?.capture;
    if (!capture || busy) return;
    setBusy('image');
    setActionStatus('');
    try {
      capture((blob) => {
        if (!blob) {
          setActionStatus('Image download failed, please try again.');
          setBusy('');
          return;
        }
        // composite the transparent render over the page background so the
        // PNG looks like what's on screen instead of floating on black
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
          canvas.toBlob((finalBlob) => {
            downloadBlob(finalBlob, `snowglobe-${data.username}-${YEAR}.png`);
            setActionStatus('Image saved — ready to share!');
            setBusy('');
          }, 'image/png');
        };
        img.src = URL.createObjectURL(blob);
      });
    } catch {
      setActionStatus('Image download failed, please try again.');
      setBusy('');
    }
  };

  const downloadVideo = async () => {
    const canvas = glRef.current?.gl?.domElement;
    if (!canvas || busy) return;
    setBusy('video');
    setActionStatus(`Recording ${RECORD_SECONDS} seconds — shake the globe while it films!`);
    try {
      const { blob } = await recordGlobeVideo(canvas);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadBlob(blob, `snowglobe-${data.username}-${YEAR}.${ext}`);
      setActionStatus('Video saved — ready to share!');
    } catch {
      setActionStatus('Video recording failed, please try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className='page-container snowglobe-page'>
      <h1>Your {YEAR} Trailhead Snow Globe</h1>
      <p className='snowglobe-tagline'>
        Fill a snow globe with the certifications and stamps you earned in {YEAR}, shake it, and share it.
      </p>

      {webglOk === false ? (
        <WebGLHelpPanel onRetry={() => setWebglOk(detectWebGL())} />
      ) : (
        <form className='snowglobe-form' onSubmit={loadGlobe}>
          <input
            aria-label='Trailhead username or profile URL'
            className={`input snowglobe-input ${error ? 'input-error' : ''}`}
            value={input}
            onChange={handleInputChange}
            placeholder='Trailhead username or profile URL'
            autoComplete='off'
            autoCapitalize='none'
            spellCheck='false'
            enterKeyHint='go'
            data-lpignore='true'
          />
          <button type='submit' className='button snowglobe-submit' disabled={loading}>
            {loading ? 'Loading…' : data ? 'Update globe' : 'Create my globe'}
          </button>
        </form>
      )}

      {error && <div className='error-message snowglobe-error'>{error}</div>}

      {loading && (
        <div className='loading-container'>
          <p>Collecting your {YEAR} achievements…</p>
          <div className='loading-icon'></div>
        </div>
      )}

      {data && !loading && (
        <section ref={resultRef} className='snowglobe-result'>
          <div className='snowglobe-box'>
            <SnowGlobeScene
              achievements={data.achievements}
              rank={data.rank}
              year={data.year}
              username={data.username}
              // years on Trailhead, counted inclusively (joined this year = 1)
              woodYears={data.firstAchievementYear ? YEAR - data.firstAchievementYear + 1 : 1}
              shakeNonce={shakeNonce}
              onReady={(gl) => {
                glRef.current = gl;
              }}
            />
          </div>
          <p className='snowglobe-hint'>Drag the globe sideways or press Shake to make it snow.</p>
          <div className='snowglobe-actions'>
            <button type='button' className='button' onClick={() => setShakeNonce((n) => n + 1)}>
              Shake ❄️
            </button>
            <button type='button' className='button' onClick={downloadImage} disabled={!!busy}>
              {busy === 'image' ? 'Saving…' : 'Download image'}
            </button>
            {videoOk && (
              <button type='button' className='button' onClick={downloadVideo} disabled={!!busy}>
                {busy === 'video' ? 'Recording… 🔴' : 'Download video'}
              </button>
            )}
          </div>
          {actionStatus && (
            <p className='snowglobe-status' role='status'>
              {actionStatus}
            </p>
          )}
        </section>
      )}

      {spikeMode && <Mp4Spike getCanvas={() => glRef.current?.gl?.domElement} />}
    </div>
  );
}
