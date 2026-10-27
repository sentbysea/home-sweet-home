// neighbor — 브라우저 창 대신 흰 화면의 손그림 마을(village.js). 주소 /neighbor · /neighbor/banner(routes.js),
// 여닫기 · 기록은 room-window.js 가 맡는다(archive 와 같은 길).
//   · 가운데 홍차네 집, 둘레에 배너를 교환한 이웃집(banners · 배너 카테고리, 정렬 순서대로). 집을 고르면 그 배너.
//     그 뒤에 홈페이지 없는 이웃(neighbor_residents) — 집 + 이름표만, 눌러도 배너 · 이동 없음.
//   · 홍차네 집 옆 우체통 → 배너 교환 패널(panel.js) — 주소 /neighbor/banner.
//   · 홍차네 집 → 내 배너(복사) — 주소 /neighbor/mine. 주인 고치기 중이면 홍차네 집 고치기(모양 · 색, neighbor_home 에 저장).
//   · 주인: 아래 'edit'(주인으로 로그인돼 있을 때만 보인다 — 로그인은 /admin, 같은 사이트라 여기서도 이어진다)
//     → 집을 누르면 그 집 고치기, '+ add banner', 받은 신청.
//   · 손그림 위글: 선 변형 4장을 190ms 마다(로딩 · 평면도와 같은 박자) — 이 화면의 모든 집(패널 미리보기까지)이 같이. 모션 줄이기면 멈춘다.
//   · 바탕은 홈과 같은 아이보리, 여백에 홈 · archive 와 같은 작은 별(shared/star.js)을 성글게 — 자리는 고정 비율이라
//     창 크기가 바뀌어도 그대로, 마을 뒤에 깔려 집 · 이름표를 가리거나 누르기를 막지 않는다.
//   · 오른쪽 위 스위치(← home · 제목과 한 줄) — 마을(village) ↔ 배너(banner) 보기. 배너 보기는 맨 위 내 배너, 그 아래 받은 배너만 한 줄에 하나씩(이름 없이,
//     누르면 그 사이트 새 탭 — 홈페이지 없는 이웃은 빠진다). 고른 보기는 이 브라우저에 기억한다(hsh:nbh-view). 주인 고치기는 마을에서만.
//   · 닫으면 마을을 치운다.

import { fetchBanners, fetchHome, fetchResidents, siteLabel, httpUrl, MY_BANNER } from './data.js';
import { createVillage } from './village.js';
import { mountPanel } from './panel.js';
import { BOIL, HOME_NAME } from './house-art.js';
import { starSvg } from '../shared/star.js';
import { getClient, ownerSession, hasSavedLogin, consumeAuthError } from '../content/supabase.js';

const BOIL_MS = 190;
const VIEW_KEY = 'hsh:nbh-view'; // 'village' | 'banner'
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'banner' ? 'banner' : 'village'; } catch { return 'village'; } };

// 스위치 손잡이 그림 — 집(마을) · 배너(가로로 긴 네모에 글줄)
const VIEW_ICONS = `
  <svg class="nbh-view__ico is-village" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 9.5L10 4l6.5 5.5"/><path d="M5.5 8.2V16h9V8.2"/><path d="M8.6 16v-3.6h2.8V16"/></svg>
  <svg class="nbh-view__ico is-banner" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="6.5" width="15" height="7" rx="1.4"/><path d="M5.5 10h5"/><circle cx="14" cy="10" r="1.2"/></svg>`;

// 여백 별 [x%, y%, 기울기, 크기] — ← home(왼쪽 위) · 제목(가운데 위)은 비켜서 가장자리 위주로
const STARS = [
  [94, 6, 14, 1.1], [3.5, 22, 8, 1], [97, 27, -6, 1.2], [5, 44, 20, 1.1], [95.5, 52, -16, 1],
  [2.5, 67, -10, 1.2], [97, 76, 6, 1], [6, 90, 12, 1.1], [93, 95, -12, 1], [22, 97, 4, 0.9], [78, 3, -8, 0.9],
];

function build() {
  const root = document.createElement('section');
  root.className = 'nbh';
  root.hidden = true;
  root.dataset.boil = '0';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'nbh-title');
  root.tabIndex = -1;
  root.innerHTML = `
    <div class="nbh__stars" aria-hidden="true">${STARS.map(([x, y, rot, size]) => starSvg(x, y, rot, size)).join('')}</div>
    <div class="nbh__scroll">
      <button class="nbh__home" type="button"><span aria-hidden="true">←</span> home</button>
      <h2 class="nbh__title" id="nbh-title">Neighbor</h2>
      <div class="nbh__village" role="group" aria-label="이웃 마을 — 집을 고르면 그 집의 배너가 보여요"></div>
      <div class="nbh__banners" role="region" aria-label="이웃 배너" hidden></div>
      <footer class="nbh__foot">
        <p class="nbh__msg" role="status" aria-live="polite" hidden></p>
        <div class="nbh__owner">
          <button class="nbh__link" type="button" data-act="requests" hidden>받은 신청 <span class="nbh__count"></span></button>
          <button class="nbh__link" type="button" data-act="add" hidden>+ add banner</button>
          <button class="nbh__link" type="button" data-act="edit" hidden>edit</button>
        </div>
      </footer>
      <!-- 보기 스위치 — 화면 오른쪽 위에 고정. Tab 은 이웃집 · edit 다음에 -->
      <button class="nbh-view" type="button" role="switch" aria-checked="false" aria-label="배너로 보기">
        <span class="nbh-view__txt is-village" aria-hidden="true">village</span>
        <span class="nbh-view__txt is-banner" aria-hidden="true">banner</span>
        <span class="nbh-view__knob" aria-hidden="true">${VIEW_ICONS}</span>
        <span class="nbh-view__spark" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </div>
    <div class="nbh-panel" hidden></div>`;
  return root;
}

/**
 * @param {HTMLElement} host  붙일 곳(#app)
 * @param {{ reduced?: boolean, cover?: HTMLElement }} opts  cover — 열려 있는 동안 키보드가 닿지 않게 할 홈 화면(.hsh-plan)
 */
export function mountNeighbor(host, { reduced = false, cover = null } = {}) {
  let root = null;
  let village = null;
  let panel = null;
  let banners = [];
  let residents = []; // 홈페이지 없는 이웃(집 + 이름표만)
  let homeHouse = null; // 홍차네 집 — 주인이 고친 모양(없으면 기본)
  let state = 'loading';
  let loaded = false;
  let editing = false;
  let session = { user: null, owner: false };
  let onHome = () => {};
  let onPage = () => {};
  let hiding = 0;
  let back = null;
  let boilTimer = 0;
  const authError = consumeAuthError();

  const $ = (q) => root.querySelector(q);

  const say = (text) => {
    const msg = $('.nbh__msg');
    msg.textContent = text;
    msg.hidden = !text;
  };

  // 배너 이웃 다음에 홈페이지 없는 이웃(집 + 이름표만 — 배너 · 링크 없음)
  const items = () => [
    ...banners.map((b) => ({
      id: b.id,
      href: httpUrl(b.url) || '',
      image: httpUrl(b.image_url) || '',
      label: siteLabel(b),
      house: b.house ?? null,
      banner: b,
    })),
    ...residents.map((r) => ({
      id: `r${r.id}`,
      href: '',
      image: '',
      label: r.name,
      house: r.house ?? null,
      resident: r,
    })),
  ];

  // ---------- 보기 — 마을 ↔ 배너 ----------

  let view = readView();

  // 배너 보기 — 맨 위에 내 배너(homesweethome), 그 아래 받은 배너만 한 줄에 하나씩(이름 없이, 누르면 그 사이트 새 탭).
  //   홈페이지 없는 이웃은 배너가 없어 빠진다
  const paintBanners = () => {
    const box = $('.nbh__banners');
    if (state !== 'ready') {
      box.innerHTML = `<p class="nbh-bl__note">${state === 'error' ? '이웃을 불러오지 못했어요.' : '불러오는 중…'}</p>`;
      return;
    }
    const mine = { href: MY_BANNER.site, image: MY_BANNER.image, label: HOME_NAME };
    const list = [mine, ...items().filter((it) => !it.resident)];
    box.innerHTML = list.length
      ? `<ul class="nbh-bl">${list.map((it) => `
        <li><a class="nbh-bl__a"${it.href ? ` href="${esc(it.href)}" target="_blank" rel="noopener noreferrer"` : ''} aria-label="${esc(it.label)} 방문하기 — 새 탭">${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" decoding="async">` : ''}<span class="nbh-bl__alt">${esc(it.label)}</span></a></li>`).join('')}</ul>`
      : '<p class="nbh-bl__note">아직 배너를 건 이웃이 없어요.</p>';
    // 못 불러온 배너 — 그 칸에 이름으로
    box.querySelectorAll('.nbh-bl__a img').forEach((img) => {
      const broke = () => img.closest('.nbh-bl__a').classList.add('is-broken');
      if (img.complete && !img.naturalWidth) broke();
      else img.addEventListener('error', broke, { once: true });
    });
    box.querySelectorAll('.nbh-bl__a:not(:has(img))').forEach((el) => el.classList.add('is-broken'));
  };

  const paintView = () => {
    const banner = view === 'banner';
    const sw = $('.nbh-view');
    sw.setAttribute('aria-checked', String(banner));
    sw.setAttribute('aria-label', banner ? '마을로 보기' : '배너로 보기');
    root.dataset.view = view;
    $('.nbh__village').hidden = banner;
    $('.nbh__banners').hidden = !banner;
  };

  const setView = (next, { animate = true } = {}) => {
    if (next === view) return;
    view = next;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* 이번 화면에서만 */ }
    village?.close();
    paintView();
    paint();
    if (animate && !reduced) {
      // 손잡이가 눌렸다 튀어 오르며 넘어가고, 반짝이가 톡 — 다시 눌러도 처음부터
      const sw = $('.nbh-view');
      sw.classList.remove('is-flip');
      void sw.offsetWidth;
      sw.classList.add('is-flip');
    }
  };

  const paint = () => {
    if (view === 'banner') paintBanners();
    else village?.render({ items: items(), home: homeHouse, state, editing });
    $('.nbh__village').setAttribute('aria-busy', String(state === 'loading'));
  };

  // quiet — 다시 열 때는 지난 목록을 그대로 두고 뒤에서 새로 받는다
  const load = async ({ quiet = false } = {}) => {
    if (!quiet || state !== 'ready') { state = 'loading'; paint(); }
    try {
      [banners, homeHouse, residents] = await Promise.all([fetchBanners(), fetchHome(), fetchResidents()]);
      state = 'ready';
    } catch (e) {
      console.error(e);
      if (quiet && state === 'ready') return;
      state = 'error';
    }
    paint();
  };

  const paintOwner = () => {
    $('[data-act="edit"]').textContent = editing ? 'done' : 'edit';
    root.classList.toggle('is-editing', editing);
    $('[data-act="add"]').hidden = !editing;
    $('[data-act="edit"]').hidden = !session.owner;
    $('[data-act="requests"]').hidden = !session.owner;
  };

  // ---------- 주인 ----------

  // edit — 주인에게만 보인다(checkOwner). 누르면 고치기 모드
  const toggleEdit = () => {
    if (editing) { editing = false; paintOwner(); paint(); return; }
    if (!session.owner) return;
    setView('village'); // 고치기는 마을에서
    say('집을 누르면 그 집을 고칠 수 있어요.');
    editing = true;
    paintOwner();
    paint();
    panel.refreshCount();
  };

  // 로그인돼 있으면 조용히 주인인지 본다(edit · 받은 신청 수)
  const checkOwner = async () => {
    if (!hasSavedLogin() && !/access_token=|[?&]code=/.test(location.hash + location.search)) return;
    try {
      session = await ownerSession(await getClient());
    } catch { return; }
    paintOwner();
    if (session.owner) panel.refreshCount();
  };

  // ---------- 배너 교환 ----------

  let mailing = false;
  const openExchange = async () => {
    if (panel.mode === 'exchange' || mailing) return;
    village?.close();
    mailing = true;
    await village.mailOut();
    mailing = false;
    if (!root || root.hidden) return;
    panel.open('exchange', village.mail);
    onPage('banner');
  };

  // 홍차네 집 — 내 배너, 주인 고치기 중이면 홍차네 집 고치기
  const openHouse = (from) => {
    village?.close();
    if (editing) {
      panel.open('house', from, { item: { id: 'home', home: true, label: HOME_NAME, image: MY_BANNER.image, house: homeHouse } });
      return;
    }
    if (panel.mode === 'mine') return;
    panel.open('mine', from);
    onPage('mine');
  };

  const ensure = () => {
    if (root) return;
    root = build();
    root.classList.toggle('is-reduced', reduced);
    host.append(root);
    panel = mountPanel($('.nbh-panel'), {
      reduced,
      session: () => session,
      banners: () => banners,
      onClose: (mode) => { if (mode === 'exchange' || mode === 'mine') onPage('room'); },
      onChanged: () => load(),
      onCount: (n) => { $('.nbh__count').textContent = String(n); },
    });
    $('.nbh__home').addEventListener('click', () => onHome());
    $('.nbh-view').addEventListener('click', () => setView(view === 'banner' ? 'village' : 'banner'));
    $('.nbh-view').addEventListener('animationend', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('is-flip'); });
    paintView();
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit') toggleEdit();
      if (act === 'add') panel.open('add', e.target.closest('button'));
      if (act === 'retry') load();
      if (act === 'requests') { panel.open('exchange', e.target.closest('button')); onPage('banner'); setTimeout(() => panel.showRequests(), 60); }
    });
    // 포커스가 화면 밖으로 갈 수 있어 문서에서 받는다(배너 미리보기 Esc 는 village.js 가 먼저)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !root || root.hidden || root.classList.contains('is-closing')) return;
      e.preventDefault();
      if (panel.mode) panel.close(); // 패널이 먼저
      else onHome();
    });
  };

  return {
    get open() { return Boolean(root && !root.hidden && !root.classList.contains('is-closing')); },
    /**
     * @param {{ from?: Element | null, home: () => void, page?: 'room' | 'banner' | 'mine', onPage: (page: 'room' | 'banner' | 'mine') => void }} o
     */
    show({ from = null, home, page = 'room', onPage: pageCb }) {
      ensure();
      onHome = home;
      onPage = pageCb;
      clearTimeout(hiding);
      if (this.open) { this.page(page); return; }
      back = from;
      root.classList.remove('is-closing');
      root.hidden = false;
      if (cover) cover.inert = true;
      document.documentElement.classList.add('hsh-nbh-on');
      village = createVillage($('.nbh__village'), {
        reduced,
        mine: { href: MY_BANNER.site, image: MY_BANNER.image, label: HOME_NAME },
        onMail: () => openExchange(),
        onEdit: (item, from) => panel.open('house', from, { item }),
        onHouse: (from) => openHouse(from),
      });
      $('.nbh__village').hshVillage = village; // 시험이 배치를 읽는다
      if (!reduced) {
        let k = 0;
        boilTimer = setInterval(() => {
          if (document.hidden) return;
          k = (k + 1) % BOIL;
          root.dataset.boil = String(k);
        }, BOIL_MS);
      }
      $('.nbh__scroll').scrollTop = 0;
      paint();
      void root.offsetWidth;
      root.classList.add('is-open');
      root.focus({ preventScroll: true });
      if (!loaded) {
        loaded = true;
        load().then(() => { if (authError) say(`로그인하지 못했어요 — ${authError}`); });
        checkOwner();
      } else {
        load({ quiet: true });
      }
      this.page(page);
    },
    /** 주소가 바뀌었을 때(뒤로 · 앞으로 · 새로고침) — 패널만 여닫는다 */
    page(page) {
      if (!root || root.hidden) return;
      if (page === 'banner') {
        if (panel.mode === 'exchange') return;
        panel.open('exchange', village?.mail || null);
      } else if (page === 'mine') {
        if (panel.mode === 'mine') return;
        panel.open('mine', root.querySelector('.nbh-center'));
      } else if (panel.mode) {
        panel.close({ silent: true });
      }
    },
    hide({ instant = false } = {}) {
      if (!root || root.hidden) return;
      panel.close({ silent: true });
      clearInterval(boilTimer);
      root.dataset.boil = '0';
      village?.dispose();
      village = null;
      delete $('.nbh__village').hshVillage;
      editing = false;
      paintOwner();
      if (cover) cover.inert = false;
      document.documentElement.classList.remove('hsh-nbh-on');
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      const done = () => {
        root.hidden = true;
        root.classList.remove('is-closing');
        back?.focus?.({ preventScroll: true });
      };
      clearTimeout(hiding);
      if (instant || reduced) done();
      else hiding = setTimeout(done, 200);
    },
  };
}
