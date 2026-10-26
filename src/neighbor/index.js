// neighbor — 브라우저 창 대신 흰 화면 가운데 길쭉한 손그림 집(house.js). 주소 /neighbor · /neighbor/banner(routes.js),
// 여닫기 · 기록은 room-window.js 가 맡는다(archive 와 같은 길).
//   · 이웃 배너(banners · 배너 카테고리)를 정렬 순서대로 집 안에 한 줄로 건다. 누르면 새 탭.
//   · 맨 아래 바닥 오른쪽 바깥 우체통 → 편지가 살짝 올라온 뒤 배너 교환 패널(panel.js) — 주소 /neighbor/banner.
//   · 주인: 아래 'edit' → Google 로그인(돌아오면 보던 주소로) → 간판마다 ×, '+ add banner', 받은 신청.
//   · 처음 한 번만 '끌어서 돌려 보기' 손그림 화살표.
//   · 닫으면 그리기 · 스크롤 따라가기를 멈추고 장면을 치운다.

import { fetchBanners, siteLabel, httpUrl, deleteBanner } from './data.js';
import { createHouse } from './house.js';
import { mountPanel } from './panel.js';
import { getClient, ownerSession, hasSavedLogin, HOME_REDIRECT, consumeAuthError, rememberReturnPath } from '../content/supabase.js';

const HINT_KEY = 'hsh:nbh-hint';

function build() {
  const root = document.createElement('section');
  root.className = 'nbh';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'nbh-title');
  root.tabIndex = -1;
  root.innerHTML = `
    <div class="nbh__scroll">
      <button class="nbh__home" type="button"><span aria-hidden="true">←</span> home</button>
      <h2 class="nbh__title" id="nbh-title">neighbor</h2>
      <div class="nbh__scene" role="group" aria-label="이웃 간판 — 좌우로 끌면 집이 살짝 돌아가요">
        <p class="nbh__hint" aria-hidden="true" hidden>
          <svg viewBox="0 0 120 22"><path d="M8 13C30 7 88 7 112 13"/><path d="M15 6.5L7.5 13.2L15.5 18.4"/><path d="M105 6.8L112.6 13.3L104.6 18.6"/></svg>
          <span>끌어서 돌려 보기</span>
        </p>
      </div>
      <footer class="nbh__foot">
        <p class="nbh__msg" role="status" aria-live="polite" hidden></p>
        <div class="nbh__owner">
          <button class="nbh__link" type="button" data-act="requests" hidden>받은 신청 <span class="nbh__count"></span></button>
          <button class="nbh__link" type="button" data-act="add" hidden>+ add banner</button>
          <button class="nbh__link" type="button" data-act="edit">edit</button>
        </div>
      </footer>
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
  let house = null;
  let panel = null;
  let banners = [];
  let state = 'loading';
  let loaded = false;
  let editing = false;
  let session = { user: null, owner: false };
  let onHome = () => {};
  let onPage = () => {};
  let hiding = 0;
  let back = null;
  let hintTimer = 0;
  const authError = consumeAuthError();

  const $ = (q) => root.querySelector(q);

  const say = (text) => {
    const msg = $('.nbh__msg');
    msg.textContent = text;
    msg.hidden = !text;
  };

  const items = () => banners.map((b) => ({
    id: b.id,
    href: httpUrl(b.url) || '',
    image: httpUrl(b.image_url) || '',
    label: siteLabel(b),
  }));

  const paint = () => {
    house?.render({ items: items(), state, editing });
    $('.nbh__scene').setAttribute('aria-busy', String(state === 'loading'));
  };

  // quiet — 다시 열 때는 지난 목록을 그대로 두고 뒤에서 새로 받는다
  const load = async ({ quiet = false } = {}) => {
    if (!quiet || state !== 'ready') { state = 'loading'; paint(); }
    try {
      banners = await fetchBanners();
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
    $('[data-act="requests"]').hidden = !session.owner;
  };

  // ---------- 안내 — 처음 한 번만, 몇 초 뒤 또는 처음 돌리면 사라진다 ----------

  const hideHint = () => {
    clearTimeout(hintTimer);
    const hint = $('.nbh__hint');
    if (hint.hidden) return;
    hint.classList.add('is-gone');
    setTimeout(() => { hint.hidden = true; hint.classList.remove('is-gone'); }, reduced ? 0 : 400);
  };
  const showHint = () => {
    let seen = false;
    try { seen = sessionStorage.getItem(HINT_KEY) === '1'; sessionStorage.setItem(HINT_KEY, '1'); } catch { /* 이번 한 번 */ }
    if (seen) return;
    const hint = $('.nbh__hint');
    hint.hidden = false;
    hintTimer = setTimeout(hideHint, 4200);
  };

  // ---------- 주인 ----------

  // edit — 로그인 안 했으면 Google 로, 주인이면 고치기 모드
  const toggleEdit = async () => {
    if (editing) { editing = false; paintOwner(); paint(); return; }
    say('확인 중…');
    let client;
    try { client = await getClient(); } catch { say('불러오지 못했어요.'); return; }
    session = await ownerSession(client);
    if (!session.user) {
      say('Google 로그인으로 이동 중…');
      // 돌아오는 곳은 허용 목록의 루트(/) 하나 — 보던 주소(/neighbor 등)는 적어 두었다가 돌아온 뒤 연다
      rememberReturnPath();
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: HOME_REDIRECT } });
      if (error) { console.error(error); say('로그인하지 못했어요.'); }
      return;
    }
    if (!session.owner) { say('사이트 주인만 고칠 수 있어요.'); return; }
    say('');
    editing = true;
    paintOwner();
    paint();
    panel.refreshCount();
  };

  const remove = async (id) => {
    const b = banners.find((x) => String(x.id) === String(id));
    if (!b || !confirm(`'${siteLabel(b)}' 배너를 내릴까요?`)) return;
    try {
      await deleteBanner(session.user.id, b);
    } catch (e) {
      console.error(e);
      say('삭제하지 못했어요.');
      return;
    }
    say('');
    await load();
  };

  // 로그인돼 있으면 조용히 주인인지 본다(받은 신청 수)
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
  const openExchange = async ({ animate = true } = {}) => {
    if (panel.mode === 'exchange' || mailing) return;
    hideHint();
    if (animate) {
      mailing = true;
      await house.mailOut();
      mailing = false;
      if (!root || root.hidden) return;
    }
    panel.open('exchange', house.mail);
    onPage('banner');
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
      onClose: (mode) => { if (mode === 'exchange') onPage('room'); },
      onChanged: () => load(),
      onCount: (n) => { $('.nbh__count').textContent = String(n); },
    });
    $('.nbh__home').addEventListener('click', () => onHome());
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit') toggleEdit();
      if (act === 'add') panel.open('add', e.target.closest('button'));
      if (act === 'retry') load();
      if (act === 'requests') { panel.open('exchange', e.target.closest('button')); onPage('banner'); setTimeout(() => panel.showRequests(), 60); }
      const del = e.target.closest('[data-del]');
      if (del) remove(del.dataset.del);
    });
    // 캔버스 대신 DOM 이지만 포커스가 화면 밖으로 갈 수 있어 문서에서 받는다
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
     * @param {{ from?: Element | null, home: () => void, page?: 'room' | 'banner', onPage: (page: 'room' | 'banner') => void }} o
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
      const scroller = $('.nbh__scroll');
      house = createHouse($('.nbh__scene'), scroller, {
        reduced,
        onMail: () => openExchange(),
        onTurn: () => hideHint(),
      });
      $('.nbh__scene').hshHouse = house; // 시험이 각도를 읽고 돌린다
      scroller.scrollTop = 0;
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
      showHint();
      this.page(page);
    },
    /** 주소가 바뀌었을 때(뒤로 · 앞으로 · 새로고침) — 패널만 여닫는다 */
    page(page) {
      if (!root || root.hidden) return;
      if (page === 'banner') {
        if (panel.mode === 'exchange') return;
        // 주소로 바로 왔으면 우체통이 보이는 맨 아래로
        const scroller = $('.nbh__scroll');
        requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
        panel.open('exchange', house?.mail || null);
      } else if (panel.mode) {
        panel.close({ silent: true });
      }
    },
    hide({ instant = false } = {}) {
      if (!root || root.hidden) return;
      panel.close({ silent: true });
      clearTimeout(hintTimer);
      $('.nbh__hint').hidden = true;
      house?.dispose();
      house = null;
      delete $('.nbh__scene').hshHouse;
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
