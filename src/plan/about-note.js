// about __VE 방 — 짧은 글, 맨 끝에 글쓴이(가운데 · 본문보다 살짝 연하게). 마지막 점 뒤에서 커서만 깜빡인다.
//   글쓴이 줄은 모양에 들지 않는다 — 본문 글자만 모양으로 옮겨 가고, 그동안 글쓴이 줄은 본문과 같이 숨는다.
//   Vibe · Echo 카드 두 장은 /pair 로 옮겼다(about.js).
//   본문의 '집' 은 휴대폰에서 글자를 고른 것처럼(옅은 파랑 · 양끝 손잡이) — 누르면 위에 말풍선(always | together).
//     always   → 글자들이 집 외곽선을 따라 늘어선다(창의 보이는 높이 안에 — 스크롤 없이)
//     together → 두 사람 전신(youth-tone.js)으로 모인다(집과 같은 크기 — 창의 보이는 높이까지)
//   모이는 동안 원래 글은 자리를 지킨 채 숨고, 같은 글자를 위에 띄워(.hsh-ab__fly) 옮긴다 — 글 차례대로 형상의 칸을 위 → 아래, 왼 → 오른으로 채운다.
//   오른쪽 아래 둥근 단추를 누르면 글자들이 제자리로 돌아간다. 모양 속 '집' 을 눌러도 말풍선이 뜬다.
//   글 · 글쓴이는 로딩 home sweet home 과 같은 글꼴 — 한글은 이 저장소 글꼴 파일에 없어서 처음 열 때 Google Fonts 에서
//   같은 글꼴을 다른 이름(HSH Hand KR)으로 불러온다(다른 화면의 한글은 그대로). 못 받으면 Pretendard.

import { YOUTH_TONE } from './youth-tone.js';

// {sel:…} 자리가 고른 글자처럼 보이는 단추
const BODY = '홍지원은 이제 새로운 {sel:집}을 찾았다. 그 집에 같은 나이의 여자애가 살았다. 스물둘이 되어 기어이 알아보았다. 일어나야 하는 일이었다는 듯이. 고로, 바이바이. 하나와 하나로 존재하던 시간과 아주아주 작별한 채, 영원히 둘이 되어서. 외로움과 괴로움과 영원히 이별하여…….';

const CREDIT = '© 담(@ohmyfilmbonita)';

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 한글은 완성된 글자 하나씩(자모로 쪼개지 않는다)
const graphemes = (t) => (typeof Intl !== 'undefined' && Intl.Segmenter
  ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(t)].map((s) => s.segment)
  : Array.from(t));

// 글자마다 감싼다(빈칸은 그대로 — 모양에 들지 않는다). 감싼 span 은 inline 이라 줄바꿈은 원래 글 그대로
const letters = (t) => graphemes(t).map((c) => (/\s/.test(c) ? c : `<span class="hsh-ab__g">${esc(c)}</span>`)).join('');

function paragraph(src) {
  return src.replace(/\{sel:([^}]+)\}|[^{]+/g, (m, word) => {
    if (!word) return letters(m);
    return `<span class="hsh-ab__sel" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-controls="hsh-ab-menu">` +
      `${letters(word)}<i class="hsh-ab__knob" aria-hidden="true"></i><i class="hsh-ab__knob is-end" aria-hidden="true"></i></span>`;
  });
}

const BACK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15M8 9.5h8M8 12.5h8M8 15.5h5"/></svg>';

/** about 방 안쪽 — 글 · 글쓴이 · 말풍선 · 되돌리기 단추 · 옮겨 다니는 글자 칸 */
export function aboutNoteMarkup() {
  return `<div class="hsh-ab__text"><p>${paragraph(BODY)}<span class="hsh-ab__caret" aria-hidden="true"></span></p></div>` +
    `<p class="hsh-ab__credit">${esc(CREDIT)}</p>` +
    `<div class="hsh-ab__fly" aria-hidden="true"></div>` +
    `<div class="hsh-ab__menu" id="hsh-ab-menu" role="menu" hidden>` +
    `<button type="button" role="menuitem" data-shape="always">always</button>` +
    `<button type="button" role="menuitem" data-shape="together">together</button></div>` +
    `<button class="hsh-ab__back" type="button" aria-label="원래 글로 되돌리기" hidden>${BACK_ICON}</button>`;
}

// ---------- 형상 — 단위 좌표에서 안에 드나(가로 x0~x1, 세로 y0~y1) ----------

// 집 — 외곽선 하나(벽 · 처마 나온 삼각 지붕 · 굴뚝). 왼쪽 아래에서 시작해 시계 방향으로 — 글자가 이 선을 따라 같은 간격으로 놓인다
const house = {
  x0: -34, x1: 34, y0: 18, y1: 96,
  outline: [[-26, 96], [-26, 52], [-34, 52], [0, 18], [14, 32], [14, 24], [21, 24], [21, 39], [34, 52], [26, 52], [26, 96]],
};

// 두 사람 — 밝기 지도에서 배경(0)이 아닌 곳
const toneBytes = Uint8Array.from(atob(YOUTH_TONE.data), (c) => c.charCodeAt(0));
const pair = {
  x0: YOUTH_TONE.x0, x1: YOUTH_TONE.x1, y0: YOUTH_TONE.y0, y1: YOUTH_TONE.y1,
  inside(u, v) {
    const t = YOUTH_TONE;
    const x = Math.floor(((u - t.x0) / (t.x1 - t.x0)) * t.w);
    const y = Math.floor(((v - t.y0) / (t.y1 - t.y0)) * t.h);
    if (x < 0 || y < 0 || x >= t.w || y >= t.h) return false;
    const i = y * t.w + x;
    return (i % 2 ? toneBytes[i >> 1] & 15 : toneBytes[i >> 1] >> 4) > 0;
  },
};

const SHAPES = { always: house, together: pair };

const STEP = 2.5; // 윤곽을 찾는 격자(px)

/** 닫힌 외곽선(px 점들)을 첫 꼭짓점부터 한 바퀴 돌며 글자 n 개를 같은 간격으로(글 차례 = 선을 따라가는 차례) */
function alongOutline(pts, n) {
  const segs = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const total = segs.reduce((s, g) => s + g.len, 0);
  const gap = total / n;
  const cells = [];
  let seg = 0;
  let from = 0; // 지금 선분이 시작하는 거리
  for (let i = 0; i < n; i++) {
    const d = i * gap;
    while (seg < segs.length - 1 && d > from + segs[seg].len) { from += segs[seg].len; seg++; }
    const { a, b, len } = segs[seg];
    const t = len ? (d - from) / len : 0;
    cells.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return { cells, gap };
}

/**
 * 형상을 box 안에 맞춰 놓고, 그 윤곽(바깥 테두리 · 문 · 창 같은 구멍의 테두리)을 따라 글자 n 개를 고른 간격으로 놓는다 —
 *   글자 수가 적어서 속을 채우면 뭉개지지만, 선으로 그리면 또렷하다.
 * @returns {{ cells: {x:number, y:number}[], gap: number }}  글자 가운데(px, box 와 같은 좌표계) · 글자 사이
 */
function cellsFor(shape, box, n) {
  const k = Math.min(box.w / (shape.x1 - shape.x0), box.h / (shape.y1 - shape.y0)) * 0.94;
  const W = (shape.x1 - shape.x0) * k;
  const H = (shape.y1 - shape.y0) * k;
  const left = box.x + (box.w - W) / 2;
  const top = box.y + (box.h - H) / 2;
  if (shape.outline) return alongOutline(shape.outline.map(([u, v]) => ({ x: left + (u - shape.x0) * k, y: top + (v - shape.y0) * k })), n);
  // 윤곽 — 안쪽 점 가운데 위아래 · 양옆 중 하나라도 바깥인 점(위 → 아래, 왼 → 오른 차례)
  const cols = Math.ceil(W / STEP) + 2;
  const rows = Math.ceil(H / STEP) + 2;
  const at = (c, r) => shape.inside(shape.x0 + ((c - 1) * STEP) / k, shape.y0 + ((r - 1) * STEP) / k);
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mask[r * cols + c] = at(c, r) ? 1 : 0;
  const edge = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (mask[i] && (!mask[i - 1] || !mask[i + 1] || !mask[i - cols] || !mask[i + cols])) edge.push({ x: left + (c - 1) * STEP, y: top + (r - 1) * STEP });
    }
  }
  // 서로 gap 보다 가까운 점은 버린다 — n 개 이상 남는 가장 넓은 gap
  const spread = (gap) => {
    const cell = new Map();
    const key = (x, y) => `${Math.floor(x / gap)},${Math.floor(y / gap)}`;
    const out = [];
    for (const p of edge) {
      const gx = Math.floor(p.x / gap);
      const gy = Math.floor(p.y / gap);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1 && !near; dx++) {
          for (const q of cell.get(`${gx + dx},${gy + dy}`) || []) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < gap * gap) { near = true; break; }
        }
      }
      if (near) continue;
      out.push(p);
      const kk = key(p.x, p.y);
      (cell.get(kk) || cell.set(kk, []).get(kk)).push(p);
    }
    return out;
  };
  let lo = STEP;
  let hi = Math.max(W, H) / 2;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (spread(mid).length >= n) lo = mid;
    else hi = mid;
  }
  let cells = spread(lo);
  const extra = cells.length - n;
  if (extra > 0) cells = cells.filter((_, i) => Math.floor(((i + 1) * extra) / (n + extra)) === Math.floor((i * extra) / (n + extra)));
  return { cells, gap: lo };
}

const MOVE = { dur: 950, stagger: 380, jitter: 140 }; // 글자 하나가 옮겨 가는 시간 · 차례가 벌어지는 폭 · 흔들림(ms)

/**
 * about 방이 열려 있는 동안 — '집' 말풍선 · 모양 바꾸기. 방을 닫으면 close() 로 원래 글로 되돌리고 정리.
 * @param {HTMLElement} root  .hsh-ab
 * @param {{ reduced?: boolean, scroller?: HTMLElement, onLayout?: () => void }} opts
 *   scroller — 글이 들어 있는 스크롤 칸(말풍선 · 집이 보이는 높이), onLayout — 모양이 바뀌어 넘침이 달라졌을 때(창이 스크롤바를 다시 잰다)
 */
export function openAboutNote(root, { reduced = false, scroller = null, onLayout = () => {} } = {}) {
  const text = root.querySelector('.hsh-ab__text');
  const sel = root.querySelector('.hsh-ab__sel');
  const fly = root.querySelector('.hsh-ab__fly');
  const menu = root.querySelector('.hsh-ab__menu');
  const back = root.querySelector('.hsh-ab__back');
  const glyphs = [...root.querySelectorAll('.hsh-ab__g')];
  const selGlyphs = new Set(sel.querySelectorAll('.hsh-ab__g'));

  let shape = null; // 지금 모양(always · together), 원래 글이면 null
  let flies = []; // 띄운 글자 — glyphs 와 같은 차례
  let homeTimer = 0;

  // ---------- 띄운 글자 ----------

  // 원래 글자 자리(root 기준)
  const measure = () => {
    const base = root.getBoundingClientRect();
    return glyphs.map((g) => {
      const r = g.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
  };
  // 글이 차지한 칸 — 모양은 이 안에
  const area = () => {
    const base = root.getBoundingClientRect();
    const a = text.getBoundingClientRect();
    return { x: a.left - base.left, y: a.top - base.top, w: a.width, h: a.height };
  };
  // 스크롤 칸을 맨 위에 두었을 때 글 첫 줄부터 창 바닥까지 보이는 높이
  const visible = () => {
    if (!scroller) return Infinity;
    const top = text.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    return scroller.clientHeight - top - 12;
  };

  const spawn = () => {
    const homes = measure();
    flies = glyphs.map((g, i) => {
      const cs = getComputedStyle(g);
      const el = document.createElement('span');
      el.className = `hsh-ab__f${selGlyphs.has(g) ? ' is-sel' : ''}`;
      el.textContent = g.textContent;
      Object.assign(el.style, { fontSize: cs.fontSize, color: cs.color, lineHeight: `${homes[i].h}px` });
      el.style.setProperty('--delay', `${Math.round((i / glyphs.length) * MOVE.stagger + Math.random() * MOVE.jitter)}ms`);
      fly.append(el);
      return { el, home: homes[i] };
    });
    place(homes);
    root.classList.add('is-shaped');
  };
  // 원래 자리에 놓는다(transform 은 그대로 — 모양 자리는 transform 으로)
  const place = (homes) => flies.forEach((f, i) => {
    f.home = homes[i];
    Object.assign(f.el.style, { left: `${f.home.x}px`, top: `${f.home.y}px`, width: `${f.home.w}px`, height: `${f.home.h}px` });
  });
  // 모양 자리로 — 글 차례대로 칸을 채운다
  const target = () => {
    const box = area();
    const sh = SHAPES[shape];
    // 집 · 두 사람 모두 글 칸보다 크게 — 너비에 맞춘 높이까지, 다만 창의 보이는 높이를 넘지 않게(스크롤 없이 한눈에). 글자가 커지게
    box.h = Math.max(box.h, Math.min((box.w / (sh.x1 - sh.x0)) * (sh.y1 - sh.y0), visible()));
    const { cells, gap } = cellsFor(sh, box, flies.length);
    flies.forEach((f, i) => {
      const c = cells[i] || cells[cells.length - 1];
      const dx = c.x - (f.home.x + f.home.w / 2);
      const dy = c.y - (f.home.y + f.home.h / 2);
      const s = Math.min(1, (gap * 1.05) / Math.max(f.home.w, f.home.h * 0.8));
      f.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})`;
    });
    // 되돌리기 단추 — 모양 칸 오른쪽 아래 모서리 안
    back.style.left = `${box.x + box.w - 40}px`;
    back.style.top = `${box.y + box.h - 40}px`;
  };
  // 띄운 글자를 다 지우고 원래 글로
  const settle = () => {
    clearTimeout(homeTimer);
    homeTimer = 0;
    fly.replaceChildren();
    flies = [];
    root.classList.remove('is-shaped', 'is-moving');
    onLayout();
  };
  const maxMove = MOVE.dur + MOVE.stagger + MOVE.jitter;

  const become = (name) => {
    closeMenu();
    if (name === shape) return;
    clearTimeout(homeTimer);
    homeTimer = 0;
    if (!flies.length) {
      spawn();
      fly.getBoundingClientRect(); // 원래 자리를 먼저 그려 두고 옮긴다(transition 이 걸리게)
    }
    shape = name;
    root.dataset.shape = name;
    root.classList.toggle('is-moving', !reduced);
    scroller?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); // 모양은 맨 위에서 한눈에
    target();
    back.hidden = false;
    onLayout();
    homeTimer = setTimeout(() => { homeTimer = 0; onLayout(); }, reduced ? 0 : maxMove + 60);
  };
  const goHome = () => {
    closeMenu();
    if (!shape) return;
    shape = null;
    delete root.dataset.shape;
    back.hidden = true;
    if (reduced) { settle(); return; }
    root.classList.add('is-moving');
    flies.forEach((f) => { f.el.style.transform = ''; });
    homeTimer = setTimeout(settle, maxMove + 60);
    sel.focus({ preventScroll: true });
  };

  // 칸 크기가 바뀌면 — 원래 자리를 다시 재고 모양도 새 칸에 맞춰 바로(옮기는 중이 아니면 transition 없이)
  const ro = new ResizeObserver(() => {
    if (!flies.length) return;
    root.classList.remove('is-moving');
    place(measure());
    if (shape) target();
  });
  ro.observe(root);

  // ---------- 말풍선 ----------

  // 말풍선은 열 때 창 틀(.hsh-win__frame)로 옮겨 붙인다 — 첫 줄의 '집' 위로도(스크롤 칸 밖, 제목 쪽에) 뜨게. 닫으면 제자리로
  const layer = root.closest('.hsh-win__frame') || root;
  let anchor = null;
  const openMenu = (from) => {
    anchor = from;
    layer.append(menu);
    menu.hidden = false;
    sel.setAttribute('aria-expanded', 'true');
    const base = layer.getBoundingClientRect();
    const r = from.getBoundingClientRect();
    const mid = r.left + r.width / 2 - base.left;
    const w = menu.offsetWidth;
    const left = Math.max(6, Math.min(layer.clientWidth - w - 6, mid - w / 2));
    // 위에 — 창 위로 넘치면 아래에
    const below = r.top - menu.offsetHeight - 12 < Math.max(0, base.top);
    menu.classList.toggle('is-below', below);
    menu.style.left = `${left}px`;
    menu.style.top = `${below ? r.bottom - base.top + 12 : r.top - base.top - menu.offsetHeight - 12}px`;
    menu.style.setProperty('--arrow', `${mid - left}px`);
  };
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    root.append(menu);
    sel.setAttribute('aria-expanded', 'false');
    anchor = null;
  }

  const onClick = (e) => {
    const item = e.target.closest('.hsh-ab__menu [data-shape]');
    if (item) { become(item.dataset.shape); return; }
    if (e.target.closest('.hsh-ab__back')) { goHome(); return; }
    const from = e.target.closest('.hsh-ab__sel, .hsh-ab__f.is-sel');
    if (from) {
      if (anchor) closeMenu();
      else openMenu(from.classList.contains('is-sel') ? from : sel);
      return;
    }
    if (!e.target.closest('.hsh-ab__menu')) closeMenu();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      e.stopPropagation(); // 창은 닫지 않고 말풍선만
      closeMenu();
      sel.focus();
      return;
    }
    if (e.target === sel && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); // Space 로 칸이 스크롤되지 않게
      if (e.repeat) return;
      if (anchor) closeMenu();
      else {
        openMenu(sel);
        menu.querySelector('[data-shape]').focus();
      }
      return;
    }
    // 말풍선 안 — 왼쪽 · 오른쪽 화살표로 옮겨 다닌다
    const item = e.target.closest('.hsh-ab__menu [data-shape]');
    if (item && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const items = [...menu.querySelectorAll('[data-shape]')];
      items[(items.indexOf(item) + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length].focus();
    }
  };
  // 바깥을 누르거나 글을 스크롤하면 말풍선만 닫힌다
  const onOutside = (e) => { if (!root.contains(e.target) && !menu.contains(e.target)) closeMenu(); };
  const onScroll = () => closeMenu();
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  menu.addEventListener('click', onClick);
  menu.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside);
  scroller?.addEventListener('scroll', onScroll, { passive: true });

  return {
    close() {
      ro.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      menu.removeEventListener('click', onClick);
      menu.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      scroller?.removeEventListener('scroll', onScroll);
      closeMenu();
      // 다시 열면 원래 글부터
      shape = null;
      delete root.dataset.shape;
      back.hidden = true;
      settle();
    },
  };
}

let fontAsked = false;

/** 글 · 글쓴이 한글 글꼴 — 처음 한 번, Google Fonts 의 Nanum Gothic Coding 을 HSH Hand KR 이름으로(실패하면 조용히) */
export function loadAboutFont() {
  if (fontAsked) return;
  fontAsked = true;
  fetch('https://fonts.googleapis.com/css2?family=Nanum+Gothic+Coding&display=swap')
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`fonts ${res.status}`))))
    .then((css) => {
      const style = document.createElement('style');
      style.textContent = css.replace(/font-family:\s*'Nanum Gothic Coding'/g, "font-family: 'HSH Hand KR'");
      document.head.append(style);
    })
    .catch(() => { fontAsked = false; });
}
