'use client';

import { useEffect, useState } from 'react';
import { MEDIA_RECORDER_TYPES, RECORD_SECONDS, FPS, recordWebCodecs, recordMediaRecorder } from './snowglobe/recording';

/**
 * MP4 export spike (roadmap item A): proves — or disproves — client-side MP4
 * capture on the target browsers, iPhone Safari above all. Enabled with
 * /snowglobe?mp4spike=1, not linked anywhere. Exercises the two capture paths
 * from snowglobe/recording.js separately (the product Video button
 * auto-picks), and reports codec support up front. A globe must be loaded.
 */

const styles = {
  panel: {
    maxWidth: 760,
    margin: '30px auto 0',
    padding: '16px 20px',
    border: '1px dashed #888',
    borderRadius: 8,
    textAlign: 'left',
    fontSize: '0.9rem',
  },
  table: { borderCollapse: 'collapse', margin: '8px 0' },
  cell: { padding: '2px 10px 2px 0', fontFamily: 'monospace', fontSize: '0.8rem' },
  video: { width: '100%', maxWidth: 480, display: 'block', margin: '10px 0', background: '#000', borderRadius: 6 },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: 10, margin: '10px 0' },
  ua: { fontFamily: 'monospace', fontSize: '0.7rem', opacity: 0.7, wordBreak: 'break-all' },
};

export default function Mp4Spike({ getCanvas }) {
  const [support, setSupport] = useState(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const report = { 'WebCodecs VideoEncoder': typeof VideoEncoder !== 'undefined' };
    for (const type of MEDIA_RECORDER_TYPES) {
      report[type] =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
          ? MediaRecorder.isTypeSupported(type)
          : false;
    }
    setSupport(report);
  }, []);

  const record = async (useWebCodecs) => {
    setError(null);
    setResult(null);
    const source = getCanvas?.();
    if (!source) {
      setError('Load a globe first — the recording captures the live globe canvas');
      return;
    }
    setRecording(true);
    try {
      const mrType = MEDIA_RECORDER_TYPES.find((t) => support[t]);
      const captured = useWebCodecs ? await recordWebCodecs(source) : await recordMediaRecorder(source, mrType);
      const ext = captured.blob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([captured.blob], `snowglobe-spike-${captured.suffix}.${ext}`, {
        type: captured.blob.type,
      });
      setResult({
        ...captured,
        file,
        url: URL.createObjectURL(captured.blob),
        canShare: !!navigator.canShare?.({ files: [file] }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setRecording(false);
    }
  };

  const download = () => {
    const link = document.createElement('a');
    link.href = result.url;
    link.download = result.file.name;
    link.click();
  };

  const share = async () => {
    try {
      await navigator.share({ files: [result.file] });
    } catch {
      /* user cancelled the share sheet — not an error */
    }
  };

  if (!support) return null;
  const hasWebCodecs = support['WebCodecs VideoEncoder'];
  const hasMediaRecorder = MEDIA_RECORDER_TYPES.some((t) => support[t]);

  return (
    <div style={styles.panel}>
      <h3 style={{ marginTop: 0 }}>🧪 MP4 export spike</h3>
      <table style={styles.table}>
        <tbody>
          {Object.entries(support).map(([name, ok]) => (
            <tr key={name}>
              <td style={styles.cell}>{name}</td>
              <td style={styles.cell}>{ok ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: '8px 0' }}>
        Records {RECORD_SECONDS}s of the live globe at {FPS}fps.
      </p>
      <div style={styles.buttons}>
        <button className='button' onClick={() => record(true)} disabled={recording || !hasWebCodecs}>
          {recording ? 'Recording… 🔴' : 'Record (WebCodecs) 🎬'}
        </button>
        <button className='button' onClick={() => record(false)} disabled={recording || !hasMediaRecorder}>
          Record (MediaRecorder) 📼
        </button>
        {result && (
          <button className='button' onClick={download}>
            Download ⬇️
          </button>
        )}
        {result?.canShare && (
          <button className='button' onClick={share}>
            Share 📤
          </button>
        )}
      </div>
      {error && <p style={{ color: '#e05555' }}>❌ {error}</p>}
      {result && (
        <>
          <p style={{ margin: '4px 0' }}>
            ✅ {(result.blob.size / 1024).toFixed(0)} KB — {result.detail}. If it plays below, the pipeline works:
          </p>
          <video src={result.url} controls playsInline muted style={styles.video} />
        </>
      )}
      <p style={styles.ua}>{typeof navigator !== 'undefined' ? navigator.userAgent : ''}</p>
    </div>
  );
}
