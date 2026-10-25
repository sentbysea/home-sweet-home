// 평면도 — 불러오기 · 등장(선 그리기 → 색 뽀잉) · 기울기 연결
//   선과 색은 레이어가 나뉘어 있다(.hsh-plan__lines / .hsh-plan__color, tools/floorplan.mjs).

import { enableTilt } from './tilt.js';

const SVG_URL = new URL('./floorplan.svg', import.meta.url);

// 등장 시간표(ms) — 전체 약 2.6초, 한 번만
const LINE_SPAN = 1000; // 마지막 획이 시작하는 때
const LINE_MIN = 170; // 획 하나 길이(짧은 획)
const LINE_MAX = 560; // 획 하나 길이(벽처럼 긴 획)
const COLOR_GAP_ROOM = 210; // 방마다 색이 시작하는 간격 — 뿅 · 뿅 · 뿅
const POP_MS = 460;
const ROOM_ORDER = ['v', 'kitchen', 'bath', 'living', 'entry', 'e'];

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

  if (!reduced) {
    enableTilt(el, card);
    startWallWobble(el);
  }

  const replay = () => reveal(el, { reduced });
  return { done: replay(), replay };
}

// 벽 위글 — 로딩 화면 집 윤곽처럼 4장을 190ms 마다 번갈아(필터 없음). 다 그려진 뒤(.is-done)에만, 그리는 동안은 0장.
const WALL_FRAMES = 4;
const WALL_FRAME_MS = 190;

function startWallWobble(el) {
  let k = 0;
  setInterval(() => {
    k = el.classList.contains('is-done') ? (k + 1) % WALL_FRAMES : 0;
    el.dataset.wallFrame = k;
  }, WALL_FRAME_MS);
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

  el.classList.add('is-playing'); // 대시·opacity 가 'backwards' 로 잡혀 있으니 바로 보여도 빈 화면
  el.dispatchEvent(new CustomEvent('hsh:plan-shown', { bubbles: true }));

  const anims = running;
  return Promise.all(anims.map((a) => a.finished)).then(() => {
    strokes.forEach((s) => { s.style.strokeDasharray = ''; });
    el.classList.replace('is-playing', 'is-done');
    el.dispatchEvent(new CustomEvent('hsh:plan-done', { bubbles: true }));
  }, () => { /* 다시 재생으로 취소됨 */ });
}
