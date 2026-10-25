// 평면도 — 불러오기 · 등장(선 그리기 → 색 뽀잉 → 스티커) · 기울기 · 위글 · 방 스티커 버튼
//   선 · 색 · 스티커는 레이어가 나뉘어 있다(.hsh-plan__lines / __color / __stickers, tools/floorplan.mjs).
//   방 버튼을 누르면 hsh:room 이벤트(detail.room = 'v' | 'kitchen' | 'living' | 'entry' | 'e', 버튼 이름 · 색)가 올라가고
//   room-window.js 가 그 방 창을 띄운다.

import { enableTilt } from './tilt.js';
import { mountClock } from './clock.js';
import { enableRoomWindow } from './room-window.js';

const SVG_URL = new URL('./floorplan.svg', import.meta.url);

// 등장 시간표(ms) — 전체 약 2.6초, 한 번만
const LINE_SPAN = 1000; // 마지막 획이 시작하는 때
const LINE_MIN = 170; // 획 하나 길이(짧은 획)
const LINE_MAX = 560; // 획 하나 길이(벽처럼 긴 획)
const COLOR_GAP_ROOM = 210; // 방마다 색이 시작하는 간격 — 뿅 · 뿅 · 뿅
const POP_MS = 460;
const ROOM_ORDER = ['v', 'kitchen', 'bath', 'living', 'entry', 'e'];
const STICKER_GAP = 90; // 스티커가 하나씩 붙는 간격
const STICKER_MS = 420;
const ICON_MS = 1400; // 하단 안내 괄호 속 버튼 이름이 바뀌는 간격
const DRAG_SLOP = 6; // tilt.js 와 같다 — 이보다 많이 끌었으면 누름이 아니다

/** SVG 를 받아 둔다(로딩 화면이 떠 있는 동안). */
export function loadPlan() {
  return fetch(SVG_URL).then((r) => {
    if (!r.ok) throw new Error(`floorplan ${r.status}`);
    return r.text();
  });
}

/**
 * @param {HTMLElement} el      .hsh-plan
 * @param {string} svgText      floorplan.svg
 * @param {{ reduced?: boolean }} opts
 * @returns {{ done: Promise<void>, replay: () => Promise<void> }}
 */
export function mountPlan(el, svgText, { reduced = false } = {}) {
  const card = el.querySelector('.hsh-plan__card');
  card.innerHTML = svgText;
  el.hidden = false;
  fitTags(el);
  halftoneColors(el);

  mountClock(el.querySelector('.hsh-clock')); // 판 밖 화면 고정 — 기울여도 그대로
  enableStickers(el);
  enableRoomWindow(el.parentElement, el, { reduced });
  const hint = setupHint(el);
  fitAroundClock(el);
  thinStars(el);
  let resizing = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => { fitAroundClock(el); thinStars(el); }, 200);
  });
  if (!reduced) {
    enableTilt(el, card);
    startWobble(el, hint);
    cycleHintIcon(el, hint);
  }

  const replay = () => reveal(el, { reduced });
  return { done: replay(), replay };
}

// 위글 — 로딩 화면처럼 4프레임을 190ms 마다(필터 없음). 다 그려진 뒤(.is-done)에만, 그리는 동안은 0프레임.
//   · 벽: 4장 중 한 장만(data-wall-frame)
//   · 스티커: 몸통마다 살짝 기울고 들썩임
//   · 하단 안내: 글자마다 살짝 기울고 들썩임
const FRAMES = 4;
const FRAME_MS = 190;

// 조각 i, 프레임 k 마다 고정된 작은 값(-1..1) — loader/wobble.js 와 같은 식
function jitter(i, k, salt) {
  const s = Math.sin(i * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function startWobble(el, hint) {
  const bodies = [...el.querySelectorAll('.hsh-sticker__body')];
  let k = 0;
  setInterval(() => {
    const on = el.classList.contains('is-done');
    k = on ? (k + 1) % FRAMES : 0;
    el.dataset.wallFrame = k;
    if (!on) return;
    bodies.forEach((b, i) => {
      b.style.transform = `translate(${(jitter(i, k, 1) * 0.8).toFixed(2)}px, ${(jitter(i, k, 2) * 0.8).toFixed(2)}px) rotate(${(jitter(i, k, 3) * 2).toFixed(1)}deg)`;
    });
    hint.chars.forEach((c, i) => {
      c.style.transform = `translateY(${(jitter(i, k, 4) * 0.7).toFixed(2)}px) rotate(${(jitter(i, k, 5) * 5).toFixed(1)}deg)`;
    });
  }, FRAME_MS);
}

// ---------- 색칠 질감 — 망점 + 번짐 ----------
//   색 조각마다 45° 기운 점 무늬로 채우고, 같은 색 테두리를 굵기 · 투명도를 달리해 몇 겹 아래에 깔아
//   가장자리가 부옇게 번진 것처럼 보이게 한다. 흐림 필터는 쓰지 않는다(iOS Safari 에서 검게 깜빡임).
//   바탕색 가리개(.hsh-mask)와 스티커는 그대로.

const DOT_GAP = 6; // 점 간격(평면도 단위)
const DOT_R = 2.2;
const HALO = [[11, 0.1], [7, 0.16], [3.5, 0.24]]; // [테두리 굵기, 투명도] — 바깥부터

function halftoneColors(el) {
  const svg = el.querySelector('.hsh-plan__svg');
  if (!svg) return;
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.prepend(defs);
  const made = new Map();
  const patternFor = (color) => {
    if (made.has(color)) return made.get(color);
    const id = `hsh-dots-${made.size}`;
    const pt = document.createElementNS(SVG_NS, 'pattern');
    pt.id = id;
    pt.setAttribute('width', DOT_GAP);
    pt.setAttribute('height', DOT_GAP);
    pt.setAttribute('patternUnits', 'userSpaceOnUse');
    pt.setAttribute('patternTransform', 'rotate(45)');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', DOT_GAP / 2);
    dot.setAttribute('cy', DOT_GAP / 2);
    dot.setAttribute('r', DOT_R);
    dot.setAttribute('fill', color);
    pt.append(dot);
    defs.append(pt);
    made.set(color, id);
    return id;
  };
  svg.querySelectorAll('.hsh-plan__color path[fill]').forEach((path) => {
    const color = path.getAttribute('fill');
    if (!color || color === 'none' || color.startsWith('url(')) return;
    for (const [w, o] of HALO) {
      const halo = path.cloneNode();
      halo.removeAttribute('class');
      halo.setAttribute('fill', color);
      halo.setAttribute('fill-opacity', '0.18');
      halo.setAttribute('stroke', color);
      halo.setAttribute('stroke-width', w);
      halo.setAttribute('stroke-opacity', o);
      halo.setAttribute('stroke-linejoin', 'round');
      path.before(halo);
    }
    path.setAttribute('fill', `url(#${patternFor(color)})`);
  });
}

// ---------- 시계 자리 ----------
//   집 오른쪽 위(주방 위 · 지원 방 오른쪽)는 비어 있어 시계가 들어갈 수 있다. 시계가 집이 차지한 곳과 겹치면
//   겹치지 않을 때까지 조금씩 비운다(--hsh-clock-room). 평면도는 시계 없을 때 크기에 되도록 가깝게.

// 집이 차지한 곳(평면도 viewBox 좌표) — 지원 방 · 욕실 · 현관 열(x < FREE_X) 과 주방 위 벽 아래(y > FREE_Y)
const FREE_X = 514;
const FREE_Y = 254;
const ROOM_STEP = 6;

function fitAroundClock(el) {
  const clock = el.querySelector('.hsh-clock');
  const house = el.querySelector('.hsh-plan__svg > g');
  if (!clock || !house) return;
  const box = house.getBBox();
  const hits = () => {
    const ctm = house.getScreenCTM();
    if (!ctm) return false;
    const inv = ctm.inverse();
    const r = clock.getBoundingClientRect();
    // 시계 네 모서리 + 가장자리 가운데를 집 좌표로
    const pts = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom],
      [(r.left + r.right) / 2, r.bottom], [r.left, (r.top + r.bottom) / 2]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(inv));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const l = Math.min(...xs) - 8;
    const rr = Math.max(...xs) + 8;
    const t = Math.min(...ys) - 8;
    const b = Math.max(...ys) + 8;
    const inHouse = rr > box.x && l < box.x + box.width && b > box.y && t < box.y + box.height;
    return inHouse && (l < FREE_X || b > FREE_Y);
  };
  let room = 0;
  el.style.setProperty('--hsh-clock-room', '0px');
  const max = clock.getBoundingClientRect().width + 24;
  while (hits() && room < max) {
    room += ROOM_STEP;
    el.style.setProperty('--hsh-clock-room', `${room}px`);
  }
}

// ---------- 바깥 여백 별 ----------
//   집 · 시계 · 하단 안내와 겹치거나 가까운 별은 지우고, 남은 여백 별도 몇 개만(약 25%) 옅게 남긴다.

const STAR_KEEP = 0.25;
const STAR_CLEAR = 14; // 집 · 시계 · 안내 둘레로 이만큼은 비운다(px)

function thinStars(el) {
  const grow = (r) => ({ l: r.left - STAR_CLEAR, t: r.top - STAR_CLEAR, r: r.right + STAR_CLEAR, b: r.bottom + STAR_CLEAR });
  const keepOut = ['.hsh-plan__svg > g', '.hsh-clock', '.hsh-plan__hint']
    .map((q) => el.querySelector(q))
    .filter(Boolean)
    .map((n) => grow(n.getBoundingClientRect()));
  el.querySelectorAll('.hsh-plan__stars use').forEach((u, i) => {
    const r = u.getBoundingClientRect();
    const hit = keepOut.some((k) => r.right > k.l && r.left < k.r && r.bottom > k.t && r.top < k.b);
    const keep = !hit && (jitter(i, 0, 9) + 1) / 2 < STAR_KEEP;
    u.classList.toggle('is-away', !keep);
    u.classList.toggle('is-faint', keep);
  });
}

// ---------- 방 스티커 버튼 ----------
//   기울이기(tilt.js)가 포인터를 붙잡아 click 대상이 판 전체가 될 수 있어서, 누른 곳은 pointerdown 에서 기억한다.

function enableStickers(el) {
  let pressed = null;
  let x0 = 0;
  let y0 = 0;
  let moved = false;

  const pick = (e) => e.target.closest?.('.hsh-sticker') ?? null;
  const release = () => pressed?.classList.remove('is-pressed');

  el.addEventListener('pointerdown', (e) => {
    pressed = pick(e);
    pressed?.classList.add('is-pressed');
    x0 = e.clientX;
    y0 = e.clientY;
    moved = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (pressed && Math.hypot(e.clientX - x0, e.clientY - y0) > DRAG_SLOP) { moved = true; release(); }
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, release);
  el.addEventListener('click', (e) => {
    const s = pressed ?? pick(e);
    pressed = null;
    if (s && !moved) activate(s);
  });
  el.addEventListener('keydown', (e) => {
    const s = pick(e);
    if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(s); }
  });
}

function activate(s) {
  s.querySelector('.hsh-sticker__body').animate(
    [{ scale: '0.9' }, { scale: '1.12', offset: 0.5 }, { scale: '1' }],
    { duration: 300, easing: 'ease-out' },
  );
  const { room, label, bg, fg } = s.dataset;
  const name = s.getAttribute('aria-label');
  s.dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room, label, name, bg, fg } }));
}

// 방 버튼 네모 폭을 글자에 맞춘다(글꼴마다 글자 폭이 달라서 화면에서 잰다)
const TAG_PAD_X = 17; // tools/floorplan.mjs 의 TAG.padX 와 같다

function fitTags(el) {
  el.querySelectorAll('.hsh-tag').forEach((g) => {
    const text = g.querySelector('.hsh-tag__text');
    const bg = g.querySelector('.hsh-tag__bg');
    const w = text.getComputedTextLength() + TAG_PAD_X * 2;
    if (!(w > TAG_PAD_X * 2)) return;
    bg.setAttribute('x', (-w / 2).toFixed(1));
    bg.setAttribute('width', w.toFixed(1));
  });
}

// ---------- 하단 안내 — click the ( ) ----------
//   글자는 하나씩 span 으로(위글), 괄호 속에는 평면도 버튼을 작게 줄인 색 네모가 이름을 바꿔 가며 들어간다.

function setupHint(el) {
  const p = el.querySelector('.hsh-plan__hint');
  const chip = p.querySelector('.hsh-plan__hint-chip');
  for (const node of [...p.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      const span = document.createElement('span');
      span.className = 'hsh-plan__hint-char';
      span.textContent = ch;
      frag.append(span);
    }
    node.replaceWith(frag);
  }
  const tags = [...el.querySelectorAll('.hsh-tag')].map((g) => g.dataset);
  const hint = { chars: [...p.querySelectorAll('.hsh-plan__hint-char')], chip, tags, i: 0 };
  showHintIcon(hint);
  return hint;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function showHintIcon(hint) {
  const t = hint.tags[hint.i % hint.tags.length];
  if (!t) return;
  hint.chip.textContent = t.label;
  hint.chip.style.backgroundColor = t.bg;
  hint.chip.style.color = t.fg;
}

function cycleHintIcon(el, hint) {
  setInterval(() => {
    if (!el.classList.contains('is-done')) return;
    hint.i++;
    showHintIcon(hint);
  }, ICON_MS);
}

let running = [];

function reveal(el, { reduced }) {
  running.forEach((a) => a.cancel());
  running = [];
  el.classList.remove('is-playing', 'is-done');

  if (reduced) {
    el.classList.add('is-done'); // 완성 화면 바로
    el.dispatchEvent(new CustomEvent('hsh:plan-shown', { bubbles: true }));
    return Promise.resolve();
  }

  const strokes = [...el.querySelectorAll('.hsh-plan__lines [data-stroke]')];
  // 색은 방 하나(바닥색 + 가구 색)가 한 덩어리로 튄다
  const rooms = [...el.querySelectorAll('.hsh-plan__color > [data-room]')]
    .sort((a, b) => ROOM_ORDER.indexOf(a.dataset.room) - ROOM_ORDER.indexOf(b.dataset.room));
  const stickers = [...el.querySelectorAll('.hsh-sticker')]
    .sort((a, b) => ROOM_ORDER.indexOf(a.dataset.room) - ROOM_ORDER.indexOf(b.dataset.room));

  // ① 선 — 획마다 대시를 길이만큼 밀어 두었다가 펜처럼 당긴다. 앞 획이 끝나기 전에 다음 획이 시작한다.
  const last = Math.max(1, strokes.length - 1);
  let lineEnd = 0;
  strokes.forEach((s, i) => {
    const len = s.getTotalLength() + 2;
    const delay = Math.round((i / last) ** 0.9 * LINE_SPAN);
    const dur = Math.round(Math.min(LINE_MAX, Math.max(LINE_MIN, 130 + len * 0.22)));
    lineEnd = Math.max(lineEnd, delay + dur);
    s.style.strokeDasharray = `${len} ${len}`;
    running.push(s.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: dur, delay, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'backwards' },
    ));
  });

  // ② 색 — 선이 다 그려진 뒤, 방 순서대로 한 방씩 뽀잉(0.82 → 1.05 → 1)
  const colorStart = lineEnd - 60;
  rooms.forEach((g, i) => {
    const delay = colorStart + i * COLOR_GAP_ROOM;
    running.push(g.animate(
      [
        { opacity: 0, transform: 'scale(0.82)' },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.55 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: POP_MS, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' },
    ));
  });

  // ③ 스티커 — 색이 다 튄 뒤 한 장씩 톡 붙는다
  const stickerStart = colorStart + (rooms.length - 1) * COLOR_GAP_ROOM + POP_MS * 0.6;
  stickers.forEach((s, i) => {
    running.push(s.querySelector('.hsh-sticker__body').animate(
      [
        { opacity: 0, transform: 'scale(0.5) rotate(-12deg)' },
        { opacity: 1, transform: 'scale(1.12) rotate(3deg)', offset: 0.6 },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: STICKER_MS, delay: Math.round(stickerStart + i * STICKER_GAP), easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' },
    ));
  });

  el.classList.add('is-playing'); // 대시·opacity 가 'backwards' 로 잡혀 있으니 바로 보여도 빈 화면
  el.dispatchEvent(new CustomEvent('hsh:plan-shown', { bubbles: true }));

  const anims = running;
  return Promise.all(anims.map((a) => a.finished)).then(() => {
    strokes.forEach((s) => { s.style.strokeDasharray = ''; });
    el.classList.replace('is-playing', 'is-done');
    el.dispatchEvent(new CustomEvent('hsh:plan-done', { bubbles: true }));
  }, () => { /* 다시 재생으로 취소됨 */ });
}
