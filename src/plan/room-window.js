// 방 버튼을 누르면 뜨는 창 — 폴더 탭 + 주소창이 있는 브라우저 창 꼴에 무늬 스티커를 걸쳐 둔다.
//   스티커는 열 때마다 새로 — 2~4개, 모양(별 · 하트 · 뾰족이 · 클로버 · 구름) · 무늬(줄무늬 · 도트 · 망점 · 단색 · 깅엄) ·
//   색 · 크기 · 기울기가 무작위. 창 둘레를 개수만큼 나눠 칸마다 하나씩 놓아 몰리지 않게(탭 · × 쪽은 비운다).
//   창 머리(탭 · 주소창 줄)는 누른 버튼의 바탕색, 제목 밑줄은 버튼 글자색을 따른다.
//   선은 모두 로딩 화면 집 윤곽과 같은 얇은 회색.
//   뒤의 홈 화면은 반투명 덮개로 살짝 가린다. 닫기: ×, 덮개 누르기, Esc.
//   주소창: 지금 사이트 주소 / 방 이름. 하트: 누르면 채워지고 이 브라우저에 기억한다(방마다).
//   about __VE 방은 Vibe · Echo 카드 두 장(about.js).
//   neighbor 방의 칩은 '배너교환은 여기에서' 버튼 — 누르면 hsh:banner 이벤트, 지금은 배너 정보 자리로 바꿔 보여 준다.
//   버튼에 data-category(hongjiwon.love 카테고리 id 또는 slug)가 있으면 그 카테고리의 글 · 갤러리 · 메모 창
//   (content/viewer.js). 목록 → 폴더 → 글로 갈 때마다 창 기록을 한 칸씩 쌓는다 — < > · 휴대폰 뒤로 가기가 그대로 오간다.

import { mountAbout } from './about.js';
import { mountNeighbor } from './neighbor.js';
import { mountContent } from '../content/viewer.js';

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
  const n = 2 + Math.floor(Math.random() * 3); // 2 ~ 4
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

// ---------- 공지(notice 버튼) ----------

const NOTICE_TAG = '@3tatichearts · 수아'; // 공지 창의 검정 이름표
// 방 버튼(data-label)마다 검정 이름표 글자 — 없으면 버튼 이름(aria-label)
const PILLS = {
  'about __VE': 'Vibe X Echo',
  'teatime?': '홍차라도 한 잔?',
  notice: NOTICE_TAG,
  archive: '홍차아카이브',
};
const NOTICE_THUMB = 'src/images/notice-thumb.jpg'; // 공지 창 썸네일 사진
// 칸마다 [제목, [[본문, 화살표 줄], …] 또는 한 줄] — **…** 는 강조
const NOTICE = [
  ['ABOUT', [
    ['성인 여성, 일상과 덕질로 채워가는 계정', '**♡ ARCH Vibe 99%** + etc. 1%'],
    ['좋아하는 것들이 많아 다양하게 언급합니다.', 'Nintendo · anime · novel · J-pop · idol'],
    ['**CBC 오픈**, 드림 지우기X 외에 특별한 배려 요하지 않습니다.', '온리 성향 분은 메인 기준 1T1D, 겹드림 연결 ok♡'],
  ]],
  ['ME', [
    ['AI 이미지 생성•소비합니다. (학습 X)', '뽑아드린 에셋은 편히 써주세요!'],
    ['좋지 않은 이슈에 굳이 말 얹지 말자 주의입니다.', '그럴 수 있지 하고 넘기는 편. 팔안굽 성향 강합니다…'],
    ['무던한 성향이라 수용 범위가 넓습니다.', '기존 트친분들은 대화할 때 제 신상 관련 언급만 피해주세요~'],
  ]],
  ['NG', '미성년자 · 남성 · 공계에서의 R18 전시'],
];

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const SUP = ['¹', '²', '³'];

/** 위쪽 탭(ABOUT · ME · NG)과 칸마다 내용 — 첫 칸만 열어 둔다 */
function noticeMarkup() {
  const tabs = NOTICE.map(([head], i) =>
    `<button class="hsh-note__tab" type="button" role="tab" id="hsh-note-tab-${i}" aria-controls="hsh-note-sec-${i}" aria-selected="${i === 0}">${head}</button>`).join('');
  const secs = NOTICE.map(([, body], i) => {
    const items = typeof body === 'string'
      ? `<p class="hsh-note__line">${rich(body)}</p>`
      : body.map(([line, more], j) =>
        `<p class="hsh-note__item"><span class="hsh-note__line"><sup>${SUP[j]}</sup> ${rich(line)}</span>` +
        `<span class="hsh-note__more">⇢ ${rich(more)}</span></p>`).join('');
    return `<section class="hsh-note__sec" role="tabpanel" id="hsh-note-sec-${i}" aria-labelledby="hsh-note-tab-${i}"${i ? ' hidden' : ''}>${items}</section>`;
  }).join('');
  return { tabs, secs };
}

// ---------- 내 배너(neighbor 의 '배너교환은 여기에서') ----------

const BANNER = {
  site: 'https://xn--9g3b29an0p.me', // 바이브.me — 한글 주소를 못 받는 곳도 있어서 퓨니코드로
  siteLabel: 'xn--9g3b29an0p.me',
  image: 'https://iokdgqzfprtggsnrusez.supabase.co/storage/v1/object/public/user-banners/cfe0dc66-7fa2-450e-8817-44073a4a5aab/banner', // 3000×600
};

/** 클립보드에 — 안 되는 브라우저(오래된 iOS · http)는 숨긴 textarea 로 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* 아래로 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  try { document.execCommand('copy'); } catch { /* 복사 못 해도 조용히 */ }
  ta.remove();
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
        <span class="hsh-win__nav">
          <button type="button" data-nav="back" aria-label="뒤로"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M8 2L4 6L8 10"/></svg></button>
          <button type="button" data-nav="forward" aria-label="앞으로"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2L8 6L4 10"/></svg></button>
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
          <div class="hsh-note__tabs" role="tablist" aria-label="공지" hidden></div>
          <div class="hsh-win__scroll">
            <p class="hsh-win__empty"></p>
            <div class="hsh-win__note hsh-note" hidden></div>
            <div class="hsh-ve" hidden></div>
            <div class="hsh-nb" hidden></div>
            <div class="hsh-ct-box" hidden></div>
            <div class="hsh-banner" hidden>
              <img class="hsh-banner__img" src="${BANNER.image}" alt="hongjiwon.love 배너" width="3000" height="600" loading="lazy" decoding="async">
              <dl class="hsh-banner__rows">
                <div class="hsh-banner__row">
                  <dt>url</dt>
                  <dd><span class="hsh-banner__val">${BANNER.siteLabel}</span><button class="hsh-banner__copy" type="button" data-copy="${BANNER.site}">복사</button></dd>
                </div>
                <div class="hsh-banner__row">
                  <dt>image</dt>
                  <dd><span class="hsh-banner__val">${BANNER.image}</span><button class="hsh-banner__copy" type="button" data-copy="${BANNER.image}">복사</button></dd>
                </div>
              </dl>
            </div>
          </div>
          <div class="hsh-win__rail" aria-hidden="true" hidden><span class="hsh-win__knob"></span></div>
        </div>
      </div>
    </section>`;
  // 썸네일 귀퉁이 하트 — 단색
  root.querySelector('.hsh-win__thumb').append(sticker({ shape: 'heart', kind: 'solid', color: '#f4a6c9' }, 'hsh-win__thumb-heart'));
  const { tabs, secs } = noticeMarkup();
  root.querySelector('.hsh-note__tabs').innerHTML = tabs;
  root.querySelector('.hsh-win__note').innerHTML = secs;
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
  const note = win.querySelector('.hsh-win__note');
  const banner = win.querySelector('.hsh-banner');
  const nbBox = win.querySelector('.hsh-nb');
  const neighbor = mountNeighbor(nbBox, () => syncRail());
  const veBox = win.querySelector('.hsh-ve');
  const about = mountAbout(veBox, () => syncRail());
  const ctBox = win.querySelector('.hsh-ct-box');
  const content = mountContent(ctBox, {
    // 창 안에서 다른 화면으로 — 지금 칸에 스크롤 위치를 적어 두고(뒤로 오면 그 자리로) 한 칸 쌓는다
    onNavigate: (state) => {
      if (steps[at]) steps[at].state = { ...steps[at].state, scroll: scroller.scrollTop };
      step({ detail: steps[at].detail, page: 'content', state });
      scroller.scrollTop = 0;
    },
    onResize: () => syncRail(),
    // 주소창: 사이트 / 방 / (카테고리) / 폴더 … / 글 제목
    onTitle: (name, trail = []) => {
      const label = title.textContent;
      const parts = [label, name && name.toLowerCase() !== label.toLowerCase() ? name : null, ...trail].filter(Boolean);
      url.textContent = `${siteHost()} / ${parts.join(' / ')}`;
    },
  });
  const thumb = win.querySelector('.hsh-win__thumb');
  const noteTabs = win.querySelector('.hsh-note__tabs');
  const scroller = win.querySelector('.hsh-win__scroll');
  const rail = win.querySelector('.hsh-win__rail');
  const knob = win.querySelector('.hsh-win__knob');
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
      next.addEventListener('click', () => {
        if (steps[at]?.page === 'banner') return;
        showBanner();
        step({ detail: steps[at].detail, page: 'banner' });
      });
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
    // 공지면 탭 + 내용(ABOUT 부터), 아니면 '곧 채워질' 안내
    const isNotice = label === 'notice';
    note.hidden = noteTabs.hidden = !isNotice;
    // neighbor 면 친구 배너 모음(neighbor.js)
    const isNeighbor = label === 'neighbor';
    nbBox.hidden = !isNeighbor;
    if (isNeighbor) neighbor.show();
    // about __VE 면 Vibe · Echo 카드(about.js)
    const isAbout = label === 'about __VE';
    veBox.hidden = !isAbout;
    if (isAbout) about.reset();
    // 카테고리 버튼이면 글 · 갤러리 · 메모(그리기는 content.show 가 상태를 받아서)
    const isContent = Boolean(win.dataset.category);
    ctBox.hidden = !isContent;
    empty.hidden = isNotice || isNeighbor || isAbout || isContent;
    banner.hidden = true;
    if (isNotice) pickTab(0);
    else scroller.scrollTop = 0;
    syncRail();
  };

  // 공지 탭 — 누른 칸만 보이고 밑줄이 옮겨 간다
  const pickTab = (n) => {
    noteTabs.querySelectorAll('.hsh-note__tab').forEach((t, i) => t.setAttribute('aria-selected', String(i === n)));
    note.querySelectorAll('.hsh-note__sec').forEach((s, i) => { s.hidden = i !== n; });
    scroller.scrollTop = 0;
    syncRail();
  };
  noteTabs.addEventListener('click', (e) => {
    const t = e.target.closest('.hsh-note__tab');
    if (t) pickTab([...noteTabs.children].indexOf(t));
  });

  // 스크롤바 — 창 무늬에 맞춘 막대를 직접 그린다(모바일에서도 늘 보이게). 넘칠 때만 나온다
  const syncRail = () => {
    const { scrollHeight: h, clientHeight: c, scrollTop: t } = scroller;
    rail.hidden = h - c < 2 || !veBox.hidden; // about __VE 는 막대 없이 손으로 내려 읽기만
    if (rail.hidden) return;
    const track = rail.clientHeight;
    const size = Math.max(28, (track * c) / h);
    knob.style.height = `${size}px`;
    knob.style.translate = `0 ${((track - size) * t) / (h - c)}px`;
  };
  scroller.addEventListener('scroll', syncRail, { passive: true });
  new ResizeObserver(syncRail).observe(scroller);
  knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    knob.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const top0 = scroller.scrollTop;
    const k = (scroller.scrollHeight - scroller.clientHeight) / (rail.clientHeight - knob.offsetHeight);
    const move = (ev) => { scroller.scrollTop = top0 + (ev.clientY - y0) * k; };
    knob.addEventListener('pointermove', move);
    knob.addEventListener('lostpointercapture', () => knob.removeEventListener('pointermove', move), { once: true });
  });

  // 배너 정보 — 배너 그림 + 사이트 주소 · 배너 이미지 주소(각각 복사 버튼)
  const showBanner = () => {
    show('my banner', '');
    empty.hidden = true;
    banner.hidden = false;
    syncRail();
    win.dispatchEvent(new CustomEvent('hsh:banner', { bubbles: true }));
  };
  banner.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    await copyText(btn.dataset.copy);
    btn.textContent = '복사됨 ♡';
    btn.classList.add('is-done');
    clearTimeout(btn.timer);
    btn.timer = setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('is-done'); }, 1400);
  });

  const paintLike = () => {
    const on = Boolean(current && readLikes()[current]);
    like.setAttribute('aria-pressed', String(on));
  };

  // ---------- 뒤로 · 앞으로 — 브라우저 기록과 같이 간다 ----------
  //   방을 열거나 창 안에서 다른 쪽(my banner)으로 가면 기록을 한 칸 쌓는다.
  //   < > · 휴대폰 뒤로 가기 · 브라우저 버튼이 모두 같은 기록을 오간다. 처음 칸에서 뒤로 가면 창이 닫힌다.
  let steps = []; // 이번 창에서 거친 화면 [{ detail, page: 'room' | 'banner' }]
  let at = -1; // 지금 steps 의 몇 번째(-1 = 창 닫힘)
  const navBack = win.querySelector('[data-nav="back"]');
  const navFwd = win.querySelector('[data-nav="forward"]');

  const paintNav = () => {
    navFwd.disabled = at < 0 || at >= steps.length - 1;
  };

  const step = (view) => {
    at += 1;
    steps.length = at;
    steps.push(view);
    history.pushState({ hshWin: at }, '');
    paintNav();
  };

  const showStep = (view) => {
    if (win.hidden || win.classList.contains('is-closing')) openWindow(view.detail, back);
    else show(view.detail.label, '곧 채워질 방이에요.');
    if (view.page === 'banner') showBanner();
    if (view.page === 'content') {
      scroller.scrollTop = 0;
      const shown = view;
      content.show(view.state).then(() => {
        if (steps[at] === shown) { scroller.scrollTop = view.state.scroll || 0; syncRail(); }
      });
    }
    paintNav();
  };

  navBack.addEventListener('click', () => { if (at >= 0) history.back(); });
  navFwd.addEventListener('click', () => { if (at < steps.length - 1) history.forward(); });

  window.addEventListener('popstate', (e) => {
    const i = e.state?.hshWin;
    if (typeof i !== 'number' || !steps[i]) {
      // 창보다 앞(홈)으로 돌아왔다 — 열려 있으면 닫는다
      if (at >= 0) { at = -1; closeWindow(); }
      return;
    }
    at = i;
    showStep(steps[i]);
  });

  const open = (detail, from) => {
    steps = [];
    at = -1;
    openWindow(detail, from);
    if (detail.category) {
      const state = content.initial(detail);
      step({ detail, page: 'content', state });
      content.show(state);
      return;
    }
    step({ detail, page: 'room' });
  };

  // ×  · 덮개 · Esc — 쌓아 둔 기록을 한꺼번에 되돌리고 닫는다
  const close = () => {
    if (at >= 0) {
      const n = at + 1;
      at = -1;
      history.go(-n);
    }
    closeWindow();
  };

  const openWindow = ({ room, label, name, bg, fg, category }, from) => {
    clearTimeout(closing);
    back = from ?? null;
    current = category ? `${room}:${category}` : room; // 하트는 버튼마다
    win.dataset.room = room;
    if (category) win.dataset.category = category;
    else delete win.dataset.category;
    win.style.setProperty('--hsh-win-tint', bg);
    win.style.setProperty('--hsh-win-ink', fg);
    show(label, '곧 채워질 방이에요.');
    scatter(frame);
    setPill(room, PILLS[label] ?? name);
    thumb.style.backgroundImage = label === 'notice' ? `url("${NOTICE_THUMB}")` : '';
    paintLike();
    win.hidden = false;
    win.classList.remove('is-closing');
    void win.offsetWidth; // 다시 열 때도 등장 전환이 처음부터
    win.classList.add('is-open');
    win.querySelector('.hsh-win__x').focus({ preventScroll: true });
  };

  const closeWindow = () => {
    if (win.hidden || win.classList.contains('is-closing')) return;
    content.close();
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
