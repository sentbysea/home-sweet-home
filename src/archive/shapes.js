// archive 열쇠꾸러미 — 열쇠 · 키링 윤곽(2D). three.js 를 모르는 순수 좌표만.
//   단위: 열쇠 길이 약 2.1. 고리가 지나가는 구멍(매달리는 점)이 (0, 0), 아래로 매달린다(-y).
//   모양 하나 = { outline, holes, fills, lines, size }
//     outline  바깥 윤곽(닫힌 점 목록) — 두께를 주어 입체로 뽑는다
//     holes    뚫린 구멍(닫힌 점 목록)
//     fills    겉면에 칠하는 작은 색 조각 { pts, color } — 창문 · 볼 · 책등 …
//     lines    겉면에 그리는 안쪽 묘사 선 { pts, closed?, w? }(펜 굵기 배율)
//   손그림 떨림은 keyring.js 가 점 목록에 입힌다.

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;

/** 펜 — 선분 · 호 · 2차 곡선을 점 목록으로 */
class Pen {
  constructor() { this.pts = []; }
  get last() { return this.pts[this.pts.length - 1]; }
  m(x, y) { this.pts.push([x, y]); return this; }
  l(x, y) { this.pts.push([x, y]); return this; }
  /** 호 — 각도는 도(°), a0 → a1 방향 그대로(줄면 시계 방향) */
  arc(cx, cy, r, a0, a1, step = 8) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
    for (let i = 0; i <= n; i++) {
      const a = rad(a0 + ((a1 - a0) * i) / n);
      this.pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return this;
  }
  /** 타원 호 */
  ell(cx, cy, rx, ry, a0, a1, step = 8) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
    for (let i = 0; i <= n; i++) {
      const a = rad(a0 + ((a1 - a0) * i) / n);
      this.pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return this;
  }
  q(cx, cy, x, y, n = 8) {
    const [x0, y0] = this.last;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.pts.push([u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y]);
    }
    return this;
  }
  done() { return dedupe(this.pts); }
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p);
  }
  const a = out[0];
  const b = out[out.length - 1];
  if (out.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) out.pop();
  return out;
}

const circle = (cx, cy, r, step = 12) => new Pen().arc(cx, cy, r, 0, 360 - step, step).done();
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** 둥근 네모 */
function rrect(x0, y0, x1, y1, r) {
  return new Pen()
    .arc(x1 - r, y1 - r, r, 0, 90).arc(x0 + r, y1 - r, r, 90, 180)
    .arc(x0 + r, y0 + r, r, 180, 270).arc(x1 - r, y0 + r, r, 270, 360)
    .done();
}
function heartPts(cx, cy, s) {
  // 아래 뾰족 · 위 가운데 오목 — 크기 s 는 폭의 절반쯤
  return new Pen()
    .m(cx, cy - s * 0.9)
    .q(cx - s * 0.3, cy - s * 0.6, cx - s * 0.83, cy - s * 0.08)
    .arc(cx - s * 0.48, cy + s * 0.22, s * 0.46, 220, 30, 12)
    .arc(cx + s * 0.48, cy + s * 0.22, s * 0.46, 150, -40, 12)
    .q(cx + s * 0.3, cy - s * 0.6, cx, cy - s * 0.9)
    .done();
}

// ---------- 열쇠 몸통(날 · 이빨) — 머리 아래 y0 에서 시작 ----------

const BLADE = { w: 0.12, collar: 0.19, tip: -2.02 };

/** 오른쪽 위(머리와 만나는 곳) → 날 오른쪽 이빨 → 끝 → 왼쪽 위 */
function blade(pen, y0) {
  const { w, collar, tip } = BLADE;
  const c0 = y0 - 0.1;
  const c1 = c0 - 0.08;
  pen.l(w, y0).l(w, c0).l(collar, c0).l(collar, c1).l(w, c1)
    .l(w, -1.12).l(0.2, -1.19).l(w, -1.26)
    .l(w, -1.36).l(0.19, -1.41).l(0.22, -1.5).l(w, -1.56)
    .l(w, -1.66).l(0.2, -1.73).l(0.2, -1.83).l(w, -1.89)
    .l(w, tip).l(-0.04, tip).l(-w, tip + 0.1)
    .l(-w, c1).l(-collar, c1).l(-collar, c0).l(-w, c0).l(-w, y0);
  return pen;
}
const bladeLines = () => [{ pts: [[-0.03, -0.98], [-0.03, -1.86]], w: 0.7 }];

// ---------- 열쇠 머리 ----------

/** 둥근 머리 — 가운데에 동그란 묘사 */
function roundKey() {
  const cy = -0.27;
  const r = 0.42;
  const yj = cy - Math.sqrt(r * r - BLADE.w * BLADE.w);
  const a = (Math.atan2(yj - cy, BLADE.w) * 180) / Math.PI; // 오른쪽 아래 만나는 각
  // 왼쪽 아래 → 위로 돌아 → 오른쪽 아래(시계 방향)
  const pen = new Pen().m(-BLADE.w, yj).arc(0, cy, r, 180 - a, a, 9);
  blade(pen, yj);
  return {
    outline: pen.done(),
    holes: [circle(0, 0, 0.085)],
    fills: [],
    lines: [{ pts: new Pen().arc(0, cy - 0.04, 0.21, 200, -20, 12).done(), w: 0.75 }, ...bladeLines()],
    size: 2.15,
  };
}

/** 하트 머리 — 하트 자물쇠 열쇠 */
function heartKey() {
  const pen = new Pen().m(-BLADE.w, -0.44)
    .q(-0.34, -0.3, -0.37, -0.06)
    .arc(-0.19, 0.08, 0.215, 218, 30, 10)
    .arc(0.19, 0.08, 0.215, 150, -38, 10)
    .q(0.34, -0.3, BLADE.w, -0.44);
  blade(pen, -0.44);
  return {
    outline: pen.done(),
    holes: [circle(0, 0, 0.085)],
    fills: [],
    lines: [{ pts: new Pen().arc(-0.19, 0.08, 0.12, 150, 95, 10).done(), w: 0.7 }, ...bladeLines()],
    size: 2.2,
  };
}

/** 집 머리 — 지붕 · 굴뚝 · 창 · 문, 구멍은 지붕 밑 */
function houseKey(win = '#cfe0fb', door = '#f6c6d6') {
  const peak = 0.27;
  const slope = (x) => peak - (x / 0.46) * 0.4; // 지붕 오른쪽 경사
  const pen = new Pen().m(-BLADE.w, -0.64)
    .l(-0.33, -0.64).l(-0.33, -0.13).l(-0.46, -0.13)
    .l(0, peak)
    .l(0.19, slope(0.19)).l(0.19, 0.2).l(0.29, 0.2).l(0.29, slope(0.29))
    .l(0.46, -0.13).l(0.33, -0.13).l(0.33, -0.64).l(BLADE.w, -0.64);
  blade(pen, -0.64);
  return {
    outline: pen.done(),
    holes: [circle(0, 0, 0.085)],
    fills: [
      { pts: rect(0.12, -0.24, 0.25, -0.37), color: win },
      { pts: rect(-0.22, -0.64, -0.08, -0.4), color: door },
    ],
    lines: [
      { pts: rect(0.12, -0.24, 0.25, -0.37), closed: true, w: 0.7 },
      { pts: [[0.185, -0.24], [0.185, -0.37]], w: 0.55 },
      { pts: [[0.12, -0.305], [0.25, -0.305]], w: 0.55 },
      { pts: [[-0.22, -0.64], [-0.22, -0.4], [-0.08, -0.4], [-0.08, -0.64]], w: 0.7 },
      { pts: [[-0.33, -0.13], [0.33, -0.13]], w: 0.6 },
      ...bladeLines(),
    ],
    size: 2.3,
  };
}

// ---------- 키링 ----------

/** 고리에 걸리는 작은 귀 — 매다는 점 둘레(0, 0) */
const tab = (pen, r = 0.1, from = -40, to = 220) => pen.arc(0, 0, r, from, to, 12);

/** 작은 새 — 하늘색, 부리는 버터색, 볼은 분홍 */
function bird() {
  const cx = 0;
  const cy = -0.38;
  const rx = 0.34;
  const ry = 0.26;
  const pen = new Pen();
  tab(pen);
  pen.ell(cx, cy, rx, ry, 102, 165, 9)
    .l(-0.47, -0.36).l(-0.335, -0.42)
    .ell(cx, cy, rx, ry, 192, 350, 9)
    .l(0.39, -0.33).l(0.55, -0.2).l(0.5, -0.12).l(0.3, -0.21)
    .ell(cx, cy, rx, ry, 42, 78, 9);
  return {
    outline: pen.done(),
    holes: [circle(0, 0, 0.045)],
    fills: [
      { pts: [[-0.33, -0.31], [-0.47, -0.36], [-0.335, -0.42]], color: '#fbe7a1' },
      { pts: circle(-0.13, -0.42, 0.045), color: '#f6b9cb' },
      { pts: circle(-0.19, -0.33, 0.028), color: 'ink' },
    ],
    lines: [
      { pts: new Pen().arc(0.1, -0.36, 0.14, 195, 345, 12).done(), w: 0.75 },
      { pts: [[-0.33, -0.31], [-0.47, -0.36], [-0.335, -0.42]], w: 0.6 },
    ],
    size: 0.62,
  };
}

/** 일기장 — 연보라 표지 · 진한 책등 · 버터색 잠금띠 · 하트 */
function diary() {
  const pen = new Pen();
  tab(pen, 0.09, -30, 210);
  pen.l(-0.07, -0.13).arc(-0.2, -0.17, 0.04, 90, 180, 15)
    .l(-0.24, -0.72).arc(-0.2, -0.72, 0.04, 180, 270, 15)
    .l(0.2, -0.76).arc(0.2, -0.72, 0.04, 270, 360, 15)
    .l(0.24, -0.17).arc(0.2, -0.17, 0.04, 0, 90, 15)
    .l(0.07, -0.13);
  return {
    outline: pen.done(),
    holes: [circle(0, 0, 0.04)],
    fills: [
      { pts: rect(-0.24, -0.15, -0.16, -0.74), color: '#b8a3e8' },
      { pts: rect(0.15, -0.38, 0.26, -0.5), color: '#fbe7a1' },
      { pts: heartPts(0.01, -0.46, 0.09), color: '#f6b9cb' },
    ],
    lines: [
      { pts: [[-0.16, -0.15], [-0.16, -0.74]], w: 0.7 },
      { pts: rect(0.15, -0.38, 0.26, -0.5), closed: true, w: 0.65 },
      { pts: heartPts(0.01, -0.46, 0.09), closed: true, w: 0.6 },
      { pts: [[-0.08, -0.25], [0.1, -0.25]], w: 0.5 },
      { pts: [[-0.08, -0.65], [0.08, -0.65]], w: 0.5 },
    ],
    size: 0.78,
  };
}

/** 하트 자물쇠 — 연보라 몸통, 걸쇠 안쪽이 구멍(고리가 지나간다) */
function heartLock() {
  const L = 0.12; // 하트 위 두 둥근 데의 중심 x
  const cy = -0.36;
  const r = 0.135;
  const pen = new Pen()
    .m(-L - r * Math.cos(rad(76)), cy + r * Math.sin(rad(76))).l(-0.15, -0.1)
    .arc(0, -0.1, 0.15, 180, 0, 12)
    .arc(L, cy, r, 76, -42, 10)
    .l(0, -0.66)
    .l(-L - r * Math.cos(rad(42)), cy - r * Math.sin(rad(42)))
    .arc(-L, cy, r, 222, 104, 10);
  const hole = new Pen().m(0.095, -0.24).l(0.095, -0.1).arc(0, -0.1, 0.095, 0, 180, 12).l(-0.095, -0.24)
    .q(0, -0.31, 0.095, -0.24, 6).done();
  return {
    outline: pen.done(),
    holes: [hole],
    fills: [
      { pts: circle(0, -0.42, 0.035), color: 'ink' },
      { pts: [[-0.02, -0.43], [0.02, -0.43], [0.03, -0.52], [-0.03, -0.52]], color: 'ink' },
    ],
    lines: [{ pts: new Pen().arc(-L, cy, 0.07, 160, 110, 10).done(), w: 0.6 }],
    size: 0.66,
  };
}

/** 가죽 이름표 — 위쪽 긴 구멍에 작은 고리를 끼워 매달고 아래로 길게 늘어진다(글씨는 세로, 그림 붙임) */
function label() {
  return {
    outline: rrect(-0.2, -1.52, 0.2, 0.11, 0.07),
    holes: [rrect(-0.085, -0.035, 0.085, 0.035, 0.033)],
    fills: [],
    lines: [],
    size: 1.6,
    face: { x0: -0.2, y0: -1.52, x1: 0.2, y1: -0.09 },
  };
}

export const SHAPES = { roundKey, heartKey, houseKey, bird, diary, heartLock, label };
export { TAU };
