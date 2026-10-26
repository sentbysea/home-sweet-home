// neighbor 마을 — 가운데 홍차네 집, 둘레에 배너를 교환한 이웃집들이 느슨하게 모인 손그림 동네(house-art.js 로 그린다).
//   · 배치: 칸(PC 5 · 휴대폰 3)으로 나눈 동네에서 홍차네 집 둘레 칸부터 가까운 순서로 채우고, 넘치면 아래로 줄을 늘린다
//     (집을 줄이지 않는다). 칸 안 자리 · 높낮이는 칸 번호로 정한 작은 어긋남 — 새로고침 · 고르기에도 그대로.
//     나무 · 울타리는 집이 없는 빈 칸 몇 곳에 — 어느 칸 · 칸 안 어디 · 무엇인지는 새로고침마다 무작위(화면 크기가 바뀌어도 그대로),
//     칸 가장자리에서 떼어 이웃집과 간격을 둔다.
//   · 집마다 다른 주기로 2~4px 둥실(CSS). 외곽선 위글은 .nbh 의 data-boil(index.js)이 돌린다.
//   · 배너: 평소엔 숨기고, 집을 고르면 집 위로 하나만 — PC 는 올리기 · 포커스(집 → 배너로 옮겨도 그대로), 누르면 새 탭.
//     휴대폰은 한 번 누르면 배너 · 이름이 뜨고, 그 배너를 눌러야 이동. 바깥 · 다른 집을 누르면 닫힌다. Esc 로 닫기.
//     배너 말풍선은 집과 같은 손그림 외곽선(위글 변형 4장) — 그림자 없이.
//     배너는 화면 가장자리에서 잘리지 않게 자리를 고친다(위에 자리가 없으면 아래로).
//   · 집마다 바로 아래 이름표(사이트 이름) — 홈 라벨 같은 색종이. 종이 색은 그 집에 쓴 색 중 하나(진하면 밝혀서, house-art.js tagTone),
//     배너 링크를 올렸을 때 밑줄도 같은 색. 긴 이름은 줄을 바꾸고, 화면 밖으로 나가지 않게 폭을 정한다.
//   · 우체통 위에 통통 튀는 화살표 · 바람에 떠는 빨간 세모 깃발로 누르기를 이끈다.
//   · 주인 고치기 중에는 집을 누르면 그 집 고치기(onEdit).

import { houseSvg, houseKey, normalizeHouse, defaultHouse, tagTone, rng, sketch, sketchEllipse, BOIL } from './house-art.js';

const HOME_HOUSE = { v: 2, body: 'cozy', roof: 'tri', roofPattern: 'solid', door: 'arch', window: 'cross', deco: ['chimney'], wall: '#fffaf0', roofColor: '#e88a8a', doorColor: '#c9a27e' };

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f = (n) => Math.round(n * 10) / 10;

// 나무 · 울타리 자리 — 이 화면을 연 동안은 같은 씨앗(다시 그려도 그대로), 새로고침하면 새로
const DECO_SEED = Math.floor(Math.random() * 2 ** 31);

/** 위글 변형 4장으로 그린 작은 그림(나무 · 울타리 · 우체통) */
function boiled(viewBox, w, h, draw, cls) {
  const body = Array.from({ length: BOIL }, (_, v) => `<g class="nbh-v nbh-v${v} nbh-ink">${draw(v)}</g>`).join('');
  return `<svg class="${cls}" viewBox="${viewBox}" width="${f(w)}" height="${f(h)}" aria-hidden="true" focusable="false">${body}</svg>`;
}
const tree = (s, seed) => boiled('-16 -46 32 48', 32 * s, 48 * s, (v) =>
  `<path d="${sketch([[0, 0], [0, -16]], { seed: seed + 1, v })}" fill="none"/>` +
  `<path d="${sketchEllipse(0, -28, 12, 14, seed + 2, v)}" fill="#a9d6a0"/>`, 'nbh-deco');
// 우체통 위 화살표(아래로)
const arrow = (s) => boiled('-8 -20 16 22', 16 * s, 22 * s, (v) =>
  `<path d="${sketch([[0, -18], [0, -1]], { seed: 71, v })}" fill="none"/>` +
  `<path d="${sketch([[-5, -6], [0, -1], [5, -6]], { seed: 72, v, radius: 1 })}" fill="none"/>`, 'nbh-mailbox__arrow-art');
const fence = (s, seed) => boiled('-2 -16 46 18', 46 * s, 18 * s, (v) =>
  [0, 10, 20, 30, 40].map((x, i) => `<path d="${sketch([[x, 0], [x, -12], [x + 2, -14], [x + 4, -12], [x + 4, 0]], { seed: seed + i, v, radius: 1 })}" fill="#f3e6d8"/>`).join('') +
  `<path d="${sketch([[-1, -8], [45, -8]], { seed: seed + 9, v })}" fill="none"/>`, 'nbh-deco');
const mailbox = (s) => boiled('-14 -44 34 46', 34 * s, 46 * s, (v) =>
  `<path d="${sketch([[0, 0], [0, -22]], { seed: 61, v })}" fill="none"/>` +
  `<path d="${sketch([[-10, -22], [-10, -34], [-7, -38], [7, -38], [10, -34], [10, -22]], { seed: 62, v, closed: true, radius: 2 })}" fill="#fbd5e3"/>` +
  `<path class="d" d="${sketch([[-5, -31], [5, -31]], { seed: 63, v })}" fill="none"/>` +
  `<g class="nbh-mailbox__flag"><path d="${sketch([[10, -24], [10, -42]], { seed: 64, v })}" fill="none"/>` +
  `<g class="nbh-mailbox__pennant"><path d="${sketch([[10, -42], [17, -40], [10, -37]], { seed: 65, v, closed: true, radius: 1 })}" fill="#e5604f"/></g></g>` +
  `<path class="nbh-mailbox__letter" d="${sketch([[-6, -36], [6, -36], [6, -44], [-6, -44]], { seed: 66, v, closed: true, radius: 1 })}" fill="#ffffff"/>`, 'nbh-mailbox__art');

/** 동네 칸 — 너비에 맞춰 칸 수 · 크기를 정하고, 홍차네 집 둘레부터 가까운 칸 순서 */
function grid(width) {
  const W = Math.min(width, 980);
  const cols = W < 560 ? 3 : 5;
  const pad = 12;
  const cw = Math.min((W - pad * 2) / cols, cols === 3 ? 180 : 150);
  const scale = cols === 3 ? Math.min(1.15, cw / 114) : 1.25; // 114 — 장식을 다 단 가장 넓은 집(넓은 집 + 개집 · 우체통)도 칸 안에
  const rowH = Math.round(112 * scale + 64); // 이름표 자리까지(긴 이름은 두세 줄)
  const mid = (cols - 1) / 2;
  const r0 = rng(7);
  const ring = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 1 && c === mid) continue; // 홍차네 집
      if (r === 1 && c === mid + 1) continue; // 우체통 자리
      ring.push({ r, c, d: Math.hypot(c - mid, (r - 1) * 1.3) + r0() * 0.35 });
    }
  }
  ring.sort((a, b) => a.d - b.d);
  return { W, cols, cw, scale, rowH, mid, ring, left: (W - cw * cols) / 2 };
}

/**
 * @param {HTMLElement} stage  마을을 그릴 칸
 * @param {{ reduced?: boolean, onMail?: () => void, onEdit?: (item: any) => void }} opts
 */
export function createVillage(stage, { reduced = false, onMail = () => {}, onEdit = () => {} } = {}) {
  const town = document.createElement('div');
  town.className = 'nbh-town';
  const pop = document.createElement('div');
  pop.className = 'nbh-pop';
  pop.id = 'nbh-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `
    <svg class="nbh-pop__frame" aria-hidden="true" focusable="false"></svg>
    <a class="nbh-pop__link" target="_blank" rel="noopener noreferrer">
      <span class="nbh-pop__banner"><img alt="" decoding="async"><span class="nbh-pop__alt"></span></span>
      <span class="nbh-pop__name"></span>
    </a>`;
  stage.append(town, pop);
  let items = [];
  let state = 'loading';
  let editing = false;
  let open = -1; // 지금 배너를 보이는 집
  let pinned = false; // 누르거나 Enter 로 연 것(올린 것은 false)
  let closeTimer = 0;
  let openTimer = 0;
  let lastPointer = 'mouse';
  let quiet = false; // Esc 로 닫고 집에 포커스를 돌려줄 때 — 다시 열지 않게
  let homes = [];
  let mailBtn = null;
  let layout = [];

  const itemSpec = (it) => normalizeHouse(it.house) || defaultHouse(it.id ?? it.href);

  // ---------- 그리기 ----------

  const build = () => {
    closePop(true);
    const g = grid(stage.clientWidth || window.innerWidth);
    town.textContent = '';
    town.style.width = `${f(g.W)}px`;
    homes = [];
    layout = [];
    // 칸 → 자리(그 칸의 집 크기로 어긋남 폭을 정한다)
    const slotFor = (i) => {
      if (i < g.ring.length) return g.ring[i];
      const k = i - g.ring.length;
      return { r: 3 + Math.floor(k / g.cols), c: k % g.cols };
    };
    const place = (slot, w, h, salt) => {
      const sr = rng(slot.r * 31 + slot.c * 7 + salt);
      const room = Math.max(0, (g.cw - w) / 2 - 6);
      const x = g.left + (slot.c + 0.5) * g.cw + (sr() * 2 - 1) * room * 0.8;
      const base = (slot.r + 0.82) * g.rowH + (sr() * 2 - 1) * g.rowH * 0.07;
      return { x, base };
    };

    // 홍차네 집 + 이름표 + 우체통
    const center = { r: 1, c: g.mid };
    const hs = houseSvg(HOME_HOUSE, { scale: g.scale * 1.35, seed: 3 });
    const home = document.createElement('div');
    home.className = 'nbh-center';
    home.innerHTML = `<div class="nbh-home__art">${hs.svg}</div><span class="nbh-center__tag nbh-label">홍차네 집</span>`;
    const cbase = (center.r + 0.82) * g.rowH;
    const cx = g.left + (center.c + 0.5) * g.cw - g.cw * (g.cols === 3 ? 0.12 : 0.08);
    // 이름표 폭 — 이름 길이만큼, 단 화면(동네) 밖으로 나가지 않게
    const tagMax = (x) => `${f(Math.max(60, Math.min(170, 2 * Math.min(x - 4, g.W - x - 4))))}px`;
    home.style.setProperty('--tag-bg', tagTone(HOME_HOUSE));
    home.style.setProperty('--tag-max', tagMax(cx));
    home.style.setProperty('--tilt', '-2deg');
    home.style.left = `${f(cx - hs.w / 2)}px`;
    home.style.top = `${f(cbase - hs.h)}px`;
    home.style.setProperty('--dur', '5.6s');
    home.style.setProperty('--delay', '-1.2s');
    town.append(home);
    layout.push({ kind: 'center', x: cx, base: cbase, w: hs.w, h: hs.h });

    // 이웃집
    const shown = state === 'ready' ? items : [];
    shown.forEach((it, i) => {
      const spec = itemSpec(it);
      const art = houseSvg(spec, { scale: g.scale, seed: i + 1 });
      const slot = slotFor(i);
      const { x, base } = place(slot, art.w, art.h, 1);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nbh-home';
      b.dataset.i = String(i);
      b.dataset.house = houseKey(spec);
      b.setAttribute('aria-label', `${it.label} — ${editing ? '집 고치기' : '배너 보기'}`);
      const tone = tagTone(spec);
      b.style.setProperty('--tag-bg', tone);
      b.style.setProperty('--hl', tone);
      b.style.setProperty('--tag-max', tagMax(x));
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-expanded', 'false');
      b.innerHTML = `<span class="nbh-home__art">${art.svg}</span><span class="nbh-home__tag nbh-label" aria-hidden="true">${esc(it.label)}</span>${editing ? '<span class="nbh-home__edit" aria-hidden="true">✎</span>' : ''}`;
      b.style.left = `${f(x - art.w / 2)}px`;
      b.style.top = `${f(base - art.h)}px`;
      b.style.width = `${f(art.w)}px`;
      b.style.height = `${f(art.h)}px`;
      const hr = rng(i * 53 + 9);
      b.style.setProperty('--dur', `${f(3.8 + hr() * 2.6)}s`);
      b.style.setProperty('--delay', `${f(-hr() * 5)}s`);
      b.style.setProperty('--bob', `${f(2 + hr() * 2)}px`);
      b.style.setProperty('--tilt', `${f((hr() * 2 - 1) * 2.5)}deg`);
      town.append(b);
      homes.push(b);
      layout.push({ kind: 'home', i, x, base, w: art.w, h: art.h, slot: `${slot.r}:${slot.c}` });
    });

    // 우체통 — 이웃집 다음(Tab 은 이웃집부터)
    mailBtn = document.createElement('button');
    mailBtn.type = 'button';
    mailBtn.className = 'nbh-mailbox';
    mailBtn.setAttribute('aria-label', '배너교환은 여기에서 — 내 배너 정보 · 교환 신청');
    mailBtn.innerHTML = `<span class="nbh-mailbox__arrow" aria-hidden="true">${arrow(g.scale)}</span>${mailbox(g.scale)}`;
    const ms = 34 * g.scale;
    const mx = cx + hs.w / 2 + 4;
    mailBtn.style.left = `${f(mx)}px`;
    mailBtn.style.top = `${f(cbase - 46 * g.scale)}px`;
    mailBtn.addEventListener('click', () => onMail());
    town.append(mailBtn);
    layout.push({ kind: 'mail', x: mx + ms / 2, base: cbase, w: ms, h: 46 * g.scale });


    // 장식 — 집이 없는 빈 칸(둘레 · 마지막 줄)에서 무작위로 2~4곳, 칸 가장자리에서 GAP 만큼 떼어
    const used = new Set(layout.filter((l) => l.slot).map((l) => l.slot));
    const rowsUsed = shown.length > g.ring.length ? 3 + Math.ceil((shown.length - g.ring.length) / g.cols) : 3;
    const free = [];
    for (let rr = 0; rr < rowsUsed; rr++) {
      for (let c = 0; c < g.cols; c++) {
        if (rr === 1 && (c === g.mid || c === g.mid + 1)) continue; // 홍차네 집 · 우체통
        if (rr === 2 && c === g.mid && !shown.length) continue; // 빈 동네 안내 자리
        if (!used.has(`${rr}:${c}`)) free.push({ r: rr, c });
      }
    }
    const dr = rng(DECO_SEED);
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(dr() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    const GAP = 14;
    free.slice(0, 2 + Math.floor(dr() * 3)).forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'nbh-deco-wrap';
      const isFence = dr() < 0.35;
      const ts = g.scale * (0.85 + dr() * 0.3);
      d.innerHTML = isFence ? fence(g.scale, 80 + i * 10) : tree(ts, 40 + i * 10);
      const w = isFence ? 46 * g.scale : 32 * ts;
      const h = isFence ? 18 * g.scale : 48 * ts;
      const span = Math.max(0, g.cw - w - GAP * 2);
      const x = g.left + s.c * g.cw + GAP + w / 2 + dr() * span;
      const base = (s.r + 0.82) * g.rowH + (dr() * 2 - 1) * g.rowH * 0.06;
      d.style.left = `${f(x - w / 2)}px`;
      d.style.top = `${f(base - h)}px`;
      town.append(d);
      layout.push({ kind: isFence ? 'fence' : 'tree', x, base, w, h });
    });

    // 빈 동네 · 불러오는 중 · 오류
    if (state !== 'ready' || !items.length) {
      const note = document.createElement('div');
      note.className = 'nbh-note';
      const text = state === 'loading' ? '이웃집을 불러오는 중…' : state === 'error' ? '이웃집을 불러오지 못했어요.' : '아직 이웃집이 없어요.';
      note.innerHTML = `<span>${text}</span>${state === 'error' ? '<button class="nbh-note__retry" type="button" data-act="retry">다시 불러오기</button>' : ''}`;
      note.style.top = `${f(cbase + 44)}px`;
      town.append(note);
    }

    // 쓰지 않은 위 · 아래 빈 줄은 줄인다(배치는 그대로)
    const tops = layout.map((l) => l.base - l.h);
    const minTop = Math.min(...tops);
    const shift = Math.max(0, minTop - 24);
    for (const el of town.children) el.style.top = `${f(parseFloat(el.style.top) - shift)}px`;
    layout.forEach((l) => { l.base -= shift; });
    const bottom = Math.max(...layout.map((l) => l.base)) + (state === 'ready' && items.length ? 52 : 90);
    town.style.height = `${f(bottom)}px`;
  };

  // ---------- 배너 미리보기 ----------

  const popImg = pop.querySelector('img');
  const popLink = pop.querySelector('.nbh-pop__link');
  const popFrame = pop.querySelector('.nbh-pop__frame');
  const popAlt = pop.querySelector('.nbh-pop__alt');
  const popName = pop.querySelector('.nbh-pop__name');
  popImg.addEventListener('error', () => pop.classList.add('is-broken'));
  popImg.addEventListener('load', () => pop.classList.remove('is-broken'));

  const position = () => {
    const b = homes[open];
    if (!b) return;
    const sr = stage.getBoundingClientRect();
    const hr = b.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let left = hr.left + hr.width / 2 - pw / 2;
    left = Math.max(8, Math.min(vw - pw - 8, left));
    let top = hr.top - ph - 10;
    let below = false;
    if (top < 8) { top = hr.bottom + 10; below = true; } // 위에 자리가 없으면 아래로
    pop.classList.toggle('is-below', below);
    pop.style.left = `${f(left - sr.left)}px`;
    pop.style.top = `${f(top - sr.top)}px`;
    drawFrame(pw, ph, Math.max(16, Math.min(pw - 16, hr.left + hr.width / 2 - left)), below);
  };

  // 손그림 말풍선 — 집 쪽으로 작은 꼬리. 선 변형 4장(.nbh 의 data-boil)
  const drawFrame = (w, h, tx, below) => {
    const i = 1.5;
    const t = 8;
    const pts = below
      ? [[i, i], [tx - 7, i], [tx, -t], [tx + 7, i], [w - i, i], [w - i, h - i], [i, h - i]]
      : [[i, i], [w - i, i], [w - i, h - i], [tx + 7, h - i], [tx, h + t], [tx - 7, h - i], [i, h - i]];
    popFrame.setAttribute('viewBox', `0 ${below ? -t : 0} ${f(w)} ${f(h + t)}`);
    popFrame.setAttribute('width', f(w));
    popFrame.setAttribute('height', f(h + t));
    popFrame.style.top = below ? `${-t}px` : '0';
    popFrame.innerHTML = Array.from({ length: BOIL }, (_, v) =>
      `<g class="nbh-v nbh-v${v} nbh-ink"><path d="${sketch(pts, { closed: true, seed: 91, v, radius: 7, amp: 0.45 })}" fill="#fff"/></g>`).join('');
  };

  const openPop = (i, { pin = false } = {}) => {
    clearTimeout(closeTimer);
    const it = items[i];
    if (!it) return;
    if (open !== i) {
      homes[open]?.setAttribute('aria-expanded', 'false');
      homes[open]?.classList.remove('is-open');
      open = i;
      popImg.alt = `${it.label} 배너`;
      pop.classList.toggle('is-broken', !it.image);
      if (it.image) popImg.src = it.image; else popImg.removeAttribute('src');
      popAlt.textContent = it.label;
      popName.textContent = it.label;
      pop.style.setProperty('--hl', homes[i].style.getPropertyValue('--hl'));
      if (it.href) popLink.href = it.href; else popLink.removeAttribute('href');
      popLink.setAttribute('aria-label', `${it.label} 방문하기 — 새 탭`);
      pop.setAttribute('aria-label', `${it.label} 배너`);
      pop.hidden = false;
      pop.classList.remove('is-open');
      position();
      void pop.offsetWidth;
      pop.classList.add('is-open');
      homes[i].setAttribute('aria-expanded', 'true');
      homes[i].classList.add('is-open');
    }
    pinned = pinned || pin;
  };

  function closePop(now = false) {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    if (open < 0) return;
    homes[open]?.setAttribute('aria-expanded', 'false');
    homes[open]?.classList.remove('is-open');
    open = -1;
    pinned = false;
    pop.classList.remove('is-open');
    if (now || reduced) pop.hidden = true;
    else closeTimer = setTimeout(() => { if (open < 0) pop.hidden = true; }, 220);
  }
  const closeSoon = () => {
    if (pinned) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => closePop(), 180);
  };

  const visit = (i) => {
    const href = items[i]?.href;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const homeOf = (t) => t.closest?.('.nbh-home');
  town.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; });
  town.addEventListener('pointerover', (e) => {
    const b = homeOf(e.target);
    if (!b || e.pointerType !== 'mouse' || editing) return;
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    const i = Number(b.dataset.i);
    openTimer = setTimeout(() => openPop(i), open >= 0 ? 0 : 60);
  });
  town.addEventListener('pointerout', (e) => {
    const b = homeOf(e.target);
    if (!b || e.pointerType !== 'mouse') return;
    if (b.contains(e.relatedTarget) || pop.contains(e.relatedTarget)) return;
    clearTimeout(openTimer);
    closeSoon();
  });
  pop.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  pop.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || homes[open]?.contains(e.relatedTarget)) return;
    closeSoon();
  });
  town.addEventListener('click', (e) => {
    const b = homeOf(e.target);
    if (!b) return;
    const i = Number(b.dataset.i);
    if (editing) { onEdit(items[i], b); return; }
    if (e.detail === 0) { // 키보드 Enter · Space — 고정해 열고 배너(링크)로
      openPop(i, { pin: true });
      popLink.focus({ preventScroll: true });
      return;
    }
    if (lastPointer === 'mouse') { visit(i); return; }
    // 손가락 — 한 번 누르면 배너, 같은 집을 또 누르면 닫기
    if (open === i && pinned) closePop();
    else { if (open !== i) closePop(true); openPop(i, { pin: true }); }
  });
  town.addEventListener('focusin', (e) => {
    const b = homeOf(e.target);
    if (!b || editing || lastPointer !== 'keyboard' || quiet) return;
    openPop(Number(b.dataset.i));
  });
  stage.addEventListener('focusout', (e) => {
    if (open < 0) return;
    const next = e.relatedTarget;
    if (next && (pop.contains(next) || homes[open]?.contains(next))) return;
    if (lastPointer === 'keyboard') closePop();
  });
  const onKey = (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow')) lastPointer = 'keyboard';
    if (e.key === 'Escape' && open >= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const b = homes[open];
      closePop();
      quiet = true;
      b?.focus({ preventScroll: true });
      quiet = false;
    }
  };
  document.addEventListener('keydown', onKey, true);
  // 바깥을 누르면 닫는다
  const onDocDown = (e) => {
    lastPointer = e.pointerType || 'mouse';
    if (open < 0) return;
    if (pop.contains(e.target) || homes[open]?.contains(e.target)) return;
    if (homeOf(e.target)) return; // 다른 집 — click 에서 바꾼다
    closePop();
  };
  document.addEventListener('pointerdown', onDocDown, true);
  const onScroll = () => { if (open >= 0) position(); };
  window.addEventListener('scroll', onScroll, true);

  let resizing = 0;
  const onResize = () => { clearTimeout(resizing); resizing = setTimeout(build, 120); };
  window.addEventListener('resize', onResize);

  return {
    /** @param {{ items?: Array<{ id?: any, href: string, image: string, label: string, house?: object | null }>, state?: string, editing?: boolean }} next */
    render(next = {}) {
      if (next.items) items = next.items;
      if (next.state) state = next.state;
      if (next.editing != null) editing = next.editing;
      build();
    },
    /** 우체통 — 깃발이 올라가고 편지가 살짝 보인 뒤 */
    mailOut() {
      if (!mailBtn || reduced) return Promise.resolve();
      mailBtn.classList.add('is-sending');
      return new Promise((resolve) => setTimeout(() => { mailBtn?.classList.remove('is-sending'); resolve(); }, 420));
    },
    get mail() { return mailBtn; },
    /** 시험용 — 지금 배치(종류 · 바닥 가운데 · 크기) */
    get layout() { return layout.map((l) => ({ ...l })); },
    get open() { return open; },
    close: () => closePop(true),
    dispose() {
      closePop(true);
      clearTimeout(resizing);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDocDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      town.remove();
      pop.remove();
    },
  };
}
