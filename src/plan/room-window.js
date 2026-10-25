// 방 버튼을 누르면 뜨는 창 — 폴더 탭 + 주소창이 있는 브라우저 창 꼴에 무늬 스티커를 걸쳐 둔다.
//   스티커는 열 때마다 새로 — 3~6개, 모양(별 · 하트 · 뾰족이 · 클로버 · 구름) · 무늬(줄무늬 · 도트 · 망점 · 단색 · 깅엄) ·
//   색 · 크기 · 기울기가 무작위. 창 둘레를 개수만큼 나눠 칸마다 하나씩 놓아 몰리지 않게(탭 · × 쪽은 비운다).
//   창 머리(탭 · 주소창 줄)는 누른 버튼의 바탕색, 제목 밑줄은 버튼 글자색을 따른다.
//   선은 모두 로딩 화면 집 윤곽과 같은 얇은 회색.
//   뒤의 홈 화면은 반투명 덮개로 살짝 가린다. 닫기: ×, 덮개 누르기, Esc.
//   주소창: 지금 사이트 주소 / 방 이름. 하트: 누르면 채워지고 이 브라우저에 기억한다(방마다).
//   neighbor 방의 칩은 '배너교환은 여기에서' 버튼 — 누르면 hsh:banner 이벤트, 지금은 배너 정보 자리로 바꿔 보여 준다.

const NS = 'http://www.w3.org/2000/svg';
const LIKE_KEY = 'hsh:liked';

/** 뾰족한 별(가시 points 개) — 가시 길이를 조금씩 달리해 손으로 오린 느낌 */
function burst(points, outer, inner, wobble = 0.18, seed = 1) {
  let d = '';
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const s = Math.sin(seed * 91.7 + i * 12.9) * 0.5 + 0.5;
    const r = i % 2 ? inner : outer * (1 - wobble + s * wobble * 2);
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}

const HEART = 'M0 9C-7 3 -12 -1 -12 -6C-12 -10 -9 -12 -6 -12C-3 -12 -1 -10 0 -8C1 -10 3 -12 6 -12C9 -12 12 -10 12 -6C12 -1 7 3 0 9Z';

// ---------- 스티커 ----------

const S = 31; // 모양은 -34..34 칸을 거의 채운다
const scaleD = (d, k) => d.replace(/-?\d+(\.\d+)?/g, (n) => (Number(n) * k).toFixed(1));
const SHAPES = {
  star: burst(5, S, 13, 0, 5),
  bigstar: burst(8, S, 17, 0, 2), // 통통한 팔각 별
  spiky: burst(8, S, 7, 0.25, 1), // 뾰족뾰족이
  heart: scaleD(HEART, 2.6),
  // 동그라미 넷이 붙은 클로버 — 바깥 윤곽만
  clover: 'M0 -20.5A15 15 0 1 1 20.5 0A15 15 0 1 1 0 20.5A15 15 0 1 1 -20.5 0A15 15 0 1 1 0 -20.5Z',
  // 세로로 긴 동그라미 셋이 붙은 구름 — 바깥 윤곽만
  cloud: 'M-10 -7.5A11 18 0 0 1 10 -7.5A11 18 0 1 1 10 7.5A11 18 0 0 1 -10 7.5A11 18 0 1 1 -10 -7.5Z',
};
const COLORS = ['#f4a6c9', '#8fb0ec', '#a9d78a', '#f6dc8f', '#c9b5f2', '#8fd8bd'];
const PATTERNS = ['stripe', 'dot', 'halftone', 'solid', 'gingham'];
const LINE = '#8f9497'; // 외곽선 — 로딩 화면 집 윤곽과 같은 회색

const pick = (list) => list[Math.floor(Math.random() * list.length)];
let patternNo = 0;

/** 무늬 하나 — <pattern> 마크업과 fill 값 */
function patternFill(kind, color) {
  if (kind === 'solid') return { defs: '', fill: color };
  const id = `hsh-win-pt-${patternNo++}`;
  const open = (w, h, extra = '') => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${extra}>`;
  const body = {
    stripe: open(10, 10) + `<rect width="10" height="5" fill="${color}" fill-opacity="0.75"/>`,
    dot: open(11, 11) + `<circle cx="3" cy="3" r="2.6" fill="${color}"/><circle cx="8.5" cy="8.5" r="2.6" fill="${color}"/>`,
    halftone: open(3.8, 3.8, ' patternTransform="rotate(45)"') + `<circle cx="1.9" cy="1.9" r="1.3" fill="${color}"/>`,
    gingham: open(12, 12) + `<rect width="6" height="12" fill="${color}" fill-opacity="0.45"/><rect width="12" height="6" fill="${color}" fill-opacity="0.45"/>`,
  }[kind];
  return { defs: `<defs>${body}</pattern></defs>`, fill: `url(#${id})` };
}

/** 스티커 한 장 — 흰 바탕(뒤가 비치지 않게) + 무늬 + 얇은 회색 외곽선 */
function sticker({ shape, kind, color, tilt = 0 }, cls) {
  const d = SHAPES[shape];
  const { defs, fill } = patternFill(kind, color);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '-34 -34 68 68');
  svg.setAttribute('aria-hidden', 'true');
  const glow = kind === 'halftone' // 망점은 가장자리가 살짝 번지게
    ? `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="0.25" stroke-width="6" stroke-linejoin="round"/>`
    : '';
  svg.innerHTML = defs +
    `<g transform="rotate(${tilt.toFixed(1)})">${glow}<path d="${d}" fill="#fff"/><path d="${d}" fill="${fill}"/>` +
    `<path class="hsh-win__outline" d="${d}" stroke="${LINE}"/></g>`;
  return svg;
}

/**
 * 창 둘레에 n 개 — 둘레(탭 · × 가 있는 위 왼쪽은 빼고)를 n 칸으로 나눠 칸마다 하나.
 * 둘레 위치 t(0..1) → 창 안 좌표(%). 위 오른쪽 → 오른쪽 → 아래 → 왼쪽 순서.
 */
function edgePoint(t) {
  const segs = [
    [[62, 0], [100, 0]], // 위(탭 오른쪽부터)
    [[100, 0], [100, 100]], // 오른쪽
    [[100, 100], [0, 100]], // 아래
    [[0, 100], [0, 18]], // 왼쪽(탭 아래까지)
  ];
  const lens = segs.map(([[x0, y0], [x1, y1]]) => Math.hypot(x1 - x0, y1 - y0));
  let d = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < segs.length; i++) {
    if (d <= lens[i] || i === segs.length - 1) {
      const [[x0, y0], [x1, y1]] = segs[i];
      const k = Math.min(1, d / lens[i]);
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
    d -= lens[i];
  }
  return [100, 50];
}

function scatter(frame) {
  frame.querySelectorAll('.hsh-win__deco').forEach((n) => n.remove());
  const n = 3 + Math.floor(Math.random() * 4); // 3 ~ 6
  const start = Math.random();
  const big = Math.floor(Math.random() * n); // 하나는 크게
  for (let i = 0; i < n; i++) {
    const t = (start + (i + 0.2 + Math.random() * 0.6) / n) % 1;
    const [x, y] = edgePoint(t);
    const size = i === big ? 78 + Math.random() * 22 : 30 + Math.random() * 30;
    const svg = sticker({
      shape: pick(Object.keys(SHAPES)),
      kind: pick(PATTERNS),
      color: pick(COLORS),
      tilt: Math.random() * 40 - 20,
    }, 'hsh-win__deco');
    svg.style.left = `${x}%`;
    svg.style.top = `${y}%`;
    svg.style.width = svg.style.height = `${Math.round(size)}px`;
    svg.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s`;
    frame.append(svg);
  }
}

/** 지금 사이트 주소(한글 도메인은 한글로) */
function siteHost() {
  const host = location.host || 'home sweet home';
  return host.split('.').map((part) => (part.startsWith('xn--') ? punyDecode(part.slice(4)) : part)).join('.');
}

// 한글 도메인(xn--…)을 읽을 수 있게 — RFC 3492 디코더
function punyDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  let n = 128, i = 0, bias = 72;
  const out = [];
  let b = input.lastIndexOf('-');
  if (b < 0) b = 0;
  for (let j = 0; j < b; j++) out.push(input.charCodeAt(j));
  const digit = (c) => (c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base);
  const adapt = (delta, num, first) => {
    let k = 0;
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / num);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  for (let idx = b > 0 ? b + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      const d = digit(input.charCodeAt(idx++));
      i += d * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

const readLikes = () => {
  try { return JSON.parse(localStorage.getItem(LIKE_KEY)) || {}; } catch { return {}; }
};
const writeLikes = (likes) => {
  try { localStorage.setItem(LIKE_KEY, JSON.stringify(likes)); } catch { /* 저장 못 해도 이번 화면에서는 채워진다 */ }
};

function build() {
  const root = document.createElement('div');
  root.className = 'hsh-win';
  root.hidden = true;
  root.innerHTML = `
    <div class="hsh-win__veil" data-close></div>
    <section class="hsh-win__frame" role="dialog" aria-modal="true" aria-labelledby="hsh-win-title">
      <div class="hsh-win__tab">
        <span class="hsh-win__site">home sweet home</span>
        <button class="hsh-win__x" type="button" data-close aria-label="창 닫기">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2L10 10M10 2L2 10"/></svg>
        </button>
      </div>
      <div class="hsh-win__bar">
        <span class="hsh-win__nav" aria-hidden="true">
          <svg viewBox="0 0 12 12"><path d="M8 2L4 6L8 10"/></svg>
          <svg viewBox="0 0 12 12"><path d="M4 2L8 6L4 10"/></svg>
        </span>
        <span class="hsh-win__url"></span>
        <button class="hsh-win__like" type="button" aria-pressed="false" aria-label="이 방 좋아요">
          <svg viewBox="-14 -14 28 28" aria-hidden="true"><path d="${HEART}"/></svg>
        </button>
      </div>
      <div class="hsh-win__body">
        <header class="hsh-win__head">
          <span class="hsh-win__thumb" aria-hidden="true"></span>
          <div class="hsh-win__titles">
            <h2 class="hsh-win__title" id="hsh-win-title"></h2>
            <span class="hsh-win__pill"></span>
          </div>
        </header>
        <div class="hsh-win__page">
          <p class="hsh-win__empty"></p>
        </div>
      </div>
    </section>`;
  // 썸네일 귀퉁이 하트 — 단색
  root.querySelector('.hsh-win__thumb').append(sticker({ shape: 'heart', kind: 'solid', color: '#f4a6c9' }, 'hsh-win__thumb-heart'));
  return root;
}

/**
 * @param {HTMLElement} host     창을 붙일 곳(#app)
 * @param {HTMLElement} trigger  hsh:room 이 올라오는 곳(.hsh-plan)
 * @param {{ reduced?: boolean }} opts
 */
export function enableRoomWindow(host, trigger, { reduced = false } = {}) {
  const win = build();
  host.append(win);
  const frame = win.querySelector('.hsh-win__frame');
  const title = win.querySelector('.hsh-win__title');
  const url = win.querySelector('.hsh-win__url');
  const like = win.querySelector('.hsh-win__like');
  const empty = win.querySelector('.hsh-win__empty');
  let pill = win.querySelector('.hsh-win__pill');
  let current = null;
  let back = null; // 닫으면 포커스를 돌려줄 버튼
  let closing = null;

  const setPill = (room, name) => {
    // neighbor 는 누를 수 있는 칩, 나머지는 방 이름표
    const next = document.createElement(room === 'entry' ? 'button' : 'span');
    next.className = 'hsh-win__pill';
    if (room === 'entry') {
      next.type = 'button';
      next.classList.add('is-link');
      next.textContent = '배너교환은 여기에서 <';
      next.addEventListener('click', () => showBanner());
    } else {
      next.textContent = name;
    }
    pill.replaceWith(next);
    pill = next;
  };

  const show = (label, text) => {
    title.textContent = label;
    url.textContent = `${siteHost()} / ${label}`;
    empty.textContent = text;
  };

  // 배너 정보 자리 — 내용이 생기면 여기서 채운다
  const showBanner = () => {
    show('my banner', '곧 채워질 배너 정보예요.');
    win.dispatchEvent(new CustomEvent('hsh:banner', { bubbles: true }));
  };

  const paintLike = () => {
    const on = Boolean(current && readLikes()[current]);
    like.setAttribute('aria-pressed', String(on));
  };

  const open = ({ room, label, name, bg, fg }, from) => {
    clearTimeout(closing);
    back = from ?? null;
    current = room;
    win.dataset.room = room;
    win.style.setProperty('--hsh-win-tint', bg);
    win.style.setProperty('--hsh-win-ink', fg);
    show(label, '곧 채워질 방이에요.');
    scatter(frame);
    setPill(room, name);
    paintLike();
    win.hidden = false;
    win.classList.remove('is-closing');
    void win.offsetWidth; // 다시 열 때도 등장 전환이 처음부터
    win.classList.add('is-open');
    win.querySelector('.hsh-win__x').focus({ preventScroll: true });
  };

  const close = () => {
    if (win.hidden || win.classList.contains('is-closing')) return;
    win.classList.remove('is-open');
    win.classList.add('is-closing');
    closing = setTimeout(() => {
      win.hidden = true;
      win.classList.remove('is-closing');
      back?.focus?.({ preventScroll: true });
    }, reduced ? 0 : 220);
  };

  like.addEventListener('click', () => {
    if (!current) return;
    const likes = readLikes();
    if (likes[current]) delete likes[current];
    else likes[current] = true;
    writeLikes(likes);
    paintLike();
    if (!reduced && likes[current]) {
      like.animate([{ scale: '1' }, { scale: '1.35', offset: 0.45 }, { scale: '1' }], { duration: 320, easing: 'ease-out' });
    }
  });

  trigger.addEventListener('hsh:room', (e) => open(e.detail, e.target));
  win.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (win.hidden) return;
    if (e.key === 'Escape') close();
    // 창 안에서만 Tab 이 돌게
    if (e.key === 'Tab') {
      const items = [...frame.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
