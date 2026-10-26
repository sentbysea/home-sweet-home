// archive 열쇠꾸러미 — three.js 장면(고리 하나에 열쇠 · 키링이 따로따로 매달린다).
//   · 모양: shapes.js 의 2D 윤곽에 손그림 떨림을 입혀 얇게 뽑고(두께), 앞 · 뒷면에 굵기가 고르지 않은 회색 선을 따로 그린다.
//     선은 로딩 집 · 평면도 벽과 같은 부드러운 회색, 휴대폰에서 1.5px 남짓(평면도 선과 비슷한 무게).
//     선은 조금씩 다른 3장을 190ms 마다 번갈아(로딩 화면 · 평면도 위글과 같은 박자) — 흔들림은 작게. 색은 툰 3단(앞 · 옆면 차이 작게) — 실사 금속 · 크롬 반짝임 없이.
//   · 움직임: 꾸러미(고리)는 끌어서 돌린다(좌우 무한, 위아래 조금). 놓으면 관성으로 돌다 멈춘다.
//     열쇠 · 키링은 고리의 한 점에 매달린 진자 — 꾸러미가 돌거나 기울면 늦게 따라오며 흔들리고, 각도는 늘 한도 안이라 떨어져 나가지 않는다.
//   · 고르기: 누르면(끌지 않았을 때만) 그 열쇠가 고리를 타고 맨 앞으로 미끄러져 나오고 살짝 커진다. 같은 열쇠를 또 누르면 onActivate.
//   · 모션 줄이기: 자동 흔들림 · 위글 없음, 관성은 짧게.
//   three.js 는 archive 를 열 때만 받는다(홈 첫 화면에는 싣지 않는다).

import { SHAPES } from './shapes.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
let threeP = null;
/** three.js — 한 번 받으면 다시 열 때 그대로. 못 받으면 다음에 다시 시도 */
export function loadThree() {
  threeP ??= import(THREE_URL).catch((e) => { threeP = null; throw e; });
  return threeP;
}

/** WebGL 을 쓸 수 있는지(그릴 수 없는 환경이면 목록으로) */
export function canUseWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

// ---------- 색 · 선 ----------

const INK = '#8c9195'; // 윤곽 — 로딩 집 · 평면도 선(--hsh-line #8f9497)과 같은 회색(색 면 위라 아주 조금만 짙게)
const DOT = '#6f7478'; // 새 눈 · 열쇠 구멍 같은 작은 점 — 선보다 조금 짙게(묻히지 않게)
const PAPER = '#fcfbf8'; // 바탕(base.css --hsh-paper) — 고르지 않은 조각은 이 색 쪽으로 바랜다
const TONES = {
  // face 는 홈 라벨 파스텔(base.css --hsh-*), side 는 같은 색을 한 단만 — 얇은 옆면이 진한 띠로 보이지 않게
  silver: { face: '#e4e7ea', side: '#d0d5d9' },
  butter: { face: '#fbefae', side: '#ecdd97' },
  sky: { face: '#cfe0fb', side: '#b7ceef' },
  lilac: { face: '#e4d4fb', side: '#cebeef' },
  cloth: { face: '#fffaf0', side: '#ede5d4' },
  pink: { face: '#fbd5e3', side: '#eebccf' },
};
const PEN = 0.013; // 기본 펜 굵기(열쇠 길이 2.1 기준) — 휴대폰에서 1.5px 남짓, PC 에서 2px 남짓
const BOIL_MS = 190;
const BOIL_FRAMES = 3;

// 사이트 오브젝트 → 열쇠 + 키링
//   keySize    열쇠 크기(1 = 보통) — twitter · luvlog 열쇠는 조금 작다(키링은 그대로)
//   charmFront 고르면 키링이 열쇠 옆이 아니라 열쇠 앞(화면 쪽)으로 나온다
//   charmFlip  키링을 열쇠 반대쪽에(맨 앞 home sweet home 이름표에 가리지 않게)
const OBJECTS = {
  bird: { key: 'roundKey', tone: 'silver', charm: 'bird', charmTone: 'sky', keySize: 0.84, charmFlip: true },
  diary: { key: 'roundKey', tone: 'butter', charm: 'diary', charmTone: 'lilac', charmFront: true },
  heart: { key: 'heartKey', tone: 'butter', charm: 'heartLock', charmTone: 'pink', keySize: 0.84 }, // twitter 와 같은 크기
  house: { key: 'houseKey', tone: 'silver' },
};
const HOUSE_LOOKS = [['silver', '#cfe0fb', '#f6c6d6'], ['butter', '#dfd2f6', '#cfe0fb'], ['silver', '#fbefae', '#dfd2f6']];

// ---------- 고리 · 매달기 ----------

const RING_R = 0.78;
const CENTER_Y = -1.12; // 카메라가 보는 곳(꾸러미 가운데쯤)
// 배치 — 고리를 거의 정면으로 보고, 매단 것들을 고리 아래 둘레에 왼쪽 → 오른쪽으로 펼친다(φ 가 클수록 왼쪽)
//   파랑새 · twitter 열쇠 · tistory · luvlog · love 열쇠 … · 맨 오른쪽 home sweet home 이름표
const KEY_L = 0.8; // 첫 열쇠 자리
const KEY_R = -0.72; // 마지막 열쇠 자리
const FAN = 0.42; // 바깥쪽 열쇠일수록 끝이 바깥으로 벌어지는 정도
const FACE_C = 1.2; // 고리 철사에 끼운 채 돌아간 정도 — 정면에서 앞면이 살짝 비스듬히 보이게
const LIMIT = { a: 0.75, b: 1.0, c: 1.25 }; // 진자 각도 한도(쉬는 자리에서)

/** 고리 위 점(φ: 맨 아래 0, 앞쪽 +) — 고리는 YZ 평면 */
const ringPoint = (phi, out) => out.set(0, -RING_R * Math.cos(phi), RING_R * Math.sin(phi));

// 작은 결정적 난수 — 새로고침해도 같은 손그림
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** 긴 선분을 잘게(꼭짓점은 그대로 — 열쇠 이빨이 뭉개지지 않게) */
function subdivide(pts, step, closed) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** 손그림 떨림 — 선을 따라 잘게 출렁이는 만큼 법선 방향으로 민다(큰 물결 + 잔물결 두 겹) */
function wobble(pts, amp, seed, closed) {
  const r = rng(seed);
  const f1 = 14 + r() * 6;
  const f2 = 32 + r() * 14;
  const f3 = 70 + r() * 30;
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  const p3 = r() * 6.28;
  let s = 0;
  const n = pts.length;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const d = amp * (Math.sin(s * f1 + p1) * 0.5 + Math.sin(s * f2 + p2) * 0.32 + Math.sin(s * f3 + p3) * 0.18);
    return [p[0] - ty * d, p[1] + tx * d];
  });
}

/** 펜 선 — 굵기가 조금씩 다른 납작한 띠(삼각형). 꺾이는 곳은 각을 살리되 너무 뾰족하지 않게 */
function ribbon(pts, closed, width, seed, acc) {
  const r = rng(seed);
  const f = 12 + r() * 8;
  const p = r() * 6.28;
  const n = pts.length;
  if (n < 2) return;
  const base = acc.pos.length / 3;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    if (i) s += Math.hypot(cur[0] - pts[i - 1][0], cur[1] - pts[i - 1][1]);
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    // 앞뒤 선분 법선의 평균(마이터)
    const n1 = norm(cur[0] - prev[0], cur[1] - prev[1]);
    const n2 = norm(next[0] - cur[0], next[1] - cur[1]);
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { mx = n2[0]; my = n2[1]; } else { mx /= ml; my /= ml; }
    const dot = Math.max(0.5, mx * n2[0] + my * n2[1]);
    let w = width * (0.82 + 0.36 * (0.5 + 0.5 * Math.sin(s * f + p)));
    if (!closed && (i === 0 || i === n - 1)) w *= 0.55; // 열린 선 끝은 펜을 떼듯 가늘게
    const h = w / 2 / dot;
    acc.pos.push(cur[0] + mx * h, cur[1] + my * h, 0, cur[0] - mx * h, cur[1] - my * h, 0);
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = base + i * 2;
    const b = base + ((i + 1) % n) * 2;
    acc.idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
}
function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [-y / l, x / l];
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ id: string, name: string, url: string, object: string, tone?: string }[]} sites
 * @param {{ reduced?: boolean, onSelect?: (i: number | null) => void, onActivate?: (i: number) => void }} opts
 */
export async function createKeyring(canvas, sites, { reduced = false, onSelect = () => {}, onActivate = () => {} } = {}) {
  const T = await loadThree();
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.autoClear = false; // 조각마다 따로 그린다(drawLayered)

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(28, 1, 0.1, 60);
  // 면 색이 거의 그대로(손그림 색) 보이게 — 주변광이 대부분, 해는 몇 단 그늘만
  scene.add(new T.AmbientLight(0xffffff, 1.05));
  const sun = new T.DirectionalLight(0xffffff, 1.35);
  sun.position.set(-2.5, 3, 5);
  scene.add(sun);
  const back = new T.DirectionalLight(0xffffff, 0.5); // 뒷면도 너무 어둡지 않게
  back.position.set(2, 1, -4);
  scene.add(back);

  // 툰 3단 — 그림처럼 면 밝기가 몇 칸으로만 바뀐다. 그늘은 옅게(강한 그림자 없이)
  const ramp = new T.DataTexture(new Uint8Array([200, 230, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter;
  ramp.needsUpdate = true;

  const disposables = [ramp];
  const keep = (x) => { disposables.push(x); return x; };
  const toon = (hex) => keep(new T.MeshToonMaterial({ color: hex, gradientMap: ramp }));
  const inkMat = () => keep(new T.MeshBasicMaterial({ color: INK, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const fillMat = (hex) => keep(new T.MeshBasicMaterial({ color: hex, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));

  const bundle = new T.Group();
  scene.add(bundle);
  const ringParts = []; // 고리(조각보다 먼저, 맨 뒤에 그린다)

  // ---------- 고리(두 바퀴 감긴 납작 고리) — 바깥에 회색 테(안팎 뒤집은 껍질, 굵기를 조금씩 흔들어) ----------
  const ringMat = toon(TONES.silver.face);
  const hullMat = keep(new T.MeshBasicMaterial({ color: INK, side: T.BackSide }));
  const addTorus = (r, tube, arc, rotZ, x) => {
    const g = keep(new T.TorusGeometry(r, tube, 10, 120, arc));
    const m = new T.Mesh(g, ringMat);
    const hg = keep(new T.TorusGeometry(r, tube + 0.0075, 8, 120, arc));
    const pos = hg.attributes.position;
    const nor = hg.attributes.normal;
    const rr = rng(Math.round(r * 1000));
    const ph = rr() * 6;
    for (let i = 0; i < pos.count; i++) {
      const u = Math.atan2(pos.getY(i), pos.getX(i));
      const d = 0.003 * Math.sin(u * 7 + ph) + 0.002 * Math.sin(u * 17 + ph * 2);
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d);
    }
    const h = new T.Mesh(hg, hullMat);
    const holder = new T.Group();
    holder.add(m, h);
    holder.rotation.set(0, Math.PI / 2, rotZ);
    holder.position.x = x;
    bundle.add(holder);
    ringParts.push(holder);
  };
  addTorus(RING_R, 0.03, Math.PI * 2, 0, 0);
  addTorus(RING_R - 0.01, 0.028, Math.PI * 0.5, Math.PI * 0.5, 0.062);

  // ---------- 조각(열쇠 · 키링 · 라벨) ----------

  /** 2D 모양 → 두께 있는 몸통 + 칠 + 위글 선 3장 */
  const buildPiece = (def, tone, depth, seed, pen = PEN) => {
    const group = new T.Group();
    const faceMat = toon(TONES[tone].face);
    const sideMat = toon(TONES[tone].side);
    const ink = inkMat();
    const fills = [];
    const outline = wobble(subdivide(def.outline, 0.018, true), 0.005, seed, true);
    const shape = new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y)));
    for (const [hi, h] of def.holes.entries()) {
      shape.holes.push(new T.Path(wobble(subdivide(h, 0.02, true), 0.004, seed + 7 + hi, true).map(([x, y]) => new T.Vector2(x, y))));
    }
    const geo = keep(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }));
    geo.translate(0, 0, -depth / 2);
    const body = new T.Mesh(geo, [faceMat, sideMat]);
    group.add(body);

    const zf = depth / 2 + 0.0015;
    for (const f of def.fills) {
      const g = keep(new T.ShapeGeometry(new T.Shape(wobble(subdivide(f.pts, 0.03, true), 0.004, seed + 3, true).map(([x, y]) => new T.Vector2(x, y)))));
      const mat = f.color === 'ink' ? fillMat(DOT) : fillMat(f.color);
      if (f.color !== 'ink') fills.push(mat); // 점(ink)은 바래지 않는다
      for (const z of [zf, -zf]) {
        const m = new T.Mesh(g, mat);
        m.position.z = z;
        group.add(m);
      }
    }

    // 선 — 바깥 윤곽 · 구멍 · 안쪽 묘사, 프레임마다 떨림이 다르다
    const frames = [];
    const zs = depth / 2 + 0.003;
    for (let k = 0; k < BOIL_FRAMES; k++) {
      const acc = { pos: [], idx: [] };
      const s = seed * 31 + k * 101;
      ribbon(wobble(subdivide(def.outline, 0.012, true), 0.0055, s + 1, true), true, pen, s + 2, acc);
      def.holes.forEach((h, i) => ribbon(wobble(subdivide(h, 0.01, true), 0.004, s + 10 + i, true), true, pen * 0.8, s + 11 + i, acc));
      def.lines.forEach((ln, i) => ribbon(wobble(subdivide(ln.pts, 0.012, Boolean(ln.closed)), 0.0045, s + 20 + i, Boolean(ln.closed)), Boolean(ln.closed), pen * (ln.w ?? 1), s + 21 + i, acc));
      const g = keep(new T.BufferGeometry());
      g.setAttribute('position', new T.Float32BufferAttribute(acc.pos, 3));
      g.setIndex(acc.idx);
      const frame = new T.Group();
      for (const z of [zs, -zs]) {
        const m = new T.Mesh(g, ink);
        m.position.z = z;
        frame.add(m);
      }
      frame.visible = k === 0;
      group.add(frame);
      frames.push(frame);
    }
    const base = { face: faceMat.color.clone(), side: sideMat.color.clone(), ink: ink.color.clone(), fills: fills.map((m) => m.color.clone()) };
    return { group, body, frames, mats: { faceMat, sideMat, ink, fills }, base };
  };

  // 고리에 끼우는 작은 쇠고리(키링 귀) — 키링 면과 직각으로 서서 고리 철사를 감는다
  const jumpRing = () => {
    const g = new T.Group();
    const geo = keep(new T.TorusGeometry(0.075, 0.016, 8, 40));
    const hull = keep(new T.TorusGeometry(0.075, 0.016 + 0.0065, 6, 40));
    g.add(new T.Mesh(geo, ringMat), new T.Mesh(hull, hullMat));
    g.rotation.y = Math.PI / 2;
    return g;
  };

  // 가죽 이름표 글씨 — 바이브.me 로딩과 같은 글꼴, 위에서 아래로 세로(첨부 키링 이름표처럼)
  const labelTexture = async (w, h) => {
    try { await document.fonts?.load('80px "Nanum Gothic Coding"'); } catch { /* 기본 글꼴로 */ }
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = Math.round((256 * h) / w);
    const x = c.getContext('2d');
    x.fillStyle = TONES.cloth.face;
    x.fillRect(0, 0, c.width, c.height);
    // 가장자리 바느질
    x.strokeStyle = '#d6c6ad';
    x.lineWidth = 5;
    x.setLineDash([18, 12]);
    x.strokeRect(22, 22, c.width - 44, c.height - 44);
    x.setLineDash([]);
    x.save();
    x.translate(c.width / 2, c.height / 2);
    x.rotate(Math.PI / 2);
    x.fillStyle = '#4f5357';
    x.font = '76px "Nanum Gothic Coding", ui-monospace, monospace';
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    // 글씨 바로 뒤(마지막 home 옆)에 빨간 집 — 글씨와 같이 90° 돌아 있다. 글씨 + 집을 한 덩어리로 가운데에
    const text = 'home sweet home';
    const u = 0.95; // 집 크기(폭 약 53px)
    const gap = 18;
    const houseW = 56 * u;
    const tw = x.measureText(text).width;
    const x0 = -(tw + gap + houseW) / 2;
    x.fillText(text, x0, 4);
    const hx = x0 + tw + gap + houseW / 2;
    const hy = 2;
    x.fillStyle = '#e8574d';
    x.beginPath();
    x.moveTo(hx, hy - 30 * u);
    x.lineTo(hx + 28 * u, hy - 6 * u);
    x.lineTo(hx + 19 * u, hy - 6 * u);
    x.lineTo(hx + 19 * u, hy + 24 * u);
    x.lineTo(hx - 19 * u, hy + 24 * u);
    x.lineTo(hx - 19 * u, hy - 6 * u);
    x.lineTo(hx - 28 * u, hy - 6 * u);
    x.closePath();
    x.fill();
    x.restore();
    const t = keep(new T.CanvasTexture(c));
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  // ---------- 매달 것들 ----------
  //   진자 하나 = 고리 위 한 점(φ)에 매달린 조각. a 면 안에서 흔들림 · b 앞뒤로 흔들림 · c 제자리 돌기

  const pendulums = [];
  const addPendulum = (piece, o) => {
    const holder = new T.Group();
    holder.add(piece.group);
    bundle.add(holder);
    const p = {
      piece, holder, site: o.site ?? null, kind: o.kind, follow: o.follow ?? null,
      phi: o.phi, phiT: o.phi, phi0: o.phi, phiOff: o.phiOff ?? 0, phiSel: o.phiSel ?? (o.phiOff ?? 0) * 1.6,
      a0: o.a0, aSel: o.aSel ?? 0, b0: o.b0 ?? 0, bSel: o.bSel ?? -0.34, c0: o.c0 ?? 0, size: o.size ?? 1,
      layer: o.layer ?? 0, layerSel: o.layerSel ?? 0.08, front: o.front ?? 0, order: 0,
      a: o.a0, b: o.b0 ?? 0, c: o.c0 ?? 0, va: 0, vb: 0, vc: 0,
      sel: 0, dim: 0, mass: o.mass ?? 1,
      seed: o.seed, pa: rng(o.seed)() * 6.28, pb: rng(o.seed + 1)() * 6.28,
    };
    piece.group.traverse((m) => { m.userData.pend = p; });
    pendulums.push(p);
    return p;
  };

  const n = sites.length;
  const keys = [];
  const rand = rng(77);
  let houses = 0;
  sites.forEach((site, i) => {
    const spec = OBJECTS[site.object] || OBJECTS.house;
    let tone = spec.tone;
    let def;
    if (spec.key === 'houseKey') {
      const [t, win, door] = HOUSE_LOOKS[houses++ % HOUSE_LOOKS.length];
      tone = t;
      def = SHAPES.houseKey(win, door);
    } else {
      def = SHAPES[spec.key]();
    }
    if (site.tone && TONES[site.tone]) tone = site.tone;
    const phi = n > 1 ? KEY_L + ((KEY_R - KEY_L) * i) / (n - 1) : 0;
    const a0 = (-FAN * phi) / KEY_L; // 왼쪽 열쇠는 왼쪽으로, 오른쪽 열쇠는 오른쪽으로 벌어진다
    // 겹치는 열쇠끼리 앞뒤로 조금씩 — 서로 뚫고 지나가 보이지 않게(b<0 은 끝이 화면 쪽으로)
    const b0 = [0.06, -0.08, 0.1, -0.04][i % 4];
    const layer = [0, 0.035, -0.03, 0.02][i % 4];
    const size = spec.keySize ?? 1;
    // 작게 줄인 열쇠도 선 굵기는 같게(펜을 그만큼 굵게)
    const key = addPendulum(buildPiece(def, tone, 0.075, 11 + i * 17, PEN / size), {
      site: i, kind: 'key', phi, a0, b0, layer, c0: FACE_C + (rand() - 0.5) * 0.2, seed: 300 + i * 13, mass: size, size,
    });
    keys.push(key);
    if (spec.charm) {
      const piece = buildPiece(SHAPES[spec.charm](), spec.charmTone, 0.09, 101 + i * 23);
      piece.group.add(jumpRing());
      // charmFlip(파랑새) — 열쇠 바깥 왼쪽, 맨 앞 줄로 화면 쪽에 나와 있다. 나머지는 제 열쇠 왼쪽 틈에(오른쪽 끝 이름표 · 집 열쇠 머리를 가리지 않게)
      const off = spec.charmFlip ? 0.42 : 0.2;
      addPendulum(piece, {
        site: i, kind: 'charm', follow: key, phi: phi + off, phiOff: off, seed: 500 + i * 7, mass: 0.6,
        a0: (-FAN * 0.6 * (phi + off)) / KEY_L, c0: FACE_C + (rand() - 0.5) * 0.2,
        b0: spec.charmFlip ? -0.38 : -0.16, layer: spec.charmFlip ? 0.06 : 0.045, front: spec.charmFlip ? 0.35 : 0.05,
        // 고르면 — 열쇠 앞(제 열쇠 머리 위 · 화면 쪽) 또는 열쇠 옆으로 비켜
        ...(spec.charmFront ? { phiSel: 0.04, aSel: 0, bSel: -0.62, layerSel: 0.12 } : { phiSel: off * 1.25, aSel: a0 * 1.2, bSel: -0.5, layerSel: 0.1 }),
      });
    }
  });
  // 가죽 이름표 — 작은 고리로 큰 고리에 걸려 열쇠들 옆에 아래로 늘어진 home sweet home
  const LABEL_DEPTH = 0.045;
  const labelDef = SHAPES.label();
  const labelPiece = buildPiece(labelDef, 'cloth', LABEL_DEPTH, 909);
  labelPiece.group.add(jumpRing());
  const { x0, y0, x1, y1 } = labelDef.face;
  const fw = x1 - x0 - 0.03;
  const fh = y1 - y0 - 0.03;
  const tex = await labelTexture(fw, fh);
  const plane = keep(new T.PlaneGeometry(fw, fh));
  const labelMat = keep(new T.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  for (const [z, ry] of [[LABEL_DEPTH / 2 + 0.0015, 0], [-LABEL_DEPTH / 2 - 0.0015, Math.PI]]) {
    const m = new T.Mesh(plane, labelMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    m.rotation.y = ry;
    labelPiece.group.add(m);
  }
  // 맨 오른쪽 · 맨 앞 줄 — 다른 것에 가리지 않고 아래로 곧게 늘어진다
  addPendulum(labelPiece, { kind: 'label', phi: -1.62, a0: 0.3, b0: -0.3, c0: FACE_C + 0.05, layer: 0.07, front: 0.45, seed: 999, mass: 0.55 });

  // ---------- 화면 맞추기 ----------
  const fit = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 꾸러미 높이 약 4.2 · 폭 약 3.3 이 다 들어가게 — 휴대폰(세로)에서는 폭 기준으로 크게
    const halfH = 2.2;
    const phone = w < 560;
    const halfW = phone ? 1.42 : 1.6;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    // 휴대폰은 꾸러미를 85% 쯤으로 — 아래 버튼 줄 · 링크와 답답하게 붙지 않게
    const d = Math.max(halfH / t, halfW / (t * camera.aspect)) / (phone ? 0.85 : 1);
    camera.position.set(0, CENTER_Y + 0.35, d);
    camera.lookAt(0, CENTER_Y, 0);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);

  // ---------- 끌어 돌리기 · 누르기 ----------
  const YAW0 = -1.42; // 고리를 거의 정면으로 — 매단 것들이 좌우로 펼쳐 보이고, 열쇠 앞면은 살짝 비스듬히
  const PITCH0 = 0.08;
  const st = { yaw: YAW0, pitch: PITCH0, vyaw: 0, vpitch: 0, yawT: null, drag: null, moved: false, selected: null };
  let lastVyaw = 0;
  let lastVpitch = 0;

  const slop = (e) => (e.pointerType === 'mouse' ? 5 : 10);
  const sens = () => Math.min(0.016, Math.max(0.0065, 5.4 / (canvas.clientWidth || 600)));

  const onDown = (e) => {
    if (e.button > 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    st.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, hist: [[performance.now(), e.clientX, e.clientY]] };
    st.moved = false;
  };
  const onMove = (e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!st.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > slop(e)) {
      st.moved = true;
      st.yawT = null; // 손으로 돌리기 시작하면 자동으로 돌려 주던 것은 그만
      canvas.classList.add('is-dragging');
    }
    if (st.moved) {
      const k = sens();
      st.yaw += (e.clientX - d.x) * k;
      st.pitch = Math.max(-0.42, Math.min(0.5, st.pitch + (e.clientY - d.y) * k * 0.5));
    }
    d.x = e.clientX;
    d.y = e.clientY;
    const now = performance.now();
    d.hist.push([now, e.clientX, e.clientY]);
    while (d.hist.length > 2 && now - d.hist[0][0] > 90) d.hist.shift();
  };
  const onUp = (e) => {
    const d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    if (st.moved) {
      const [t0, x0, y0] = d.hist[0];
      const dt = Math.max(16, performance.now() - t0) / 1000;
      const k = sens();
      st.vyaw = reduced ? 0 : Math.max(-9, Math.min(9, ((d.x - x0) * k) / dt));
      st.vpitch = reduced ? 0 : Math.max(-4, Math.min(4, ((d.y - y0) * k * 0.5) / dt));
    }
    st.drag = null;
    canvas.classList.remove('is-dragging');
  };

  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const box = new T.Box3();
  const v3 = new T.Vector3();

  /** 누른 곳의 사이트 — 열쇠 · 키링 몸통에 맞으면 그것, 아니면 손가락 크기만큼 둘레까지 */
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pendulums.filter((p) => p.site != null).map((p) => p.piece.body), false);
    // 화면에 맨 위로 그려진 조각이 이긴다(drawLayered 순서)
    if (hits.length) return hits.reduce((a, h) => (h.object.userData.pend.order > a.object.userData.pend.order ? h : a)).object.userData.pend.site;
    // 가장 가까운 화면 상자(여유 22px)
    const pad = 22;
    let best = null;
    let bestD = Infinity;
    for (const p of pendulums) {
      if (p.site == null) continue;
      box.setFromObject(p.piece.body);
      let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity;
      for (let i = 0; i < 8; i++) {
        v3.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const sx = r.left + ((v3.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - v3.y) / 2) * r.height;
        l = Math.min(l, sx); rr = Math.max(rr, sx); t = Math.min(t, sy); b = Math.max(b, sy);
      }
      if (cx < l - pad || cx > rr + pad || cy < t - pad || cy > b + pad) continue;
      const dx = Math.max(l - cx, 0, cx - rr);
      const dy = Math.max(t - cy, 0, cy - b);
      const dd = Math.hypot(dx, dy);
      if (dd < bestD) { bestD = dd; best = p.site; }
    }
    return best;
  };

  // click — 끌었으면 무시(돌리다 놓은 것을 누름으로 보지 않는다). 새 탭 열기는 click 안에서라야 막히지 않는다
  const onClick = (e) => {
    if (st.moved) { st.moved = false; return; }
    const i = pick(e.clientX, e.clientY);
    if (i != null && i === st.selected) onActivate(i);
    else select(i, { turn: false });
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('click', onClick);

  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

  /** 고르기(null = 풀기). turn — 고른 열쇠가 뒤에 있으면 꾸러미를 앞으로 돌려 준다 */
  function select(i, { turn = true } = {}) {
    const next = i == null || i < 0 || i >= n ? null : i;
    if (next === st.selected) return;
    st.selected = next;
    if (next != null) {
      // 열쇠 앞면이 보이는 가까운 각도(조금 비스듬히)로 — 뒤를 보고 있었거나 키보드로 골랐을 때
      const face = -keys[next].c0 - 0.22;
      const target = st.yaw + wrap(face - st.yaw);
      if (turn || Math.abs(wrap(face - st.yaw)) > 1.1) st.yawT = target;
      st.vyaw = 0;
    }
    onSelect(next);
  }

  // ---------- 움직임 ----------
  const tmp = new T.Vector3();
  const tick = (dt, time) => {
    // 꾸러미
    if (!st.drag) {
      if (st.yawT != null) {
        const k = reduced ? 60 : 26;
        const dmp = reduced ? 16 : 9.5;
        st.vyaw += (k * (st.yawT - st.yaw) - dmp * st.vyaw) * dt;
        if (Math.abs(st.yawT - st.yaw) < 0.002 && Math.abs(st.vyaw) < 0.01) { st.yaw = st.yawT; st.vyaw = 0; st.yawT = null; }
      } else {
        st.vyaw *= Math.exp(-(reduced ? 14 : 1.9) * dt);
      }
      st.yaw += st.vyaw * dt;
      st.vpitch += (18 * (PITCH0 - st.pitch) - 7 * st.vpitch) * dt;
      st.pitch = Math.max(-0.42, Math.min(0.5, st.pitch + st.vpitch * dt));
    }
    const ddt = Math.max(dt, 1e-3);
    // 꾸러미 각속도 변화(끌 때는 손이 준 만큼)
    const curVyaw = st.drag ? (st.yaw - (tick.py ?? st.yaw)) / ddt : st.vyaw;
    const curVpitch = st.drag ? (st.pitch - (tick.pp ?? st.pitch)) / ddt : st.vpitch;
    const ay = Math.max(-60, Math.min(60, (curVyaw - lastVyaw) / ddt));
    const ap = Math.max(-40, Math.min(40, (curVpitch - lastVpitch) / ddt));
    lastVyaw = curVyaw;
    lastVpitch = curVpitch;
    tick.py = st.yaw;
    tick.pp = st.pitch;
    bundle.rotation.set(st.pitch, st.yaw, 0, 'XYZ');

    const any = st.selected != null;
    const idle = reduced ? 0 : 1;
    const damp = reduced ? 12 : 3.6;
    for (const p of pendulums) {
      const mine = p.site != null && p.site === st.selected;
      const toSel = mine ? 1 : 0;
      p.sel += (toSel - p.sel) * Math.min(1, dt * (reduced ? 30 : 8));
      const toDim = any && !mine ? 1 : 0;
      p.dim += (toDim - p.dim) * Math.min(1, dt * 8);
      // 고리 위 자리 — 키링은 제 열쇠 옆을 따라간다
      const phiT = p.follow ? p.follow.phiT + (mine ? p.phiSel : p.phiOff) : p.phiT;
      p.phi += (phiT - p.phi) * Math.min(1, dt * (reduced ? 30 : 5.5));

      // 쉬는 자세 — 고르면 똑바로 · 살짝 앞으로(b<0 이 화면 쪽) · 앞면이 화면을 보게
      const faceTwist = Math.max(-LIMIT.c, Math.min(LIMIT.c, -wrap(st.yaw)));
      const aRest = p.a0 * (1 - p.sel) + p.aSel * p.sel;
      const bRest = (p.b0 * (1 - p.sel) + p.bSel * p.sel) - st.pitch; // 고리가 기울어도 매달린 것은 아래로
      const cRest = p.c0 * (1 - p.sel) + faceTwist * p.sel;
      const m = p.mass;
      const na = idle * Math.sin(time * 0.9 + p.pa) * 0.9;
      const nb = idle * Math.sin(time * 0.7 + p.pb) * 0.7;
      const nc = idle * Math.sin(time * 0.5 + p.pa * 1.7) * 0.5;
      const side = Math.sin(p.phi) >= 0 ? 1 : -1;
      p.va += ((34 / m) * (aRest - p.a) - damp * p.va + ay * 0.32 * side + na) * dt;
      p.vb += ((30 / m) * (bRest - p.b) - damp * p.vb + ap * 0.9 + ay * 0.12 * side + nb) * dt;
      p.vc += ((20 / m) * (cRest - p.c) - (damp + 0.6) * p.vc - ay * 0.55 + nc) * dt;
      p.a += p.va * dt;
      p.b += p.vb * dt;
      p.c += p.vc * dt;
      // 한도 — 부딪히면 그 방향 속도를 버린다(떨어져 나가거나 한 바퀴 돌지 않게)
      if (Math.abs(p.a - aRest) > LIMIT.a) { p.a = aRest + Math.sign(p.a - aRest) * LIMIT.a; p.va *= -0.2; }
      if (Math.abs(p.b + st.pitch) > LIMIT.b) { p.b = -st.pitch + Math.sign(p.b + st.pitch) * LIMIT.b; p.vb *= -0.2; }
      if (Math.abs(p.c - cRest) > LIMIT.c) { p.c = cRest + Math.sign(p.c - cRest) * LIMIT.c; p.vc *= -0.2; }

      ringPoint(p.phi, tmp);
      p.holder.position.copy(tmp);
      p.holder.position.x += p.layer + p.layerSel * p.sel; // 앞뒤 줄(고리 정면에서 화면 쪽이 +) — 고르면 앞으로
      p.holder.rotation.set(p.b, p.c, p.a, 'YXZ');
      p.piece.group.scale.setScalar(p.size * (1 + 0.12 * p.sel * (p.kind === 'key' ? 1 : 0.6)));
      // 고르지 않은 것은 조금 바랜다
      const fade = p.dim * 0.4;
      const { mats, base } = p.piece;
      mats.faceMat.color.copy(base.face).lerp(WHITE, fade);
      mats.sideMat.color.copy(base.side).lerp(WHITE, fade);
      mats.ink.color.copy(base.ink).lerp(WHITE, fade * 0.75);
      mats.fills.forEach((mm, j) => mm.color.copy(base.fills[j]).lerp(WHITE, fade));
    }
  };
  const WHITE = new T.Color(PAPER);

  // 위글 — 3장 중 하나만
  let boil = 0;
  let boilAt = 0;
  const setBoil = (k) => pendulums.forEach((p) => p.piece.frames.forEach((f, j) => { f.visible = j === k; }));

  // ---------- 그리기 — 조각을 하나씩, 먼 것부터(앞 조각이 뒤 조각을 늘 통째로 가린다) ----------
  //   얇은 조각끼리 깊이로만 그리면 흔들리다 서로 뚫고 지나가 보인다(뒤 키링이 이름표를 뚫고 나오는 것 같은).
  //   그래서 고리를 먼저 그리고, 조각마다 깊이를 지우고 하나씩 덧그린다 — 한 조각 안(두께 · 선 · 칠)만 깊이로.
  //   순서 = 화면 쪽 거리 + 앞 기울임(front: 이름표 · 파랑새, 고른 열쇠와 그 키링). 뒤에서 보면 거리가 커서 뒤집힌다.
  const viewInv = new T.Matrix4();
  const vc = new T.Vector3();
  const drawLayered = () => {
    scene.updateMatrixWorld();
    viewInv.copy(camera.matrixWorldInverse);
    for (const p of pendulums) {
      p.piece.group.localToWorld(vc.set(0, p.kind === 'key' ? -0.9 : -0.35, 0));
      p.depth = vc.applyMatrix4(viewInv).z + p.front + p.sel * (p.kind === 'charm' ? 0.75 : 0.7);
    }
    const sorted = [...pendulums].sort((a, b) => a.depth - b.depth);
    sorted.forEach((p, i) => { p.order = i; });
    renderer.clear();
    for (const p of pendulums) p.holder.visible = false;
    renderer.render(scene, camera); // 고리
    for (const r of ringParts) r.visible = false;
    for (const p of sorted) {
      p.holder.visible = true;
      renderer.clearDepth();
      renderer.render(scene, camera);
      p.holder.visible = false;
    }
    for (const r of ringParts) r.visible = true;
    for (const p of pendulums) p.holder.visible = true;
  };

  let raf = 0;
  let last = performance.now();
  let alive = true;
  const loop = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    let dt = Math.min(1 / 20, (now - last) / 1000);
    last = now;
    // 두 번 나눠 계산(빠르게 돌려도 흔들림이 튀지 않게)
    dt /= 2;
    tick(dt, now / 1000);
    tick(dt, now / 1000 + dt);
    if (!reduced && now - boilAt > BOIL_MS) { boilAt = now; boil = (boil + 1) % BOIL_FRAMES; setBoil(boil); }
    drawLayered();
  };
  raf = requestAnimationFrame(loop);

  /** 고른 열쇠 옆(이름표를 붙일 화면 좌표, 캔버스 기준) */
  const anchor = (i) => {
    const k = keys[i];
    if (!k) return null;
    k.piece.group.localToWorld(v3.set(0.5, -0.3, 0));
    v3.project(camera);
    if (v3.z > 1) return null;
    return { x: ((v3.x + 1) / 2) * canvas.clientWidth, y: ((1 - v3.y) / 2) * canvas.clientHeight };
  };

  // 확인(E2E)용 — 열쇠 i 날 가운데의 화면 좌표(누르기 · 끌기 시험)
  canvas.hshKeyPoint = (i) => {
    const k = keys[i];
    if (!k) return null;
    k.piece.group.localToWorld(v3.set(0, -1.3, 0));
    v3.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((v3.x + 1) / 2) * r.width, y: r.top + ((1 - v3.y) / 2) * r.height };
  };

  const dispose = () => {
    alive = false;
    delete canvas.hshKeyPoint;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('click', onClick);
    for (const d of disposables) d.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
  };

  return { select, anchor, dispose, get selected() { return st.selected; } };
}
