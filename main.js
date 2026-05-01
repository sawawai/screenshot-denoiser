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
const cvBeforeCtx  = cvBefore.getContext('2d');
const cvAfterCtx   = cvAfter.getContext('2d');
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
const controlsHint  = $('controls-hint');
const tDropDesc     = $('t-drop-desc');
const dropSecondary = $('drop-secondary');
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

const TILE = isMobile ? 256 : 512;
const OVL  = isMobile ? 32  : 64;

const MAX_MEGAPIXELS = 48;

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
    'hint-zoom':       '拡大 / 縮小',
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
    'lang-aria':           '言語',
    'image-too-large':     '画像が大きすぎます（{0} MP）。{1} MP までの画像をご利用ください。',
  },
  en: {
    'title':           'Screenshot Denoiser',
    'drop-label':      'Drop image here',
    'drop-sub':        'Click to browse &nbsp;·&nbsp; <kbd>Ctrl+V</kbd> to paste<br>PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; WebP &nbsp;·&nbsp; BMP',
    'btn-save':        'Save',
    'btn-new':         'New',
    'label-before':    'Before',
    'label-after':     'After',
    'hint-reveal':     'Before / after',
    'hint-original':   'Show original',
    'hint-zoom':       'Zoom in / out',
    'hint-reset':      'Reset zoom',
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
    'lang-aria':           'Language',
    'image-too-large':     'Image is too large ({0} MP). Maximum supported size is {1} MP.',
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

// Cached [element, key] pairs — DOM is fully parsed when this script runs
// (script lives at end of body), so getElementById is safe at module load.
const _tEntries = Object.entries(tMap)
  .map(([id, key]) => [$(id), key])
  .filter(([el]) => el);
const _langButtons = document.querySelectorAll('.lang-switch button');
const _langSwitch = document.querySelector('.lang-switch');
// Icon buttons whose aria-label should mirror the localised visible text.
const _ariaButtons = [[btnSave, 'btn-save'], [btnNew, 'btn-new'], [mobSave, 'btn-save'], [mobNew, 'btn-new']];
_langButtons.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const [el, key] of _tEntries) el.innerHTML = t(key);
  _langButtons.forEach(b => {
    const active = b.dataset.lang === lang;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (_langSwitch) _langSwitch.setAttribute('aria-label', t('lang-aria'));
  for (const [el, key] of _ariaButtons) el.setAttribute('aria-label', t(key));
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

// ─── colour constants ───────────────────────────────────────────────────────
// BT.709 luma + reciprocals so hot loops can multiply instead of divide.
const Y_R = 0.2126, Y_G = 0.7152, Y_B = 0.0722;
const Y_R_INV255 = Y_R / 255, Y_G_INV255 = Y_G / 255, Y_B_INV255 = Y_B / 255;
const INV_255 = 1 / 255;

// ─── blue-noise dither ────────────────────────────────────────────────────────
// 64×64 single-channel blue-noise texture from Christoph Peters /
// Moments in Graphics: momentsingraphics.de/BlueNoise.html (LDR_LLL1_0.png)
const blueNoise = new Uint8Array([
   65,247,203,177, 54,149, 96,135,122, 62,109,206, 27,217,152,103,250, 78,122,228,  3, 83,233,160, 45,242,108, 40,125, 93,201, 35,
  231,187,254,207,147, 13, 87,134,246,197,177,224, 59, 92,132,169, 49,183,140,  3, 58,165, 27,204, 12, 83,196,  4,159,183, 92,197,
  170,140, 24,127,109,255, 35,210, 79,193,178,141,168, 11, 69,130,182, 27,147, 47,191,170, 66, 13,187, 76,  0,197,161, 66,146,172,
  104,134, 58, 97,182,232,162,115, 34, 73,  2,238,162,188,  6,243,218, 31, 69,193,244, 87,146,130,248,172,225,104,235, 21,218,117,
  236, 49, 87,155,228, 69, 15,166,235, 24, 48, 86,119,238,195, 90,  6,221,165,105, 20,255,120,146,211,129, 88,236, 21, 52,245, 17,
   73,158, 24,  7,126, 43, 64,190,218, 95,128, 23,207, 46,113,145, 85,102,229,119, 40,106,222, 66, 49,152, 31,126, 46,145, 57, 10,
  191,104,213,  3, 42,197,182,104,147,  1,223,252, 60, 34,161, 45,244, 61,208,133, 89,199, 37, 56,245, 29,174,152,114,190,212,127,
  179,238,216,195,246,109, 26,240,170, 51,155,108, 81,249, 28,195, 60,175,153, 19,208,177, 15,187,114,211, 93, 72,178,203, 82,162,
   28, 72,179,242,160, 83,120, 55,214,128,156,100,180,136,214,106,144,117, 30,231, 71,155,177,106, 94,224, 47, 69,229, 99, 83,  4,
   45,114, 87,141, 72,156,203, 79,139, 13,232,181,137, 67,159,212, 10,130,254, 77, 52,160,235, 80,  5,241,192, 18,254,111,227,131,
  248,147,115, 59,133,207, 26,248, 91, 67, 31,202, 13, 78,229, 16,201, 82,183, 52,240, 18,221,  7,139,163,202, 12,134, 32,164,224,
  198, 63, 33,170, 51,224,101, 19,116,211, 61,198, 36,226,121, 93,236, 38,200, 97,141,123, 33,102,139,165, 58,133,157,  4, 96, 41,
  199, 13,219, 98, 16,227,144, 39,189,172,237,113, 53,189,126, 67,173,156,  4,101,141,114,205, 63,191, 79,118,241,185, 57,143,248,
  102,154,229,121,  0,178, 38,150,186,254, 89,  4,101,173, 17,186, 54,112,167,  0,215,247, 63,203,227, 42, 85,220, 34,207, 64,173,
   80, 51,186, 37,171, 73,110,161,  9,220, 81,140,164,241, 25, 95,253, 38,215,194,170, 43, 85,125,250, 21, 40,149,108,208, 76, 21,
  130, 12,183,252, 94,210,241,129, 68, 44,165,127,242, 47,152, 82,142,223, 71, 28,179, 86,189,150, 24,176,122,104,184,141,239,120,
  225,135, 89,253,125,193,243, 60, 97,123, 44,  5,212,104,148, 50,223,135,120, 74,248, 29,229,158, 53,177,214, 88,  5,168, 42,192,
   90,213, 74, 28,135, 59, 83,  9,225,110, 27,145,215, 70,205,251, 22,194,155,243,133, 46,  8,115, 73,249, 14,233, 77, 47, 23,154,
  106,165,205,  2,152, 49, 24,206,232,150,183,251, 66, 34,203,185, 20, 86, 57, 10,150, 96,186,  3,137,234,102, 63,254,221,119,232,
  174, 53,148,202,162,115,195,173,154,203,235, 79,189,114,  6,131,105, 43, 91,118, 59,226,162, 95,213,136, 55,194,163, 94,212, 10,
  240, 28, 64,232,104, 84,178,137, 74, 17,198, 89,131,171, 77,113,160,236,199,225,128, 65,209,108, 75, 34,155,196,132, 29,157, 67,
  112, 36,240,105, 19, 46,220, 32, 93, 53, 10,178, 58, 33,226,169, 63,182,235,206, 18,107,198,236, 39,157,205,  1,127,252,177, 72,
  191,122, 42,143,199, 12,218,119, 35,108, 54,159, 23,240,219,  0,143,100,177, 36,166,243, 15,173,224,123, 19,183, 49, 82, 15,244,
  141,  3,217, 81,185,250,142, 73,106,246,124,137, 99,156,240, 86,202, 10,135, 35,170,143, 69,182, 27, 87,109, 66,147, 30,115, 53,
  150,174,221, 76,164,241, 57,156,248,173,226,214, 99,120, 60, 43,247, 67, 16,110, 51,144, 89,200, 56,246, 94,208,146,105,179,205,
   94,190,128, 65,170,  7,122,229, 22,193,162,218, 15,196, 46,123, 29,159, 73,217, 84,255, 13, 53,130,244,174,230, 43,220,202, 86,
  245, 22, 93,131, 33,114, 95,190,  2, 84,140, 40,  9,146,179,194,130,210, 80,191,219, 25,119, 41,139,163, 11, 70,239,219,124, 57,
  162, 44,228,152, 97, 56,209,156,180, 66, 42, 85,253, 71,143,103,224,248,113,178, 44,124,224,104,150,216, 23, 81,185,101,137,  6,
  111,210, 52,229,180, 17,213, 45,131,236, 63,188,206, 81,232, 93, 28,163,121,253,152, 70,237,187, 80,215,116, 43,169,  6, 34, 77,
  253, 12,113, 29,239,199, 38, 83,131,  3,232,112, 27,167,214,  1,188, 53, 96,148,  4,196,161, 75,189,  7,119, 58,159, 17,234, 67,
  185,158, 11,193, 65,247,144, 72,204, 26,122,105,255,158, 52, 12,223,141, 40,  6, 92,207,172,  1, 31,102,252,142,191, 91,234,197,
  135,182, 87,211,138, 16,116,248, 98,212,146,201,182, 59,131, 82,153, 17,207,241, 63, 91,238, 32,205, 96,144,250,198,126,169, 39,
  254, 98,139,121, 86,170,107,160, 92,183,168, 15, 70, 33,117,174,106, 62,233,183, 55,132,107,158,230,198, 59, 23,128, 64,111,151,
   21,222, 53,166, 74,177,191, 62, 30,172, 52,121, 92,238, 38,246,171, 69, 34,128,184, 23,117, 49,168, 67,222, 34, 88, 51,214, 78,
   29, 57,206,233, 40, 21,221,  7,250, 54,228,152,198,133,215,245, 75,204,169,101, 22,244, 44, 66,124, 88,180,226,157,212,175, 47,
  102, 68,127,246,106, 46,226,158,136,242, 77,  9,155, 19,105,198,118,225,142,105,229,153,215,138,246, 17,130,176,229,  3,116,148,
  129,173,  6, 75,153,199, 59,117, 34,138, 80, 43,242, 87, 20,186,149,  9,128, 81,220,194,140,213, 16,148, 49,  8, 81, 32,249,  0,
  231,205,155, 27,  4,147, 88, 12,109,219, 41,186,228,208,138, 49, 21,190, 85,167, 14, 56, 80,101,187, 42,111, 74,156,103,240,195,
   90,225,111,244,178,127,238,190,210,100,218,  2,112,165, 56, 98, 35, 48,249,156,114, 34,177, 78,250,166,110,241, 99,199,123,143,
   88,172, 39,194,217,125,255,204, 24,194, 96,128, 61,164, 77,234, 97, 59,212, 42,243,201,175,  0,230,150,210,192, 25, 61,180, 16,
   69, 35,144, 50, 99, 28, 88, 70,151,173,125, 65,181,140,200,232,119,214,191, 18, 68,236,  7, 97,200, 39,219,184,138, 55, 72,187,
   16,115, 79,236, 99, 66,181, 79, 57,166,148,251, 31,114,  7,176,149,253,  9,133, 71,114, 31,126, 64, 88, 12,247,142,220, 45,208,
  249,158,189,216, 15,137,164, 47, 10, 22,193,235, 31,222, 14, 70,163,142, 60, 91,168,146,121, 57,133, 19, 65,119, 13,230,161,213,
  241, 58,137,177, 51,160, 33,134,240,118,  1, 71,216, 90,189,221, 32,121,162,184, 94,226,157,252,204,166, 53, 98,122, 82,164,134,
  118,  0, 82, 63,202,253,185,228,109,246, 91,146, 48,103,128, 84,242,  1,108,227,201, 45,216,187,238,154, 90,207,174, 44, 25, 95,
   36,153,223,  6,119,210, 16,222, 92,175, 50,197,139,243, 45,131, 70,106,204, 22,144,195, 47,106, 22,137,217, 35,173,231, 28, 95,
  236,175,224,125,103, 39, 76,215,132, 57,201, 77,159,253,209, 28,175,188, 37,132,254, 26, 85,107,164, 30,247, 76,147,107,252,132,
  202,109, 22,249, 88,193,149,107, 40,231,211, 23,105,154, 18,166,237, 51, 82,246, 61,  6, 86,179, 77,240,112,185, 68, 10,193, 55,
  108, 43, 23,167,148,  8,118,154, 27,168, 38,121,178,  6, 62,154, 95,223, 54, 76,153,176,  4, 70,222, 51,128,190,  2,218, 81,169,
   65,184, 75,166, 45,233, 71,186, 11,158, 76,124,181, 62, 84,193,  2,215,175, 36,219,130,237,149, 40,192,  3,131,249,153,205,143,
  213, 73,198,243, 85,230,179, 65, 96,209,240, 19,219,111,195, 43,135,117,208, 12,101,124,233,141,201, 15,101,231, 60,117,195, 48,
   12,125,206,101,139, 25,127,245, 54,141, 98,247, 35,227,208, 96,118,137,153,100,114,165,207, 15,223, 60,161, 90, 47,104, 79, 18,
  255,156,135, 57, 31,204, 48,248,  1,187,136, 69, 90,143,233, 79,248, 21,164,243,184, 59,194, 34,114,172,151, 40,180, 23,156,235,
  224,146,244, 35,220, 62,174, 86,115,206,191,  5,169, 52,142,251, 29, 64,233,  9,190, 49, 69,122,102,142,200,235, 29,225,126,180,
   93,  4,120, 97,187,111,137,162, 78,104,226, 46,165, 30,183, 10,203, 66,145, 83,217, 44,159, 93,252, 65,208, 85,243,140, 99, 30,
   89, 57,  1,160,113,199,  7,214,163, 20, 66,221,129,112, 11,160,180, 44,198, 76,255, 92, 27,175,245, 83, 19,116,168,188, 61, 36,
  165, 50,223,173, 12,218, 21,233,125,151, 14,199,251, 57,102,125,171, 48,110, 31,134, 16,238, 78,  8,132,226, 19,124, 72,205,171,
  115,191, 80,180, 93,251,151, 37,236, 46, 94,148, 79,237,201, 71, 90,221,126, 18,157,136,231,187, 37,210, 54, 71,216,  9,147,231,
   69,193,240, 76,147, 60, 90,193, 37, 55,177,114,131,214,157,224, 92,239,196,229, 98,206,119,177,215, 49, 96,166,197,  5,255, 44,
  135,239,216, 23,131, 50,103, 77,123,178,254, 26,187, 39,103, 20,242,147,105,171,209, 58,111, 11,162,124,150,252,134, 99,206,112,
  141, 17, 33,207,127,252,169, 72,212,245, 92, 26, 82,  3, 71, 39, 18,150,181,  1,167, 69,143, 24,155,188, 35,146, 55,109,220, 65,
   19,152, 39, 70,233,189, 15,227,136,196,109,161,215, 59,170,132,189, 54, 33, 82,227, 40,145, 74,195, 93,  0,178, 42, 83, 25,246,
  125, 89,107,157, 45,100, 29,121,  5,158,203,235,145,188,244,208,116, 78, 61,129, 46,249,192, 57,105,246,116,235,178, 82,158,185,
   98,202,122,173,145, 61,166,205, 28, 55,  0, 85,121,140,231,210,  3,118,249,200,  8, 98,246,215, 50,234,220,107,199,158, 56,175,
   41,212,235,177,  7,200,227,185,106,134, 65, 44,167,108, 54,175,140,255, 23,220, 90,113, 36,231, 83,  2, 70,200, 15, 31,126,230,
    9, 84,250,107, 10,213,115, 90,156, 72,223,242, 14, 32, 75, 45, 87,158,176, 68,133,190,168,116, 20,132, 33, 64,241, 13,226,188,
    2,148, 61, 82,136,239, 53,149, 82,220, 17, 99,226, 31,126,  8,193,100,160,204,185, 16,148,209,127,172,219,136, 93,242,143, 52,
  214,164, 47,197, 32, 78,247, 41,235,144,102,173,205,183,152, 99,238,216, 17,108,151, 28, 86, 61,181,154, 78,171,143,116, 95, 75,
  167,221,192, 20,115, 68,165, 13, 40,253,176,196, 76,154,237, 87, 44,230, 30,136, 76,239,164, 95, 47, 22,157, 61, 43,206,181, 71,
  118, 25,140, 94,224,179,132,  7,184,200,126, 48, 64,249,112,195, 26,127, 56,234, 42,219,239,  5,207,250, 91,189, 27,211,134,253,
  103,121, 48,248,182, 95,217,129,192, 58,117,138, 22,202, 60,169,216, 68,109, 52,122,  5, 64,195,227,183,102,250,113,167,  6,103,
  244,192, 64,237,150, 54,162, 97, 67, 20, 34,163, 90,134,  6,168, 69,142,182,201, 78,124,162,142,104, 39,123, 12,233, 49, 66, 32,
  144, 14, 90,160, 36,205, 24,109,232, 92,159,  0,245,111, 94,130, 16,183,153,247,176,222,141, 31, 74,133, 10,212, 28,147, 81,222,
   38,174,124,  2,111, 21,209,121,221,253,110,214, 17,229, 53,220, 37,254, 93,  1,171,100, 50, 71,192,223, 56,202,109,162,182,198,
  238,209,227, 64,140,243,153, 74,172, 33,212, 49,179,219, 38,250,144,205,  9, 84,211, 44,106,254,118,233, 86,191, 67,236,197,133,
   15,156, 86,217, 74,245,194, 44, 84,171,143,188, 77,150,117,203, 81,159,120, 30,212,247, 14,232, 26,134,168,148, 74,245,  8, 83,
   53, 26,170,126,  3, 84, 50,201,  9,241,132, 85, 69,149, 25,191, 77,117, 35,163, 96, 20,150,181, 56,167, 40,155,122, 48, 95, 58,
  254,203, 46,185,167, 35,137,154, 10, 56,235, 99, 40,246,178,102, 13,189,228, 60,135,186,154,113,177, 83,  6,228, 41, 93,154,130,
  180, 73, 98,196,111,230,184,123, 62,146,106,188,231,123,165, 54,103,223, 63,242,129,198, 79,  8,203, 25,138,221,  0,181,164, 24,
  114,100,144,234, 61,106, 91,226,181, 72,131,  1,210, 60, 22,138,240, 47,107,148, 75, 38, 89,209, 62,255, 99,120,214, 20,206,114,
   37,223,147,254, 43, 19,166, 97,222, 20,207, 41, 10, 97,211, 14,236,172,140,189, 52,230,160,217, 92,110,239, 73,103,247,214,141,
  229, 72,  8, 28,130,207, 13,250,112,198, 30,162,121,194, 91,156, 68,215,  9,200,237, 19,225,127, 46,198, 32,186,136,173, 63,248,
  160,190, 11, 58,135,217,151, 33,248, 79,174,157,254, 65,196,130, 42, 87, 26,  1,109, 69, 30,123,246, 60,172,197,131, 20, 64, 35,
  188,170,216,155,241, 79,172, 26, 50,150,222,242, 80,171,226, 34,129,164, 88,175,123,101,168,  2,142,161,239, 70, 50,234,104,  0,
   92,120, 79,174,199, 89, 70,118,191,136, 55,115, 30,141, 81,245,155,184,120,210,252,177,143, 46,185,149, 16, 38, 89,159,205, 82,
  125, 44, 89,117, 54,193,146,124,212, 87,103, 44,141, 17, 51,252,112,187, 27,248, 42, 67,195,243, 80,108, 14,151, 87, 29,196,140,
   46,211,232, 25,106,245, 13, 49,232,  5, 94,201,222,181,  4,107,217, 72,233,149, 39, 85,101,227,  4, 81,211,229, 53,179,112,237,
   18,197,250,179,  3, 98, 39,237, 63,168,  6,185, 68,209,100,200,  2, 78,222, 55,139,155,217, 31, 58,176,205,218,126,165,225, 68,
   18,243,155,128, 37,209,183,154,212,169, 73,238, 45,122,163, 55, 34, 17, 97, 59,165,192, 22,204,134,164,106,121,143,244,  4,153,
   98,139, 66, 32,224,204, 73,187,138, 23,249,110,228,130,152,174, 63,144,119,204,  8,111,183, 92,121,230, 23, 98,  6,252,111,182,
  145, 99, 52, 72,168,139, 60,101,128, 28,110,149, 20, 89,230,193,145,175,203,129, 11,218,116,237, 54, 68,255, 28,190, 74, 40,217,
   56,228,163,113,133,159,107, 11,219,120,201,156, 36, 12, 87,231, 43,243,160, 89,234, 74, 24,251,149, 41,136,192, 78, 56, 38,204,
  171,  6,194,223,113,  2,227, 80, 41,251,186, 59,172,210, 68,132,247, 80,110,239, 47, 75,157, 91, 36,199,176, 11,222, 94,169,129,
  184, 11, 78,240, 19, 55,254,174, 91, 50, 76,178, 58,244,122, 24,192,102, 35, 18,189,171,132, 51,201,167, 64,243,180,157,130, 82,
   28,117,252, 88,178, 23,242,161,200, 11,220,135,242,  7,103, 42, 26,220,  3,183,138,249,174, 14,127,149,100, 47,137, 62,208, 24,
  105,201, 45,176,212, 85, 36,148,230, 26,132, 96,217,187, 71,211,135,168,218,125, 64,210, 98, 14,225, 84,105, 33,119, 11,239,216,
  232,134, 59, 34,144,206, 95,120, 67,145, 83, 99, 34,156,202,117,167, 62,155, 93, 30, 64,107,213,186,241, 81,231,160,119,251, 85,
  233,145,124, 96,152,195,116, 66,207,161,238,  2,142,164, 46,110,  8, 78, 52,250,146, 39,240,160,116,  4,210,229,140,196, 94, 66,
   43,184,162,215, 77, 50,190, 32,234,180, 48,125,189, 77,255,141, 88,236,210,122,199,150,225, 24, 56,  1,206,111, 26,196,  5,152,
   37, 68,220,  0, 29,243,138,  8,186, 41,107,197, 30, 88,255,151,180,230, 94,197,  5,108, 76,185, 58,145,172, 72, 22, 51,165,107,
  147,200,  8,100,245,127,154,  9,109,166, 22,217,232, 14, 55,181, 19,190, 51, 13,231, 42, 83,120,142, 70,169, 38,182, 77, 54,177,
  114,192,249, 59,183, 75,225,100,126, 83,248, 55,118,225, 18, 62,202, 31,118,157,176,221,139, 29,195,253, 43, 91,184,247,207, 14,
  125, 71,237,115, 21,174, 60,221,253, 88,199, 66,112,173,128,224, 36,110, 78,134,176,102,190,163,252, 95,219,127,245,139,215,237,
   91, 16,166,132,108,157, 50, 16,216,169,151, 73,176,207,129,101,240,137, 68, 21, 84, 48,236, 94,123, 17,216,132,153,114, 81,224,
   27, 92,151, 45,225,194,138, 75, 39,129,157,  4,144, 43, 95, 72,239,146,165,251, 62,  5,237, 32,202, 48,153,  9, 62, 99, 13,161,
  128, 48, 80,213, 36,232,176,200, 63, 25,228,  7,137, 36, 81,169,  0, 45,185,247,211,129, 10,203, 68,166,104,231,  1, 62, 37,179,
  255, 56,209,168, 86,  3,101,211,182, 54,235,102,245,214,195,158,  0,202, 96, 27,213,154, 74,133, 16,108,188, 87,227,198,110, 32,
  203,228,148,190,  7, 92,115,253,145, 97,193,109,184,246, 51,218,192,148,228,104,164, 61,151,175,245, 50, 79, 31,189,239,139,161,
    7,192,130, 33, 67,249,122, 15,148, 25,206, 79, 32,169, 20,120, 63,219, 45,126,194,113, 90,222,178, 67,234, 27,173,149, 51,254,
   71, 20,102,244, 65,139, 26, 80, 37,131, 47,238, 14, 93,159,112, 74,123, 89, 33, 15,115,227, 37,110,143,208,158,121, 87,214,104,
  228,112,176,234,142,162,198,230, 91,172,117,188,133, 50, 87,249,139,174, 84,241, 11, 52,170, 38,246,143,117,206, 41,123, 84,167,
  138,182,120, 42,170,197,156,236,209,163, 70,213,146, 60,230, 25, 11,210, 56,179,206, 75,191, 88,  5,182,224, 57, 11,199, 45, 73,
  149, 82, 18, 97, 49, 27,111, 58, 41,247, 69, 10,220,151,107,200, 12, 35,106,181,226,147,207,124,  2, 54,161, 76, 13,237,189,222,
    2, 58,208, 86,224,126, 52,  1,181,117, 21, 85,172,124,201,136,253,167,234,131,147,250, 47,136,236, 20,128, 94,251,171,133, 25,
  203, 55,218,188,241, 75,180,221,158,140, 97,239, 61,180,228, 75,234,155, 59,134, 72, 19,101,186, 85,213, 97,250,136, 62, 25, 96,
  113,241,152, 30, 14,249, 94, 67,104,226,195,250, 32,103, 43,187, 65,100, 42,  3, 85, 23,160,100,197, 73,168, 39,113, 66,184,235,
  164,116,  0,126,151,209, 18, 84,123,  3,194,163, 18,125, 41, 24,186,118,208,253, 31,163,238, 65,230, 22,194,179,108,215,159,202,
   37,175,133, 73,185,111,217,167, 18,138, 56,153,  4,223, 78,161, 29,150,199,119,184,222, 62,212,119, 29,244,145,218, 17,100, 35,
  138,252, 69,171, 40,103,135,252, 33,214, 48,112,204, 93,145,167, 97, 48,  5,193, 92,116, 46,140,155, 37,129, 49,  5,146, 74,127,
   52, 90,231,211,161, 44,147,201,232, 41, 91,129,179,205,244,116, 89,219,242, 71,105,238, 36,176,153, 53,204, 77,191,157,242, 86,
  215, 23,192, 90,228, 12,202,170, 70,182,235, 80, 30,254,213, 65,243,221,141, 77,171,218,197,  7,105,171,226, 89,241, 33,229,180,
  248, 21,105,  4, 60, 84,130, 32, 76,186,238,110, 68, 50,139, 24,174,  8,135, 53,169, 13,134, 88,  1,229,105,131,  8, 51,124, 61,
  179,108, 48,144,244, 64,115, 51,145,101,129,154, 57,175,  2, 84,128,159,109, 16, 57,244,127, 80,251,203, 70,118,165,191,102, 15,
   67,166,196,142,242,190, 10,251,120,158,  9,216,166, 14, 98,234, 61,188, 38,209,151,196,113,255, 67,186, 24, 91,173,227,200, 12,
  234,159,211,122, 30,163, 86,196,219, 22,  9,225,188,136,115,196, 19, 36,237,184,152, 40, 27,181, 59, 15,150, 25, 55, 80,137,209,
  153,221,124, 38,113,225,100,175, 63,208, 83, 29,255,194,152,204,123, 81,251, 95, 21, 76, 47,218,144,163,240,211, 41,110,151, 79,
   39, 98,  8, 75,223,187,  5,239, 42,161,247, 74, 95, 41,233, 52,170,204, 63, 96,213,135,112,208, 96,138,223,178,216,251,  7,116,
   49, 86, 26, 75,170, 53,213, 21,149, 46,103,142,119, 37, 73,227, 17,108,159,216,125,233,181, 99, 38,118, 58,137, 71,251, 29,133,
]);

// Precomputed (b - 127.5) / 255 so the composite loop indexes a Float32 LUT
// directly instead of doing the conversion per pixel per channel.
const blueNoiseF32 = new Float32Array(blueNoise.length);
for (let i = 0; i < blueNoise.length; i++) blueNoiseF32[i] = (blueNoise[i] - 127.5) * INV_255;


// ─── ONNX Runtime ────────────────────────────────────────────────────────────
let ortSession = null;
let ortReady = false;
let _ortLoadResolve, _ortLoadReject;
const _ortLoadPromise = new Promise((res, rej) => { _ortLoadResolve = res; _ortLoadReject = rej; });

async function tryProvider(modelPath, opts, label) {
  try { return await ort.InferenceSession.create(modelPath, opts); }
  catch(e) { console.warn(`[ORT] ${label} unavailable:`, e.message); return null; }
}

async function loadModel() {
  const ua = navigator.userAgent;
  // Safari includes "Safari" but not "Chrome"; covers both macOS and iOS.
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');

  // WASM binary fetches must share the CDN origin used by the JS bundle.
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  // ORT silently drops to 1 thread when SharedArrayBuffer is unavailable
  // (server missing COOP/COEP headers), so this is a best-effort hint.
  // Cap threads on iOS: the larger model's WASM heap per thread is enough to
  // push Safari over its memory limit on iPhones with less headroom.
  ort.env.wasm.numThreads = (isMobile && isSafari)
    ? Math.min(navigator.hardwareConcurrency || 2, 2)
    : (navigator.hardwareConcurrency || 4);
  ort.env.wasm.proxy = true;

  const modelPath = './models/s2d_1x.onnx';
  const baseOpts = {
    graphOptimizationLevel: 'all',
    executionMode: 'parallel',
    enableCpuMemArena: true,
    enableMemPattern: true,
  };
  // Android Chrome: NNAPI (WebNN) is unreliable across devices and GPU overhead
  // for a model this small doesn't pay off on shared mobile memory bandwidth.
  const useGPU = !isMobile;
  const tryAccel = useGPU || isSafari;

  // Ordered preference list. Each entry is one provider attempt; first to succeed wins.
  // 1-2: WebNN  – native OS ML API (DirectML on Windows, Core ML on Apple). Lowest overhead.
  // 3:   WebGPU – Metal on Safari, Dawn on Chromium, also Firefox.
  // 4:   WASM   – SIMD + threads when available. Primary path on mobile; final fallback elsewhere.
  const providers = [
    tryAccel && 'ml'  in navigator && { ep: { name: 'webnn', deviceType: 'gpu', powerPreference: 'default' }, label: 'WebNN GPU' },
    tryAccel && 'ml'  in navigator && { ep: { name: 'webnn', deviceType: 'cpu', powerPreference: 'default' }, label: 'WebNN CPU' },
    tryAccel && 'gpu' in navigator && { ep: 'webgpu', label: 'WebGPU' },
    { ep: 'wasm', label: 'WASM' },
  ].filter(Boolean);

  for (const { ep, label } of providers) {
    ortSession = await tryProvider(modelPath, { ...baseOpts, executionProviders: [ep] }, label);
    if (ortSession) return;
  }
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
  if (isEdge) return 1.0;
  const t = Math.min(d / ovl, 1.0);
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

// Per-tile boundary clamps + feather weights, written into the caller-owned
// wx / wyArr buffers. Returned ramp boundaries split each axis into three
// regions: [0, rampL) ramps up, [rampL, rampR) is full weight (1.0), and
// [rampR, dim) ramps down. At the image edge there's no neighbour to blend
// with, so that side's ramp collapses (rampL = 0 or rampR = dim).
function tileLayout(tx, ty, w, h, wx, wyArr) {
  const x0 = Math.max(0, tx - OVL);
  const y0 = Math.max(0, ty - OVL);
  const x1 = Math.min(w, tx + TILE + OVL);
  const y1 = Math.min(h, ty + TILE + OVL);
  const tw = x1 - x0, th = y1 - y0;
  const atLeft = x0 === 0, atRight = x1 === w;
  const atTop  = y0 === 0, atBot   = y1 === h;
  for (let x = 0; x < tw; x++)
    wx[x] = featherW(x, atLeft, OVL) * featherW(tw - 1 - x, atRight, OVL);
  for (let y = 0; y < th; y++)
    wyArr[y] = featherW(y, atTop, OVL) * featherW(th - 1 - y, atBot, OVL);
  return {
    x0, y0, x1, y1, tw, th,
    xRampL: atLeft  ? 0  : OVL,
    xRampR: atRight ? tw : tw - OVL,
    yRampL: atTop   ? 0  : OVL,
    yRampR: atBot   ? th : th - OVL,
  };
}

// Builds the padded luma Float32Array for one tile. Even spatial dims required by
// the model; odd-length edges are extended by replicating the last pixel.
// A fresh buffer is allocated per tile because ORT proxy mode transfers
// (detaches) the tensor's ArrayBuffer to the worker. Reads from a precomputed
// full-image luma so overlapping tiles don't recompute Y from RGB.
function buildTileInput(lumaImg, w, h, x0, y0, x1, y1) {
  const tw = x1 - x0, th = y1 - y0;
  const pw = tw + (tw & 1), ph = th + (th & 1);
  const luma = new Float32Array(pw * ph);

  for (let y = 0; y < th; y++) {
    const srcOff = (y0 + y) * w + x0;
    luma.set(lumaImg.subarray(srcOff, srcOff + tw), y * pw);
  }
  if (pw > tw) {
    const padX = Math.min(x1, w - 1);
    for (let y = 0; y < th; y++) {
      luma[y * pw + tw] = lumaImg[(y0 + y) * w + padX];
    }
  }
  if (ph > th) {
    const padY = Math.min(y1, h - 1);
    const srcOff = padY * w + x0;
    luma.set(lumaImg.subarray(srcOff, srcOff + tw), th * pw);
    if (pw > tw) {
      const padX = Math.min(x1, w - 1);
      luma[th * pw + tw] = lumaImg[padY * w + padX];
    }
  }
  return { luma, pw, ph, tw, th };
}

async function runDenoiser(pixels, w, h, gen) {
  if (!ortReady) throw new Error(t('model-not-ready'));

  const inputName  = ortSession.inputNames[0];
  const outputName = ortSession.outputNames[0];

  // Precompute luma once — overlapping tiles cover most pixels 2-4×, and the
  // composite loop also needs origY. One pass here saves ~3 mults + 3 byte
  // loads per pixel in tile prep AND in the final composite.
  const lumaImg = new Float32Array(w * h);
  for (let i = 0, pi = 0; i < lumaImg.length; i++, pi += 4) {
    lumaImg[i] = Y_R_INV255 * pixels[pi] + Y_G_INV255 * pixels[pi + 1] + Y_B_INV255 * pixels[pi + 2];
  }

  // Weighted luma accumulator. accumW (the matching weight sum) is replaced by
  // invW below — feather weights depend only on tile geometry, so we can sum
  // them once up front and skip the per-pixel weight write in the main pass.
  const accumY = new Float32Array(w * h);

  const xs = tileStarts(w, TILE);
  const ys = tileStarts(h, TILE);
  const total = xs.length * ys.length;
  let done = 0;

  // Reused across tiles to avoid per-tile Float32Array allocations.
  const maxDim = TILE + 2 * OVL;
  const wx    = new Float32Array(maxDim);
  const wyArr = new Float32Array(maxDim);

  // ── Pre-pass: sum feather weights into invW, then invert ───────────────
  // Composite multiplies by invW instead of dividing by accumW (much cheaper),
  // and the main pass below skips the per-pixel `accumW += wi` write entirely.
  // Each row is split on the x-axis into ramp / interior / ramp; rows are
  // split on the y-axis the same way, so wherever wx or wy is exactly 1 the
  // multiplication drops out.
  const invW = new Float32Array(w * h);
  let prepDone = 0;
  for (const ty of ys) {
    for (const tx of xs) {
      const { x0, y0, tw, th, xRampL, xRampR, yRampL, yRampR } = tileLayout(tx, ty, w, h, wx, wyArr);
      // Top ramp rows (wy < 1)
      for (let y = 0; y < yRampL; y++) {
        const wy = wyArr[y];
        const dst = (y0 + y) * w + x0;
        for (let x = 0;       x < xRampL; x++) invW[dst + x] += wy * wx[x];
        for (let x = xRampL;  x < xRampR; x++) invW[dst + x] += wy;
        for (let x = xRampR;  x < tw;     x++) invW[dst + x] += wy * wx[x];
      }
      // Interior rows (wy === 1)
      for (let y = yRampL; y < yRampR; y++) {
        const dst = (y0 + y) * w + x0;
        for (let x = 0;       x < xRampL; x++) invW[dst + x] += wx[x];
        for (let x = xRampL;  x < xRampR; x++) invW[dst + x] += 1;
        for (let x = xRampR;  x < tw;     x++) invW[dst + x] += wx[x];
      }
      // Bottom ramp rows (wy < 1)
      for (let y = yRampR; y < th; y++) {
        const wy = wyArr[y];
        const dst = (y0 + y) * w + x0;
        for (let x = 0;       x < xRampL; x++) invW[dst + x] += wy * wx[x];
        for (let x = xRampL;  x < xRampR; x++) invW[dst + x] += wy;
        for (let x = xRampR;  x < tw;     x++) invW[dst + x] += wy * wx[x];
      }
      // Yield occasionally so the pre-pass can't freeze the UI on huge images.
      if ((++prepDone & 7) === 0) {
        await tick();
        if (gen !== _loadGen) return null;
      }
    }
  }
  for (let i = 0; i < invW.length; i++) invW[i] = 1 / invW[i];

  // ── Main pass: model inference + accumulation into accumY ──────────────
  for (const ty of ys) {
    for (const tx of xs) {
      const { x0, y0, x1, y1, tw, th, xRampL, xRampR, yRampL, yRampR } = tileLayout(tx, ty, w, h, wx, wyArr);
      const { luma, pw, ph } = buildTileInput(lumaImg, w, h, x0, y0, x1, y1);
      const feeds = { [inputName]: new ort.Tensor('float32', luma, [1, 1, ph, pw]) };
      const results = await ortSession.run(feeds);
      if (gen !== _loadGen) return null;
      const outData = results[outputName].data;

      // Mirrors the invW pre-pass: drop wx and/or wy multiplications wherever
      // the corresponding feather weight is exactly 1.
      for (let y = 0; y < yRampL; y++) {
        const wy = wyArr[y];
        const dst = (y0 + y) * w + x0;
        const src = y * pw;
        for (let x = 0;      x < xRampL; x++) accumY[dst + x] += wy * wx[x] * outData[src + x];
        for (let x = xRampL; x < xRampR; x++) accumY[dst + x] += wy * outData[src + x];
        for (let x = xRampR; x < tw;     x++) accumY[dst + x] += wy * wx[x] * outData[src + x];
      }
      for (let y = yRampL; y < yRampR; y++) {
        const dst = (y0 + y) * w + x0;
        const src = y * pw;
        for (let x = 0;      x < xRampL; x++) accumY[dst + x] += wx[x] * outData[src + x];
        for (let x = xRampL; x < xRampR; x++) accumY[dst + x] += outData[src + x];
        for (let x = xRampR; x < tw;     x++) accumY[dst + x] += wx[x] * outData[src + x];
      }
      for (let y = yRampR; y < th; y++) {
        const wy = wyArr[y];
        const dst = (y0 + y) * w + x0;
        const src = y * pw;
        for (let x = 0;      x < xRampL; x++) accumY[dst + x] += wy * wx[x] * outData[src + x];
        for (let x = xRampL; x < xRampR; x++) accumY[dst + x] += wy * outData[src + x];
        for (let x = xRampR; x < tw;     x++) accumY[dst + x] += wy * wx[x] * outData[src + x];
      }

      setProgress(Math.round(++done / total * 99));
      // ortSession.run already yields between tiles; the explicit yield is for
      // paint scheduling, so once every few tiles is enough. Always yield on
      // the final tile so the 99% bar paints before the composite pass starts.
      if ((done & 3) === 0 || done === total) {
        await tick();
        if (gen !== _loadGen) return null;
      }
    }
  }

  // Normalise accumulated luma and composite with original chroma in one pass.
  // Adding the luma delta uniformly to each RGB channel is mathematically
  // equivalent to a full BT.709 YCbCr round-trip with original Cb/Cr.
  const outPixels = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) {
    const ditherR = (py & 63) * 64;
    const ditherG = ((py + 19) & 63) * 64;
    const ditherB = ((py + 41) & 63) * 64;
    const rowBase = py * w;
    for (let px = 0; px < w; px++) {
      const i = rowBase + px;
      const pi = i * 4;
      const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2];
      const deltaY255 = (accumY[i] * invW[i] - lumaImg[i]) * 255;
      const dR = blueNoiseF32[ditherR +  (px        & 63)];
      const dG = blueNoiseF32[ditherG + ((px + 17)  & 63)];
      const dB = blueNoiseF32[ditherB + ((px + 37)  & 63)];
      outPixels[pi]     = r + deltaY255 + dR;
      outPixels[pi + 1] = g + deltaY255 + dG;
      outPixels[pi + 2] = b + deltaY255 + dB;
      outPixels[pi + 3] = 255;
    }
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
  const vr = getViewerRect();
  const scaledW = S.inputImg.width  * S.zoom;
  const scaledH = S.inputImg.height * S.zoom;
  viewer.classList.toggle('zoom-mode', scaledW > vr.width || scaledH > vr.height);
}

function applyZoomTransform() {
  invalidateViewerRect();
  invalidateCvAfterRect();
  const wpx = Math.round(S.inputImg.width  * S.zoom) + 'px';
  const hpx = Math.round(S.inputImg.height * S.zoom) + 'px';
  const tx = `translate(calc(-50% + ${S.zoomPanX}px), calc(-50% + ${S.zoomPanY}px))`;
  cvBefore.style.width = wpx; cvBefore.style.height = hpx; cvBefore.style.transform = tx;
  cvAfter.style.width  = wpx; cvAfter.style.height  = hpx; cvAfter.style.transform  = tx;
}

function clampZoomPan() {
  const vr = getViewerRect();
  const scaledW = S.inputImg.width  * S.zoom;
  const scaledH = S.inputImg.height * S.zoom;
  const margin = 40;
  const maxPX = scaledW > vr.width  ? Math.max(0, vr.width  / 2 + scaledW / 2 - margin) : 0;
  const maxPY = scaledH > vr.height ? Math.max(0, vr.height / 2 + scaledH / 2 - margin) : 0;
  S.zoomPanX = Math.max(-maxPX, Math.min(maxPX, S.zoomPanX));
  S.zoomPanY = Math.max(-maxPY, Math.min(maxPY, S.zoomPanY));
}

// At minZoom the image is fit-to-viewer with no usable pan, so snap pan to 0;
// otherwise apply the caller-computed pan and clamp it to the viewer bounds.
function setZoomAndPan(newZoom, panX, panY) {
  if (newZoom <= S.minZoom) {
    S.zoom = S.minZoom;
    S.zoomPanX = 0;
    S.zoomPanY = 0;
  } else {
    S.zoom = newZoom;
    S.zoomPanX = panX;
    S.zoomPanY = panY;
    clampZoomPan();
  }
}

function commitZoomView() {
  updateZoomClass();
  applyZoomTransform();
  requestAnimationFrame(() => applyViewerState());
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
  cvBeforeCtx.putImageData(S.inputImg, 0, 0);
  if (S.denoisedImg) {
    cvAfter.width  = S.denoisedImg.width; cvAfter.height = S.denoisedImg.height;
    cvAfterCtx.putImageData(S.denoisedImg, 0, 0);
  } else {
    cvAfter.width  = S.inputImg.width;  cvAfter.height = S.inputImg.height;
    // cvBefore already has inputImg; applyViewerState will call showOriginal()
    // to fully clip cvAfter, so no paint needed here.
  }
  commitZoomView();
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
  setZoomAndPan(
    newZoom,
    cx - (cx - S.zoomPanX) * newZoom / oldZoom,
    cy - (cy - S.zoomPanY) * newZoom / oldZoom,
  );
  commitZoomView();
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
    clampZoomPan();
    commitZoomView();
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

// Prevent browser-level viewport zoom on multi-touch (belt-and-suspenders for
// Android browsers that ignore user-scalable=no in the viewport meta).
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// iOS Safari ignores user-scalable=no and fires its own gesture* events for
// pinch on the page itself — without preventing them, the page zooms and the
// header / mobile-bar / labels can drift off-screen.
['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
  document.addEventListener(evt, e => e.preventDefault(), { passive: false });
});

// Safety net: never let the layout viewport scroll. body has overflow:hidden,
// but iOS occasionally shifts it (keyboard dismiss, gesture edge swipes), which
// would push fixed UI chrome off-screen.
const _pinScroll = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
window.addEventListener('scroll', _pinScroll, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('scroll', _pinScroll);
}

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
    setZoomAndPan(
      newZoom,
      _pinch.cx0 - (_pinch.cx0 - _pinch.panX0) * newZoom / _pinch.zoom0 + (cx - _pinch.cx0),
      _pinch.cy0 - (_pinch.cy0 - _pinch.panY0) * newZoom / _pinch.zoom0 + (cy - _pinch.cy0),
    );
    commitZoomView();
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
  commitZoomView();
});

// ─── drop zone / viewer toggle ───────────────────────────────────────────────
function showViewer() {
  dropIdle.style.display      = 'none';
  dropSecondary.style.display = 'none';
  viewer.style.display        = 'block';
}
function showDropZone() {
  viewer.style.display        = 'none';
  dropIdle.style.display      = '';
  dropSecondary.style.display = '';
}

// ─── image loading ────────────────────────────────────────────────────────────
function resetZoom() {
  S.zoom = 1; S.minZoom = 1; S.zoomPanX = 0; S.zoomPanY = 0;
  viewer.classList.remove('zoom-mode');
  cvBefore.style.width = ''; cvBefore.style.height = ''; cvBefore.style.transform = '';
  cvAfter.style.width  = ''; cvAfter.style.height  = ''; cvAfter.style.transform  = '';
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
  hideError();
  S.saveName = deriveSaveName(file.name);
  setProgress(2);
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const mp = bmp.width * bmp.height / 1e6;
    if (mp > MAX_MEGAPIXELS) {
      bmp.close();
      setProgress(0);
      showError(t('image-too-large').replace('{0}', mp.toFixed(1)).replace('{1}', MAX_MEGAPIXELS));
      return;
    }
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
    showViewer();
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
  const result = await runDenoiser(imgData.data, imgData.width, imgData.height, gen);
  if (gen !== _loadGen || result === null) return;
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
document.addEventListener('dragover',  e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

// ─── actions ──────────────────────────────────────────────────────────────────
function resetToNative() {
  if (!S.inputImg) return;
  S.zoom = 1; S.zoomPanX = 0; S.zoomPanY = 0;
  commitZoomView();
}

// Use OffscreenCanvas when available: it is not tied to the display rendering
// pipeline, so browsers (notably Firefox on Windows) won't apply the monitor's
// ICC color profile when encoding, which would otherwise shift colors in the
// saved PNG compared to what was uploaded.
async function encodeBlob() {
  let blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(S.denoisedImg.width, S.denoisedImg.height);
    oc.getContext('2d', { colorSpace: 'srgb' }).putImageData(S.denoisedImg, 0, 0);
    blob = await oc.convertToBlob({ type: 'image/png' });
  } else {
    const c = document.createElement('canvas');
    c.width = S.denoisedImg.width; c.height = S.denoisedImg.height;
    c.getContext('2d').putImageData(S.denoisedImg, 0, 0);
    blob = await new Promise(r => c.toBlob(r, 'image/png'));
  }
  return blob;
}

async function saveImage() {
  if (!S.denoisedImg) return;

  // On mobile, use the Web Share API so the OS share sheet appears.
  // iOS shows "Save Image" (→ Photos); Android shows gallery/save options.
  // Must stay in the isMobile branch — desktop share sheets are unexpected there.
  if (isMobile && navigator.canShare) {
    try {
      const blob = await encodeBlob();
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

  const blob = await encodeBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = S.saveName; a.href = url; a.click();
  URL.revokeObjectURL(url);
}

function clearImage() {
  if (!S.inputImg) return;
  _loadGen++;
  S.inputImg = null; S.denoisedImg = null; S.showingBefore = false;
  S.comparing = false; S.pointerDown = false; S.lastCursorX = null; S.cursorInViewer = false;
  resetZoom();
  showDropZone();
  invalidateViewerRect();
  invalidateCvAfterRect();
  canvasArea.classList.remove('viewer-active');
  viewer.classList.remove('reveal-active', 'panning-active');
  setSaveEnabled(false); setNewEnabled(false);
  if (!isMobile) {
    botBar.classList.remove('bot-bar-visible');
  }
  _clearIndeterminate();
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

function _clearIndeterminate() {
  progBar.classList.remove('indeterminate');
  progBar.style.transition = 'none';
  progBar.style.width = '0%';
  void progBar.offsetWidth;
  progBar.style.transition = '';
}
function setProgress(pct) {
  if (progBar.classList.contains('indeterminate')) {
    progBar.style.opacity = '0';  // hide during snap so translateX reset is invisible
    _clearIndeterminate();
    progBar.style.opacity = '1';  // fade in while width grows
  }
  progBar.style.width = pct + '%';
}
function setProgressIndeterminate() {
  progBar.classList.add('indeterminate');
}
// MessageChannel postMessage round-trips faster than setTimeout(0), which the
// HTML spec lets browsers clamp to ~1-4 ms. With many tiles the saved overhead
// adds up to hundreds of ms.
const _yieldPort = (() => {
  const ch = new MessageChannel();
  const queue = [];
  ch.port1.onmessage = () => { const r = queue.shift(); if (r) r(); };
  return r => { queue.push(r); ch.port2.postMessage(0); };
})();
function tick() { return new Promise(_yieldPort); }

// ─── startup ──────────────────────────────────────────────────────────────────
async function warmUp() {
  const side = TILE + 2 * OVL;
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

main();
