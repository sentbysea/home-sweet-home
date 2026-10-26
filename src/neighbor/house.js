// neighbor 집 — CSS 3D(preserve-3d). 작고 부드러운 손그림 입체 집 안에 이웃 배너가 한 줄로 둥실둥실 떠 있고, 바닥 오른쪽 바깥에 우체통.
//   · 선: 집 앞면 · 뒷면 · 옆면 · 용마루 · 원통 굴뚝을 각자 제자리의 평면(SVG)으로 세운다 — 브라우저가 실제 앞뒤를 가려
//     뒤쪽 선은 배너 뒤로 지나간다. 선은 조금 휘고 굵기가 고르지 않은 손그림, 끝과 모서리는 둥글게.
//   · 위글: 로딩 화면 · 평면도와 같은 박자(190ms)로 비슷한 선 변형 4장을 돌린다(꼭짓점은 그대로 — 선이 벌어지지 않는다).
//     배너 이미지 · 글자는 흔들지 않는다.
//   · 배너: 원본 이미지(5:1, 자르지 않음) + 아주 얇은 흰 종이(뒷면 · 옆면 두께). 선반 · 지지선 없이 집 안 가운데에 떠 있다.
//     줄마다 아주 작은 좌우 어긋남 · 기울기, 앞뒤 자리만 조금 달라 돌릴 때 거리감이 난다. 둥실거림은 CSS(배너마다 다른 주기 · 시작).
//   · 원근: perspective-origin 을 화면 가운데에 맞춰 따라간다 — 긴 집의 지붕 · 바닥이 멀리서 찌그러지지 않는다.
//   · 돌리기: 좌우로 끌면 세로축으로 ±12°. 손을 놓으면 관성 없이 부드럽게 멈춘다. 저절로 돌지 않는다.
//     휴대폰은 세로 스크롤이 먼저(touch-action: pan-y) — 가로로 분명히 끌 때만 돌리고, 끈 뒤에는 배너 링크가 열리지 않는다.
//   · 많아도 가볍게: 높이 900px 씩 덩어리로 나눠 화면에서 먼 덩어리는 그리지 않는다(display: none).

const NS = 'http://www.w3.org/2000/svg';

export const LIMIT = 12; // 좌우 최대 각도
const START = 4; // 처음 각도 — 오른쪽 벽(우체통 쪽)이 조금 보이게
const CHUNK = 900;
const DRAG_DEG = LIMIT / 170; // 170px 끌면 끝까지
const BOIL_MS = 190; // 로딩 · 평면도 위글과 같은 박자
const BOIL = 4; // 선 변형 수
const SIGN_Z = [0, -10, 6, -5, 10, -7]; // 줄마다 앞뒤 자리(집 폭 400 기준)
const SIGN_X = [0, 3, -4, 2, -3, 4]; // 아주 작은 좌우 어긋남(px)
const SIGN_TILT = [-0.6, 0.5, -0.3, 0.7, -0.5, 0.35]; // 기울기(deg)

// 작은 결정적 난수 — 다시 그려도 같은 손그림
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const f = (n) => Math.round(n * 10) / 10;

/**
 * 손그림 선 — 점들을 지나는 하나의 길. 변마다 살짝 휘고(bow) 사이사이 조금 흔들리며, 모서리는 둥글게 돈다.
 * 꼭짓점 자체는 움직이지 않아 변형끼리도, 다른 평면의 선과도 이음매가 그대로다.
 * @param {number[][]} pts  꼭짓점
 * @param {{ closed?: boolean, seed: number, v?: number, amp?: number, radius?: number }} o  v — 위글 변형 번호
 */
function sketch(pts, { closed = false, seed, v = 0, amp = 0.55, radius = 5 }) {
  const shape = rng(seed); // 변마다 휜 방향 · 정도(변형이 바뀌어도 비슷하게)
  const wob = rng(seed * 13 + v * 7919 + 1); // 변형마다 다른 잔떨림
  const n = pts.length;
  const segs = closed ? n : n - 1;
  // 모서리를 둥글게 — 변의 양끝을 radius 만큼 잘라 두고 모서리 점을 조절점으로 잇는다
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
    const bow = (shape() - 0.5) * Math.min(3.2, len * 0.012) + (wob() - 0.5) * 0.5;
    const k = Math.max(1, Math.round(len / 46));
    if (i === 0) d += `M${f(s[0])} ${f(s[1])}`;
    else if (roundA) d += `Q${f(a[0])} ${f(a[1])} ${f(s[0])} ${f(s[1])}`;
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const off = Math.sin(Math.PI * t) * bow + (j < k ? (wob() - 0.5) * 2 * amp : 0);
      const tm = (j - 0.5) / k;
      const offm = Math.sin(Math.PI * tm) * bow + (wob() - 0.5) * amp;
      const mx = s[0] + (e[0] - s[0]) * tm + nx * offm;
      const my = s[1] + (e[1] - s[1]) * tm + ny * offm;
      const px = s[0] + (e[0] - s[0]) * t + nx * off;
      const py = s[1] + (e[1] - s[1]) * t + ny * off;
      d += `Q${f(mx)} ${f(my)} ${f(px)} ${f(py)}`;
    }
  }
  if (closed) {
    const a = pts[0];
    const s = cut(a, pts[1], radius);
    d += `Q${f(a[0])} ${f(a[1])} ${f(s[0])} ${f(s[1])}`;
  }
  return d;
}

/** 손그림 원(굴뚝 위) — 점 몇 개를 조금씩 흔들어 부드럽게 잇는다 */
function sketchCircle(cx, cy, rx, ry, seed, v) {
  const wob = rng(seed * 13 + v * 7919 + 1);
  const N = 10;
  const pts = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const r = 1 + (wob() - 0.5) * 0.08;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
  let d = '';
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N];
    const q = pts[(i + 1) % N];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M${f(m[0])} ${f(m[1])}` : `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return d;
}

/**
 * 위글 변형 4장 — 같은 선을 v 만 바꿔 그려 둔 묶음. 지금 변형만 보인다(.nbh-house[data-boil]).
 * @param {(v: number) => string} draw  변형 v 의 path d 들(여러 개면 배열)
 */
function boil(draw, width, cls = '') {
  let out = '';
  for (let v = 0; v < BOIL; v++) {
    const ds = [].concat(draw(v));
    out += `<g class="nbh-v nbh-v${v} nbh-ink${cls ? ` ${cls}` : ''}">${ds.map((d, i) => `<path d="${d}" stroke-width="${f(width * (i % 2 ? 0.93 : 1.05))}"/>`).join('')}</g>`;
  }
  return out;
}

/** 면 하나 — 단색 바탕 + 둥근 손그림 테두리(우체통) */
function faceSvg(w, h, fill, seed, extra = '') {
  const r = Math.min(3, w / 4, h / 4);
  const pts = [[0, 0], [w, 0], [w, h], [0, h]];
  return `<svg class="nbh-face" width="${f(w)}" height="${f(h)}" viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true">` +
    `<rect width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"/>${extra}` +
    `${boil((v) => sketch(pts, { closed: true, seed, v, amp: 0.25, radius: r }), 1.4)}</svg>`;
}

/** 요소를 부모 좌표 (cx, cy, cz) 에 가운데를 맞춰 세운다 */
function place(el, w, h, cx, cy, cz, rot = '') {
  el.style.width = `${f(w)}px`;
  el.style.height = `${f(h)}px`;
  el.style.transform = `translate3d(${f(cx - w / 2)}px, ${f(cy - h / 2)}px, ${f(cz)}px) ${rot}`;
  return el;
}

function div(cls, html = '') {
  const el = document.createElement('div');
  el.className = cls;
  if (html) el.innerHTML = html;
  return el;
}

/** 크기 · 자리 — 아담하게. 돌렸을 때도 집 + 우체통이 화면 안에 들어오게 */
function measure(viewW, count) {
  const avail = Math.min(viewW, 1200) - 40; // 좌우 20px 여백
  let W = Math.min(388, avail * 0.86);
  let geo;
  for (let k = 0; k < 8; k++) {
    geo = shape(W, count);
    const span = geo.right - geo.left;
    if (span <= avail) break;
    W *= avail / span;
  }
  // 집 가운데가 화면 가운데 — 오른쪽 우체통이 넘치면 그만큼만 왼쪽으로
  geo.shift = Math.max(0, geo.right - avail / 2);
  return geo;
}

function shape(W, count) {
  const D = W * 0.5;
  const P = Math.max(1200, W * 3.6);
  const RH = W * 0.45; // 지붕 높이
  const BW = Math.min(260, W * 0.63); // 배너 폭
  const BH = BW / 5;
  const T = 2.5; // 종이 두께
  const gap = W < 340 ? 34 : 30; // 배너 사이(휴대폰은 늘 보이는 이름까지)
  const rowH = BH + gap;
  const rows = Math.max(count, 0);
  const used = rows ? rows * rowH - gap : 0;
  const top = RH * 0.8; // 첫 배너 위 — 지붕 안쪽부터(용마루 아래 빈 곳이 너무 크지 않게)
  const PB = 30;
  const H = Math.max(RH + W * 0.55, top + used + PB + (rows ? 14 : 0));
  const start = top + Math.max(0, (H - PB - top - used) / 2 - (rows ? 6 : 0));
  const m = Math.max(24, Math.min(34, W * 0.085)); // 우체통 몸통 폭
  const mail = { m, x: W / 2 + 12 + m * 0.62, z: D * 0.4 }; // 집 앞 모서리 옆 땅 위
  // 돌렸을 때 가장 바깥 — 앞 기둥 · 우체통 오른쪽 끝을 ±LIMIT 로 돌려 원근까지
  const proj = (x, z, deg) => {
    const a = (deg * Math.PI) / 180;
    const rx = x * Math.cos(a) + z * Math.sin(a);
    const rz = -x * Math.sin(a) + z * Math.cos(a);
    return (rx * P) / (P - rz);
  };
  const xs = [];
  for (const deg of [-LIMIT, LIMIT]) {
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [-W / 2, -D / 2], [mail.x + m * 0.9, mail.z + m * 0.4], [mail.x + m * 0.9, mail.z - m * 0.4]]) {
      xs.push(proj(x, z, deg));
    }
  }
  return { W, D, P, RH, BW, BH, T, rowH, top: start, H, count: rows, mail, left: Math.min(...xs), right: Math.max(...xs) };
}

/**
 * @param {HTMLElement} scene     집을 세울 칸(perspective 를 준다)
 * @param {HTMLElement} scroller  세로로 스크롤하는 칸
 * @param {{ reduced?: boolean, onMail?: () => void, onTurn?: () => void }} opts
 */
export function createHouse(scene, scroller, { reduced = false, onMail = () => {}, onTurn = () => {} } = {}) {
  const house = div('nbh-house');
  house.dataset.boil = '0';
  scene.append(house);
  let geo = null;
  let chunks = [];
  let items = [];
  let state = 'loading';
  let editing = false;
  let angle = START;
  let target = START;
  let raf = 0;
  let mailEl = null;
  let letter = null;

  // 손그림 위글 — 변형 4장을 190ms 마다(모션 줄이기면 멈춤)
  let frame = 0;
  const boilTimer = reduced ? 0 : setInterval(() => {
    if (document.hidden) return;
    frame = (frame + 1) % BOIL;
    house.dataset.boil = String(frame);
  }, BOIL_MS);

  // ---------- 그리기 ----------

  const apply = () => {
    if (!geo) return;
    house.style.transform = `translateX(${f(-geo.shift)}px) rotateY(${angle.toFixed(3)}deg)`;
  };

  const tick = () => {
    raf = 0;
    const d = target - angle;
    angle = Math.abs(d) < 0.01 || reduced ? target : angle + d * 0.2;
    apply();
    if (angle !== target) raf = requestAnimationFrame(tick);
  };
  const turnTo = (deg) => {
    target = Math.max(-LIMIT, Math.min(LIMIT, deg));
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const PAD = 6;

  /** 큰 평면(앞 · 뒤 · 옆) — 덩어리마다 그 높이만큼 잘라 세운다 */
  const bigPlane = (cls, w, cx, z, rot, inner) => {
    chunks.forEach((c) => {
      const y0 = Math.max(-PAD, c.y0 - 4);
      const y1 = Math.min(geo.H + PAD, c.y1 + 4);
      if (y1 <= y0) return;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', `nbh-plane ${cls}`);
      svg.setAttribute('viewBox', `${-PAD} ${f(y0)} ${f(w + PAD * 2)} ${f(y1 - y0)}`);
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = inner;
      place(svg, w + PAD * 2, y1 - y0, cx + geo.W / 2, (y0 + y1) / 2, z, rot);
      c.el.append(svg);
    });
  };

  const smallPlane = (parent, cls, w, h, cx, cy, z, rot, inner) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', `nbh-plane ${cls}`);
    svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${f(w + PAD * 2)} ${f(h + PAD * 2)}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = inner;
    place(svg, w + PAD * 2, h + PAD * 2, cx, cy, z, rot);
    parent.append(svg);
  };

  const INK = 1.8; // 홈 평면도 선(1.7)과 같은 무게 — 조금 더 또렷하게

  const buildFrame = () => {
    const { W, D, RH, H } = geo;
    // 앞 · 뒤 오각형(지붕 두 변 · 양 기둥 · 바닥) — 하나의 닫힌 선, 모서리는 살짝 둥글게
    const pent = [[W / 2, 0], [W, RH], [W, H], [0, H], [0, RH]];
    bigPlane('is-front', W, 0, D / 2, '', boil((v) => sketch(pent, { closed: true, seed: 11, v, radius: 6 }), INK));
    bigPlane('is-back', W, 0, -D / 2, '', boil((v) => sketch(pent, { closed: true, seed: 12, v, radius: 6 }), INK * 0.9, 'is-back'));
    // 옆면 — 처마 · 바닥 모서리(앞 → 뒤). 끝점은 앞 · 뒤 꼭짓점과 같은 자리
    const side = (seed) => boil((v) => [
      sketch([[0, RH], [D, RH]], { seed, v }),
      sketch([[0, H], [D, H]], { seed: seed + 50, v }),
    ], INK * 0.92, 'is-side');
    bigPlane('is-side', D, -W / 2, 0, 'rotateY(90deg)', side(13));
    bigPlane('is-side', D, W / 2, 0, 'rotateY(90deg)', side(14));

    const roof = chunks[0].el;
    // 용마루(둥근 꼭짓점이 살짝 아래를 지나서 1.5px 내려 잇는다)
    smallPlane(roof, 'is-ridge', D, 2, W / 2, 1.5, 0, 'rotateY(90deg)', boil((v) => sketch([[0, 1], [D, 1]], { seed: 15, v }), INK));
    // 굴뚝 — 둥근 원통: 정면 실루엣(양옆 선 + 지붕에 닿는 밑 곡선) + 위 원
    const cr = W * 0.045;
    const cx = -W * 0.26;
    const cz = D * 0.15;
    const slope = (x) => RH * (Math.abs(x) / (W / 2)); // 지붕 높이(용마루 0)
    const topY = RH * 0.1;
    const yl = slope(cx - cr) - topY;
    const yr = slope(cx + cr) - topY;
    const ch = Math.max(yl, yr) + 3;
    const ccx = cx + W / 2;
    smallPlane(roof, 'is-chimney', cr * 2, ch, ccx, topY + ch / 2, cz, '', boil((v) => [
      sketch([[0, yl - 1], [0, 0]], { seed: 16, v, amp: 0.35 }),
      sketch([[cr * 2, 0], [cr * 2, yr - 1]], { seed: 17, v, amp: 0.35 }),
      `M0 ${f(yl - 1)}Q${f(cr)} ${f((yl + yr) / 2 + 1.2 + (v % 2) * 0.3)} ${f(cr * 2)} ${f(yr - 1)}`,
    ], INK * 0.95));
    smallPlane(roof, 'is-chimney', cr * 2, cr * 2, ccx, topY, cz, 'rotateX(90deg)', boil((v) => sketchCircle(cr, cr, cr, cr, 18, v), INK * 0.95));
  };

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const buildSigns = () => {
    const { W, BW, BH, T, rowH, top } = geo;
    const k = W / 400;
    items.forEach((it, i) => {
      const cy = top + i * rowH + BH / 2;
      const z = SIGN_Z[i % SIGN_Z.length] * k;
      const row = div('nbh-row');
      row.style.transform = `translate3d(${f(W / 2 + SIGN_X[i % SIGN_X.length] * k)}px, ${f(cy)}px, ${f(z)}px)`;
      // 둥실거림 — 배너마다 주기 · 시작 · 기울기가 다르다(누르거나 올리면 멈춘다 — CSS)
      const float = div('nbh-float');
      const r = rng(i * 97 + 5);
      float.style.setProperty('--tilt', `${SIGN_TILT[i % SIGN_TILT.length]}deg`);
      float.style.setProperty('--rock', `${f(0.3 + r() * 0.5) * (i % 2 ? -1 : 1)}deg`);
      float.style.setProperty('--bob', `${f(2 + r() * 2)}px`);
      float.style.animationDuration = `${f(4.2 + r() * 2.6)}s`;
      float.style.animationDelay = `${f(-r() * 6)}s`;
      const label = esc(it.label);
      const a = document.createElement('a');
      a.className = 'nbh-sign';
      a.href = it.href || '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.draggable = false;
      a.dataset.i = String(i);
      a.setAttribute('aria-label', `${it.label} — 새 탭`);
      a.innerHTML =
        `<span class="nbh-sign__back"></span>` +
        `<span class="nbh-sign__edge"></span><span class="nbh-sign__edge"></span>` +
        `<span class="nbh-sign__face"><img alt="" loading="lazy" decoding="async" draggable="false"><span class="nbh-sign__alt">${label} <span aria-hidden="true">↗</span></span></span>` +
        `<span class="nbh-sign__cap" aria-hidden="true">${label}<span class="nbh-sign__arrow">↗</span></span>`;
      const [back, e1, e2, face, cap] = a.children;
      place(back, BW, BH, 0, 0, -T / 2);
      place(e1, T, BH, -BW / 2, 0, 0, 'rotateY(90deg)');
      place(e2, T, BH, BW / 2, 0, 0, 'rotateY(90deg)');
      place(face, BW, BH, 0, 0, T / 2);
      cap.style.transform = `translate3d(-50%, ${f(BH / 2 + 5)}px, ${f(T / 2)}px)`;
      const img = face.querySelector('img');
      img.addEventListener('error', () => face.classList.add('is-broken'), { once: true });
      if (it.image) img.src = it.image;
      else face.classList.add('is-broken');
      float.append(a);
      if (editing && it.id != null) {
        const del = document.createElement('button');
        del.className = 'nbh-del';
        del.type = 'button';
        del.dataset.del = String(it.id);
        del.setAttribute('aria-label', `${it.label} 배너 삭제`);
        del.textContent = '×';
        del.style.transform = `translate3d(${f(BW / 2 - 4)}px, ${f(-BH / 2 - 4)}px, ${f(T / 2 + 2)}px)`;
        float.append(del);
      }
      row.append(float);
      chunkAt(cy).el.append(row);
    });
  };

  const buildNote = () => {
    if (items.length && state === 'ready') return;
    const { W, RH, H } = geo;
    const note = div('nbh-note');
    const text = state === 'loading' ? '간판 거는 중…' : state === 'error' ? '배너를 불러오지 못했어요.' : '아직 걸린 간판이 없어요.';
    note.innerHTML = `<span>${text}</span>${state === 'error' ? '<button class="nbh-note__retry" type="button" data-act="retry">다시 불러오기</button>' : ''}`;
    const cy = RH + (H - RH) / 2;
    note.style.transform = `translate3d(${f(W / 2)}px, ${f(cy)}px, 0) translate(-50%, -50%)`;
    chunkAt(cy).el.append(note);
  };

  // 우체통 — 기둥 위 작은 통(둥근 모서리), 옆에 깃발, 윗면 투입구. 누르면 편지가 올라온다
  const buildMail = () => {
    const { W, H, mail } = geo;
    const { m } = mail;
    const g = div('nbh-mail');
    g.setAttribute('role', 'button');
    g.tabIndex = 0;
    g.setAttribute('aria-label', '배너교환은 여기에서 — 내 배너 정보 · 교환 신청');
    g.style.transform = `translate3d(${f(W / 2 + mail.x)}px, ${f(H)}px, ${f(mail.z)}px)`;
    const box = (w, h, d, cy, colors, seed, extra = {}) => {
      const b = div('nbh-box');
      b.style.transform = `translate3d(0, ${f(cy)}px, 0)`;
      const faces = [
        [w, h, 0, 0, d / 2, '', colors.front, extra.front],
        [w, h, 0, 0, -d / 2, '', colors.front, ''],
        [d, h, -w / 2, 0, 0, 'rotateY(90deg)', colors.side, ''],
        [d, h, w / 2, 0, 0, 'rotateY(90deg)', colors.side, ''],
        [w, d, 0, -h / 2, 0, 'rotateX(90deg)', colors.top, extra.top],
      ];
      faces.forEach(([fw, fh, x, y, z, rot, fill, inner], i) => {
        const face = div('nbh-box__face', faceSvg(fw, fh, fill, seed + i, inner || ''));
        place(face, fw, fh, x, y, z, rot);
        b.append(face);
      });
      return b;
    };
    const postH = m * 1.05;
    const bodyH = m * 0.7;
    const bodyD = m * 0.8;
    // 편지 — 통 안(앞면에 가려 있다가 위로)
    letter = div('nbh-letter');
    const lw = m * 0.6;
    const lh = m * 0.5;
    letter.innerHTML = faceSvg(lw, lh, '#ffffff', 41, boil((v) => sketch([[1.5, 1.5], [lw / 2, lh * 0.55], [lw - 1.5, 1.5]], { seed: 42, v, amp: 0.15, radius: 2 }), 1));
    place(letter, lw, lh, 0, -postH - bodyH + lh / 2 + 2, 0);
    g.append(letter);
    g.append(box(m * 0.16, postH, m * 0.16, -postH / 2, { front: '#e4e7ea', side: '#d5d9dc', top: '#eef0f2' }, 50));
    const slot = boil((v) => sketch([[m * 0.25, bodyD / 2], [m * 0.75, bodyD / 2]], { seed: 61, v, amp: 0.2 }), 1.4);
    const seam = boil((v) => sketch([[m * 0.36, bodyH * 0.6], [m * 0.64, bodyH * 0.6]], { seed: 62, v, amp: 0.2 }), 1.2);
    g.append(box(m, bodyH, bodyD, -postH - bodyH / 2, { front: '#fbd5e3', side: '#f3c3d4', top: '#fde6ee' }, 70, { front: seam, top: slot }));
    // 깃발 — 오른쪽 옆에 세운 막대 + 작은 깃발(포인트 색). 옆면과 나란히 두면 정면에서 안 보여서 35° 열어 둔다
    const fw = m * 0.5;
    const fh = bodyH * 1.3;
    const fa = 35;
    const flagPts = [[2, fh * 0.08], [fw, fh * 0.1], [fw, fh * 0.34], [2, fh * 0.36]];
    const flag = `<path d="M${flagPts.map((p) => p.map(f).join(' ')).join('L')}Z" fill="#ec8aa6"/>` +
      boil((v) => [sketch([[2, fh], [2, 0]], { seed: 81, v, amp: 0.2 }), sketch(flagPts, { closed: true, seed: 82, v, amp: 0.15, radius: 1.5 })], 1.25);
    const rad = (fa * Math.PI) / 180;
    smallPlane(g, 'is-flag', fw, fh, m / 2 + 1 + (fw / 2) * Math.cos(rad), -postH - bodyH * 0.35 - fh / 2, bodyD * 0.1 - (fw / 2) * Math.sin(rad), `rotateY(${fa}deg)`, flag);
    // 안내 — 우체통 아래, 오른쪽 끝을 우체통에 맞춘다(집 바닥 앞선과 같은 깊이, 그 아래)
    const tip = div('nbh-mail__tip', '<svg class="nbh-mail__arrow" viewBox="0 0 16 20" aria-hidden="true"><path d="M3 18C9 16 12 11 11 3M7.5 6L11 2.5L14 6.5"/></svg><span>배너교환은 여기에서</span>');
    tip.style.transform = `translate3d(${f(m * 0.7)}px, ${f(4 + m * 0.1)}px, ${f(geo.D / 2 - mail.z)}px) translateX(-100%)`;
    g.append(tip);
    g.addEventListener('click', (e) => { e.stopPropagation(); onMail(); });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMail(); }
    });
    chunks[chunks.length - 1].el.append(g);
    mailEl = g;
  };

  const chunkAt = (y) => chunks[Math.max(0, Math.min(chunks.length - 1, Math.floor(y / CHUNK)))];

  const build = () => {
    geo = measure(scroller.clientWidth || window.innerWidth, items.length);
    house.textContent = '';
    house.style.width = `${f(geo.W)}px`;
    house.style.height = `${f(geo.H)}px`;
    scene.style.setProperty('--nbh-h', `${f(geo.H)}px`);
    scene.style.setProperty('--nbh-w', `${f(geo.W)}px`);
    scene.style.perspective = `${f(geo.P)}px`;
    chunks = [];
    for (let y0 = 0; y0 < geo.H + 1; y0 += CHUNK) {
      const el = div('nbh-chunk');
      house.append(el);
      chunks.push({ el, y0, y1: Math.min(geo.H, y0 + CHUNK), shown: true });
    }
    buildFrame();
    buildSigns();
    buildNote();
    buildMail();
    apply();
    follow();
  };

  // ---------- 원근 · 덩어리 — 스크롤을 따라 ----------

  let followRaf = 0;
  const follow = () => {
    followRaf = 0;
    if (!geo) return;
    const view = scroller.clientHeight;
    const sTop = scene.offsetTop + house.offsetTop;
    const mid = scroller.scrollTop + view / 2 - scene.offsetTop;
    scene.style.perspectiveOrigin = `50% ${f(mid)}px`;
    const from = scroller.scrollTop - sTop - view * 0.75;
    const to = scroller.scrollTop - sTop + view * 1.75;
    chunks.forEach((c, i) => {
      const edge = i === 0 || i === chunks.length - 1; // 굴뚝 · 우체통은 덩어리 밖으로 조금 나간다
      const keep = edge ? c.y1 > from - CHUNK && c.y0 < to + CHUNK : c.y1 > from && c.y0 < to;
      if (keep !== c.shown) { c.shown = keep; c.el.style.display = keep ? '' : 'none'; }
    });
  };
  const onScroll = () => { if (!followRaf) followRaf = requestAnimationFrame(follow); };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  let resizing = 0;
  const onResize = () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => { if (geo) build(); }, 120);
  };
  window.addEventListener('resize', onResize);

  // ---------- 끌어 돌리기 ----------

  let drag = null;
  let suppressUntil = 0;
  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest('.nbh-del, .nbh-note__retry')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: target, turning: false, mouse: e.pointerType === 'mouse', lastX: e.clientX, lastT: performance.now(), v: 0 };
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.turning) {
      const need = drag.mouse ? 4 : 10;
      if (Math.abs(dy) > need && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; } // 세로 — 스크롤에 맡긴다
      if (Math.abs(dx) < need || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      drag.turning = true;
      drag.x = e.clientX; // 문턱만큼 튀지 않게
      try { scene.setPointerCapture(e.pointerId); } catch { /* 이미 끝난 포인터 */ }
      scene.classList.add('is-turning');
      onTurn();
    }
    e.preventDefault();
    const now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = now;
    turnTo(drag.from + (e.clientX - drag.x) * DRAG_DEG);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.turning) {
      suppressUntil = performance.now() + 450; // 끈 뒤 손을 뗀 자리의 배너가 열리지 않게
      scene.classList.remove('is-turning');
      // 관성 없이 — 마지막 움직임을 아주 조금만 이어서 멈춘다
      if (!reduced) turnTo(target + Math.max(-1.2, Math.min(1.2, drag.v * 40 * DRAG_DEG)));
    }
    drag = null;
  };
  scene.addEventListener('pointerdown', onDown);
  scene.addEventListener('pointermove', onMove);
  scene.addEventListener('pointerup', onUp);
  scene.addEventListener('pointercancel', (e) => { if (drag?.turning) suppressUntil = performance.now() + 450; scene.classList.remove('is-turning'); if (drag && e.pointerId === drag.id) drag = null; });
  scene.addEventListener('click', (e) => {
    if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  scene.addEventListener('dragstart', (e) => e.preventDefault());

  return {
    /** @param {{ items?: Array<{ id?: any, href: string, image: string, label: string }>, state?: 'loading' | 'error' | 'ready', editing?: boolean }} next */
    render(next = {}) {
      if (next.items) items = next.items;
      if (next.state) state = next.state;
      if (next.editing != null) editing = next.editing;
      build();
    },
    /** 우체통에서 편지가 살짝 올라온다 — 끝나면 resolve */
    mailOut() {
      if (!letter || reduced) return Promise.resolve();
      const up = -geo.mail.m * 0.66;
      const base = letter.style.transform;
      const anim = letter.animate(
        [{ transform: base }, { transform: `${base} translateY(${f(up)}px)`, offset: 0.7 }, { transform: `${base} translateY(${f(up * 0.92)}px)` }],
        { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' },
      );
      return anim.finished.then(() => {
        setTimeout(() => letter?.animate([{ transform: `${base} translateY(${f(up * 0.92)}px)` }, { transform: base }], { duration: 320, easing: 'ease-in' }), 260);
      }).catch(() => {});
    },
    get mail() { return mailEl; },
    get angle() { return angle; },
    /** 시험용 — 각도를 바로 */
    turn(deg) { turnTo(deg); },
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(followRaf);
      clearInterval(boilTimer);
      clearTimeout(resizing);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      house.remove();
    },
  };
}
