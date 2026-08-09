import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Download, Eraser, SwitchCamera, Trash2 } from 'lucide-react';

const COLORS = ['#facc15', '#f87171', '#4ade80', '#60a5fa', '#f9fafb'];
const BRUSHES = { S: 4, M: 8, L: 16 };
// Landmark indices: tips and the joint below them (pip) per finger.
const FINGERS = {
  index: { tip: 8, pip: 6 },
  middle: { tip: 12, pip: 10 },
  ring: { tip: 16, pip: 14 },
  pinky: { tip: 20, pip: 18 },
};
// EMA weight for the fingertip position - smooths hand-tracking jitter
// without adding noticeable lag.
const SMOOTHING = 0.55;

const AirCanvas = () => {
  const videoRef = useRef();
  const drawRef = useRef(); // persistent strokes
  const overlayRef = useRef(); // fingertip cursor, cleared every frame
  const streamRef = useRef();
  const landmarkerRef = useRef();
  const rafRef = useRef();
  const penRef = useRef({ prev: null, smooth: null });
  // Tool state lives in a ref too: the rAF loop closes over the first
  // render otherwise.
  const toolRef = useRef({ color: COLORS[0], size: BRUSHES.M, eraser: false });

  const [status, setStatus] = useState('loading'); // loading | ready | no-camera | error
  const [facingMode, setFacingMode] = useState('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState('M');
  const [eraser, setEraser] = useState(false);
  const [mode, setMode] = useState('idle'); // idle | draw | hover

  toolRef.current = { color, size: BRUSHES[brush], eraser };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks('wasm');
        const landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'models/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStatus((s) => (s === 'loading' ? 'ready' : s));
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: facingMode } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        navigator.mediaDevices.enumerateDevices()
          .then((devices) => {
            if (!cancelled) {
              setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
            }
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setStatus('no-camera');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  useEffect(() => {
    if (status !== 'ready') return;
    const draw = drawRef.current;
    const overlay = overlayRef.current;
    const dctx = draw.getContext('2d');
    const octx = overlay.getContext('2d');
    let lastVideoTime = -1;

    const fingerUp = (lm, f) => lm[f.tip].y < lm[f.pip].y;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) return;
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      if (draw.width !== video.videoWidth || draw.height !== video.videoHeight) {
        // Preserve strokes across the resize that fires when the camera
        // resolution settles.
        const keep = document.createElement('canvas');
        keep.width = draw.width;
        keep.height = draw.height;
        keep.getContext('2d').drawImage(draw, 0, 0);
        draw.width = video.videoWidth;
        draw.height = video.videoHeight;
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        if (keep.width > 0) dctx.drawImage(keep, 0, 0, draw.width, draw.height);
      }

      const result = landmarker.detectForVideo(video, performance.now());
      octx.clearRect(0, 0, overlay.width, overlay.height);

      const lm = result.landmarks[0];
      const pen = penRef.current;
      if (!lm) {
        pen.prev = null;
        pen.smooth = null;
        setMode('idle');
        return;
      }

      const indexUp = fingerUp(lm, FINGERS.index);
      const middleUp = fingerUp(lm, FINGERS.middle);
      const drawing = indexUp && !middleUp;
      const hovering = indexUp && middleUp;

      const raw = { x: lm[FINGERS.index.tip].x * draw.width, y: lm[FINGERS.index.tip].y * draw.height };
      pen.smooth = pen.smooth
        ? {
            x: pen.smooth.x * SMOOTHING + raw.x * (1 - SMOOTHING),
            y: pen.smooth.y * SMOOTHING + raw.y * (1 - SMOOTHING),
          }
        : raw;
      const pt = pen.smooth;
      const { color: c, size, eraser: erasing } = toolRef.current;

      if (drawing && pen.prev) {
        dctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
        dctx.strokeStyle = c;
        dctx.lineWidth = erasing ? size * 4 : size;
        dctx.lineCap = 'round';
        dctx.lineJoin = 'round';
        dctx.beginPath();
        dctx.moveTo(pen.prev.x, pen.prev.y);
        dctx.lineTo(pt.x, pt.y);
        dctx.stroke();
      }
      pen.prev = drawing ? { ...pt } : null;
      setMode(drawing ? 'draw' : hovering ? 'hover' : 'idle');

      // Cursor: filled dot while drawing, ring while hovering.
      octx.beginPath();
      octx.arc(pt.x, pt.y, erasing ? size * 2 : Math.max(size, 6), 0, Math.PI * 2);
      if (drawing) {
        octx.fillStyle = erasing ? 'rgba(255,255,255,0.6)' : c;
        octx.fill();
      } else {
        octx.strokeStyle = erasing ? 'rgba(255,255,255,0.6)' : c;
        octx.lineWidth = 2;
        octx.stroke();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status]);

  const clearCanvas = () => {
    const draw = drawRef.current;
    draw.getContext('2d').clearRect(0, 0, draw.width, draw.height);
  };

  const savePng = () => {
    const draw = drawRef.current;
    const out = document.createElement('canvas');
    out.width = draw.width;
    out.height = draw.height;
    const ctx = out.getContext('2d');
    // Fixed dark ground for the export regardless of the UI theme: the
    // brush palette is bright and only reads against a dark backdrop.
    ctx.fillStyle = '#16171d';
    ctx.fillRect(0, 0, out.width, out.height);
    // The preview is mirrored for the front camera; flip the export the same
    // way so saved drawings read the way the artist saw them.
    if (facingMode === 'user') {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(draw, 0, 0);
    const link = document.createElement('a');
    link.download = 'air-canvas.png';
    link.href = out.toDataURL('image/png');
    link.click();
  };

  if (status === 'error') {
    return (
      <div className="text-center p-8 rounded-2xl bg-surface border border-line">
        Could not load the hand-tracking model. Check your connection and refresh.
      </div>
    );
  }
  if (status === 'no-camera') {
    return (
      <div className="text-center p-8 rounded-2xl bg-surface border border-line">
        Camera unavailable or permission denied. Air Canvas needs a camera -
        allow access and refresh the page.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Toolbar.
       *
       * Eleven controls in one wrapped row collapsed into an unreadable block
       * on a phone, so they are grouped instead: the groups stack vertically
       * below sm and sit on one row above it. Each group is a labelled
       * role="group" so a screen reader announces what the buttons belong to.
       *
       * Every control has a >=44px hit area (the guideline touch minimum) even
       * where the visible swatch is smaller - the button is the target, the
       * inner span is only the paint. */}
      <div className="w-full max-w-2xl mb-3 p-3 rounded-2xl bg-surface border border-line flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
        <div role="group" aria-label="Colour" className="flex items-center justify-center gap-1">
          {COLORS.map((c) => {
            const isWhiteDot = c.toLowerCase() === '#f9fafb';
            const selected = color === c && !eraser;
            return (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={selected}
                onClick={() => {
                  setColor(c);
                  setEraser(false);
                }}
                className="grid place-items-center w-11 h-11 shrink-0 rounded-full cursor-pointer"
              >
                <span
                  className={`block w-7 h-7 rounded-full border-2 transition-transform motion-reduce:transition-none ${
                    selected
                      ? 'border-gray-900 dark:border-white scale-110'
                      : isWhiteDot
                        ? 'border-gray-300 dark:border-transparent'
                        : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={eraser}
            onClick={() => setEraser((e) => !e)}
            className={`inline-flex items-center gap-1.5 px-3 h-11 rounded-full font-mono text-sm cursor-pointer transition-colors motion-reduce:transition-none ${
              eraser
                ? 'bg-bg text-gray-900 dark:text-gray-50 border border-line'
                : 'bg-muted hover:bg-muted-hover'
            }`}
          >
            <Eraser size={16} aria-hidden />
            Eraser
          </button>
        </div>


        <div role="group" aria-label="Brush size" className="flex items-center justify-center gap-1 sm:border-l sm:border-rule sm:pl-2">
          {Object.keys(BRUSHES).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={brush === b}
              aria-label={`Brush size ${b}`}
              onClick={() => setBrush(b)}
              className={`w-11 h-11 shrink-0 rounded-full font-mono text-sm font-bold cursor-pointer transition-colors motion-reduce:transition-none ${
                brush === b
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'bg-muted hover:bg-muted-hover'
              }`}
            >
              {b}
            </button>
          ))}
        </div>


        <div className="flex items-center justify-center gap-2 sm:border-l sm:border-rule sm:pl-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center gap-1.5 px-3 h-11 rounded-full font-mono text-sm bg-muted hover:bg-muted-hover cursor-pointer transition-colors motion-reduce:transition-none"
          >
            <Trash2 size={16} aria-hidden />
            Clear
          </button>
          <button
            type="button"
            onClick={savePng}
            className="inline-flex items-center gap-1.5 px-3 h-11 rounded-full font-mono text-sm font-bold text-accent bg-accent/15 border border-accent/40 hover:bg-accent/25 cursor-pointer transition-colors motion-reduce:transition-none"
          >
            <Download size={16} aria-hidden />
            Save PNG
          </button>
        </div>
      </div>

      {/* Mirrored container so strokes track your hand like a mirror;
          the PNG export un-flips so the result reads correctly. */}
      <div className={`relative w-full max-w-2xl rounded-2xl bg-canvas ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="rounded-2xl w-full block aspect-[4/3] object-cover opacity-80"
        />
        <canvas ref={drawRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-gray-100 font-mono text-sm scale-x-[-1]">
            Loading hand-tracking model&hellip;
          </div>
        )}
        {hasMultipleCameras && (
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            className="absolute bottom-3 right-3 grid place-items-center w-11 h-11 rounded-full bg-black/50 text-white backdrop-blur-sm cursor-pointer"
            aria-label="Switch camera"
            title="Switch camera"
          >
            <SwitchCamera size={20} aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-4 font-mono text-sm opacity-70 text-center">
        {mode === 'draw' && '✏️ drawing - index finger'}
        {mode === 'hover' && '✌️ pen up - two fingers'}
        {mode === 'idle' && '👋 raise your index finger to draw'}
      </div>
    </div>
  );
};

export default AirCanvas;
