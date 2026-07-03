'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Mp4Spike from './Mp4Spike';
import { videoSupport, recordGlobeVideo, RECORD_SECONDS } from './snowglobe/recording';

const SnowGlobeScene = dynamic(() => import('./SnowGlobeScene'), {
  ssr: false,
  loading: () => <div style={{ textAlign: 'center', paddingTop: '2rem' }}>Loading globe…</div>,
});

const CURRENT_YEAR = 2026;

const layout = {
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    justifyContent: 'center',
    alignItems: 'stretch',
    marginBottom: '20px',
  },
  globeBox: {
    // 4:5 portrait — LinkedIn's recommended vertical format for feed
    // images (1080×1350) and the rewind image's own 2160×2700 ratio
    // match the natural width of the controls row above (input + year + buttons)
    width: '100%',
    maxWidth: 720,
    aspectRatio: '4 / 5',
    margin: '0 auto',
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

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
    <div style={{ ...layout.placeholder, flexDirection: 'column', gap: '0.75rem', padding: '2rem' }}>
      <div style={{ fontSize: '2.5rem' }}>🔮❌</div>
      <h3>Your browser can&apos;t display 3D right now</h3>
      <p style={{ margin: 0, maxWidth: 460 }}>
        The snow globe needs WebGL, which is disabled — usually because hardware acceleration is turned off in your
        browser settings. Pages can&apos;t change browser settings, but it&apos;s a quick fix:
      </p>
      <ol style={{ margin: 0, textAlign: 'left', lineHeight: 1.8 }}>
        <li>
          Open <code>chrome://settings/system</code>{' '}
          <button className='button' style={{ padding: '2px 10px', fontSize: '0.85rem' }} onClick={copyAddress}>
            {copied ? 'Copied ✅' : 'Copy address'}
          </button>{' '}
          and paste it in a new tab
        </li>
        <li>
          Enable <em>&ldquo;Use graphics acceleration when available&rdquo;</em>
        </li>
        <li>Relaunch the browser and come back</li>
      </ol>
      <button className='button' onClick={onRetry}>
        Check again 🔄
      </button>
    </div>
  );
}

export default function SnowGlobePage() {
  const [username, setUsername] = useState('nabondance');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Enter a Trailhead username and load your globe.');
  const [shakeNonce, setShakeNonce] = useState(0);
  const [webglOk, setWebglOk] = useState(null); // null = not checked yet (SSR-safe)
  const [spikeMode, setSpikeMode] = useState(false); // ?mp4spike=1 — MediaRecorder MP4 test rig
  const [videoOk, setVideoOk] = useState(false); // WebCodecs or MediaRecorder available
  const [recordingVideo, setRecordingVideo] = useState(false);
  const glRef = useRef(null);

  useEffect(() => {
    setWebglOk(detectWebGL());
    setSpikeMode(new URLSearchParams(window.location.search).has('mp4spike'));
    setVideoOk(videoSupport().supported);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setStatus('Fetching Trailhead data…');
    try {
      const res = await fetch('/api/snowglobe/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), year }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error || 'Failed to load data');
        setData(null);
        return;
      }
      setData(json);
      setStatus(
        `${json.totals.certifications} certification${json.totals.certifications === 1 ? '' : 's'} and ${json.totals.stamps} stamp${json.totals.stamps === 1 ? '' : 's'} in ${json.year} — shake it!`
      );
    } catch {
      setStatus('Network error while loading data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = () => {
    const capture = glRef.current?.capture;
    if (!capture) return;
    try {
      capture((blob) => {
        if (!blob) {
          setStatus('Snapshot failed: empty canvas');
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
            const link = document.createElement('a');
            link.href = URL.createObjectURL(finalBlob);
            link.download = `snowglobe-${username.trim()}-${year}.png`;
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('Snapshot saved — canvas is clean ✅');
          }, 'image/png');
        };
        img.src = URL.createObjectURL(blob);
      });
    } catch (error) {
      // SecurityError here means a texture tainted the canvas — the spike failed
      setStatus(`Snapshot failed: ${error.message}`);
    }
  };

  const takeVideo = async () => {
    const canvas = glRef.current?.gl?.domElement;
    if (!canvas || recordingVideo) return;
    setRecordingVideo(true);
    setStatus(`Recording ${RECORD_SECONDS}s — shake it while it films! 🎬`);
    try {
      const { blob } = await recordGlobeVideo(canvas);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `snowglobe-${username.trim()}-${year}.${ext}`;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus('Video saved 🎬');
    } catch (error) {
      setStatus(`Video failed: ${error.message}`);
    } finally {
      setRecordingVideo(false);
    }
  };

  return (
    <div className='page-container'>
      <h1>Trailhead Rewind {year} — Snow Globe</h1>
      <h2>{status}</h2>
      <div style={layout.controls}>
        <input
          className='input'
          style={{ flex: '0 1 220px' }}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && loadData()}
          placeholder='Trailhead username'
        />
        <select
          className='input'
          style={{ flex: '0 1 110px' }}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button className='button' onClick={loadData} disabled={loading || !username.trim() || webglOk === false}>
          {loading ? 'Loading…' : 'Load'}
        </button>
        <button className='button' onClick={() => setShakeNonce((n) => n + 1)} disabled={!data}>
          Shake ❄️
        </button>
      </div>
      <div style={layout.globeBox}>
        {webglOk === false ? (
          <WebGLHelpPanel onRetry={() => setWebglOk(detectWebGL())} />
        ) : data ? (
          <SnowGlobeScene
            achievements={data.achievements}
            rank={data.rank}
            year={data.year}
            username={data.username}
            shakeNonce={shakeNonce}
            onReady={(gl) => {
              glRef.current = gl;
            }}
          />
        ) : (
          <div style={layout.placeholder}>Your globe will appear here</div>
        )}
      </div>
      {/* share artifacts live under the globe they capture */}
      <div style={{ ...layout.controls, marginTop: 14, marginBottom: 0 }}>
        <button className='button' onClick={takeSnapshot} disabled={!data}>
          Snapshot 📸
        </button>
        {videoOk && (
          <button className='button' onClick={takeVideo} disabled={!data || recordingVideo}>
            {recordingVideo ? 'Recording… 🔴' : 'Video 🎬'}
          </button>
        )}
      </div>
      {spikeMode && <Mp4Spike getCanvas={() => glRef.current?.gl?.domElement} />}
    </div>
  );
}
