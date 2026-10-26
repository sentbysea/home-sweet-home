// 손그림 집 렌더러 — 마을의 집 · 신청 미리보기 · 주인 집 고치기가 모두 이 하나로 그린다.
//   집 모양(house) = 몸체 · 지붕 · 지붕 무늬 · 문 · 창문 · 장식 + 벽 · 지붕 · 문 색. banners.house · banner_requests.house 에 그대로 저장
//   (web 저장소 supabase/migrations/20261027100000_neighbor_houses.sql 의 banner_house_ok 와 같은 꼴).
//   · 선: 살짝 휘고 끝 · 모서리가 둥근 손그림. 선 변형 4장(.nbh-v0~3)을 그려 두고 화면이 190ms 마다 하나씩 보인다(로딩 · 평면도 위글과 같은 박자).
//     꼭짓점은 그대로라 선이 벌어지지 않는다. 굵기는 집 크기와 상관없이 같다(vector-effect).
//   · 기존 이웃은 house 가 비어 있으면 배너 id 로 정한 기본 모양 — 새로고침해도 같다.
//   · 배너 색으로 만들기: 배너 이미지에서 대표 색을 뽑아(투명 픽셀 빼고) 벽은 밝게 · 지붕은 또렷하게 · 문은 벽과 대비 나게.
//   · 장식(deco)은 여러 개 — 배열(비면 장식 없음). 지붕 무늬(roofPattern)는 사이트 스티커 무늬(plan/room-window.js)와 같은 결.
//   · 옛 꼴(v1 — deco 가 글자 하나, roofPattern 없음)도 읽는다: 다락창 · 없음은 장식 없음으로, 무늬는 민무늬로.

export const BODIES = ['cozy', 'tall', 'wide', 'two', 'tiny'];
export const ROOFS = ['tri', 'round', 'trap', 'barn'];
export const PATTERNS = ['solid', 'dot', 'halftone', 'stripe', 'gingham'];
export const DOORS = ['arch', 'square', 'side'];
export const WINDOWS = ['one', 'two', 'round', 'cross', 'band'];
export const DECOS = ['chimney', 'pot', 'dog', 'mailbox', 'tree'];

export const LABELS = {
  body: { cozy: '아담한 집', tall: '길쭉한 집', wide: '넓은 집', two: '2층집', tiny: '오두막' },
  roof: { tri: '삼각 지붕', round: '둥근 지붕', trap: '사다리꼴 지붕', barn: '헛간 지붕' },
  roofPattern: { solid: '민무늬', dot: '도트', halftone: '망점', stripe: '사선 줄무늬', gingham: '체크' },
  door: { arch: '둥근 문', square: '네모 문', side: '옆 문' },
  window: { one: '창 하나', two: '창 둘', round: '동그란 창', cross: '격자 창', band: '긴 창' },
  deco: { chimney: '굴뚝', pot: '화분', dog: '개집', mailbox: '우체통', tree: '작은 나무' },
};

// 파스텔 — 홈 라벨 색(base.css)과 같은 결
export const WALLS = ['#fffaf0', '#fbefae', '#fbd5e3', '#cfe0fb', '#cdeed6', '#e4d4fb', '#f3e6d8', '#e4e7ea'];
export const ROOF_COLORS = ['#e88a8a', '#7fa7d9', '#8cc3a0', '#e8b56a', '#b39ddb', '#f2a7c3', '#9aa5ad', '#c9a27e'];
export const DOOR_COLORS = ['#c9a27e', '#8fa3b8', '#e2b36b', '#b5838d', '#7e9c7a', '#ffffff'];

const INK = '#54585c';
export const BOIL = 4;

// 작은 결정적 난수
export function rng(seed) {
  let s = seed >>> 0; // mulberry32 — 이웃한 씨앗끼리도 고르게 흩어진다
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 문자열 → 숫자(FNV-1a) */
export function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (list, r) => list[Math.floor(r() * list.length) % list.length];
const f = (n) => Math.round(n * 10) / 10;

const OLD_DECOS = ['chimney', 'dormer', 'pot', 'none'];

/** 저장된 모양이 정해진 꼴이면 v2 꼴로(복사 · 장식은 DECOS 순서), 아니면 null */
export function normalizeHouse(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return null;
  const hex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  if (!BODIES.includes(h.body) || !ROOFS.includes(h.roof) || !DOORS.includes(h.door) || !WINDOWS.includes(h.window)) return null;
  if (!hex(h.wall) || !hex(h.roofColor) || !hex(h.doorColor)) return null;
  let deco;
  if (typeof h.deco === 'string' && OLD_DECOS.includes(h.deco)) deco = DECOS.includes(h.deco) ? [h.deco] : [];
  else if (Array.isArray(h.deco) && h.deco.every((d) => DECOS.includes(d))) deco = DECOS.filter((d) => h.deco.includes(d));
  else return null;
  const roofPattern = h.roofPattern ?? 'solid';
  if (!PATTERNS.includes(roofPattern)) return null;
  return { v: 2, body: h.body, roof: h.roof, roofPattern, door: h.door, window: h.window, deco, wall: h.wall.toLowerCase(), roofColor: h.roofColor.toLowerCase(), doorColor: h.doorColor.toLowerCase() };
}

/** 집 모양 → 짧은 글자(data-house · 시험용): 몸체/지붕/무늬/문/창/장식+장식(없으면 -)/벽/지붕 색/문 색 */
export const houseKey = (h) => `${h.body}/${h.roof}/${h.roofPattern}/${h.door}/${h.window}/${h.deco.join('+') || '-'}/${h.wall}/${h.roofColor}/${h.doorColor}`;

/** 무작위 집(r 를 넘기면 그 난수로) — 무늬는 절반쯤 민무늬, 장식은 0~2개쯤 */
export function randomHouse(r = Math.random) {
  return {
    v: 2,
    body: pick(BODIES, r),
    roof: pick(ROOFS, r),
    roofPattern: r() < 0.5 ? 'solid' : pick(PATTERNS.slice(1), r),
    door: pick(DOORS, r),
    window: pick(WINDOWS, r),
    deco: DECOS.filter(() => r() < 0.28),
    wall: pick(WALLS, r),
    roofColor: pick(ROOF_COLORS, r),
    doorColor: pick(DOOR_COLORS, r),
  };
}

/** 기존 이웃 — 배너 id 로 늘 같은 기본 모양 */
export function defaultHouse(id) {
  return randomHouse(rng(hash(`neighbor:${id}`)));
}

// ---------- 손그림 선 ----------

/**
 * 점들을 지나는 손그림 길 — 변마다 살짝 휘고 조금 흔들리며, 모서리는 둥글게. 꼭짓점은 움직이지 않는다.
 * v — 위글 변형 번호(같은 seed 면 휜 방향은 같고 잔떨림만 다르다)
 */
export function sketch(pts, { closed = false, seed, v = 0, amp = 0.35, radius = 2.5 }) {
  const shape = rng(seed);
  const wob = rng(seed * 13 + v * 7919 + 1);
  const n = pts.length;
  const segs = closed ? n : n - 1;
  const cut = (a, b, r) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = Math.min(r, len / 3) / len;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  let d = '';
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const roundA = closed || i > 0;
    const roundB = closed || i < segs - 1;
    const s = roundA ? cut(a, b, radius) : a;
    const e = roundB ? cut(b, a, radius) : b;
    const len = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
    const nx = -(e[1] - s[1]) / len;
    const ny = (e[0] - s[0]) / len;
    const bow = (shape() - 0.5) * Math.min(1.6, len * 0.03) + (wob() - 0.5) * 0.35;
    const k = Math.max(1, Math.round(len / 22));
    if (i === 0) d += `M${f(s[0])} ${f(s[1])}`;
    else if (roundA) d += `Q${f(a[0])} ${f(a[1])} ${f(s[0])} ${f(s[1])}`;
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const tm = (j - 0.5) / k;
      const off = Math.sin(Math.PI * t) * bow + (j < k ? (wob() - 0.5) * 2 * amp : 0);
      const offm = Math.sin(Math.PI * tm) * bow + (wob() - 0.5) * amp;
      d += `Q${f(s[0] + (e[0] - s[0]) * tm + nx * offm)} ${f(s[1] + (e[1] - s[1]) * tm + ny * offm)} ${f(s[0] + (e[0] - s[0]) * t + nx * off)} ${f(s[1] + (e[1] - s[1]) * t + ny * off)}`;
    }
  }
  if (closed) {
    const s = cut(pts[0], pts[1], radius);
    d += `Q${f(pts[0][0])} ${f(pts[0][1])} ${f(s[0])} ${f(s[1])}Z`;
  }
  return d;
}

/** 손그림 원 · 타원 */
export function sketchEllipse(cx, cy, rx, ry, seed, v) {
  const wob = rng(seed * 13 + v * 7919 + 1);
  const N = 8;
  const pts = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const r = 1 + (wob() - 0.5) * 0.07;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
  let d = '';
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N];
    const q = pts[(i + 1) % N];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M${f(m[0])} ${f(m[1])}` : `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/** 아치(위가 둥근 네모) 점 — 둥근 문 · 둥근 지붕 */
function archPts(x, y, w, h, steps = 6) {
  const r = w / 2;
  const pts = [[x, y + h], [x, y + r]];
  for (let i = 1; i < steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    pts.push([x + r + Math.cos(a) * r, y + r - Math.sin(a) * r]);
  }
  pts.push([x + w, y + r], [x + w, y + h]);
  return pts;
}

// ---------- 집 ----------

const BODY = { cozy: [56, 44], tall: [44, 70], wide: [78, 40], two: [60, 72], tiny: [50, 34] };

/**
 * 집 모양 → 도형 목록(변형 v 와 상관없이 같은 뼈대). 좌표는 바닥 가운데가 (0, 0), 위가 -y.
 * @returns {{ shapes: Array<{ kind: 'poly' | 'ellipse', pts?: number[][], e?: number[], fill?: string, roof?: boolean, closed?: boolean, seed: number, r?: number }>, box: { x: number, y: number, w: number, h: number } }}
 */
function plan(h) {
  const [w, bh] = BODY[h.body];
  const x0 = -w / 2;
  const top = -bh;
  const has = (d) => h.deco.includes(d);
  const side = h.door === 'side';
  const shapes = [];
  let seed = 1;
  const add = (o) => shapes.push({ seed: seed++, closed: true, ...o });
  // 지붕
  const over = 5;
  let rh;
  let roofPts;
  if (h.roof === 'tri') {
    rh = w * 0.52;
    roofPts = [[x0 - over, top + 1], [0, top - rh], [-x0 + over, top + 1]];
  } else if (h.roof === 'round') {
    rh = (w + over * 2) / 2 * 0.78;
    roofPts = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI - (i / steps) * Math.PI;
      roofPts.push([Math.cos(a) * (w / 2 + over), top + 1 - Math.sin(a) * rh]);
    }
  } else if (h.roof === 'barn') {
    // 헛간 지붕 — 아래는 가파르고 위는 완만하게 꺾인다
    rh = w * 0.5;
    roofPts = [[x0 - over, top + 1], [x0 - over + w * 0.1, top - rh * 0.58], [0, top - rh], [-x0 + over - w * 0.1, top - rh * 0.58], [-x0 + over, top + 1]];
  } else {
    rh = w * 0.34;
    roofPts = [[x0 - over, top + 1], [x0 + w * 0.2, top - rh], [-x0 - w * 0.2, top - rh], [-x0 + over, top + 1]];
  }
  const roofTop = top - rh;
  // 지붕 윗변 높이(x 자리에서) — 굴뚝이 지붕에 걸치게
  const roofAt = (x) => {
    let y = top;
    for (let i = 0; i < roofPts.length - 1; i++) {
      const [ax, ay] = roofPts[i];
      const [bx, by] = roofPts[i + 1];
      if (ax !== bx && (x - ax) * (x - bx) <= 0) y = Math.min(y, ay + (by - ay) * (x - ax) / (bx - ax));
    }
    return y;
  };
  // 작은 나무 — 집 왼쪽 뒤(먼저 그려 집 · 개집에 살짝 가린다)
  const tx = x0 - 4;
  if (has('tree')) {
    add({ kind: 'poly', pts: [[tx, -1], [tx, -13]], closed: false });
    add({ kind: 'ellipse', e: [tx, -21, 8, 10], fill: '#a9d6a0' });
  }
  // 굴뚝(지붕 뒤)
  if (has('chimney')) {
    const cx = x0 + w * 0.26;
    const at = roofAt(cx);
    add({ kind: 'poly', pts: [[cx - 5, at + 3], [cx - 5, Math.min(at, roofTop + 6) - 9], [cx + 5, Math.min(at, roofTop + 6) - 9], [cx + 5, at + 3]], fill: h.roofColor, r: 1.5 });
  }
  add({ kind: 'poly', pts: roofPts, roof: true, r: h.roof === 'round' ? 1 : 2.5 });
  // 몸체
  add({ kind: 'poly', pts: [[x0, top], [-x0, top], [-x0, 0], [x0, 0]], fill: h.wall });
  if (h.body === 'two') add({ kind: 'poly', pts: [[x0 + 3, top + bh * 0.48], [-x0 - 3, top + bh * 0.48]], closed: false });
  // 문
  const dw = h.body === 'wide' ? 13 : 11;
  const dh = Math.min(20, bh * 0.46);
  const dx = side ? x0 + 6 : -dw / 2;
  if (h.door === 'arch') add({ kind: 'poly', pts: archPts(dx, -dh, dw, dh, 5), fill: h.doorColor, r: 1 });
  else add({ kind: 'poly', pts: [[dx, -dh], [dx + dw, -dh], [dx + dw, 0], [dx, 0]], fill: h.doorColor, r: 1.5 });
  add({ kind: 'ellipse', e: [dx + dw - 3, -dh / 2, 0.9, 0.9], fill: INK });
  // 창 — 1층(문 옆) · 2층(2층집 · 길쭉한 집). 긴 창은 가로로 길고 세 칸
  const win = (cx, cy, s, bw = s) => {
    if (h.window === 'round') { add({ kind: 'ellipse', e: [cx, cy, s / 2, s / 2], fill: '#ffffff' }); return; }
    const hw = bw / 2;
    const hh = (h.window === 'band' ? s * 0.8 : s) / 2;
    add({ kind: 'poly', pts: [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx + hw, cy + hh], [cx - hw, cy + hh]], fill: '#ffffff', r: 1.2 });
    if (h.window === 'cross') {
      add({ kind: 'poly', pts: [[cx, cy - hh + 1], [cx, cy + hh - 1]], closed: false });
      add({ kind: 'poly', pts: [[cx - hw + 1, cy], [cx + hw - 1, cy]], closed: false });
    }
    if (h.window === 'band' && bw >= 12) {
      for (const k of [-1, 1]) add({ kind: 'poly', pts: [[cx + k * bw / 6, cy - hh + 1], [cx + k * bw / 6, cy + hh - 1]], closed: false });
    }
  };
  const ws = h.window === 'two' ? 8 : 10;
  const groundY = -dh * 0.62;
  // 문 옆 빈 곳 [a, b] 에 창
  const fill = (a, b) => {
    const span = b - a;
    if (h.window === 'band' && span >= 14) { win((a + b) / 2, groundY, ws, Math.min(span - 2, 24)); return; }
    if (h.window === 'two' && span > ws * 2 + 5) { win(a + ws / 2 + 1, groundY, ws); win(a + ws * 1.5 + 4, groundY, ws); return; }
    if (span > ws + 2 || (h.body === 'tiny' && span > 8)) win((a + b) / 2, groundY, Math.min(ws, span - 2));
  };
  if (side) fill(x0 + 6 + dw + 6, -x0 - 6);
  else {
    fill(dw / 2 + 5, -x0 - 5);
    if (w >= 56 || h.body === 'tiny') fill(x0 + 5, -dw / 2 - 5);
  }
  if (bh >= 60) {
    const uy = top + bh * 0.25;
    if (h.window === 'two') { win(-w * 0.2, uy, ws); win(w * 0.2, uy, ws); }
    else if (h.window === 'band') win(0, uy, ws, w * 0.5);
    else win(0, uy, ws + 1);
  }
  // 화분(문 옆 바닥)
  if (has('pot')) {
    const px = side ? -x0 + 1 : -x0 - 1;
    add({ kind: 'poly', pts: [[px - 4, -7], [px + 4, -7], [px + 3, 0], [px - 3, 0]], fill: '#e2a37e', r: 1 });
    add({ kind: 'ellipse', e: [px, -10.5, 4.2, 3.6], fill: '#9ccb8f' });
  }
  // 개집 — 집 왼쪽 앞
  const da = x0 - 15;
  const db = x0 - 2;
  if (has('dog')) {
    const m = (da + db) / 2;
    add({ kind: 'poly', pts: [[da + 1, -9], [db - 1, -9], [db - 1, 0], [da + 1, 0]], fill: '#f3e6d8', r: 1 });
    add({ kind: 'poly', pts: [[da - 1, -8], [m, -15], [db + 1, -8]], fill: h.roofColor, r: 1.2 });
    add({ kind: 'poly', pts: archPts(m - 2.5, -5.5, 5, 5.5, 4), fill: INK, r: 0.8 });
  }
  // 우체통 — 집 오른쪽 앞(화분 · 옆 문이면 조금 더 밖에)
  const mx = -x0 + (has('pot') && side ? 10 : 8);
  if (has('mailbox')) {
    add({ kind: 'poly', pts: [[mx, 0], [mx, -10]], closed: false });
    add({ kind: 'poly', pts: [[mx - 4.5, -16], [mx + 4.5, -16], [mx + 4.5, -10], [mx - 4.5, -10]], fill: '#e88a8a', r: 1.5 });
    add({ kind: 'poly', pts: [[mx - 2.2, -13], [mx + 2, -13]], closed: false });
  }
  let minX = x0 - over;
  if (has('tree')) minX = Math.min(minX, tx - 8);
  if (has('dog')) minX = Math.min(minX, da - 1);
  let maxX = -x0 + over;
  if (has('pot')) maxX = Math.max(maxX, -x0 + 6);
  if (has('mailbox')) maxX = Math.max(maxX, mx + 4.5);
  let minY = roofTop - (has('chimney') ? 12 : 4);
  if (has('tree')) minY = Math.min(minY, -33);
  minX -= 2;
  maxX += 2;
  return { shapes, box: { x: minX, y: minY, w: maxX - minX, h: -minY + 2 } };
}

/**
 * 집 SVG — 위글 변형 4장을 겹쳐 그린다(지금 것만 보이게 하는 건 CSS: [data-boil] .nbh-v…).
 * @param {object} house  집 모양(normalizeHouse 를 거친 것)
 * @param {{ scale?: number, seed?: number, still?: boolean, cls?: string }} o  still — 위글 없이 한 장(옵션 아이콘)
 * @returns {{ svg: string, w: number, h: number }}  w · h — 화면 px
 */
export function houseSvg(house, { scale = 1, seed = 0, still = false, cls = 'nbh-art' } = {}) {
  const { shapes, box } = plan(house);
  const roof = roofPaint(house.roofPattern, house.roofColor);
  const w = box.w * scale;
  const hpx = box.h * scale;
  const layer = (v) => shapes.map((s) => {
    const sd = seed * 101 + s.seed;
    const d = s.kind === 'ellipse'
      ? sketchEllipse(s.e[0], s.e[1], s.e[2], s.e[3], sd, v)
      : sketch(s.pts, { closed: s.closed, seed: sd, v, radius: s.r ?? 2.5 });
    const fill = s.closed === false ? 'none' : s.roof ? roof.fill : s.fill || 'none';
    return `<path d="${d}" fill="${fill}"/>`;
  }).join('');
  const body = still
    ? `<g class="nbh-ink">${layer(0)}</g>`
    : Array.from({ length: BOIL }, (_, v) => `<g class="nbh-v nbh-v${v} nbh-ink">${layer(v)}</g>`).join('');
  return {
    w,
    h: hpx,
    svg: `<svg class="${cls}" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}" width="${f(w)}" height="${f(hpx)}" aria-hidden="true" focusable="false">${roof.defs}${body}</svg>`,
  };
}

// ---------- 지붕 무늬 ----------
//   사이트 스티커 무늬(plan/room-window.js — 도트 · 망점 · 줄무늬 · 깅엄)와 같은 결. 줄무늬는 사선.
//   무늬 색: 밝은 지붕엔 같은 색을 진하게, 그 밖엔 흰색 — 직접 고른 색에서도 보이게.

let patternNo = 0;

/** 지붕 무늬 하나 — <defs> 마크업과 fill 값(민무늬면 색 그대로) */
export function roofPaint(kind, color) {
  if (!kind || kind === 'solid') return { defs: '', fill: color };
  const id = `nbh-pt-${patternNo++}`;
  const [hh, ss, ll] = toHsl(color);
  const ink = ll > 70 ? toHex(hh, clamp(ss, 20, 60), clamp(ll - 28, 30, 62)) : '#ffffff';
  const op = ll > 70 ? 0.75 : 0.65;
  const open = (w, h, extra = '') => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${extra}><rect width="${w}" height="${h}" fill="${color}"/>`;
  const body = {
    dot: open(9, 9) + `<circle cx="2.4" cy="2.4" r="1.5" fill="${ink}" fill-opacity="${op}"/><circle cx="6.9" cy="6.9" r="1.5" fill="${ink}" fill-opacity="${op}"/>`,
    halftone: open(3.6, 3.6, ' patternTransform="rotate(45)"') + `<circle cx="1.8" cy="1.8" r="0.95" fill="${ink}" fill-opacity="${op}"/>`,
    stripe: open(6, 6, ' patternTransform="rotate(45)"') + `<rect width="3" height="6" fill="${ink}" fill-opacity="${op}"/>`,
    gingham: open(10, 10) + `<rect width="5" height="10" fill="${ink}" fill-opacity="0.4"/><rect width="10" height="5" fill="${ink}" fill-opacity="0.4"/>`,
  }[kind];
  if (!body) return { defs: '', fill: color };
  return { defs: `<defs>${body}</pattern></defs>`, fill: `url(#${id})` };
}

// ---------- 배너 색으로 ----------

function toHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function toHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const c = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[c(0), c(8), c(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * 배너 이미지의 대표 색(많은 순, 서로 다른 것만) — 못 읽으면 throw(외부 이미지 정책 등)
 * @returns {Promise<string[]>}
 */
export async function bannerColors(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('load'));
    img.src = url;
  });
  const c = document.createElement('canvas');
  c.width = 80;
  c.height = 16;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height); // 다른 출처 이미지를 읽을 수 없으면 여기서 throw
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue; // 투명 픽셀 빼고
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
    bins.set(key, b);
  }
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
  const out = [];
  for (const [r, g, b] of sorted) {
    if (out.every(([r2, g2, b2]) => Math.hypot(r - r2, g - g2, b - b2) > 48)) out.push([r, g, b]);
    if (out.length >= 5) break;
  }
  if (!out.length) throw new Error('empty');
  return out.map((rgb) => `#${rgb.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`);
}

/**
 * 배너 색으로 집 — r 로 색 자리 · 모양을 바꿔 '다시 뽑기'. 벽은 밝게(선이 보이게), 지붕은 또렷하게, 문은 벽과 대비 나게.
 */
export function houseFromColors(colors, r = Math.random) {
  const pool = colors.map(toHsl);
  const order = pool.map((c, i) => [c, i, r()]).sort((a, b) => a[2] - b[2]).map(([c]) => c);
  const at = (i) => order[i % order.length];
  const [wh, ws] = at(0);
  const [rh, rs] = at(1);
  const [dh, ds] = at(2);
  const wall = toHex(wh, clamp(ws * 0.6, 8, 60), 86 + r() * 6);
  const roofColor = toHex(rh, clamp(rs, 25, 70), 58 + r() * 12);
  let dl = 48 + r() * 14;
  if (Math.abs(dl - 89) < 25) dl = 50; // 벽과 대비
  const doorColor = toHex(dh, clamp(ds, 15, 55), dl);
  const shape = randomHouse(r);
  return { ...shape, wall, roofColor, doorColor };
}
