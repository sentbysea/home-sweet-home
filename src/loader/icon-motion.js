// 방문 단계 아이콘 움직임(초인종 딩동 · 달려나옴 · 문 빼꼼 · 들어가기) + 손떨림 — 매 화면마다 JS 로 쓴다.
//   예전에는 CSS 애니메이션이었는데, 아이폰 Safari 는 SVG 안 도형의 CSS 애니메이션을 다른 변화가 있을 때만
//   다시 그려서 위글(190ms)마다 한 번씩만 움직였다 — 동작은 안 보이고 제자리에서 떨기만 했다.
//   여기서 매 프레임 style 을 직접 바꾸면 그때마다 다시 그린다. 모양 · 박자는 예전 키프레임 그대로.
//   손떨림은 wobble.js 와 같은 값 · 같은 박자(WOBBLE_FRAME)로 도형마다.

import { jitter, WOBBLE_FRAME } from './wobble.js';

const ease = (x) => x * x * (3 - 2 * x); // ease-in-out 비슷하게
const easeOut = (x) => 1 - (1 - x) * (1 - x);

/** 0..1 의 p 에서 [위치, 값] 점들 사이를 구간마다 f 로 잇는다 */
function keys(p, pts, f) {
  for (let i = 1; i < pts.length; i++) {
    const [p1, v1] = pts[i];
    if (p <= p1) {
      const [p0, v0] = pts[i - 1];
      return v0 + (v1 - v0) * f(p1 > p0 ? (p - p0) / (p1 - p0) : 1);
    }
  }
  return pts[pts.length - 1][1];
}

const phase = (t, period) => (t % period) / period;

// 단계별 — t(초, 그 단계가 보인 뒤) → { 선택자: { tf, op } }
const MOTION = {
  bell: (t) => {
    const p = phase(t, 1.6);
    return {
      '.hsh-bell': { tf: `rotate(${keys(p, [[0, 0], [0.52, 0], [0.6, 14], [0.68, -12], [0.76, 8], [0.84, -4], [0.92, 0], [1, 0]], ease)}deg)` },
      '.hsh-ring': { op: keys(p, [[0, 0], [0.55, 0], [0.62, 1], [0.84, 1], [1, 0]], easeOut) },
    };
  },
  run: (t) => {
    const bob = phase(t, 0.72) * 2; // 0.36초씩 오르내림
    const sp = phase(t, 0.72);
    return {
      '.hsh-run__body': { tf: `translate(0px, ${-ease(bob <= 1 ? bob : 2 - bob)}px)` },
      '.hsh-run__a': { op: phase(t, 0.36) < 0.5 ? 1 : 0 },
      '.hsh-run__b': { op: phase(t + 0.18, 0.36) < 0.5 ? 1 : 0 },
      '.hsh-run__speed': { tf: `translate(${1.5 - 3 * easeOut(sp)}px, 0px)`, op: keys(sp, [[0, 0], [0.4, 1], [1, 0]], easeOut) },
    };
  },
  door: (t) => ({
    '.hsh-door__panel': { tf: `scale(${keys(phase(t, 2.2), [[0, 1], [0.15, 1], [0.5, 0.3], [0.72, 0.3], [1, 1]], ease)}, 1)` },
  }),
  tap: (t) => {
    const p = easeOut(phase(t, 1.8));
    return { '.hsh-tap': { tf: `scale(${0.7 + 0.8 * p})`, op: 1 - p } };
  },
};

/** 아이콘 움직임 시작. signal 이 abort 되면 멈춘다. 모션 줄이기면 부르지 않는다(아이콘은 멈춘 모양 그대로). */
export function startIconMotion(status, { signal } = {}) {
  const icon = status.querySelector('.hsh-status__icon');
  const shapes = [...icon.querySelectorAll('path, circle, rect')];
  const moving = new Set();
  let step = null;
  let t0 = 0;
  let raf = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (status.dataset.step !== step) { step = status.dataset.step; t0 = now; }
    const k = Math.floor(now / WOBBLE_FRAME) % 4;
    const parts = MOTION[step]?.((now - t0) / 1000) || {};

    // 움직이는 묶음 · 도형 — 손떨림은 도형에만 더한다
    const own = new Map();
    for (const [sel, v] of Object.entries(parts)) {
      icon.querySelectorAll(sel).forEach((el) => own.set(el, v));
    }
    for (const el of moving) if (!own.has(el)) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); }
    moving.clear();
    for (const [el, v] of own) {
      moving.add(el);
      if (v.op !== undefined) el.style.opacity = v.op.toFixed(3);
      if (v.tf && !shapes.includes(el)) el.style.transform = v.tf;
    }
    shapes.forEach((s, i) => {
      const x = (jitter(i, k, 4) * 0.4).toFixed(2);
      const y = (jitter(i, k, 5) * 0.4).toFixed(2);
      const r = (jitter(i, k, 6) * 4).toFixed(1);
      s.style.transform = `${own.get(s)?.tf || ''} translate(${x}px, ${y}px) rotate(${r}deg)`;
    });
  };
  raf = requestAnimationFrame(frame);
  signal?.addEventListener('abort', () => cancelAnimationFrame(raf), { once: true });
}
