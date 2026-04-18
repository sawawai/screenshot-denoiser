'use strict';

// ─── state ───────────────────────────────────────────────────────────────────
const S = {
  inputImg: null, denoisedImg: null,
  zoom: 1, minZoom: 1,
  zoomPanX: 0, zoomPanY: 0,
  panning: false, pointerDown: false,
  panStartX: 0, panStartY: 0,
  panStartPanX: 0, panStartPanY: 0,
  comparing: false,
  cursorInViewer: false,
  lastCursorX: null,
  showingBefore: false,
  tapStartTime: 0,
  saveName: 'denoised.png',
};

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const isMobile = window.matchMedia('(pointer: coarse)').matches;
const canvasArea   = $('canvas-area');
const viewer       = $('viewer');
const vdivider     = $('vdivider');
const cvBefore     = $('cv-before');
const cvAfter      = $('cv-after');
const dropIdle     = $('drop-idle');
const botBar       = $('bot-bar');
const mobTapHint   = $('mob-tap-hint');
const viewLabel    = $('view-label');
const progBar      = $('prog-bar');
const errorMsg     = $('error-msg');
const btnSave      = $('btn-save');
const btnNew       = $('btn-new');
const mobSave      = $('mob-save');
const mobNew       = $('mob-new');
const controlsHint = $('controls-hint');
const tDropDesc    = $('t-drop-desc');
const tDropLabel   = $('t-drop-label');
const tDropSub     = $('t-drop-sub');
const fileInput    = $('file-input');
const notice       = $('notice');

let _viewerRect = null;
function getViewerRect() {
  if (!_viewerRect) _viewerRect = viewer.getBoundingClientRect();
  return _viewerRect;
}
function invalidateViewerRect() { _viewerRect = null; }

let _cvAfterRect = null;
function getCvAfterRect() {
  if (!_cvAfterRect) _cvAfterRect = cvAfter.getBoundingClientRect();
  return _cvAfterRect;
}
function invalidateCvAfterRect() { _cvAfterRect = null; }

// ─── i18n ────────────────────────────────────────────────────────────────────
const TX = {
  ja: {
    'title':           'スクショ補正',
    'drop-label':      'ここに画像をドロップ',
    'drop-sub':        'クリックしてファイルを選択 &nbsp;·&nbsp; <kbd>Ctrl+V</kbd> でペースト<br>PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP',
    'btn-save':        '保存',
    'btn-new':         '新規',
    'label-before':    '処理前',
    'label-after':     '処理後',
    'hint-reveal':     '処理前後を比較',
    'hint-original':   '元画像を表示',
    'hint-zoom':       'ズームイン / アウト',
    'hint-reset':      '等倍にリセット',
    'hint-save':       '処理結果を保存',
    'hint-new':        '新しい画像',
    'hint-key-hover':  'ホバー',
    'hint-key-hold':   '<kbd>Space</kbd>',
    'hint-key-scroll': 'スクロール',
    'hint-key-dbl':       'ダブルクリック',
    'drop-label-mobile':   'タップして画像を選択',
    'drop-sub-mobile':     'PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP',
    'drop-desc':           'スクリーンショットから動画圧縮ノイズを除去します<br>すべてブラウザ内で完結します',
    'mob-tap-hint':        'タップして処理前後を比較',
    'drop-label-loading':  '読み込み中…',
  },
  en: {
    'title':           'Screenshot Denoiser',
    'drop-label':      'Drop image here',
    'drop-sub':        'Click to browse &nbsp;·&nbsp; <kbd>Ctrl+V</kbd> to paste<br>PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP',
    'btn-save':        'Save',
    'btn-new':         'New',
    'label-before':    'Before',
    'label-after':     'After',
    'hint-reveal':     'Reveal before / after',
    'hint-original':   'Show original',
    'hint-zoom':       'Zoom in / out',
    'hint-reset':      'Reset to 1:1',
    'hint-save':       'Save result',
    'hint-new':        'New image',
    'hint-key-hover':  'Hover',
    'hint-key-hold':   '<kbd>Space</kbd>',
    'hint-key-scroll': 'Scroll',
    'hint-key-dbl':       'Double-click',
    'drop-label-mobile':   'Tap to choose an image',
    'drop-sub-mobile':     'PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP',
    'drop-desc':           'Removes video compression artifacts from screenshots.<br>Runs entirely in the browser.',
    'mob-tap-hint':        'Tap to compare',
    'drop-label-loading':  'Initializing…',
  },
};

let lang = 'ja';
function t(k) { return TX[lang][k] ?? k; }

const tMap = {
  't-title':      'title',
  't-drop-label': 'drop-label',
  't-drop-sub':   'drop-sub',
  't-btn-save':   'btn-save',
  't-btn-new':    'btn-new',
  't-label-before':  'label-before',
  't-label-after':   'label-after',
  't-hint-reveal':   'hint-reveal',
  't-hint-original': 'hint-original',
  't-hint-zoom':     'hint-zoom',
  't-hint-reset':    'hint-reset',
  't-hint-save':     'hint-save',
  't-hint-new':      'hint-new',
  't-hint-key-hover':  'hint-key-hover',
  't-hint-key-hold':   'hint-key-hold',
  't-hint-key-scroll': 'hint-key-scroll',
  't-hint-key-dbl':    'hint-key-dbl',
  't-mob-save':     'btn-save',
  't-mob-new':      'btn-new',
  't-drop-desc':    'drop-desc',
  'mob-tap-hint':   'mob-tap-hint',
};

function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const [id, key] of Object.entries(tMap)) {
    const el = $(id);
    if (el) el.innerHTML = t(key);
  }
  document.querySelectorAll('.lang-switch button').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && lang === 'ja') || (i === 1 && lang === 'en'));
  });
  if (isMobile) {
    tDropLabel.innerHTML = t('drop-label-mobile');
    tDropSub.innerHTML   = t('drop-sub-mobile');
    updateViewLabel();
  }
  if (dropIdle.classList.contains('model-loading'))
    tDropLabel.textContent = t('drop-label-loading');
}

function setLang(l) {
  lang = l;
  setCookie('lang', l, 365);
  applyLang();
}

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 864e5);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function getCookie(name) {
  const v = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return v ? v.split('=')[1] : null;
}

let _loadGen = 0;

// ─── ONNX Runtime ────────────────────────────────────────────────────────────
let ortSession = null;
let ortReady = false;
let _ortLoadResolve, _ortLoadReject;
const _ortLoadPromise = new Promise((res, rej) => { _ortLoadResolve = res; _ortLoadReject = rej; });

async function loadModel() {
  // WASM binary fetches must share the CDN origin used by the JS bundle.
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  // ORT silently drops to 1 thread when SharedArrayBuffer is unavailable
  // (server missing COOP/COEP headers), so this is a best-effort hint.
  ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
  ort.env.wasm.proxy = true;

  const modelPath = './models/s2d_1x.onnx';
  const baseOpts = {
    graphOptimizationLevel: 'all',
    executionMode: 'parallel',
    enableCpuMemArena: true,
    enableMemPattern: true,
  };

  const ua = navigator.userAgent;
  // Safari includes "Safari" but not "Chrome"; covers both macOS and iOS.
  const isSafari  = ua.includes('Safari') && !ua.includes('Chrome');
  // Android Chrome: NNAPI (WebNN) is unreliable across devices and GPU overhead
  // for a model this small doesn't pay off on shared mobile memory bandwidth.
  const useGPU    = !isMobile;

  if (useGPU || isSafari) {
    // 1. WebNN GPU – native OS ML API (DirectML on Windows, Core ML on Apple).
    //    Lowest overhead for small models; Core ML is especially fast on Apple silicon.
    if ('ml' in navigator) {
      try {
        ortSession = await ort.InferenceSession.create(modelPath, {
          ...baseOpts,
          executionProviders: [{ name: 'webnn', deviceType: 'gpu', powerPreference: 'default' }],
        });
        return;
      } catch(e) { console.warn('[ORT] WebNN GPU unavailable:', e.message); }

      // 2. WebNN CPU – native OS ML API on CPU.
      try {
        ortSession = await ort.InferenceSession.create(modelPath, {
          ...baseOpts,
          executionProviders: [{ name: 'webnn', deviceType: 'cpu', powerPreference: 'default' }],
        });
        return;
      } catch(e) { console.warn('[ORT] WebNN CPU unavailable:', e.message); }
    }

    // 3. WebGPU – Metal on Safari, Dawn on Chromium, available on Firefox too.
    if ('gpu' in navigator) {
      try {
        ortSession = await ort.InferenceSession.create(modelPath, {
          ...baseOpts,
          executionProviders: ['webgpu'],
        });
        return;
      } catch(e) { console.warn('[ORT] WebGPU unavailable:', e.message); }
    }
  }

  // 4. WASM – SIMD + threads when available.
  //    Primary path on mobile; final fallback elsewhere.
  try {
    ortSession = await ort.InferenceSession.create(modelPath, {
      ...baseOpts,
      executionProviders: ['wasm'],
    });
    return;
  } catch(e) { console.warn('[ORT] WASM unavailable:', e.message); }

  throw new Error('No supported execution provider found (tried WebNN, WebGPU, WASM).');
}

// Returns the grid of tile start positions along one axis.
function tileStarts(length, tileSize) {
  const starts = [];
  for (let s = 0; s < length; s += tileSize) starts.push(s);
  return starts;
}

// Feather weight for one axis: ramps 0→1 over `ovl` pixels at interior seams,
// stays 1 at image borders (no adjacent tile to blend with).
function featherW(d, isEdge, ovl) {
  return isEdge ? 1.0 : Math.min(d / ovl, 1.0);
}

async function runDenoiser(pixels, w, h) {
  if (!ortReady) throw new Error(t('model-not-ready'));

  const TILE = 512; // canonical tile size (non-overlapping step)
  const OVL  = 64;  // overlap added on each side for context

  const inputName  = ortSession.inputNames[0];
  const outputName = ortSession.outputNames[0];

  // Weighted accumulators for seamless blending across tile boundaries.
  const accumY = new Float32Array(w * h);
  const accumW = new Float32Array(w * h);

  const xs = tileStarts(w, TILE);
  const ys = tileStarts(h, TILE);
  const total = xs.length * ys.length;
  let done = 0;

  for (const ty of ys) {
    for (const tx of xs) {
      // Expand each tile by OVL on every side (clamped to image bounds) so the
      // model sees context beyond the canonical region; avoids border artifacts.
      const x0 = Math.max(0, tx - OVL);
      const y0 = Math.max(0, ty - OVL);
      const x1 = Math.min(w, tx + TILE + OVL);
      const y1 = Math.min(h, ty + TILE + OVL);
      const tw = x1 - x0;
      const th = y1 - y0;

      // Model requires even spatial dimensions; pad by edge-extension if needed.
      const pw = tw + (tw & 1);
      const ph = th + (th & 1);

      const luma = new Float32Array(pw * ph);
      // Main tw×th block — x0+x < x1 ≤ w and y0+y < y1 ≤ h, so no clamping needed.
      for (let y = 0; y < th; y++) {
        const srcBase = (y0 + y) * w + x0;
        const lumaBase = y * pw;
        for (let x = 0; x < tw; x++) {
          const p = (srcBase + x) * 4;
          luma[lumaBase + x] =
            (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
        }
      }
      // Padding column (tw odd): edge-extend at clamped x.
      if (pw > tw) {
        const padX = Math.min(x1, w - 1);
        for (let y = 0; y < th; y++) {
          const p = ((y0 + y) * w + padX) * 4;
          luma[y * pw + tw] =
            (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
        }
      }
      // Padding row (th odd): edge-extend at clamped y.
      if (ph > th) {
        const padY = Math.min(y1, h - 1);
        const srcBase = padY * w;
        for (let x = 0; x < tw; x++) {
          const p = (srcBase + x0 + x) * 4;
          luma[th * pw + x] =
            (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
        }
        if (pw > tw) {
          const padX = Math.min(x1, w - 1);
          const p = (srcBase + padX) * 4;
          luma[th * pw + tw] =
            (0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2]) / 255;
        }
      }

      const feeds = { [inputName]: new ort.Tensor('float32', luma, [1, 1, ph, pw]) };
      const results = await ortSession.run(feeds);
      const outData = results[outputName].data;

      // Accumulate denoised luma with feather weights. Pixels near interior seams
      // get lower weight so adjacent tiles blend smoothly; image-border pixels
      // keep full weight since no neighbour tile exists on that side.
      const atLeft  = x0 === 0;
      const atRight = x1 === w;
      const atTop   = y0 === 0;
      const atBot   = y1 === h;

      const wx = new Float32Array(tw);
      for (let x = 0; x < tw; x++)
        wx[x] = featherW(x, atLeft, OVL) * featherW(tw - 1 - x, atRight, OVL);
      const wyArr = new Float32Array(th);
      for (let y = 0; y < th; y++)
        wyArr[y] = featherW(y, atTop, OVL) * featherW(th - 1 - y, atBot, OVL);

      for (let y = 0; y < th; y++) {
        const wy = wyArr[y];
        const row = (y0 + y) * w;
        for (let x = 0; x < tw; x++) {
          const wi = wy * wx[x];
          accumY[row + x0 + x] += wi * outData[y * pw + x];
          accumW[row + x0 + x] += wi;
        }
      }

      setProgress(Math.round(++done / total * 99));
      await tick();
    }
  }

  // Reconstruct RGB: replace luma with blended denoised value, keep original chroma.
  const outPixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const yn255 = (accumY[i] / accumW[i]) * 255;
    const di = i * 4;
    const R = pixels[di], G = pixels[di + 1], B = pixels[di + 2];
    const yo = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const cb = (B - yo) / 1.8556;
    const cr = (R - yo) / 1.5748;
    outPixels[di]     = Math.round(Math.max(0, Math.min(255, yn255 + 1.5748 * cr)));
    outPixels[di + 1] = Math.round(Math.max(0, Math.min(255, yn255 - 0.46812427 * cr - 0.18732427 * cb)));
    outPixels[di + 2] = Math.round(Math.max(0, Math.min(255, yn255 + 1.8556 * cb)));
    outPixels[di + 3] = 255;
  }

  return new ImageData(outPixels, w, h);
}

// ─── zoom ─────────────────────────────────────────────────────────────────────
const FIT_MARGIN = 32; // px per side

function computeMinZoom() {
  const vr = getViewerRect();
  const fitScale = Math.min(
    (vr.width  - FIT_MARGIN * 2) / S.inputImg.width,
    (vr.height - FIT_MARGIN * 2) / S.inputImg.height
  );
  S.minZoom = Math.min(fitScale, 1.0);
}

function updateZoomClass() {
  viewer.classList.toggle('zoom-mode', S.zoom > S.minZoom);
}

function applyZoomTransform() {
  invalidateViewerRect();
  invalidateCvAfterRect();
  const w = Math.round(S.inputImg.width  * S.zoom);
  const h = Math.round(S.inputImg.height * S.zoom);
  const tx = `translate(calc(-50% + ${S.zoomPanX}px), calc(-50% + ${S.zoomPanY}px))`;
  [cvBefore, cvAfter].forEach(c => { c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.transform = tx; });
}

function clampZoomPan() {
  const vr = getViewerRect();
  const scaledW = S.inputImg.width  * S.zoom;
  const scaledH = S.inputImg.height * S.zoom;
  const margin = 40;
  const maxPX = Math.max(0, vr.width  / 2 + scaledW / 2 - margin);
  const maxPY = Math.max(0, vr.height / 2 + scaledH / 2 - margin);
  S.zoomPanX = Math.max(-maxPX, Math.min(maxPX, S.zoomPanX));
  S.zoomPanY = Math.max(-maxPY, Math.min(maxPY, S.zoomPanY));
}

// ─── reveal / compare ────────────────────────────────────────────────────────
function applyRevealState(cursorX, showLine) {
  const vr = getViewerRect();
  const cr = getCvAfterRect();
  const clipLeft = Math.max(0, cursorX - (cr.left - vr.left));
  cvAfter.style.clipPath = cr.width > 0
    ? `inset(0 0 0 ${clipLeft / cr.width * 100}%)`
    : `inset(0 0 0 ${cursorX / vr.width * 100}%)`;
  vdivider.style.left = showLine ? cursorX + 'px' : '-200px';
  document.documentElement.style.setProperty('--divider-x', cursorX + 'px');
}

function setReveal(cursorX)  { applyRevealState(cursorX, true); }
function showDenoised()      { applyRevealState(0, false); }
function showOriginal()      { applyRevealState(viewer.clientWidth, false); }

// ─── viewer helpers ───────────────────────────────────────────────────────────
function applyViewerState() {
  if (!S.inputImg) return;
  if (isMobile) {
    S.showingBefore || !S.denoisedImg ? showOriginal() : showDenoised();
    return;
  }
  if (S.denoisedImg && S.cursorInViewer && !S.comparing && S.lastCursorX !== null) {
    setReveal(S.lastCursorX);
  } else if (S.comparing || !S.denoisedImg) {
    showOriginal();
  } else {
    showDenoised();
  }
}

function renderViewer() {
  invalidateCvAfterRect();
  cvBefore.width  = S.inputImg.width;  cvBefore.height = S.inputImg.height;
  cvBefore.getContext('2d').putImageData(S.inputImg, 0, 0);
  if (S.denoisedImg) {
    cvAfter.width  = S.denoisedImg.width; cvAfter.height = S.denoisedImg.height;
    cvAfter.getContext('2d').putImageData(S.denoisedImg, 0, 0);
  } else {
    cvAfter.width  = S.inputImg.width;  cvAfter.height = S.inputImg.height;
    // cvBefore already has inputImg; applyViewerState will call showOriginal()
    // to fully clip cvAfter, so no paint needed here.
  }
  applyZoomTransform();
  updateZoomClass();
  requestAnimationFrame(() => applyViewerState());
}

// ─── scroll-to-zoom ───────────────────────────────────────────────────────────
viewer.addEventListener('wheel', e => {
  if (!S.inputImg) return;
  e.preventDefault();
  if (S.zoom <= S.minZoom && e.deltaY > 0) return;
  const vr = getViewerRect();
  const cx = e.clientX - vr.left - vr.width  / 2;
  const cy = e.clientY - vr.top  - vr.height / 2;
  const oldZoom = S.zoom;
  const newZoom = Math.max(S.minZoom, Math.min(4, oldZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  if (newZoom <= S.minZoom) {
    S.zoom = S.minZoom; S.zoomPanX = 0; S.zoomPanY = 0;
  } else {
    S.zoomPanX = cx - (cx - S.zoomPanX) * newZoom / oldZoom;
    S.zoomPanY = cy - (cy - S.zoomPanY) * newZoom / oldZoom;
    S.zoom = newZoom;
    clampZoomPan();
  }
  updateZoomClass(); applyZoomTransform();
  requestAnimationFrame(() => applyViewerState());
}, { passive: false });

// ─── pointer interactions ─────────────────────────────────────────────────────
viewer.addEventListener('mouseenter', () => {
  if (isMobile || !S.inputImg) return;
  S.cursorInViewer = true;
  if (!S.comparing && S.denoisedImg) viewer.classList.add('reveal-active');
});

viewer.addEventListener('mousemove', e => {
  if (isMobile || !S.inputImg) return;
  const vr = getViewerRect();
  S.lastCursorX = e.clientX - vr.left;
  if (!S.comparing && !S.panning && S.denoisedImg) setReveal(S.lastCursorX);
});

viewer.addEventListener('mouseleave', () => {
  if (isMobile) return;
  S.cursorInViewer = false;
  viewer.classList.remove('reveal-active');
  if (!S.comparing) showDenoised();
});

viewer.addEventListener('pointerdown', e => {
  if (!S.inputImg || e.button !== 0) return;
  e.preventDefault();
  viewer.setPointerCapture(e.pointerId);
  S.panStartX = e.clientX; S.panStartY = e.clientY;
  S.panStartPanX = S.zoomPanX; S.panStartPanY = S.zoomPanY;
  S.pointerDown = true;
  S.tapStartTime = Date.now();
});

viewer.addEventListener('pointermove', e => {
  if (!S.inputImg) return;
  const vr = getViewerRect();
  S.lastCursorX = e.clientX - vr.left;
  if (S.pointerDown && !S.panning && viewer.classList.contains('zoom-mode')) {
    const dx = e.clientX - S.panStartX, dy = e.clientY - S.panStartY;
    if (dx * dx + dy * dy > 16) {
      S.panning = true;
      viewer.classList.add('panning-active');
    }
  }
  if (S.panning) {
    S.zoomPanX = S.panStartPanX + (e.clientX - S.panStartX);
    S.zoomPanY = S.panStartPanY + (e.clientY - S.panStartY);
    clampZoomPan(); applyZoomTransform();
    requestAnimationFrame(() => applyViewerState());
  } else if (!isMobile && !S.comparing && S.denoisedImg) {
    setReveal(S.lastCursorX);
  }
});

const endPointer = e => {
  if (e.button !== undefined && e.button !== 0) return;
  S.pointerDown = false;
  const wasPanning = S.panning;
  if (S.panning) {
    S.panning = false;
    viewer.classList.remove('panning-active');
    if (S.cursorInViewer && !S.comparing) {
      viewer.classList.add('reveal-active');
      if (S.lastCursorX !== null) setReveal(S.lastCursorX);
    }
  }
  if (isMobile && e.type === 'pointerup' && !wasPanning && S.denoisedImg) {
    const dx = e.clientX - S.panStartX, dy = e.clientY - S.panStartY;
    if (Date.now() - S.tapStartTime < 400 && dx * dx + dy * dy < 225) {
      S.showingBefore = !S.showingBefore;
      S.showingBefore ? showOriginal() : showDenoised();
      updateViewLabel();
      mobTapHint.classList.remove('visible');
    }
  }
};
viewer.addEventListener('pointerup',     endPointer);
viewer.addEventListener('pointercancel', endPointer);

// ─── double-click to reset zoom (desktop only) ───────────────────────────────
if (!isMobile) viewer.addEventListener('dblclick', resetToNative);

// ─── keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveImage(); return; }
  if (e.key === 'Escape')          { clearImage(); return; }
  if (e.code !== 'Space' || !S.inputImg || S.comparing) return;
  e.preventDefault();
  S.comparing = true;
  viewer.classList.remove('reveal-active');
  viewer.classList.add('comparing-active');
  showOriginal();
});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space' || !S.comparing || S.panning) return;
  S.comparing = false;
  viewer.classList.remove('comparing-active');
  if (S.cursorInViewer && S.lastCursorX !== null) {
    viewer.classList.add('reveal-active');
    setReveal(S.lastCursorX);
  } else {
    showDenoised();
  }
});

// ─── mobile pinch-zoom ───────────────────────────────────────────────────────
if (isMobile) {
  let _pinch = null;

  viewer.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    S.tapStartTime = 0; // cancel any pending tap
    S.pointerDown = false; S.panning = false;
    viewer.classList.remove('panning-active');
    const [a, b] = [e.touches[0], e.touches[1]];
    const vr = getViewerRect();
    _pinch = {
      dist0: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
      zoom0: S.zoom,
      panX0: S.zoomPanX, panY0: S.zoomPanY,
      cx0: (a.clientX + b.clientX) / 2 - vr.left - vr.width  / 2,
      cy0: (a.clientY + b.clientY) / 2 - vr.top  - vr.height / 2,
    };
  }, { passive: false });

  viewer.addEventListener('touchmove', e => {
    if (!_pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const vr    = getViewerRect();
    const dist  = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const cx    = (a.clientX + b.clientX) / 2 - vr.left - vr.width  / 2;
    const cy    = (a.clientY + b.clientY) / 2 - vr.top  - vr.height / 2;
    const newZoom = Math.max(S.minZoom, Math.min(4, _pinch.zoom0 * dist / _pinch.dist0));
    if (newZoom <= S.minZoom) {
      S.zoom = S.minZoom; S.zoomPanX = 0; S.zoomPanY = 0;
    } else {
      S.zoomPanX = _pinch.cx0 - (_pinch.cx0 - _pinch.panX0) * newZoom / _pinch.zoom0 + (cx - _pinch.cx0);
      S.zoomPanY = _pinch.cy0 - (_pinch.cy0 - _pinch.panY0) * newZoom / _pinch.zoom0 + (cy - _pinch.cy0);
      S.zoom = newZoom;
      clampZoomPan();
    }
    updateZoomClass(); applyZoomTransform();
    requestAnimationFrame(() => applyViewerState());
  }, { passive: false });

  viewer.addEventListener('touchend', e => { if (e.touches.length < 2) _pinch = null; });
}

// ─── window resize ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  invalidateViewerRect();
  if (!S.inputImg) return;
  computeMinZoom();
  S.zoom = Math.max(S.zoom, S.minZoom);
  clampZoomPan();
  updateZoomClass(); applyZoomTransform();
  requestAnimationFrame(() => applyViewerState());
});

// ─── image loading ────────────────────────────────────────────────────────────
function resetZoom() {
  S.zoom = 1; S.minZoom = 1; S.zoomPanX = 0; S.zoomPanY = 0;
  viewer.classList.remove('zoom-mode');
  [cvBefore, cvAfter].forEach(c => { c.style.width = ''; c.style.height = ''; c.style.transform = ''; });
}

function deriveSaveName(name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const truncated = base.length > 200 ? base.slice(0, 200) : base;
  return truncated + '_denoised.png';
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (!ortReady) return;
  S.saveName = deriveSaveName(file.name);
  if (ortReady) setProgress(2); else setProgressIndeterminate();
  try {
    const bmp = await createImageBitmap(file);
    const tmp = document.createElement('canvas');
    tmp.width = bmp.width; tmp.height = bmp.height;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(bmp, 0, 0); bmp.close();
    S.inputImg = ctx.getImageData(0, 0, tmp.width, tmp.height);
    S.denoisedImg = null;
    S.comparing = false; S.panning = false;
    resetZoom();
    // Preserve cursorInViewer / lastCursorX — cursor may still be inside the
    // viewer when replacing an image, and no mouseenter will fire to restore them.
    dropIdle.style.display              = 'none';
    tDropDesc.style.display      = 'none';
    controlsHint.style.display   = 'none';
    viewer.style.display         = 'block';
    invalidateViewerRect();
    botBar.classList.remove('bot-bar-visible');
    computeMinZoom();
    viewer.classList.remove('panning-active');
    if (!S.cursorInViewer) viewer.classList.remove('reveal-active');
    canvasArea.classList.add('viewer-active');
    setSaveEnabled(false); setNewEnabled(true);
    renderViewer();
    const gen = ++_loadGen;
    await tick();
    await processAndShow(S.inputImg, gen);
  } catch(e) {
    console.error(e); setProgress(0); showError(e.message || 'An unexpected error occurred.');
  }
}

async function processAndShow(imgData, gen) {
  try { await _ortLoadPromise; } catch { return; }
  if (gen !== _loadGen) return;
  await tick();
  const result = await runDenoiser(imgData.data, imgData.width, imgData.height);
  if (gen !== _loadGen) return;
  S.denoisedImg = result;
  S.showingBefore = false;
  if (!isMobile) {
    requestAnimationFrame(() => botBar.classList.add('bot-bar-visible'));
    if (S.cursorInViewer && !S.comparing) viewer.classList.add('reveal-active');
  }
  renderViewer();
  setSaveEnabled(true);
  setProgress(100);
  if (isMobile) { updateViewLabel(); mobTapHint.classList.add('visible'); }
}

// ─── drop / paste / click ─────────────────────────────────────────────────────
dropIdle.addEventListener('click', () => fileInput.click());
dropIdle.addEventListener('dragover',  e => { e.preventDefault(); dropIdle.classList.add('drag-over'); });
dropIdle.addEventListener('dragleave', ()  => dropIdle.classList.remove('drag-over'));
dropIdle.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); dropIdle.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
document.addEventListener('paste', e => {
  for (const item of (e.clipboardData?.items || []))
    if (item.type.startsWith('image/')) { loadFile(item.getAsFile()); break; }
});
document.addEventListener('dragenter', e => e.preventDefault());
document.addEventListener('dragleave', e => e.preventDefault());
document.addEventListener('dragover',  e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

// ─── actions ──────────────────────────────────────────────────────────────────
function resetToNative() {
  if (!S.inputImg) return;
  S.zoom = 1; S.zoomPanX = 0; S.zoomPanY = 0;
  updateZoomClass(); applyZoomTransform();
  requestAnimationFrame(() => applyViewerState());
}

async function saveImage() {
  if (!S.denoisedImg) return;
  const c = document.createElement('canvas');
  c.width = S.denoisedImg.width; c.height = S.denoisedImg.height;
  c.getContext('2d').putImageData(S.denoisedImg, 0, 0);

  // On mobile, use the Web Share API so the OS share sheet appears.
  // iOS shows "Save Image" (→ Photos); Android shows gallery/save options.
  // Must stay in the isMobile branch — desktop share sheets are unexpected there.
  if (isMobile && navigator.canShare) {
    try {
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], S.saveName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // user dismissed the sheet
      console.warn('[save] Web Share failed:', e);
    }
  }

  const a = document.createElement('a');
  a.download = S.saveName; a.href = c.toDataURL('image/png'); a.click();
}

function clearImage() {
  if (!S.inputImg) return;
  _loadGen++;
  S.inputImg = null; S.denoisedImg = null; S.showingBefore = false;
  S.comparing = false; S.pointerDown = false; S.lastCursorX = null; S.cursorInViewer = false;
  resetZoom();
  viewer.style.display   = 'none';
  invalidateViewerRect();
  invalidateCvAfterRect();
  dropIdle.style.display = '';
  tDropDesc.style.display = '';
  canvasArea.classList.remove('viewer-active');
  viewer.classList.remove('reveal-active', 'panning-active');
  setSaveEnabled(false); setNewEnabled(false);
  if (!isMobile) {
    controlsHint.style.display = '';
    botBar.classList.remove('bot-bar-visible');
  }
  progBar.classList.remove('indeterminate');
  progBar.style.transition = 'none';
  progBar.style.width = '0%';
  void progBar.offsetWidth;
  progBar.style.transition = '';
  hideError();
  if (isMobile) { updateViewLabel(); mobTapHint.classList.remove('visible'); }
}

// ─── header / mobile buttons ─────────────────────────────────────────────────
btnSave.addEventListener('click', saveImage);
btnNew.addEventListener('click',  clearImage);
mobSave.addEventListener('click', saveImage);
mobNew.addEventListener('click',  clearImage);

// ─── helpers ──────────────────────────────────────────────────────────────────
function setSaveEnabled(v) { btnSave.disabled = !v; mobSave.disabled = !v; }
function setNewEnabled(v)  { btnNew.disabled  = !v; mobNew.disabled  = !v; }

function updateViewLabel() {
  const show = S.showingBefore && !!S.denoisedImg;
  if (show) viewLabel.textContent = t('label-before');
  viewLabel.classList.toggle('visible', show);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}
function hideError() {
  errorMsg.classList.remove('visible');
}

function setProgress(pct) {
  if (progBar.classList.contains('indeterminate')) {
    progBar.classList.remove('indeterminate');
    progBar.style.transition = 'none';
    progBar.style.opacity = '0';  // hide during snap so translateX reset is invisible
    progBar.style.width = '0%';
    void progBar.offsetWidth;     // anchor state before re-enabling transitions
    progBar.style.transition = '';
    progBar.style.opacity = '1';  // fade in while width grows
  }
  progBar.style.width = pct + '%';
}
function setProgressIndeterminate() {
  progBar.classList.add('indeterminate');
}
function tick() { return new Promise(r => setTimeout(r, 0)); }

// ─── startup ──────────────────────────────────────────────────────────────────
async function warmUp() {
  const side = 512 + 2 * 64; // matches worst-case tile shape used in runDenoiser
  const dummy = new ort.Tensor('float32', new Float32Array(side * side), [1, 1, side, side]);
  await ortSession.run({ [ortSession.inputNames[0]]: dummy });
}

async function main() {
  dropIdle.classList.add('model-loading');
  tDropLabel.textContent = t('drop-label-loading');
  setProgressIndeterminate();
  try {
    await loadModel();
    await warmUp();
    ortReady = true;
    _ortLoadResolve();
  } catch(e) {
    console.error(e);
    if (/HTTP|fetch|load|404/i.test(e.message)) notice.style.display = 'block';
    _ortLoadReject(e);
  }
  dropIdle.classList.remove('model-loading');
  applyLang();
  if (!S.inputImg) setProgress(0);
}

// ─── init lang ───────────────────────────────────────────────────────────────
const savedLang = getCookie('lang');
if (savedLang === 'ja' || savedLang === 'en') lang = savedLang;
applyLang();

// setLang must be globally accessible for inline onclick handlers in HTML
window.setLang = setLang;

main();
