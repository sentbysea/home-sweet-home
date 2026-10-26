// 평면도 — 불러오기 · 등장(선 그리기 → 색 뽀잉 → 스티커) · 기울기 · 위글 · 방 스티커 버튼
//   선 · 색 · 스티커는 레이어가 나뉘어 있다(.hsh-plan__lines / __color / __stickers, tools/floorplan.mjs).
//   방 버튼을 누르면 hsh:room 이벤트(detail.room = 'v' | 'kitchen' | 'living' | 'entry' | 'e', 버튼 이름 · 색)가 올라가고
//   room-window.js 가 그 방 창을 띄운다. 버튼에 data-category 가 있으면 detail.category · look 도 실린다.

import { enableTilt } from './tilt.js';
import { mountClock } from './clock.js';
import { mountBubbles } from './bubbles.js';
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
const ICON_MS = 1400; // 하단 안내 괄호 속 물건 아이콘이 바뀌는 간격
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
  mountBubbles(el, el.querySelector('.hsh-clock'), { reduced }); // 시계 단어 → 디데이 · 말풍선
  enableStickers(el);
  const rooms = enableRoomWindow(el.parentElement, el, { reduced });
  rooms.routeFromLocation(); // 주소(/notice · /post/13 …)의 창 — 직접 들어오기 · 새로고침 · 로그인에서 돌아오기
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
    hint.icon.style.transform = `translateY(${(jitter(99, k, 4) * 0.7).toFixed(2)}px) rotate(${(jitter(99, k, 5) * 6).toFixed(1)}deg)`;
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
//   집(방 모양 그대로) · 시계 · 하단 안내와 겹치거나 가까운 별은 지우고, 남은 여백 별은 듬성듬성(약 절반) 옅게 남긴다.
//   집은 큰 네모가 아니라 방 덩어리 네 개로 본다 — 주방 위 · 주방 오른쪽 · 현관 아래 같은 빈 귀퉁이에도 별이 남게.

const STAR_KEEP = 0.5;
const STAR_CLEAR = 14; // 시계 · 안내 둘레로 이만큼은 비운다(px)
const HOUSE_CLEAR = 22; // 집 둘레로 이만큼은 비운다(평면도 단위)
// 방 덩어리(평면도 viewBox 좌표, tools/floorplan.mjs 의 벽 좌표)
const HOUSE_RECTS = [
  [84, 118, 509, 973], // 지원 방 · 욕실 · 거실 왼쪽
  [509, 262, 885, 962], // 주방 · 거실
  [536, 930, 969, 1413], // 우연 방
  [164, 962, 536, 1357], // 현관
];

function thinStars(el) {
  const grow = (r) => ({ l: r.left - STAR_CLEAR, t: r.top - STAR_CLEAR, r: r.right + STAR_CLEAR, b: r.bottom + STAR_CLEAR });
  const keepOut = ['.hsh-clock', '.hsh-plan__hint']
    .map((q) => el.querySelector(q))
    .filter(Boolean)
    .map((n) => grow(n.getBoundingClientRect()));
  const house = el.querySelector('.hsh-plan__svg > g');
  const inv = house?.getScreenCTM()?.inverse();
  const inHouse = (x, y) => {
    if (!inv) return false;
    const p = new DOMPoint(x, y).matrixTransform(inv);
    return HOUSE_RECTS.some(([l, t, r, b]) =>
      p.x > l - HOUSE_CLEAR && p.x < r + HOUSE_CLEAR && p.y > t - HOUSE_CLEAR && p.y < b + HOUSE_CLEAR);
  };
  el.querySelectorAll('.hsh-plan__stars use').forEach((u, i) => {
    const r = u.getBoundingClientRect();
    const hit = keepOut.some((k) => r.right > k.l && r.left < k.r && r.bottom > k.t && r.top < k.b)
      || inHouse((r.left + r.right) / 2, (r.top + r.bottom) / 2);
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
  // data-category(+ data-look)가 있는 버튼은 hongjiwon.love 그 카테고리의 글 · 갤러리 · 메모 창을 연다(room-window.js)
  const { room, label, bg, fg, category, look } = s.dataset;
  const name = s.getAttribute('aria-label');
  s.dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room, label, name, bg, fg, category, look } }));
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
//   글자는 하나씩 span 으로(위글), 괄호 속에는 나중에 누를 수 있게 될 물건 아이콘이 돌아가며 들어간다.
//   아이콘 칸은 폭이 고정이라 글자는 움직이지 않는다.
//   그림은 평면도(tools/floorplan.mjs)에 그린 물건을 그대로 — 가운데로 옮겨 -13..13 칸에 비슷한 크기로 줄였다.
//   class o = 윤곽(평면도 선), d = 안쪽 묘사(평면도 hsh-fine 처럼 연하게). 베이스만 눌림을 풀고 넥을 줄였다.

const HINT_ICONS = [
  // 지원 방 책상 위 태블릿(-11° 기울임)
  `<g transform="rotate(-11) scale(0.42)">
     <rect class="o" x="-26" y="-20" width="52" height="40" rx="4" fill="#7e8085"/>
     <path d="M-3 -7L5 5L-11 5Z" fill="#f4f4f4"/>
   </g>`,
  // 부엌 가스레인지 — 검은 상판 + 화구 둘
  `<g transform="scale(0.36)">
     <rect class="o" x="-31.5" y="-19" width="63" height="38" rx="4" fill="#7e8085"/>
     <circle cx="-14.5" cy="0" r="9.5" fill="none" stroke="#c6c7cb" stroke-width="3"/>
     <circle cx="13.5" cy="0" r="9.5" fill="none" stroke="#c6c7cb" stroke-width="3"/>
   </g>`,
  // 현관 선반 위 사진 액자 — 나무 테 · 흰 여백 · 산과 해(-6°)
  `<g transform="rotate(-6) scale(0.36)">
     <rect class="o" x="-32" y="-24" width="64" height="48" rx="3" fill="#d9b27a"/>
     <rect class="d" x="-26" y="-18" width="52" height="36" rx="1" fill="#fff"/>
     <rect x="-22" y="-14" width="44" height="28" rx="1" fill="#d3e3f3"/>
     <path d="M-22 14L-22 6L-10 -6L-1 3L6 -3L22 11L22 14Z" fill="#cfe5c4"/>
     <circle cx="13" cy="-7" r="3.6" fill="#f7e6ad"/>
     <path class="d" d="M-22 6L-10 -6L-1 3L6 -3L22 11" fill="none"/>
   </g>`,
  // 우연 방 흰 베이스 기타 — 평면도에선 기대어 눌려 보이던 것을 펴고, 넥을 줄여 비스듬히
  `<g transform="rotate(40) scale(0.25) translate(0 24)">
     <path class="o" d="M5 -20C10 -30 20 -38 23 -29C25 -19 18 -12 20 -2C24 10 26 26 10 30C3 32 -3 32 -10 30C-26 26 -26 10 -21 -2C-18 -12 -24 -20 -20 -27C-16 -32 -10 -26 -5 -20Z" fill="#fff"/>
     <path class="d" d="M-4 -14C2 -18 12 -16 14 -8C16 0 12 10 4 12L-4 12C-12 10 -14 0 -12 -8C-10 -12 -8 -13 -4 -14Z" fill="none"/>
     <path class="o" d="M-4 -62L4 -62L4 -18L-4 -18Z" fill="#fff"/>
     <path class="o" d="M-4 -62L-6 -80Q-5 -86 1 -85L7 -79L4 -62Z" fill="#fff"/>
     <rect class="d" x="-7" y="-6" width="14" height="5" rx="1.5" fill="none"/>
     <rect class="d" x="-6" y="18" width="12" height="6" rx="1" fill="none"/>
     <path class="d" d="M-2.4 -62L-2.4 20M2.4 -62L2.4 20M-5 -66L-10 -66M-5.3 -70L-10.3 -70M-5.6 -74L-10.6 -74M-5.9 -78L-10.9 -78" fill="none"/>
   </g>`,
  // 우연 방 책상 위 펼친 노트 + 펜
  `<g transform="scale(0.34) translate(-9.5 0)">
     <path d="M-27 -13Q-14 -19 0 -13L0 17Q-14 11 -27 17Z" fill="#fff"/>
     <path d="M0 -13Q14 -19 27 -13L27 17Q14 11 0 17Z" fill="#fff"/>
     <path d="M-23 -8H-5M-23 -2H-5M-23 4H-7M4 -8H23M4 -2H23M4 4H19M4 10H21" fill="none" stroke="#e09ab3" stroke-width="1.3" stroke-dasharray="3 1.5"/>
     <path class="d" d="M-27 -13Q-14 -19 0 -13Q14 -19 27 -13L27 17Q14 11 0 17Q-14 11 -27 17ZM0 -13L0 17" fill="none"/>
     <path class="o pen" d="M35 -19L46 15" fill="none"/>
   </g>`,
];

function setupHint(el) {
  const p = el.querySelector('.hsh-plan__hint');
  const icon = p.querySelector('.hsh-plan__hint-icon');
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
  const hint = { chars: [...p.querySelectorAll('.hsh-plan__hint-char')], icon, i: 0 };
  showHintIcon(hint);
  return hint;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function showHintIcon(hint) {
  hint.icon.innerHTML = `<g class="hsh-plan__hint-art">${HINT_ICONS[hint.i % HINT_ICONS.length]}</g>`;
}

function cycleHintIcon(el, hint) {
  setInterval(() => {
    if (!el.classList.contains('is-done')) return;
    hint.i++;
    showHintIcon(hint); // 튀는 동작 없이 바로 바뀐다
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
