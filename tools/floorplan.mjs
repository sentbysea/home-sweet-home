// 평면도 SVG 생성기 — 시안(1024×1536) 좌표를 그대로 옮긴다.
//   node tools/floorplan.mjs  →  src/plan/floorplan.svg
//
// 레이어
//   .hsh-plan__color  채색 — 방 색 덩어리 · 가구 색 · 바탕색 가리개(.hsh-mask).
//                     방([data-room]) 하나가 통째로 튀어나온다(plan/index.js).
//   .hsh-plan__lines  선 — 벽 · 창 · 문 · 가구 윤곽 · 글자. [data-stroke] 가 한 획.
// 모든 가구는 바로 위에서 내려다본 모양(다리 · 정면 모습 없음).

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/plan/floorplan.svg', import.meta.url));


// ---------- 손그림 흔들림(시드 고정) ----------

let seed = 7;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const j = (a) => (rand() * 2 - 1) * a;
const n = (v) => +v.toFixed(1);

// 시안에서 제목과 바깥 여백을 뺀 집 영역
const HOUSE = { x: 76, y: 110, w: 900, h: 1314 };
// 집 전체를 살짝 기울여 손으로 놓은 느낌 — 기운 만큼 보이는 영역을 넓힌다
const TILT = -2;
const VIEW = (() => {
  const t = Math.abs(TILT) * Math.PI / 180;
  const w = HOUSE.w * Math.cos(t) + HOUSE.h * Math.sin(t);
  const h = HOUSE.h * Math.cos(t) + HOUSE.w * Math.sin(t);
  return { x: n(HOUSE.x - (w - HOUSE.w) / 2), y: n(HOUSE.y - (h - HOUSE.h) / 2), w: n(w), h: n(h) };
})();
const CENTER = [HOUSE.x + HOUSE.w / 2, HOUSE.y + HOUSE.h / 2];

/** 꺾은선 — 마디 사이를 살짝 휜 2차 곡선으로 */
function poly(pts, { closed = false, amp = 0.7 } = {}) {
  const p = pts.map(([x, y]) => [x + j(0.35), y + j(0.35)]);
  if (closed) p.push(p[0]);
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const k = j(Math.min(amp, len * 0.02));
    const cx = (x0 + x1) / 2 + (-(y1 - y0) / len) * k;
    const cy = (y0 + y1) / 2 + ((x1 - x0) / len) * k;
    d += `Q${n(cx)} ${n(cy)} ${n(x1)} ${n(y1)}`;
  }
  return closed ? d + 'Z' : d;
}

/** 둥근 네모 */
function rrect(x, y, w, h, r = 3, amp = 0.5) {
  const e = () => j(0.3);
  const s = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const k = j(Math.min(amp, len * 0.02));
    return `Q${n((x0 + x1) / 2 + (-(y1 - y0) / len) * k)} ${n((y0 + y1) / 2 + ((x1 - x0) / len) * k)} ${n(x1)} ${n(y1)}`;
  };
  const a = [x + r + e(), y + e()];
  const b = [x + w - r + e(), y + e()];
  const c = [x + w + e(), y + r + e()];
  const d0 = [x + w + e(), y + h - r + e()];
  const f = [x + w - r + e(), y + h + e()];
  const g = [x + r + e(), y + h + e()];
  const hh = [x + e(), y + h - r + e()];
  const i = [x + e(), y + r + e()];
  return `M${n(a[0])} ${n(a[1])}` +
    s(...a, ...b) + `Q${n(x + w)} ${n(y)} ${n(c[0])} ${n(c[1])}` +
    s(...c, ...d0) + `Q${n(x + w)} ${n(y + h)} ${n(f[0])} ${n(f[1])}` +
    s(...f, ...g) + `Q${n(x)} ${n(y + h)} ${n(hh[0])} ${n(hh[1])}` +
    s(...hh, ...i) + `Q${n(x)} ${n(y)} ${n(a[0])} ${n(a[1])}Z`;
}

/** 타원(원) — 8조각 3차 곡선, 반지름 조금씩 다르게 */
function ellipse(cx, cy, rx, ry = rx, wob = 0.012) {
  const K = 0.2652; // 8조각 원 근사 핸들 비율(4/3·tan(π/16))
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const m = 1 + j(wob);
    pts.push([t, rx * m, ry * m]);
  }
  const at = ([t, a, b]) => [cx + Math.cos(t) * a, cy + Math.sin(t) * b];
  const tan = ([t, a, b]) => [-Math.sin(t) * a, Math.cos(t) * b];
  let d = `M${at(pts[0]).map(n).join(' ')}`;
  for (let i = 0; i < 8; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 8];
    const [x0, y0] = at(p0);
    const [x1, y1] = at(p1);
    const [tx0, ty0] = tan(p0);
    const [tx1, ty1] = tan(p1);
    d += `C${n(x0 + tx0 * K)} ${n(y0 + ty0 * K)} ${n(x1 - tx1 * K)} ${n(y1 - ty1 * K)} ${n(x1)} ${n(y1)}`;
  }
  return d + 'Z';
}

/** 색 덩어리 — 점들을 지나는 부드러운 닫힌 곡선(Catmull-Rom) */
function blob(pts) {
  const p = pts.map(([x, y]) => [x + j(1.5), y + j(1.5)]);
  const N = p.length;
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = p[(i - 1 + N) % N];
    const p1 = p[i];
    const p2 = p[(i + 1) % N];
    const p3 = p[(i + 2) % N];
    d += `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + 'Z';
}

const rot = (deg, cx, cy) => `rotate(${deg} ${cx} ${cy})`;

// ---------- 출력 ----------

const color = []; // [room, markup]
const lines = []; // [room, markup]
let room = 'wall';
const ROOMS = ['wall', 'v', 'bath', 'kitchen', 'living', 'entry', 'e'];

const attr = (o) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ` ${k}="${v}"`).join('');

/** 선 한 획 */
const ln = (d, cls = '', extra = {}) =>
  lines.push([room, `<path data-stroke${attr({ class: cls || null, d, ...extra })}/>`]);
/** 채색 — 튀어나오는 색 */
//   기울인 조각은 겉 <g> 가 튀고 안쪽이 기울기를 가진다(튀는 transform 이 회전을 덮지 않게)
const pop = (d, fill, extra = {}) =>
  color.push([room, extra.transform
    ? `<g class="hsh-pop"><path${attr({ d, fill, ...extra })}/></g>`
    : `<path class="hsh-pop"${attr({ d, fill, ...extra })}/>`]);
/** 여러 조각을 한 덩어리로 튀게 */
const popGroup = (inner, extra = {}) =>
  color.push([room, extra.transform
    ? `<g class="hsh-pop"><g${attr(extra)}>${inner}</g></g>`
    : `<g class="hsh-pop">${inner}</g>`]);
/** 흰 가리개 — 움직이지 않는다 */
const mask = (d, extra = {}) => color.push([room, `<path class="hsh-mask"${attr({ d, ...extra })}/>`]);
/** 윤곽 + 바탕 */
const shape = (d, fill, cls = '', extra = {}) => {
  if (fill === 'mask') mask(d, extra);
  else if (fill) pop(d, fill, extra);
  ln(d, cls, extra);
};
const label = (x, y, text) =>
  lines.push([room, `<text class="hsh-plan__label" data-label x="${x}" y="${y}">${text}</text>`]);

// 색
const C = {
  sky: '#d7edfc',
  mint: '#dff3e5',
  butter: '#fdf2cd',
  pink: '#fbe1e4',
  tile: '#f6fafd',
  tileLine: '#dbe9f6',
  shower: '#dceffc',
  cream: '#fbf4e4',
  wood: '#fcefd6',
  blueBlanket: '#b6d6f2',
  pinkBlanket: '#f9cdd3',
  dark: '#505154',
  grey: '#e5e5e5',
  yellow: '#fde9a6',
  leaf: '#7bbd59',
  leafLine: '#4f8f3a',
  pillowBlue: '#c3e0f7',
};

// =========================================================
// 벽 — 벽 덩어리마다 한 번에 둘러 그린다(바깥선·안선이 이어진 한 획)
// =========================================================
room = 'wall';
const wall = (pts) => ln(poly(pts, { closed: true, amp: 0.9 }), 'hsh-wall');

// 지원 방 왼쪽 · 아래 + 욕실 + 현관 왼쪽
wall([
  [270, 118], [84, 118], [84, 973], [164, 973], [164, 1230], [182, 1230], [182, 973],
  [273, 973], [273, 957], [100, 957], [100, 549], [352, 549], [352, 972], [368, 972],
  [368, 549], [390, 549], [390, 532], [100, 532], [100, 138], [270, 138],
]);
// 지원 방 오른쪽
wall([
  [425, 118], [508, 118], [508, 262], [551, 262], [551, 281], [509, 281], [509, 549],
  [468, 549], [468, 532], [491, 532], [491, 138], [425, 138],
]);
// 주방 위 · 오른쪽
wall([
  [676, 262], [885, 262], [885, 652], [800, 652], [800, 632], [862, 632], [862, 281], [676, 281],
]);
// 우연 방 위 · 오른쪽 — 위 벽은 곧게
wall([
  [832, 930], [852, 930], [852, 944], [969, 944], [969, 1413], [832, 1413], [832, 1392],
  [952, 1392], [952, 962], [550, 962], [550, 1002], [536, 1002], [536, 944], [832, 944],
]);
// 우연 방 왼쪽 · 아래 + 현관 아래
wall([
  [536, 1085], [550, 1085], [550, 1392], [661, 1392], [661, 1413], [536, 1413],
  [536, 1360], [164, 1368], [164, 1333], [182, 1333], [182, 1347], [536, 1334],
]);

// 창 — 가는 겹선 + 양 끝 기둥
const windowH = (x0, x1, y0, y1) => {
  const m = (y0 + y1) / 2;
  ln(poly([[x0 + 6, m - 3.5], [x1 - 6, m - 3.5]], { amp: 0.3 }), 'hsh-thin');
  ln(poly([[x0 + 6, m + 3.5], [x1 - 6, m + 3.5]], { amp: 0.3 }), 'hsh-thin');
  ln(rrect(x0, m - 7, 6, 14, 1), 'hsh-fine');
  ln(rrect(x1 - 6, m - 7, 6, 14, 1), 'hsh-fine');
};
windowH(270, 425, 118, 138);
windowH(551, 676, 262, 281);
windowH(661, 832, 1392, 1413);
// 동쪽 큰 창 — 시안처럼 아래로 갈수록 살짝 오른쪽
ln('M820 658L833 928', 'hsh-thin');
ln('M829 658L843 928', 'hsh-thin');
ln('M824.5 660L838 926', 'hsh-hair');
ln(rrect(820, 652, 10, 7, 1), 'hsh-fine');
ln(rrect(834, 925, 11, 7, 1), 'hsh-fine');

// 문 — 문짝 + 여닫는 호 + 문턱 가는 선
const sill = (pts) => ln(poly(pts, { amp: 0.2 }), 'hsh-hair');
// 지원 방 문(아래 벽, 오른쪽 경첩)
sill([[390, 535], [468, 535]]);
sill([[390, 546], [468, 546]]);
ln('M463 532L463 458', 'hsh-door');
ln('M463 459A73 73 0 0 0 390 532', 'hsh-thin');
// 욕실 문(아래 벽, 오른쪽 경첩)
sill([[273, 960], [352, 960]]);
sill([[273, 970], [352, 970]]);
ln('M348 957L348 881', 'hsh-door');
ln('M348 882A75 75 0 0 0 273 957', 'hsh-thin');
// 현관문(왼쪽 벽, 아래 경첩)
sill([[167, 1233], [167, 1330]]);
sill([[180, 1233], [180, 1330]]);
ln('M180 1328L276 1325', 'hsh-door');
ln('M276 1325A96 96 0 0 0 180 1232', 'hsh-thin');
// 우연 방 문(왼쪽 벽, 위 경첩)
sill([[539, 1002], [539, 1085]]);
sill([[548, 1002], [548, 1085]]);
ln('M550 1004L624 1004', 'hsh-door');
ln('M624 1004A74 74 0 0 1 550 1078', 'hsh-thin');

// =========================================================
// 방 색 덩어리(가구보다 먼저 = 아래)
// =========================================================
room = 'v';
pop(blob([
  [108, 196], [116, 166], [170, 159], [236, 160], [270, 151], [338, 149], [398, 153], [414, 182],
  [410, 240], [416, 300], [406, 342], [368, 362], [312, 381], [262, 400], [242, 400], [240, 300],
  [112, 296], [104, 250],
]), C.sky);
room = 'kitchen';
pop(blob([
  [552, 298], [630, 290], [720, 293], [810, 288], [852, 302], [856, 380], [851, 460], [854, 540],
  [836, 596], [770, 606], [690, 600], [610, 604], [560, 590], [546, 520], [550, 440], [544, 360],
]), C.mint);
room = 'bath';
{
  let grid = '';
  for (let x = 117; x < 352; x += 17) grid += `M${x} 549V957`;
  for (let y = 566; y < 957; y += 17) grid += `M100 ${y}H352`;
  popGroup(
    `<rect x="100" y="549" width="252" height="408" fill="${C.tile}"/>` +
    `<path d="${grid}" fill="none" stroke="${C.tileLine}" stroke-width="0.8"/>`,
  );
}
room = 'living';
pop(blob([
  [394, 694], [450, 688], [530, 691], [604, 688], [640, 700], [656, 740], [650, 800], [664, 880],
  [660, 922], [636, 934], [560, 936], [522, 942], [470, 965], [402, 969], [388, 940], [383, 860], [386, 760],
]), C.butter);
room = 'e';
pop(blob([
  [606, 1105], [642, 1090], [700, 1096], [742, 1087], [786, 1093], [794, 1150], [790, 1250],
  [800, 1336], [780, 1372], [700, 1379], [640, 1372], [612, 1340], [600, 1270], [612, 1200],
  [566, 1172], [562, 1132],
]), C.pink);

// =========================================================
// 지원 방(왼쪽 위)
// =========================================================
room = 'v';
// 침대
shape(rrect(104, 181, 142, 316, 4), C.cream);
ln(rrect(109, 186, 132, 306, 3, 0.3), 'hsh-frame');
shape(rrect(126, 206, 100, 64, 10), 'mask');
shape('M104 302Q175 286 246 302L246 484Q246 492 238 492L112 492Q104 492 104 484Z', C.blueBlanket);
ln('M168 418Q184 422 200 430', 'hsh-crease-blue');
ln('M176 446Q196 456 210 468', 'hsh-crease-blue');
ln('M128 474Q146 466 162 458', 'hsh-crease-blue');
// 책상 · 노트북 · 연필꽂이
shape(rrect(274, 177, 139, 73, 3), C.cream);
popGroup(
  `<path d="${rrect(307, 195, 52, 40, 4)}" fill="${C.dark}"/>` +
  `<path d="M330 208L338 220L322 220Z" fill="#f4f4f4"/>`,
  { transform: rot(-11, 333, 215) },
);
ln(rrect(307, 195, 52, 40, 4), '', { transform: rot(-11, 333, 215) });
ln('M356 242L362 242');
ln('M382 197L382 212Q382 222 390 222Q398 222 398 212L398 197', '');
ln(ellipse(390, 197, 8, 3, 0), 'hsh-fine');
ln('M386 196L383 184M390 196L390 182M394 196L397 185M388 196L387 186', 'hsh-pencil');
// 의자 — 위에서 본 좌판 + 등받이(다리 없음)
function chairDown(cx, top, w, depth) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const b = top + depth;
  const seat = `M${l} ${top}L${l} ${b - 10}Q${cx} ${b + 6} ${r} ${b - 10}L${r} ${top}`;
  const back = `M${l - 7} ${b - 9}Q${cx} ${b + 22} ${r + 7} ${b - 9}L${r} ${b - 7}Q${cx} ${b + 12} ${l} ${b - 7}Z`;
  mask(seat + 'Z');
  ln(seat);
  shape(back, 'mask');
}
chairDown(346, 251, 62, 42);
// 옷장
shape(rrect(440, 174, 51, 243, 2), C.wood);
ln(rrect(451, 268, 5, 100, 2.5, 0.2), 'hsh-fine');
// 둥근 스툴 + 체크 방석
shape(
  'M300 444C334 444 349 456 349 488C349 520 334 533 300 533C266 533 251 520 251 488C251 456 266 444 300 444Z',
  'mask',
);
{
  let g = '';
  for (let i = 1; i < 4; i++) g += `M${273 + i * 13} 464V516M273 ${464 + i * 13}H325`;
  popGroup(
    `<path d="${rrect(273, 464, 52, 52, 5)}" fill="${C.yellow}"/>` +
    `<path d="${g}" fill="none" stroke="#e6c25a" stroke-width="1"/>`,
    { transform: rot(22, 299, 490) },
  );
  ln(rrect(273, 464, 52, 52, 5), '', { transform: rot(22, 299, 490) });
}
label(347, 390, 'ROOM-V');

// =========================================================
// 욕실(지원 방 아래)
// =========================================================
room = 'bath';
shape(rrect(102, 551, 127, 141, 1), C.shower);
ln(rrect(107, 556, 117, 131, 1, 0.3), 'hsh-fine');
ln('M122 634L122 598M115 607L130 607M122 598L122 590Q122 576 136 576Q146 576 147 584', '');
popGroup(`<path d="${ellipse(149, 589, 6.5, 6.5, 0)}" fill="#6fb2e4"/>`, { transform: rot(-30, 149, 589) });
ln(ellipse(149, 589, 6.5, 6.5, 0), 'hsh-fine');
// 세면대
shape(rrect(259, 564, 79, 61, 3), 'mask');
ln(rrect(268, 577, 61, 38, 5), 'hsh-fine');
ln('M298 564L298 580M292 564L304 564', '');
ln(ellipse(298, 590, 1.6, 1.6, 0), 'hsh-fine');
// 변기 — 물탱크 + 둥근 변기
shape(ellipse(158, 866, 31, 29), 'mask');
ln(ellipse(161, 866, 22, 21), 'hsh-fine');
shape(rrect(104, 824, 25, 82, 5), 'mask');
ln(ellipse(114, 864, 2.4, 2.4, 0), 'hsh-fine');
label(234, 787, 'BATH');

// =========================================================
// 주방
// =========================================================
room = 'kitchen';
shape(poly([[575, 298], [862, 296], [862, 419], [797, 419], [797, 374], [575, 375]], { closed: true, amp: 0.5 }), 'mask');
shape(rrect(592, 316, 65, 43, 3), 'mask');
ln(rrect(598, 322, 53, 31, 3, 0.3), 'hsh-fine');
ln('M624 305L624 324M617 305L631 305', '');
ln(ellipse(624, 337, 1.6, 1.6, 0), 'hsh-fine');
popGroup(
  `<path d="${rrect(769, 314, 63, 38, 4)}" fill="${C.dark}"/>` +
  `<circle cx="786" cy="333" r="9.5" fill="none" stroke="#a9a9ad" stroke-width="1.6"/>` +
  `<circle cx="814" cy="333" r="9.5" fill="none" stroke="#a9a9ad" stroke-width="1.6"/>`,
);
ln(rrect(769, 314, 63, 38, 4));
shape(rrect(797, 420, 65, 77, 3), C.grey);
shape(rrect(793, 504, 70, 70, 4), 'mask');
shape(rrect(795, 577, 69, 50, 4), 'mask');
// 식탁 · 의자 둘
function chairSide(tx, dir) {
  // tx: 식탁 가장자리, dir: -1 왼쪽 / 1 오른쪽
  const x = (v) => tx + dir * v;
  const seat = `M${x(0)} 548L${x(12)} 548Q${x(23)} 548 ${x(23)} 560L${x(23)} 588Q${x(23)} 600 ${x(12)} 600L${x(0)} 600`;
  const back = `M${x(12)} 543Q${x(36)} 543 ${x(36)} 574Q${x(36)} 605 ${x(12)} 605L${x(11)} 598` +
    `Q${x(27)} 596 ${x(27)} 574Q${x(27)} 552 ${x(11)} 550Z`;
  mask(seat + 'Z');
  ln(seat);
  shape(back, 'mask');
}
chairSide(603, -1);
chairSide(678, 1);
shape(rrect(603, 516, 75, 118, 3), C.cream);
// 화분
ln('M645 559L640 545M645 559L648 541M645 559L654 548M645 559L636 552', 'hsh-stem');
{
  const leaves = [
    [637, 545, 6, 9, -35], [649, 540, 6, 10, 15], [657, 548, 6, 9, 60],
    [633, 553, 5, 7, -80], [654, 556, 5, 8, 100], [643, 547, 4, 7, -5],
  ];
  popGroup(
    leaves.map(([cx, cy, rx, ry, a]) =>
      `<path d="${ellipse(cx, cy, rx, ry, 0)}" transform="${rot(a, cx, cy)}" fill="${C.leaf}" stroke="${C.leafLine}" stroke-width="0.7"/>`,
    ).join(''),
  );
}
shape(ellipse(645, 568, 10, 11), 'mask');
label(658, 469, 'KITCHEN');

// =========================================================
// 거실
// =========================================================
room = 'living';
shape(rrect(416, 723, 76, 89, 4), 'mask');
shape(rrect(416, 812, 76, 90, 4), 'mask');
shape(rrect(392, 702, 27, 229, 13), 'mask');
shape(rrect(413, 697, 79, 27, 12), 'mask');
shape(rrect(419, 903, 77, 29, 13), 'mask');
shape(rrect(423, 848, 50, 52, 7), C.pillowBlue, '', { transform: rot(-12, 448, 874) });
shape(ellipse(582, 820, 58, 58, 0.006), C.cream);
shape(rrect(549, 790, 44, 40, 4), C.dark, '', { transform: rot(35, 571, 810) });
shape(ellipse(603, 838, 8.5, 8.5, 0), 'mask');
ln('M611 834Q618 836 616 843Q614 847 609 844', 'hsh-fine');
shape(rrect(696, 714, 55, 197, 2), C.wood);
popGroup(
  `<path d="${rrect(712, 727, 12, 128, 3)}" fill="#38383b"/>` +
  `<path d="${rrect(723, 756, 12, 70, 2)}" fill="#5a5a5e"/>`,
);
ln(rrect(712, 727, 12, 128, 3));
ln(rrect(723, 756, 12, 70, 2), 'hsh-fine');
{
  const cols = ['#8fc6ee', '#9fd2f2', '#f3a3ab', '#f7d580', '#cfe6f8', '#a6d9bd'];
  let g = '';
  cols.forEach((c, i) => {
    g += `<rect x="${706 + (i % 3) * 11.5}" y="${866 + Math.floor(i / 3) * 17}" width="10" height="14" rx="1.5" fill="${c}"/>`;
  });
  popGroup(g);
  ln(rrect(705, 864, 36, 36, 2), 'hsh-fine');
}
label(579, 916, 'LIVING');

// =========================================================
// 현관
// =========================================================
room = 'entry';
for (const cx of [349, 379]) {
  shape(ellipse(cx, 1307, 11.5, 25, 0.01), C.cream);
  ln(`M${cx - 10} 1299Q${cx} 1290 ${cx + 10} 1299M${cx - 10} 1305Q${cx} 1296 ${cx + 10} 1305`, 'hsh-fine');
}
// 신발장 — 위에서 본 장 · 그 위에 눕혀 둔 사진 액자
shape(rrect(422, 1254, 80, 83, 2), C.cream);
pop(rrect(422, 1309, 80, 28, 1), C.wood);
ln('M422 1309L502 1309M462 1309L462 1337', 'hsh-fine');
popGroup(
  `<path d="${rrect(434, 1264, 49, 35, 2)}" fill="#bcdcf6"/>` +
  `<path d="M436 1297L436 1284Q444 1276 452 1280Q462 1270 472 1276Q478 1272 481 1274L481 1297Z" fill="#eef7fd"/>`,
);
ln(rrect(434, 1264, 49, 35, 2));
ln('M444 1288L447 1286L450 1288M471 1272L474 1270L477 1272', 'hsh-hair-dark');
label(316, 1211, 'ENTRY');

// =========================================================
// 우연 방(오른쪽 아래)
// =========================================================
room = 'e';
shape(rrect(669, 1001, 111, 66, 3), C.cream);
popGroup(
  `<path d="M690 1027Q703 1021 717 1027L717 1057Q703 1051 690 1057Z" fill="#fff"/>` +
  `<path d="M717 1027Q731 1021 744 1027L744 1057Q731 1051 717 1057Z" fill="#fff"/>` +
  `<path d="M694 1032H712M694 1038H712M694 1044H710M721 1032H740M721 1038H740M721 1044H736M721 1050H738" stroke="#ec8f98" stroke-width="1.3" stroke-dasharray="3 1.5"/>`,
);
ln('M690 1027Q703 1021 717 1027Q731 1021 744 1027L744 1057Q731 1051 717 1057Q703 1051 690 1057Z', 'hsh-fine');
ln('M717 1027L717 1057', 'hsh-fine');
ln('M752 1021L763 1055', 'hsh-pen');
chairDown(725.5, 1068, 58, 32);
// 침대
shape(rrect(805, 1013, 150, 338, 4), C.cream);
ln(rrect(810, 1018, 140, 328, 3, 0.3), 'hsh-frame');
shape(rrect(827, 1032, 101, 69, 10), 'mask');
shape('M805 1134Q880 1118 955 1134L955 1336Q955 1344 947 1344L813 1344Q805 1344 805 1336Z', C.pinkBlanket);
ln('M868 1232Q890 1240 910 1252', 'hsh-crease-pink');
ln('M884 1262Q904 1270 920 1284', 'hsh-crease-pink');
// 옷장
shape(rrect(554, 1143, 63, 222, 2), C.wood);
ln(rrect(601, 1230, 5, 58, 2.5, 0.2), 'hsh-fine');
// 둥근 쿠션 의자(위에서 본 단추 주름)
shape(ellipse(717, 1291, 52, 52, 0.008), '#fce4e6');
ln('M717 1291L700 1270M717 1291L736 1272M717 1291L742 1298M717 1291L724 1316M717 1291L694 1306', 'hsh-crease-pink');
ln(ellipse(717, 1291, 1.8, 1.8, 0), 'hsh-fine');
label(712, 1184, 'ROOM-E');

// ---------- SVG ----------

const byRoom = (list) =>
  ROOMS.map((r) => {
    const items = list.filter(([k]) => k === r).map(([, m]) => '    ' + m);
    return items.length ? `  <g data-room="${r}">\n${items.join('\n')}\n  </g>` : '';
  }).filter(Boolean).join('\n');

const svg = `<!-- tools/floorplan.mjs 로 만든다 — 직접 고치지 말 것 -->
<svg class="hsh-plan__svg" xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="집 평면도 — 지원 방, 욕실, 주방, 거실, 현관, 우연 방">
<g transform="rotate(${TILT} ${CENTER.join(' ')})">
<g class="hsh-plan__color">
${byRoom(color)}
</g>
<g class="hsh-plan__lines">
${byRoom(lines)}
</g>
</g>
</svg>
`;

mkdirSync(new URL('../src/plan/', import.meta.url), { recursive: true });
writeFileSync(OUT, svg);
console.log(`floorplan.svg — 선 ${lines.length}획, 채색 ${color.length}조각`);
