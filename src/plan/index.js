// 평면도 — 불러오기 · 등장(선 그리기 → 색 뽀잉) · 기울기 연결
//   선과 색은 레이어가 나뉘어 있다(.hsh-plan__lines / .hsh-plan__color, tools/floorplan.mjs).

import { enableTilt } from './tilt.js';

const SVG_URL = new URL('./floorplan.svg', import.meta.url);

// 등장 시간표(ms) — 전체 약 2.6초, 한 번만
const LINE_SPAN = 1000; // 마지막 획이 시작하는 때
const LINE_MIN = 170; // 획 하나 길이(짧은 획)
const LINE_MAX = 560; // 획 하나 길이(벽처럼 긴 획)
const COLOR_GAP_ROOM = 150; // 방마다 색이 시작하는 간격
const COLOR_GAP_ITEM = 34; // 한 방 안의 색 조각 간격
const POP_MS = 440;
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

  if (!reduced) enableTilt(el, card);

  const replay = () => reveal(el, { reduced });
  return { done: replay(), replay };
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
  const labels = [...el.querySelectorAll('.hsh-plan__lines [data-label]')];
  const pops = [...el.querySelectorAll('.hsh-plan__color .hsh-pop')];

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

  // 방 이름 — 그 방 획이 거의 다 그려질 때 살짝
  labels.forEach((t) => {
    const roomStrokes = strokes.filter((s) => s.closest('[data-room]') === t.closest('[data-room]'));
    const i = strokes.indexOf(roomStrokes[roomStrokes.length - 1]);
    const delay = Math.round((i / last) ** 0.9 * LINE_SPAN);
    running.push(t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay, fill: 'backwards' }));
  });

  // ② 색 — 선이 다 그려진 뒤, 방 순서대로 하나씩 뽀잉(0.85 → 1.04 → 1)
  const colorStart = lineEnd - 60;
  let end = colorStart;
  const counts = {};
  pops.forEach((p) => {
    const r = p.closest('[data-room]')?.dataset.room;
    const ri = Math.max(0, ROOM_ORDER.indexOf(r));
    const k = (counts[r] = (counts[r] ?? -1) + 1);
    const delay = colorStart + ri * COLOR_GAP_ROOM + k * COLOR_GAP_ITEM;
    end = Math.max(end, delay + POP_MS);
    running.push(p.animate(
      [
        { opacity: 0, transform: 'scale(0.85)' },
        { opacity: 1, transform: 'scale(1.04)', offset: 0.55 },
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
