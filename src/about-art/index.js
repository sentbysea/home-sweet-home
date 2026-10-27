// about 글자 아트 — 본문 위 칸에 글자들이 모여 형상을 이룬다(캔버스 하나, 장식이라 스크린리더는 칸의 대체 설명만 읽는다).
//   형상(shapes.js)을 칸 크기에 맞춰 고정폭 글자 칸으로 나누고, 칸마다 글자(glyphs.js) 하나 = 입자 하나.
//   전환: 지금 글자들이 느슨하게 풀렸다가(LOOSE) 새 형상의 칸으로 옮겨 간다 — 부분마다 정한 차례(order · sweep)대로, 1.4초쯤.
//     같은 형상을 다시 부르면 크게 흩어졌다가 다시 모인다(등장 재생). 전환 중에 또 부르면 그 순간 자리에서 바로 새 전환 — 겹치지 않는다.
//   다 모이면 부분마다 미세하게 흔들리고(sway), 형상의 효과(effects.js)가 이어진다. 움직일 것이 없으면 그리기를 멈춘다.
//   화면 밖이면 멈춘 효과는 그리지 않고, 모션 줄이기면 늘 마지막 모습만 그린다.

import { SHAPES } from './shapes.js';
import { glyphsFor } from './glyphs.js';
import { EFFECTS } from './effects.js';

const LOOSE = 320; // 풀리는 시간
const LEAD = 180; // 풀리기 시작해서 첫 글자가 옮겨 가기까지
const SPREAD = 620; // 차례(0~1)가 벌어지는 폭
const MOVE = 640; // 글자 하나가 옮겨 가는 시간
const TOTAL = LEAD + SPREAD + MOVE;
const IDLE_MS = 33; // 다 모인 뒤에는 초당 30번쯤만 그린다

// 부분 색 — 기본은 본문 글자색(--hsh-text)
const INKS = {
  soft: '#7d8386',
  flower: '#e08f00', // Echo 꿀색
  stem: '#6d9a68',
  ribbon: '#00a894', // Vibe 청록
  roof: '#d9706f',
  door: '#b7895c',
  glow: '#e39a00',
  gold: '#c39a2f', // 견장
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- 도형 안에 있나(단위 좌표) ----------

const geo = new WeakMap(); // 도형 → 경계 상자 · 길이
function prep(p) {
  let g = geo.get(p);
  if (g) return g;
  let pts;
  let pad = 0;
  if (p.t === 'ell') { pts = [[p.x - p.rx - p.ry, p.y - p.rx - p.ry], [p.x + p.rx + p.ry, p.y + p.rx + p.ry]]; }
  else if (p.t === 'cap') { pts = [p.a, p.b]; pad = Math.max(p.r, p.r2); }
  else { pts = p.pts; pad = p.t === 'path' ? Math.max(p.r, p.r2) : 0; }
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  g = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
  if (p.t === 'path') {
    g.lens = [0];
    for (let i = 1; i < p.pts.length; i++) g.lens.push(g.lens[i - 1] + Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]));
  }
  if (p.t === 'ell') { const a = (-p.rot * Math.PI) / 180; g.cos = Math.cos(a); g.sin = Math.sin(a); }
  geo.set(p, g);
  return g;
}

/** 점에서 선분까지 — [거리², 선분 위 비율] */
function segDist(x, y, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len = vx * vx + vy * vy || 1;
  const k = clamp01(((x - a[0]) * vx + (y - a[1]) * vy) / len);
  const dx = x - (a[0] + vx * k);
  const dy = y - (a[1] + vy * k);
  return [dx * dx + dy * dy, k];
}

function inside(p, x, y) {
  const g = prep(p);
  if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) return false;
  if (p.t === 'ell') {
    const dx = x - p.x;
    const dy = y - p.y;
    const rx = dx * g.cos - dy * g.sin;
    const ry = dx * g.sin + dy * g.cos;
    return (rx / p.rx) ** 2 + (ry / p.ry) ** 2 <= 1;
  }
  if (p.t === 'cap') {
    const [d2, k] = segDist(x, y, p.a, p.b);
    return d2 <= lerp(p.r, p.r2, k) ** 2;
  }
  if (p.t === 'path') {
    const total = g.lens[g.lens.length - 1] || 1;
    for (let i = 1; i < p.pts.length; i++) {
      const [d2, k] = segDist(x, y, p.pts[i - 1], p.pts[i]);
      const r = lerp(p.r, p.r2, lerp(g.lens[i - 1], g.lens[i], k) / total);
      if (d2 <= r * r) return true;
    }
    return false;
  }
  let hit = false;
  const q = p.pts;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i][1] > y) !== (q[j][1] > y) && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) hit = !hit;
  }
  return hit;
}

// 밝은 칸은 글자를 성기게 — 4×4 규칙 무늬(Bayer)로 고르게 비운다(진할수록 빽빽)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// 형상 높이를 잴 때 최소 이만큼(단위) — 손처럼 납작한 형상이 칸을 꽉 채울 만큼 커지지 않게
const FRAME = 72;

// 칸 하나를 3×3 점으로 재서 — 셋 이상 덮인 칸만 채운다(가는 줄기도 끊기지 않게)
const SAMPLES = [-1 / 3, 0, 1 / 3];

// 밝기 지도(shape.tone — tools/tone-art.mjs) — base64 를 한 번만 풀어 둔다.
//   칸 값 0 = 배경, 아니면 classes 의 [부위, 시작, 끝] 구간 — 구간 안 위치가 그 부위의 진하기(0~1)
const toneBytes = new WeakMap();
function toneAt(t, u, v) {
  let b = toneBytes.get(t);
  if (!b) { b = Uint8Array.from(atob(t.data), (c) => c.charCodeAt(0)); toneBytes.set(t, b); }
  const x = Math.floor(((u - t.x0) / (t.x1 - t.x0)) * t.w);
  const y = Math.floor(((v - t.y0) / (t.y1 - t.y0)) * t.h);
  if (x < 0 || y < 0 || x >= t.w || y >= t.h) return null;
  const i = y * t.w + x; // 4비트 두 칸이 한 바이트(앞 칸이 윗자리)
  const q = i % 2 ? b[i >> 1] & 15 : b[i >> 1] >> 4;
  if (!q) return null;
  const k = t.classes.findIndex(([, from, to]) => q >= from && q <= to);
  const [, from, to] = t.classes[k];
  return [k, to > from ? (q - from) / (to - from) : 0.5];
}

/**
 * 형상 → 글자 칸 목록(px)
 *   도형(prims)으로 채우거나, 밝기 지도(tone)가 있으면 그 부위 · 진하기로 — 그때 도형은 부위(흔들림 · 차례)만 정하고,
 *   solid 도형(프리지아 리본처럼 그림에 없는 것)만 그 자리를 직접 채운다
 * @returns {{ cells: object[], view: object }}
 */
function rasterize(shape, box) {
  const { W, H } = box;
  const fs = box.fs / (shape.density || 1);
  const cw = fs * 0.62;
  const ch = fs * 1.04;
  // 네 형상 모두 같은 틀 — 칸 한가운데에, 같은 높이 기준(낮은 형상도 FRAME 높이로 재서 너무 커지지 않게)으로 맞춘다
  const [s0, s1] = shape.span;
  //   세로 틀은 도형 위아래 끝(형상이 frame 을 주면 그것 — 굴뚝 연기처럼 도형 밖 움직임이 잘리지 않게)
  //   밝기 지도면 지도의 위아래
  const solid = shape.prims.filter((p) => !p.cut).map(prep);
  const [y0, y1] = shape.frame || (shape.tone ? [shape.tone.y0, shape.tone.y1] : [Math.min(...solid.map((b) => b.y0)), Math.max(...solid.map((b) => b.y1))]);
  const s = Math.min((H * 0.96) / Math.max(y1 - y0, FRAME), (W - 12) / (s1 - s0));
  const ox = W / 2 - ((s0 + s1) / 2) * s;
  const top = H / 2 - ((y0 + y1) / 2) * s;
  const cols = Math.floor(W / cw);
  const rows = Math.floor(H / ch);
  const gx = (W - cols * cw) / 2;
  const gy = (H - rows * ch) / 2;
  const grid = new Array(cols * rows).fill(null);
  const prims = shape.prims;
  const toneMap = shape.tone;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = gx + (c + 0.5) * cw;
      const py = gy + (r + 0.5) * ch;
      const votes = new Map();
      let filled = 0;
      // 밝기 지도 — 부위마다 덮은 점 수 · 진하기 합
      const inked = toneMap ? toneMap.classes.map(() => 0) : null;
      const dark = toneMap ? toneMap.classes.map(() => 0) : null;
      for (const sy of SAMPLES) {
        for (const sx of SAMPLES) {
          const u = (px + sx * cw - ox) / s;
          const v = (py + sy * ch - top) / s;
          let hit = -1;
          for (let i = prims.length - 1; i >= 0; i--) {
            if (inside(prims[i], u, v)) { hit = prims[i].cut ? -1 : i; break; }
          }
          if (hit >= 0) { filled++; votes.set(hit, (votes.get(hit) || 0) + 1); }
          if (toneMap) {
            const t = toneAt(toneMap, u, v);
            if (t) { inked[t[0]]++; dark[t[0]] += t[1]; }
          }
        }
      }
      // 가장 많이 덮은 도형(같으면 앞에 그린 것)
      let z = -1;
      let best = 0;
      for (const [i, n] of votes) if (n > best || (n === best && i > z)) { z = i; best = n; }
      const pos = { x: px, y: py, u: (px - ox) / s, v: (py - top) / s };
      const solidHit = z >= 0 && prims[z].solid && best >= 3;
      if (toneMap && !solidHit) {
        const total = inked.reduce((a, b) => a + b, 0);
        if (total < 5) continue;
        // 가장 많이 덮은 부위 — 진하기를 levels 사이로 늘려 0~1(형상이 정한다)
        const k = inked.indexOf(Math.max(...inked));
        const [lo, hi] = shape.levels || [0, 1];
        const part = z >= 0 && !prims[z].solid ? prims[z].part : toneMap.classes[k][0];
        grid[r * cols + c] = { part, tone: clamp01((dark[k] / inked[k] - lo) / (hi - lo)), z, ...pos };
      } else if (filled >= 3) grid[r * cols + c] = { part: prims[z].part, tone: prims[z].tone, z, ...pos };
    }
  }
  // 윤곽 — 바깥 테두리는 진하게, 다른 부분 앞에 놓인 칸 가장자리도 조금 진하게
  const at = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols ? null : grid[r * cols + c]);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = at(r, c);
      if (!cell) continue;
      const near = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)];
      let tone = cell.tone;
      const edge = near.some((n) => !n);
      if (toneMap) {
        // 밝기 지도 — 윤곽은 살짝만, 아주 밝은 안쪽은 비워 둔다(흰 옷의 하이라이트)
        if (edge) tone = Math.max(tone, 0.3);
        else if (tone < 0.05) continue;
      } else if (edge) tone = Math.max(tone, cell.tone < 0.5 ? 0.72 : 0.95); // 밝은 부분은 윤곽도 조금 옅게
      else if (cell.tone < 0.5 && BAYER[(r % 4) * 4 + (c % 4)] / 16 >= 0.3 + cell.tone) continue;
      else if (near.some((n) => n.part !== cell.part && n.z < cell.z && Math.abs(n.tone - cell.tone) > 0.05)) tone = Math.max(tone, 0.72);
      cells.push({ ...cell, tone, row: r, col: c });
    }
  }
  // 글자 — 위 → 아래, 왼 → 오른 차례로 이어 쓴다
  const glyph = glyphsFor(shape.name, { toned: shape.glyphs === 'tone' });
  cells.forEach((cell, k) => { cell.ch = glyph(cell, k); });
  // 모이는 차례 — 부분(없으면 형상 전체) 상자 안에서 sweep 방향으로
  const boxes = new Map();
  const grow = (key, cell) => {
    const b = boxes.get(key) || { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    b.x0 = Math.min(b.x0, cell.x); b.x1 = Math.max(b.x1, cell.x); b.y0 = Math.min(b.y0, cell.y); b.y1 = Math.max(b.y1, cell.y);
    boxes.set(key, b);
  };
  const build = shape.build || { order: [0, 1], sweep: 'up' };
  const cfgOf = (part) => shape.parts?.[part] || {};
  for (const cell of cells) grow(cfgOf(cell.part).order ? cell.part : '*', cell);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const cell of cells) {
    const cfg = cfgOf(cell.part);
    const { order, sweep } = cfg.order ? cfg : build;
    const b = boxes.get(cfg.order ? cell.part : '*');
    const w = b.x1 - b.x0 || 1;
    const h = b.y1 - b.y0 || 1;
    const pos = {
      up: (b.y1 - cell.y) / h,
      down: (cell.y - b.y0) / h,
      right: (cell.x - b.x0) / w,
      left: (b.x1 - cell.x) / w,
      out: Math.hypot((cell.x - (b.x0 + b.x1) / 2) / (w / 2), (cell.y - (b.y0 + b.y1) / 2) / (h / 2)) / Math.SQRT2,
    }[sweep] ?? 0;
    cell.seed = rand();
    cell.delay = clamp01(lerp(order[0], order[1], clamp01(pos)) + (cell.seed - 0.5) * 0.05);
    cell.ink = cfg.ink || 'base';
    cell.sway = cfg.sway || null;
  }
  const view = { s, X: (u) => ox + u * s, Y: (v) => top + v * s };
  return { cells, view, font: `${fs.toFixed(2)}px ${box.family}` };
}

/**
 * @param {HTMLElement} stage  아트 칸(role="img") — 안에 캔버스를 만든다
 * @param {{ reduced?: boolean }} opts
 */
export function mountAboutArt(stage, { reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.append(canvas);
  const g = canvas.getContext('2d');

  let box = null; // { W, H, cw, ch, fs, font }
  let cache = new Map(); // 형상 이름 → rasterize 결과(칸 크기가 바뀌면 비운다)
  let current = null; // 지금 형상 이름
  let wanted = null; // 칸이 아직 안 보여(크기 0) 미뤄 둔 첫 형상
  let parts = []; // 입자
  let trans = null; // { t0 } — 전환 중
  let formedAt = 0; // 다 모인 시각
  let prev = null; // 전환 직전 형상의 효과(장식) — 풀리는 동안 흐려지며 사라진다 { name, t }
  let raf = 0;
  let lastDraw = 0;
  let visible = true;
  let running = false;
  let baseInk = '#3a3b3e';

  const ink = (key) => (key === 'base' ? baseInk : INKS[key] || baseInk);

  /** 칸 크기 재기 — 0: 아직 안 보임(크기 0), 1: 그대로, 2: 바뀜(캔버스 · 칸 다시) */
  const measure = () => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return 0;
    // 휴대폰(좁은 칸)은 글자 칸을 줄여 덜 그린다 — 형상은 그대로 알아보이게
    const rowsWanted = W < 420 ? 34 : 38;
    const fs = Math.max(6.5, Math.min(9.5, H / rowsWanted));
    const css = getComputedStyle(stage);
    baseInk = css.color || baseInk;
    const font = `${fs.toFixed(2)}px ${css.fontFamily}`;
    const same = box && box.W === W && box.H === H && box.font === font;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!same) {
      box = { W, H, fs, font, family: css.fontFamily };
      cache = new Map();
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return same ? 1 : 2;
  };

  const layout = (name) => {
    let r = cache.get(name);
    if (!r) { r = rasterize(SHAPES[name], box); cache.set(name, r); }
    return r;
  };

  const settle = (p) => Object.assign(p, { x: p.cell.x, y: p.cell.y, a: 1, ch: p.cell.ch, ink: p.cell.ink });

  /** 바로 완성된 모습으로(모션 줄이기 · 칸 크기가 바뀔 때) */
  const snap = (name) => {
    parts = layout(name).cells.map((cell) => settle({ cell, part: cell.part, seed: cell.seed }));
    trans = null;
    prev = null;
  };

  /** name 으로 — 처음이면 흩어진 데서 모이고, 같은 형상이면 크게 흩어졌다 다시 모인다 */
  const go = (name) => {
    if (!SHAPES[name] || !box) return;
    const replay = name === current;
    const now = performance.now();
    if (current && !trans) prev = { name: current, t: now - formedAt };
    current = name;
    stage.setAttribute('aria-label', SHAPES[name].label);
    if (reduced) { snap(name); formedAt = now; draw(now); return; }
    const { cells } = layout(name);
    const { W, H } = box;
    const old = parts.filter((p) => p.a > 0.02).sort((a, b) => a.x - b.x);
    const tgt = [...cells].sort((a, b) => a.x - b.x);
    const loose = replay ? 30 : 11;
    const from = (p) => {
      const ang = Math.random() * Math.PI * 2;
      const m = loose * (0.4 + Math.random() * 0.6);
      return { sx: p.x, sy: p.y, sa: p.a, sch: p.ch, sink: p.ink, lx: Math.cos(ang) * m, ly: Math.sin(ang) * m - loose * 0.25 };
    };
    const next = [];
    if (!old.length) {
      // 처음 — 칸 여기저기 흩어진 투명한 글자에서
      for (const cell of tgt) {
        next.push({ cell, part: cell.part, seed: cell.seed, sx: cell.x + (Math.random() - 0.5) * W * 0.6, sy: cell.y + (Math.random() - 0.5) * H * 0.5, sa: 0, sch: cell.ch, sink: cell.ink, lx: 0, ly: 0 });
      }
    } else if (old.length >= tgt.length) {
      const used = new Set();
      tgt.forEach((cell, i) => {
        const j = Math.floor((i * old.length) / tgt.length);
        used.add(j);
        next.push({ cell, part: cell.part, seed: cell.seed, ...from(old[j]) });
      });
      old.forEach((p, j) => { if (!used.has(j)) next.push({ cell: null, part: '', seed: p.seed, ...from(p) }); });
    } else {
      const taken = new Set();
      old.forEach((p, i) => {
        const j = Math.floor((i * tgt.length) / old.length);
        taken.add(j);
        next.push({ cell: tgt[j], part: tgt[j].part, seed: tgt[j].seed, ...from(p) });
      });
      // 모자란 글자는 가까운 글자 자리에서 투명하게 생겨난다
      tgt.forEach((cell, j) => {
        if (taken.has(j)) return;
        const near = old[Math.min(old.length - 1, Math.floor((j * old.length) / tgt.length))];
        next.push({ cell, part: cell.part, seed: cell.seed, ...from(near), sa: 0 });
      });
    }
    parts = next;
    for (const p of parts) Object.assign(p, { x: p.sx, y: p.sy, a: p.sa, ch: p.sch, ink: p.sink });
    trans = { t0: now };
    kick();
  };

  // ---------- 그리기 ----------

  const swayOf = (p, t, s) => {
    const w = p.cell.sway;
    if (!w || reduced) return 0;
    const k = clamp01((p.cell.v - w.from) / (w.to - w.from));
    const ramp = easeOut(clamp01(t / 900));
    return w.amp * s * k * ramp * Math.sin((t / 1000) * Math.PI * 2 * (w.freq || 0.35) + p.cell.u * 0.04);
  };

  function draw(now) {
    if (!box) return;
    const { W, H } = box;
    g.clearRect(0, 0, W, H);
    const shape = SHAPES[current];
    if (!shape) return;
    const { view, font } = layout(current);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const vw = { ...view, ink, mul: 1 };
    let tt = 0;
    let fxT = reduced ? Infinity : now - formedAt;
    if (trans) {
      tt = now - trans.t0;
      if (tt >= TOTAL) {
        trans = null;
        prev = null;
        formedAt = now;
        fxT = 0;
        parts = parts.filter((p) => p.cell);
      }
    }
    const fx = shape.fx && EFFECTS[shape.fx.name];
    const fading = trans && prev && SHAPES[prev.name].fx;
    // 앞 형상의 장식은 풀리는 동안 흐려진다
    if (fading) {
      const pfx = EFFECTS[SHAPES[prev.name].fx.name];
      const pv = { ...layout(prev.name).view, ink, mul: 1 - clamp01(tt / LOOSE) };
      g.globalAlpha = pv.mul;
      pfx.under?.(g, prev.t, SHAPES[prev.name].fx, pv, false);
      g.globalAlpha = 1;
    }
    if (!trans && fx?.under) fx.under(g, fxT, shape.fx, vw, reduced);

    for (const p of parts) {
      if (trans) {
        // 풀리기 → 차례가 되면 새 칸으로
        const lk = easeOut(clamp01(tt / LOOSE));
        const bx = p.sx + p.lx * lk;
        const by = p.sy + p.ly * lk;
        if (!p.cell) {
          p.x = bx; p.y = by;
          p.a = p.sa * (1 - clamp01(tt / (LOOSE + 300)));
        } else {
          const start = LEAD + p.cell.delay * SPREAD;
          const k = easeInOut(clamp01((tt - start) / MOVE));
          p.x = lerp(bx, p.cell.x, k);
          p.y = lerp(by, p.cell.y, k);
          const loose = p.sa * (1 - 0.45 * lk);
          p.a = lerp(loose, 1, k);
          if (k >= 0.5) { p.ch = p.cell.ch; p.ink = p.cell.ink; }
        }
      } else if (p.cell) {
        settle(p);
        p.x += swayOf(p, fxT, view.s);
        const m = fx?.particle(p, fxT, shape.fx, reduced);
        if (m) {
          p.x += (m.dx || 0) * view.s;
          p.y += (m.dy || 0) * view.s;
          p.a *= m.a ?? 1;
          p.over = m.over || null;
        } else p.over = null;
      }
      if (p.a <= 0.01) continue;
      const tone = p.cell ? p.cell.tone : 0.6;
      const [a0, a1] = shape.alpha || [0.12, 1];
      g.globalAlpha = p.a * (a0 + (a1 - a0) * tone);
      g.fillStyle = ink(p.ink);
      g.fillText(p.ch, p.x, p.y);
      if (p.over && !trans && p.over[1] > 0.01) {
        g.globalAlpha = p.a * p.over[1];
        g.fillStyle = ink(p.over[0]);
        g.fillText(p.ch, p.x, p.y);
      }
    }
    g.globalAlpha = 1;
    if (fading) {
      const pfx = EFFECTS[SHAPES[prev.name].fx.name];
      pfx.over?.(g, prev.t, SHAPES[prev.name].fx, { ...layout(prev.name).view, ink, mul: 1 - clamp01(tt / LOOSE) }, false);
    }
    if (!trans && fx?.over) fx.over(g, fxT, shape.fx, vw, reduced);
    lastDraw = now;
  }

  // 움직일 것이 남았나 — 전환 중 · 흔들림 · 효과
  const busy = (now) => {
    if (reduced || !current) return false;
    if (trans) return true;
    const shape = SHAPES[current];
    if (shape.parts && Object.values(shape.parts).some((p) => p.sway)) return true;
    const fx = shape.fx && EFFECTS[shape.fx.name];
    return Boolean(fx && fx.busy(now - formedAt, shape.fx));
  };

  const frame = (now) => {
    raf = 0;
    if (!running) return;
    if (trans || now - lastDraw >= IDLE_MS) draw(now);
    if (busy(now) && (visible || trans)) raf = requestAnimationFrame(frame);
  };
  function kick() {
    if (running && !raf) raf = requestAnimationFrame(frame);
  }

  // 칸 크기가 바뀌면 같은 형상을 새 칸에 맞춰 바로(전환 중이면 끝난 모습으로)
  const ro = new ResizeObserver(() => {
    if (!running) return;
    const m = measure();
    if (m && !current && wanted) { const n = wanted; wanted = null; go(n); return; }
    if (m !== 2 || !current) return;
    const wasMoving = Boolean(trans);
    snap(current);
    if (wasMoving) formedAt = performance.now();
    draw(performance.now());
    kick();
  });
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });

  return {
    /** 방을 열 때 — 첫 형상이 한 번 모인다 */
    start(name) {
      running = true;
      parts = [];
      current = null;
      trans = null;
      prev = null;
      ro.observe(stage);
      io.observe(stage);
      // 창이 막 열리는 중이라 칸 크기가 0 이면 — 크기가 생길 때(ResizeObserver) 시작
      if (measure()) go(name);
      else wanted = name;
      // 고정폭 글꼴이 늦게 오면 그 글꼴로 다시
      document.fonts?.load(`9px ${getComputedStyle(stage).fontFamily}`).then(() => { if (running && !trans) { draw(performance.now()); kick(); } }, () => {});
    },
    go,
    get current() { return current; },
    /** 방을 닫을 때 — 그리기 · 관찰을 멈추고 비운다 */
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      parts = [];
      trans = null;
      prev = null;
      current = null;
      wanted = null;
      if (box) g.clearRect(0, 0, box.W, box.H);
    },
  };
}
