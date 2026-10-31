// 대화창 — 방에 들어가면 화면 아래 가로로 긴 흰 상자에 대사가 한 줄씩(대사는 talk/lines.js).
//   게임 대화창처럼 이중 테두리(굵은 바깥 + 얇은 안쪽)를 손으로 그은 선으로. 테두리만 190ms 마다 한 장씩 위글(loader/wobble.js 와 같은 박자 ·
//   같은 흔들림 값, SVG 필터 없이 — iOS Safari 에서 검게 깜빡이지 않게). 화면은 흔들리지 않는다.
//   왼쪽 위 화자 이름표(화자 색), 오른쪽 아래 작은 ▼ — 대사가 다 나오면 보인다.
//   누르기: 쓰는 중이면 그 대사를 바로 다 보이고, 다 보인 뒤면 다음 대사, 마지막 대사 뒤면 닫는다.
//   모션 줄이기: 위글 · 타이핑 없이 대사가 바로.
//   끝까지 넘긴 대화는 이 브라우저에 적어 두고 다시 띄우지 않는다(방마다). 도중에 떠나면 다음에 처음부터.
//   대사를 고치면(talk/lines.js) 새 대화로 보고 한 번 더 띄운다.

import { jitter, WOBBLE_FRAME } from '../loader/wobble.js';
import { SPEAKERS } from './lines.js';

const FRAMES = 4;
const CHAR_MS = 28; // 글자 사이 — 빠르게
const ENTER_MS = 260; // 방 화면이 뜨는 동안 기다렸다가

const SEEN_KEY = 'hsh:talk-seen'; // { 방: 대사 서명 }

const f = (n) => n.toFixed(1);

// 대사 서명 — 대사가 바뀌면 달라진다
const signOf = (list) => {
  let h = 0;
  for (const ch of JSON.stringify(list)) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
  return (h >>> 0).toString(36);
};
const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; }
};
const writeSeen = (key, sign) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [key]: sign })); } catch { /* 적지 못하면 다음에 한 번 더 뜬다 */ }
};

/** 손으로 그은 둥근 네모 — 둘레를 성글게 찍어 점마다 조금 비틀고 부드럽게 잇는다. k 장째, salt 로 선마다 다르게 */
function roughRect(x0, y0, w, h, r, amp, k, salt) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  const pts = [];
  const side = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 40));
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  const corner = (cx, cy, a0) => {
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * Math.PI) / 6;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  side(x0 + r, y0, x1 - r, y0);
  corner(x1 - r, y0 + r, -Math.PI / 2);
  side(x1, y0 + r, x1, y1 - r);
  corner(x1 - r, y1 - r, 0);
  side(x1 - r, y1, x0 + r, y1);
  corner(x0 + r, y1 - r, Math.PI / 2);
  side(x0, y1 - r, x0, y0 + r);
  corner(x0 + r, y0 + r, Math.PI);
  const p = pts.map(([x, y], i) => [x + jitter(i, k, salt) * amp, y + jitter(i, k, salt + 1) * amp]);
  // Catmull-Rom → 베지어(닫힌 선)
  const n = p.length;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const e = p[(i + 2) % n];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return `${d}Z`;
}

function build() {
  const root = document.createElement('div');
  root.className = 'hsh-say';
  root.hidden = true;
  root.innerHTML = `
    <button class="hsh-say__box" type="button">
      <svg class="hsh-say__frame" aria-hidden="true">
        <path class="hsh-say__outer"/><path class="hsh-say__sketch"/><path class="hsh-say__inner"/>
      </svg>
      <span class="hsh-say__who" aria-hidden="true"></span>
      <span class="hsh-say__line" aria-hidden="true"><span class="hsh-say__shown"></span><span class="hsh-say__rest"></span></span>
      <svg class="hsh-say__next" viewBox="0 0 10 8" aria-hidden="true"><path d="M1 1.2L9 1L5.1 7z"/></svg>
    </button>
    <p class="hsh-say__sr" aria-live="polite"></p>`;
  return root;
}

/**
 * @param {HTMLElement} host   붙일 곳(#app)
 * @param {{ reduced?: boolean }} opts
 */
export function mountTalk(host, { reduced = false } = {}) {
  const root = build();
  root.classList.toggle('is-reduced', reduced);
  host.append(root);
  const $ = (q) => root.querySelector(q);
  const box = $('.hsh-say__box');
  const paths = [$('.hsh-say__outer'), $('.hsh-say__sketch'), $('.hsh-say__inner')];
  const who = $('.hsh-say__who');
  const shown = $('.hsh-say__shown');
  const rest = $('.hsh-say__rest');
  const say = $('.hsh-say__sr');

  let lines = [];
  let seenKey = '';
  let at = 0;
  let chars = [];
  let typed = 0;
  let typing = 0;
  let entering = 0;
  let hiding = 0;
  let wobbling = 0;
  let k = 0;
  let frames = [];

  // 테두리 4장 — 크기가 바뀔 때만 새로 그린다
  const draw = () => {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    const narrow = w < 480;
    const gap = narrow ? 5 : 6; // 바깥 · 안쪽 선 사이
    const amp = reduced ? 0 : 0.7;
    frames = Array.from({ length: reduced ? 1 : FRAMES }, (_, i) => [
      roughRect(1.5, 1.5, w - 3, h - 3, 12, amp, i, 1),
      roughRect(2.2, 2, w - 4.2, h - 4, 12, amp * 1.6, i, 7),
      roughRect(1.5 + gap, 1.5 + gap, w - 3 - gap * 2, h - 3 - gap * 2, 7, amp * 0.8, i, 13),
    ]);
    paint();
  };
  const paint = () => {
    const fr = frames[k % frames.length];
    if (!fr) return;
    paths.forEach((p, i) => p.setAttribute('d', fr[i]));
    if (!reduced) who.style.rotate = `${(-2 + jitter(0, k, 21) * 0.8).toFixed(2)}deg`;
  };
  new ResizeObserver(draw).observe(box);

  const wobble = (on) => {
    clearInterval(wobbling);
    if (!on || reduced) return;
    wobbling = setInterval(() => { k = (k + 1) % FRAMES; paint(); }, WOBBLE_FRAME);
  };

  const paintText = () => {
    shown.textContent = chars.slice(0, typed).join('');
    rest.textContent = chars.slice(typed).join(''); // 아직 안 나온 글자도 자리는 차지한다 — 줄이 쓰는 도중에 바뀌지 않게
    const done = typed >= chars.length;
    root.classList.toggle('is-done', done);
    box.setAttribute('aria-label', done && at === lines.length - 1 ? '대화 닫기' : '다음 대사');
  };

  const finish = () => {
    cancelAnimationFrame(typing);
    typed = chars.length;
    paintText();
  };

  const showLine = (i) => {
    at = i;
    const [name, text] = lines[i];
    who.textContent = name;
    who.style.setProperty('--c', SPEAKERS[name]?.color || 'var(--hsh-silver)');
    say.textContent = `${name}: ${text}`;
    chars = Array.from(text);
    typed = 0;
    cancelAnimationFrame(typing);
    if (reduced) { finish(); return; }
    paintText();
    // 지난 시간으로 글자 수를 센다 — 방 화면을 그리느라(archive 3D) 프레임이 밀려도 대사가 늘어지지 않게.
    // 한 프레임에 두 글자까지만 — 오래 멈췄다 풀려도 한꺼번에 튀어나오지 않고 타이핑으로 보이게
    const t0 = performance.now();
    const tick = (now) => {
      const n = Math.min(chars.length, typed + 2, Math.floor((now - t0) / CHAR_MS) + 1);
      if (n !== typed) { typed = n; paintText(); }
      if (typed < chars.length) typing = requestAnimationFrame(tick);
    };
    typing = requestAnimationFrame(tick);
  };

  const close = ({ instant = false } = {}) => {
    clearTimeout(entering);
    cancelAnimationFrame(typing);
    wobble(false);
    if (root.hidden) return;
    root.classList.remove('is-open');
    document.documentElement.classList.remove('hsh-say-on');
    const done = () => { root.hidden = true; say.textContent = ''; };
    clearTimeout(hiding);
    if (instant || reduced) done();
    else hiding = setTimeout(done, 180);
  };

  box.addEventListener('click', () => {
    if (!root.classList.contains('is-open')) return;
    if (typed < chars.length) finish();
    else if (at < lines.length - 1) showLine(at + 1);
    else {
      if (seenKey) writeSeen(seenKey, signOf(lines));
      close();
    }
  });

  return {
    get open() { return root.classList.contains('is-open'); },
    /**
     * @param {Array<[string, string]>} list
     * @param {string} [key]  방 이름 — 끝까지 본 대화를 기억하는 자리(없으면 매번 띄운다)
     */
    play(list, key) {
      close({ instant: true });
      if (!list?.length) return;
      if (key && readSeen()[key] === signOf(list)) return;
      lines = list;
      seenKey = key;
      entering = setTimeout(() => {
        clearTimeout(hiding);
        root.hidden = false;
        showLine(0);
        draw();
        void root.offsetWidth;
        root.classList.add('is-open');
        document.documentElement.classList.add('hsh-say-on'); // 아래에 가려지는 것(archive 라벨 줄)을 잠깐 숨긴다 — talk.css
        wobble(true);
      }, reduced ? 0 : ENTER_MS);
    },
    close,
  };
}
