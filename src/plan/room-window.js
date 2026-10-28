// 방 버튼을 누르면 뜨는 창 — 폴더 탭 + 주소창이 있는 브라우저 창 꼴에 무늬 스티커를 걸쳐 둔다.
//   스티커는 열 때마다 새로 — 2~4개, 모양(별 · 하트 · 뾰족이 · 클로버 · 구름) · 무늬(줄무늬 · 도트 · 망점 · 단색 · 깅엄) ·
//   색 · 크기 · 기울기가 무작위. 창 둘레를 개수만큼 나눠 칸마다 하나씩 놓아 몰리지 않게(탭 · × 쪽은 비운다).
//   창 머리(탭 · 주소창 줄)는 누른 버튼의 바탕색, 제목 밑줄은 버튼 글자색을 따른다.
//   선은 모두 로딩 화면 집 윤곽과 같은 얇은 회색.
//   뒤의 홈 화면은 반투명 덮개로 살짝 가리고, 창이 떠 있는 동안 홈 화면 움직임은 멈춘다(.hsh-plan.is-paused). 닫기: ×, 덮개 누르기, Esc.
//   주소창: 지금 사이트 주소 / 방 이름. 하트: 누르면 채워지고 이 브라우저에 기억한다(방마다).
//   about __VE 방은 글자 아트 · 짧은 글(about-note.js — 열려 있는 동안만 움직이고 떠나면 정리), Vibe · Echo 카드 두 장(about.js)은 /pair.
//   버튼에 data-category(hongjiwon.love 카테고리 id 또는 slug)가 있으면 그 카테고리의 글 · 갤러리 · 메모 창
//   (content/viewer.js). 목록 → 폴더 → 글로 갈 때마다 창 기록을 한 칸씩 쌓는다 — < > · 휴대폰 뒤로 가기가 그대로 오간다.
//   화면마다 주소가 있다(routes.js) — 직접 들어오거나 새로고침해도 그 창이 열리고, 닫으면(×) 홈(/)으로 돌아간다.
//   archive · neighbor 버튼은 브라우저 창 대신 흰 화면 — 열쇠꾸러미(archive/index.js) · 이웃 간판 집(neighbor/index.js).
//   주소 · 뒤로/앞으로 · 닫기는 같은 길. neighbor 의 우체통 패널은 기록 한 칸(/neighbor/banner).
//   창 머리(사진 · 제목 · 검정 알약)는 주인만 보이는 오른쪽 위 edit 로 방마다 고친다 — 머리를 아예 숨길 수도(room-heads.js).

import { mountAbout } from './about.js';
import { aboutNoteMarkup, openAboutNote, loadAboutFont } from './about-note.js';
import { mountContent } from '../content/viewer.js';
import { fetchPost } from '../content/data.js';
import { getClient, ownerSession, hasSavedLogin, AUTH_RETURN, takeReturnPath } from '../content/supabase.js';
import { fetchRoomHeads, cachedRoomHeads, saveRoomHeads, uploadRoomPhoto, removeRoomPhoto } from './room-heads.js';
import { pathOf, parsePath, withKeep } from './routes.js';
import { mountArchive } from '../archive/index.js';
import { mountNeighbor } from '../neighbor/index.js';

const NS = 'http://www.w3.org/2000/svg';
const SCREENS = ['archive', 'neighbor']; // 창 대신 흰 화면으로 여는 방
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

const STICKERS = [2, 4]; // 둘레 스티커 개수 기본(주인이 방마다 바꿀 수 있다 — 0 ~ STICKER_MAX)
const STICKER_MAX = 8;

function scatter(frame, [lo, hi] = STICKERS) {
  frame.querySelectorAll('.hsh-win__deco').forEach((n) => n.remove());
  const n = lo + Math.floor(Math.random() * (hi - lo + 1)); // lo ~ hi
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
// 방 버튼(data-label)마다 검정 이름표 글자 — 없으면 버튼 이름(aria-label). 주인이 edit 로 고친 값이 있으면 그것(room-heads.js)
const PILLS = {
  'about __VE': 'Vibe X Echo',
  'teatime?': '홍차라도 한 잔?',
  notice: NOTICE_TAG,
  archive: '홍차아카이브',
};
const NOTICE_THUMB = 'src/images/notice-thumb.jpg'; // 공지 창 썸네일 사진(주인이 고른 사진이 없을 때)
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
        <button class="hsh-win__edit" type="button" hidden>edit</button>
        <form class="hsh-win__editor" aria-label="창 머리 고치기" novalidate hidden>
          <div class="hsh-win__ed-photo">
            <span class="hsh-win__ed-thumb" aria-hidden="true"></span>
            <label class="hsh-win__ed-btn">사진 고르기<input name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
            <button class="hsh-win__ed-btn" type="button" data-ed="clear">사진 지우기</button>
          </div>
          <label class="hsh-win__ed-field"><span>제목</span><input name="head-title" maxlength="40" autocomplete="off"></label>
          <label class="hsh-win__ed-field"><span>검정 알약</span><input name="head-pill" maxlength="60" autocomplete="off"></label>
          <div class="hsh-win__ed-field"><span id="hsh-win-ed-st">주변 스티커 개수 <em>0 ~ ${STICKER_MAX} · 열 때마다 그 사이에서</em></span>
            <span class="hsh-win__ed-range" role="group" aria-labelledby="hsh-win-ed-st"><input name="st-min" type="number" min="0" max="${STICKER_MAX}" inputmode="numeric" aria-label="최소"> ~ <input name="st-max" type="number" min="0" max="${STICKER_MAX}" inputmode="numeric" aria-label="최대"></span></div>
          <label class="hsh-win__ed-check"><input name="headless" type="checkbox"> 상단 바 숨기기 <em>사진 · 제목 · 검정 알약</em></label>
          <p class="hsh-win__ed-msg" role="status" aria-live="polite"></p>
          <div class="hsh-win__ed-act">
            <button class="hsh-win__ed-btn" type="button" data-ed="cancel">취소</button>
            <button class="hsh-win__ed-save" type="submit">저장</button>
          </div>
        </form>
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
            <div class="hsh-ab" hidden></div>
            <div class="hsh-ve" hidden></div>
            <div class="hsh-ct-box" hidden></div>
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
  root.querySelector('.hsh-ab').innerHTML = aboutNoteMarkup();
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
  const archive = mountArchive(host, { reduced, cover: trigger });
  const neighbor = mountNeighbor(host, { reduced, cover: trigger });
  const frame = win.querySelector('.hsh-win__frame');
  const title = win.querySelector('.hsh-win__title');
  const url = win.querySelector('.hsh-win__url');
  const like = win.querySelector('.hsh-win__like');
  const empty = win.querySelector('.hsh-win__empty');
  const note = win.querySelector('.hsh-win__note');
  const abBox = win.querySelector('.hsh-ab');
  let aboutNote = null; // about 이 열려 있는 동안 — 집 말풍선 · 모양 바꾸기(떠나면 close)
  const leaveAbout = () => { aboutNote?.close(); aboutNote = null; };
  // about 글꼴은 홈이 뜬 뒤 한가할 때 미리 받아 둔다 — 열자마자 깔끔하게
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(() => loadAboutFont());
  const veBox = win.querySelector('.hsh-ve');
  const about = mountAbout(veBox, () => syncRail());
  const ctBox = win.querySelector('.hsh-ct-box');
  const content = mountContent(ctBox, {
    // 창 안에서 다른 화면으로 — 지금 칸에 스크롤 위치를 적어 두고(뒤로 오면 그 자리로) 한 칸 쌓는다
    onNavigate: (state) => {
      if (steps[at]) {
        steps[at].state = { ...steps[at].state, scroll: scroller.scrollTop };
        history.replaceState({ hshWin: at, view: steps[at] }, '', location.href);
      }
      step({ detail: steps[at].detail, page: 'content', state });
      scroller.scrollTop = 0;
    },
    onResize: () => syncRail(),
    // 주소창: 사이트 / 방 / (카테고리) / 폴더 … / 글 제목
    onTitle: (name, trail = []) => {
      if (win.dataset.auto && name) title.textContent = name;
      const label = title.textContent;
      const parts = [label, name && name.toLowerCase() !== label.toLowerCase() ? name : null, ...trail].filter(Boolean);
      url.textContent = `${siteHost()} / ${parts.join(' / ')}`;
    },
  });
  const thumb = win.querySelector('.hsh-win__thumb');
  const noteTabs = win.querySelector('.hsh-note__tabs');
  // 스크롤하는 칸 — 보통은 둥근 상자 안 칸, 글 · 갤러리 · 메모 창은 창 몸통 하나(상자 없이 몸통이 끝까지 내려간다)
  const inner = win.querySelector('.hsh-win__scroll');
  const winBody = win.querySelector('.hsh-win__body');
  let scroller = inner;
  const rail = win.querySelector('.hsh-win__rail');
  const knob = win.querySelector('.hsh-win__knob');
  const pill = win.querySelector('.hsh-win__pill');
  let current = null;
  let back = null; // 닫으면 포커스를 돌려줄 버튼
  let closing = null;

  // ---------- 창 머리(사진 · 제목 · 검정 알약) — 주인이 고친 값(room-heads.js), 없으면 코드 기본값 ----------

  const editBtn = win.querySelector('.hsh-win__edit');
  const editor = win.querySelector('.hsh-win__editor');
  const field = (name) => editor.elements.namedItem(name);
  const edThumb = editor.querySelector('.hsh-win__ed-thumb');
  const edMsg = editor.querySelector('.hsh-win__ed-msg');
  // 적어 둔 값이 있으면 그것부터 — 없으면(처음 온 브라우저) 받아 올 때까지 머리를 감춰 둔다(숨긴 머리가 잠깐 보이지 않게)
  const cached = cachedRoomHeads();
  let heads = cached || {};
  win.classList.toggle('is-head-pending', !cached);
  let headLabel = ''; // 지금 방(data-label)
  let basePill = ''; // 그 방의 기본 검정 알약
  let pairNow = false; // about 의 /pair — 제목은 늘 pair
  let owner = null; // 주인이면 그 사람(edit 가 보인다)
  let ownerChecked = false;
  const headOf = (l) => (win.dataset.category ? {} : heads[l] || {});
  const baseThumb = (l) => (l === 'notice' ? NOTICE_THUMB : '');
  const titleFor = (l) => (pairNow ? 'pair' : headOf(l).title || l);
  // 둘레 스티커 개수 [최소, 최대] — 고친 값이 이상하면 기본
  const stickersOf = (l) => {
    const r = headOf(l).stickers;
    const ok = Array.isArray(r) && r.length === 2 && r.every((n) => Number.isInteger(n) && n >= 0 && n <= STICKER_MAX) && r[0] <= r[1];
    return ok ? r : STICKERS;
  };

  const paintHead = () => {
    const h = headOf(headLabel);
    pill.textContent = h.pill || basePill;
    const img = h.image || baseThumb(headLabel);
    thumb.style.backgroundImage = img ? `url("${img}")` : '';
    win.classList.toggle('is-headless', Boolean(h.hidden));
    editBtn.hidden = !owner || Boolean(win.dataset.category);
  };
  const repaintHead = () => {
    if (win.hidden || win.dataset.category) return;
    title.textContent = titleFor(headLabel);
    paintHead();
    syncRail();
  };
  fetchRoomHeads().then((h) => {
    if (h) heads = h;
    repaintHead();
    win.classList.remove('is-head-pending');
    // 창을 먼저 열었는데 이 방 스티커 개수를 고쳐 두었으면 — 그 개수로 다시 붙인다
    if (!win.hidden && !win.dataset.category && heads[headLabel]?.stickers) scatter(frame, stickersOf(headLabel));
  });

  // 로그인돼 있으면 조용히 주인인지 본다(처음 창을 열 때 한 번) — 주인에게만 edit
  const checkOwner = async () => {
    if (ownerChecked) return;
    ownerChecked = true;
    if (!hasSavedLogin() && !AUTH_RETURN) return;
    try {
      const s = await ownerSession(await getClient());
      owner = s.owner ? s.user : null;
    } catch { return; }
    paintHead();
  };

  // 고치기 창 — 사진(고르기 · 지우기) · 제목 · 검정 알약 · 둘레 스티커 개수(n ~ n) · 머리 숨기기. 비운 칸은 기본값으로
  let pendingFile = null;
  let clearPhoto = false;
  let previewUrl = '';
  let saving = false;
  const edSay = (text, tone = '') => { edMsg.textContent = text; edMsg.dataset.tone = tone; };
  const paintEdThumb = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = pendingFile ? URL.createObjectURL(pendingFile) : '';
    const img = previewUrl || (clearPhoto ? baseThumb(headLabel) : headOf(headLabel).image || baseThumb(headLabel));
    edThumb.style.backgroundImage = img ? `url("${img}")` : '';
  };
  const openEditor = () => {
    const h = headOf(headLabel);
    field('head-title').value = h.title || '';
    field('head-title').placeholder = headLabel;
    field('head-pill').value = h.pill || '';
    field('head-pill').placeholder = basePill;
    field('headless').checked = Boolean(h.hidden);
    const [lo, hi] = h.stickers ? stickersOf(headLabel) : ['', ''];
    field('st-min').value = lo;
    field('st-max').value = hi;
    field('st-min').placeholder = STICKERS[0];
    field('st-max').placeholder = STICKERS[1];
    field('photo').value = '';
    pendingFile = null;
    clearPhoto = false;
    paintEdThumb();
    edSay('');
    editor.hidden = false;
    win.classList.add('is-editing');
    field('head-title').focus({ preventScroll: true });
  };
  const closeEditor = () => {
    if (editor.hidden) return;
    editor.hidden = true;
    win.classList.remove('is-editing');
    syncRail();
    pendingFile = null;
    paintEdThumb();
  };
  editBtn.addEventListener('click', () => (editor.hidden ? openEditor() : closeEditor()));
  field('photo').addEventListener('change', () => {
    const file = field('photo').files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { edSay('사진 파일만 올릴 수 있어요.', 'error'); return; }
    pendingFile = file;
    clearPhoto = false;
    paintEdThumb();
    edSay('');
  });
  editor.addEventListener('click', (e) => {
    const act = e.target.closest('[data-ed]')?.dataset.ed;
    if (act === 'cancel') { closeEditor(); editBtn.focus({ preventScroll: true }); }
    if (act === 'clear') { pendingFile = null; clearPhoto = true; field('photo').value = ''; paintEdThumb(); }
  });
  // 스티커 개수 칸 — 둘 다 비면 기본(null), 하나만 적으면 딱 그 개수, 0 ~ STICKER_MAX 로 맞추고 작은 쪽이 최소
  const readStickers = () => {
    const num = (name) => {
      const t = field(name).value.trim();
      return t === '' || !Number.isFinite(Number(t)) ? null : Math.max(0, Math.min(STICKER_MAX, Math.round(Number(t))));
    };
    const a = num('st-min');
    const b = num('st-max');
    if (a === null && b === null) return null;
    const lo = a ?? b;
    const hi = b ?? a;
    return [Math.min(lo, hi), Math.max(lo, hi)];
  };
  editor.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!owner || saving) return;
    saving = true;
    edSay('저장 중…');
    const label = headLabel;
    const prev = heads[label] || {};
    let uploaded = null;
    try {
      let image = clearPhoto ? '' : prev.image || '';
      let imagePath = clearPhoto ? '' : prev.imagePath || '';
      if (pendingFile) {
        uploaded = await uploadRoomPhoto(owner.id, pendingFile);
        ({ url: image, path: imagePath } = uploaded);
      }
      const next = { title: field('head-title').value.trim(), pill: field('head-pill').value.trim(), image, imagePath, hidden: field('headless').checked, stickers: readStickers() };
      for (const k of Object.keys(next)) if (!next[k]) delete next[k];
      const all = { ...heads };
      if (Object.keys(next).length) all[label] = next;
      else delete all[label];
      await saveRoomHeads(owner.id, all);
      heads = all;
      if (prev.imagePath && prev.imagePath !== imagePath) removeRoomPhoto(prev.imagePath);
      closeEditor();
      repaintHead();
      scatter(frame, stickersOf(label)); // 바꾼 개수를 바로 보이게
      editBtn.focus({ preventScroll: true });
    } catch {
      if (uploaded) removeRoomPhoto(uploaded.path);
      edSay('저장하지 못했어요. 잠시 뒤 다시 해 주세요.', 'error');
    } finally {
      saving = false;
    }
  });

  const show = (label, text, page = 'room') => {
    // about __VE 의 /pair — 같은 방 창에 Vibe · Echo 카드, 제목 · 주소창은 pair
    const isAbout = label === 'about __VE';
    const isPair = isAbout && page === 'pair';
    pairNow = isPair;
    headLabel = label;
    title.textContent = titleFor(label);
    url.textContent = `${siteHost()} / ${isPair ? 'pair' : label}`;
    empty.textContent = text;
    // 공지면 탭 + 내용(ABOUT 부터), 아니면 '곧 채워질' 안내
    const isNotice = label === 'notice';
    note.hidden = noteTabs.hidden = !isNotice;
    // about __VE 면 글(about-note.js), /pair 면 Vibe · Echo 카드(about.js)
    abBox.hidden = !isAbout || isPair;
    leaveAbout();
    if (!abBox.hidden) {
      // 글꼴이 오기 전엔 글을 숨겨 둔다 — 기본 글꼴로 먼저 그렸다가 줄이 다시 짜이는 게 안 보이게(대개는 미리 받아 두어 바로 풀린다)
      abBox.classList.add('is-font-wait');
      loadAboutFont().then(() => { abBox.classList.remove('is-font-wait'); syncRail(); });
      aboutNote = openAboutNote(abBox, { reduced, scroller: inner, onLayout: () => syncRail() });
    }
    win.classList.toggle('is-about', isAbout && !isPair); // about 글은 둥근 상자 없이 창에 바로
    veBox.hidden = !isPair;
    if (isPair) about.reset();
    // 카테고리 버튼이면 글 · 갤러리 · 메모(그리기는 content.show 가 상태를 받아서)
    const isContent = Boolean(win.dataset.category);
    ctBox.hidden = !isContent;
    scroller = isContent ? winBody : inner;
    empty.hidden = isNotice || isAbout || isContent;
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
    rail.hidden = h - c < 2 || !veBox.hidden; // /pair 카드는 막대 없이 손으로 내려 읽기만
    if (rail.hidden) return;
    // 몸통이 스크롤하면 막대는 창(frame) 기준 — 몸통 오른쪽 끝, 위아래는 몸통 안쪽
    rail.style.top = scroller === winBody ? `${winBody.offsetTop + 12}px` : '';
    const track = rail.clientHeight;
    const size = Math.max(28, (track * c) / h);
    knob.style.height = `${size}px`;
    knob.style.translate = `0 ${((track - size) * t) / (h - c)}px`;
  };
  for (const el of [inner, winBody]) {
    el.addEventListener('scroll', syncRail, { passive: true });
    new ResizeObserver(syncRail).observe(el);
  }
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

  const paintLike = () => {
    const on = Boolean(current && readLikes()[current]);
    like.setAttribute('aria-pressed', String(on));
  };

  // ---------- 뒤로 · 앞으로 — 브라우저 기록과 같이 간다 ----------
  //   방을 열거나 창 안에서 다른 쪽(글 · neighbor 우체통 패널)으로 가면 기록을 한 칸 쌓는다.
  //   < > · 휴대폰 뒤로 가기 · 브라우저 버튼이 모두 같은 기록을 오간다. 처음 칸에서 뒤로 가면 창이 닫힌다.
  let steps = []; // 이번 창에서 거친 화면 [{ detail, page: 'room' | 'banner' | 'content' }]
  let at = -1; // 지금 steps 의 몇 번째(-1 = 창 닫힘)
  const navBack = win.querySelector('[data-nav="back"]');
  const navFwd = win.querySelector('[data-nav="forward"]');

  const paintNav = () => {
    navFwd.disabled = at < 0 || at >= steps.length - 1;
  };

  // 기록 한 칸 = 그 화면 전부(새로고침 · 다른 방을 거친 앞으로 가기에서도 그 칸만 보고 다시 그린다)
  const urlOf = (view) => {
    const [path, query = ''] = pathOf(view).split('?');
    return withKeep(path, query);
  };
  const step = (view) => {
    at += 1;
    // 창을 처음 열 때 지금 홈 칸에 표시 — 창에서 새로고침한 뒤 × · ← home 으로 이 칸에 돌아오면 브라우저가 문서를 새로 불러오는데,
    // 그때도 로딩 화면 없이 평면도로(index.html 머리 스크립트가 hshHome 을 본다)
    if (at === 0 && !history.state?.view && !history.state?.hshHome) history.replaceState({ ...history.state, hshHome: true }, '', location.href);
    steps.length = at;
    steps.push(view);
    history.pushState({ hshWin: at, view }, '', urlOf(view));
    paintNav();
  };

  const showStep = (view) => {
    if (win.hidden || win.classList.contains('is-closing') || SCREENS.includes(view.detail.label)) openWindow(view.detail, back, view.page);
    else show(view.detail.label, '곧 채워질 방이에요.', view.page);
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

  // ×  · Esc 로 닫으며 기록을 되돌리는 중(history.go 는 비동기) — 그 popstate 가 오기 전에 연 창을 닫지 않게,
  // 되돌리기가 끝난 뒤에 연다(느린 브라우저 · WebKit 에서 닫자마자 다른 방을 누르면 새 창이 바로 닫히던 것)
  let unwinding = false;
  let queued = null;
  let unwindTimer = 0;
  const finishUnwind = () => {
    clearTimeout(unwindTimer);
    unwinding = false;
    if (queued) { const [detail, from, first] = queued; queued = null; open(detail, from, first); }
  };

  window.addEventListener('popstate', (e) => {
    const i = e.state?.hshWin;
    const view = e.state?.view;
    if (unwinding) {
      if (typeof i === 'number') return; // 아직 창 기록 위
      finishUnwind();
      return;
    }
    if (typeof i !== 'number' || !view) {
      // 창보다 앞(홈)으로 돌아왔다 — 열려 있으면 닫는다
      if (at >= 0 || !win.hidden) { at = -1; closeWindow(); }
      return;
    }
    at = i;
    steps[i] = view;
    showStep(view);
  });

  // first — 주소로 열 때 처음 화면(없으면 버튼의 기본: 방 · 카테고리 목록)
  const open = (detail, from, first = null) => {
    if (unwinding) { queued = [detail, from, first]; return; }
    steps = [];
    at = -1;
    openWindow(detail, from, first?.page);
    if (detail.category) {
      const state = first?.state || content.initial(detail);
      step({ detail, page: 'content', state });
      content.show(state);
      return;
    }
    step({ detail, page: first?.page || 'room' });
  };

  // ×  · 덮개 · Esc — 쌓아 둔 기록을 한꺼번에 되돌리고 닫는다
  const close = () => {
    if (at >= 0) {
      const n = at + 1;
      at = -1;
      unwinding = true;
      unwindTimer = setTimeout(finishUnwind, 800); // popstate 가 끝내 오지 않아도 멈추지 않게
      history.go(-n);
    }
    closeWindow();
  };

  // neighbor 안에서 패널(우체통 /neighbor/banner · 홍차네 집 /neighbor/mine)을 열고 닫을 때 — 열면 기록 한 칸, 닫으면 되돌린다
  const neighborPage = (page) => {
    const now = steps[at];
    if (!now || now.page === page) return;
    // 우체통으로 연 칸은 바로 앞이 집 화면이라고 적어 둔다(새로고침 뒤 앞 칸을 몰라도 되돌릴 수 있게)
    if (page === 'banner' || page === 'mine') { step({ detail: now.detail, page, fromRoom: true }); return; }
    if (now.fromRoom) { history.back(); return; }
    // 주소로 바로 들어온 패널 — 기록을 늘리지 않고 이 칸을 /neighbor 로
    steps[at] = { detail: now.detail, page: 'room' };
    history.replaceState({ hshWin: at, view: steps[at] }, '', urlOf(steps[at]));
  };

  const openWindow = ({ room, label, name, bg, fg, category, auto }, from, page = 'room') => {
    clearTimeout(closing);
    // archive · neighbor — 창 대신 흰 화면. ← home · Esc 는 × 와 같이 기록을 되돌리며 홈으로
    if (SCREENS.includes(label)) {
      if (!win.hidden) {
        leaveAbout();
        content.close();
        trigger.classList.remove('is-paused');
        win.hidden = true;
        win.classList.remove('is-open', 'is-closing');
      }
      back = null;
      current = room;
      if (label === 'archive') {
        neighbor.hide({ instant: true });
        archive.show({ from, home: close });
      } else {
        archive.hide({ instant: true });
        neighbor.show({ from, home: close, page, onPage: neighborPage });
      }
      return;
    }
    archive.hide({ instant: true });
    neighbor.hide({ instant: true });
    closeEditor();
    checkOwner();
    const already = win.classList.contains('is-open'); // 주소로 연 글 창이 이제 카테고리를 알게 됐다 — 스티커 · 등장은 그대로
    back = from ?? null;
    current = category ? `${room}:${category}` : room; // 하트는 버튼마다
    win.dataset.room = room;
    if (category) win.dataset.category = category;
    else delete win.dataset.category;
    if (auto) win.dataset.auto = '1';
    else delete win.dataset.auto;
    win.style.setProperty('--hsh-win-tint', bg);
    win.style.setProperty('--hsh-win-ink', fg);
    show(label, '곧 채워질 방이에요.', page);
    if (!already) scatter(frame, stickersOf(label));
    basePill = PILLS[label] ?? name;
    paintHead();
    paintLike();
    if (already) return;
    win.hidden = false;
    win.classList.remove('is-closing');
    trigger.classList.add('is-paused'); // 덮개가 뜨는 순간 홈 화면 움직임을 멈춘다(plan/index.js · clock.js · plan.css)
    void win.offsetWidth; // 다시 열 때도 등장 전환이 처음부터
    win.classList.add('is-open');
    win.querySelector('.hsh-win__x').focus({ preventScroll: true });
  };

  const closeWindow = () => {
    archive.hide();
    neighbor.hide();
    if (win.hidden || win.classList.contains('is-closing')) return;
    closeEditor();
    leaveAbout();
    content.close();
    trigger.classList.remove('is-paused');
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

  // ---------- 주소로 열기(직접 들어오기 · 새로고침 · 404.html 이 돌려보낸 주소) ----------

  const stickerDetail = (s) => {
    const { room, label, bg, fg, category, look } = s.dataset;
    return { room, label, name: s.getAttribute('aria-label'), bg, fg, category, look };
  };
  const findSticker = (attr, value) => [...trigger.querySelectorAll('.hsh-sticker')].find((s) => s.dataset[attr] === String(value));
  // 그 카테고리 버튼이 아직 평면도에 없으면 기본 색 창(제목은 카테고리 이름 — onTitle)
  const categoryDetail = (ref, alt) => {
    const s = findSticker('category', ref) || (alt != null ? findSticker('category', alt) : null);
    return s ? stickerDetail(s) : { room: 'content', label: '', name: '', bg: '#cfe0fb', fg: '#8a62dc', category: String(ref), auto: true };
  };

  const openRoute = async (r) => {
    if (r.room) {
      const s = findSticker('label', r.room);
      if (s) open(stickerDetail(s), null, { page: r.page });
      return;
    }
    if (r.category) {
      const detail = categoryDetail(r.category);
      open(detail, null, { state: { cat: detail.category, look: detail.look || null, view: r.read ? 'series' : 'list', folder: r.folder ?? null, page: r.page || 1, post: null } });
      return;
    }
    // 글 — 그 글의 카테고리 창으로(글을 볼 수 없으면 창 안에 안내). 어느 카테고리인지 받는 동안에도 창은 먼저 열고 안에서 '불러오는 중'
    openWindow({ ...categoryDetail('pending'), label: '' }, null);
    content.loading();
    const post = await fetchPost(r.post).catch(() => null);
    if (!win.classList.contains('is-open')) return; // 받는 동안 닫았다
    // 볼 수 없는 글이어도 글 창으로 연다 — 안에서 '볼 수 없는 글'(state.cat 이 비어 있다, content/viewer.js)
    const detail = post ? categoryDetail(post.category_id) : { room: 'content', label: 'post', name: '', bg: '#cfe0fb', fg: '#8a62dc', category: 'none', auto: true };
    const state = { cat: post ? detail.category : '', look: detail.look || null, view: 'post', post: r.post, nav: null, back: null };
    if (r.quote) state.view = 'quote';
    if (r.quote) state.from = { ...state, view: 'post' };
    open(detail, null, { state });
  };

  /** 처음 한 번 — 지금 주소의 창을 연다. 홈 칸을 아래에 두어 첫 칸에서 뒤로 · × 가 홈(/)으로 간다 */
  const routeFromLocation = async () => {
    // 새로고침 — 이 칸에 화면이 적혀 있으면 기록은 그대로 두고 그 화면만(뒤로 가면 아까 보던 목록으로)
    const kept = history.state;
    if (!AUTH_RETURN && kept?.view && typeof kept.hshWin === 'number') {
      steps = [];
      steps[kept.hshWin] = kept.view;
      at = kept.hshWin;
      showStep(kept.view);
      return;
    }
    let target = location.pathname + location.search;
    const saved = takeReturnPath();
    if (AUTH_RETURN) {
      // Google 로그인에서 돌아왔다 — 주소의 토큰을 supabase-js 가 받은 뒤에(주소를 바꾸면 토큰을 잃는다), 로그인 전 화면으로
      // initialize() — supabase-js 가 주소의 토큰을 읽고 주소를 정리하는 일이 끝날 때까지(그 전에 주소를 바꾸면 그 정리가 덮어쓴다)
      try { const c = await getClient(); await c.auth.initialize?.(); await c.auth.getSession(); } catch { /* 로그인 실패여도 화면은 연다 */ }
      if (saved) target = saved;
    }
    const url = new URL(target, location.origin);
    const r = parsePath(url.pathname, url.search);
    history.replaceState(r || history.state?.hshHome ? { hshHome: true } : null, '', withKeep('/')); // 홈 칸 표시는 남긴다(step 참고)
    if (r) await openRoute(r);
  };

  win.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (win.hidden) return;
    // 고치기 창이 열려 있으면 Esc 는 그것만 닫는다
    if (e.key === 'Escape' && !editor.hidden) { closeEditor(); editBtn.focus({ preventScroll: true }); return; }
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

  return { routeFromLocation };
}
