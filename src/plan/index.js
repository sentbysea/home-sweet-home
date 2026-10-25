// 평면도 — 불러오기 · 등장(선 그리기 → 색 뽀잉 → 스티커) · 기울기 · 위글 · 방 스티커 버튼
//   선 · 색 · 스티커는 레이어가 나뉘어 있다(.hsh-plan__lines / __color / __stickers, tools/floorplan.mjs).
//   스티커를 누르면 hsh:room 이벤트(detail.room = 'v' | 'bath' | 'kitchen' | 'living' | 'entry' | 'e')가 올라간다.

import { enableTilt } from './tilt.js';

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
const ICON_MS = 1100; // 하단 안내 괄호 속 스티커 모양이 바뀌는 간격
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

  enableStickers(el);
  const hint = setupHint(el);
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
      b.style.transform = `translate(${(jitter(i, k, 1) * 0.8).toFixed(2)}px, ${(jitter(i, k, 2) * 0.8).toFixed(2)}px) rotate(${(jitter(i, k, 3) * 4).toFixed(1)}deg)`;
    });
    hint.chars.forEach((c, i) => {
      c.style.transform = `translateY(${(jitter(i, k, 4) * 0.7).toFixed(2)}px) rotate(${(jitter(i, k, 5) * 5).toFixed(1)}deg)`;
    });
  }, FRAME_MS);
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
  s.dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room: s.dataset.room } }));
}

// ---------- 하단 안내 — click the ( ) ----------
//   글자는 하나씩 span 으로(위글), 괄호 속에는 스티커 모양을 돌아가며 그려 넣는다.

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
  // 스티커마다 그릴 조각(외곽선 · 바탕 · 열쇠 구멍)의 class · d · fill 만 뽑아 둔다
  const shapes = [...el.querySelectorAll('.hsh-sticker__body')].map((b) =>
    [...b.querySelectorAll('path')].map((path) => ({
      cls: path.getAttribute('class'),
      d: path.getAttribute('d'),
      fill: path.getAttribute('fill'),
    })));
  const hint = { chars: [...p.querySelectorAll('.hsh-plan__hint-char')], icon, shapes, i: 0 };
  showHintIcon(hint);
  return hint;
}

// innerHTML 로 옮기면 iOS Safari 에서 SVG 로 읽히지 않을 수 있어 요소를 직접 만든다
const SVG_NS = 'http://www.w3.org/2000/svg';

function showHintIcon(hint) {
  const parts = hint.shapes[hint.i % hint.shapes.length];
  if (!parts) return;
  hint.icon.replaceChildren(...parts.map(({ cls, d, fill }) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', cls);
    path.setAttribute('d', d);
    if (fill) path.setAttribute('fill', fill);
    return path;
  }));
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
