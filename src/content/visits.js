// 바이브.me 방문 집계 — ho.바이브.me 에서만. hongjiwon.love 의 /api/collect 로 보내면 그쪽 집계가
//   바이브.me 표에 따로 센다(hongjiwon.love 숫자와 섞이지 않는다). 숫자는 통계 대시보드의 '바이브.me'.
//   보내지 않는 경우 — 처음부터 아무것도 보내지 않는다:
//     · 운영 주소가 아님(localhost · 미리보기) · 자동화 브라우저(navigator.webdriver)
//     · 이 브라우저의 '내 방문 집계 제외'(통계 대시보드의 ?hsh-optout 링크로 켠다 — 그쪽 core/site-analytics.js 와 같은 열쇠)
//     · 이 브라우저에 사이트 주인 로그인이 저장돼 있음(supabase-js 를 받지 않고, 저장된 로그인의 사용자 id 로 본다)
//   무엇을 세나: 문서를 연 화면 하나 + 그 뒤 화면 종류가 바뀔 때마다 하나(주소 → 화면 이름, 같은 화면 안 이동은 세지 않는다).
//   no-cors · text/plain — 사전 요청 없이 보내고 응답은 읽지 않는다. 실패해도 다시 보내지 않고 화면에는 영향이 없다.
//   브라우저에 두는 값: localStorage hj-visitor-id — 순방문자 추정용 임의 ID(400일), hongjiwon.love 와 같은 이름 · 모양.

import { parsePath, ROOM_PATHS } from '../plan/routes.js';
import { AUTH_KEY } from './supabase.js';
import { SITE_OWNER_ID } from './home-settings.js';

const ENDPOINT = 'https://hongjiwon.love/api/collect';
const HOSTS = ['ho.xn--9g3b29an0p.me', 'xn--9g3b29an0p.me', 'www.xn--9g3b29an0p.me'];
const OPTOUT_KEY = 'hj-analytics-optout';
const VISITOR_KEY = 'hj-visitor-id';
const VISITOR_MAX_AGE = 400 * 24 * 60 * 60 * 1000;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

const optedOut = () => read(OPTOUT_KEY) === '1';

/** 저장된 로그인이 사이트 주인인가 */
function ownerSaved() {
  try { return JSON.parse(read(AUTH_KEY) || 'null')?.user?.id === SITE_OWNER_ID; } catch { return false; }
}

const hex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

let memoryVisitor = null;

function visitorId() {
  try {
    const saved = JSON.parse(localStorage.getItem(VISITOR_KEY) || 'null');
    if (saved && /^[0-9a-f]{32}$/.test(saved.id) && Number.isFinite(saved.created)
      && Date.now() - saved.created < VISITOR_MAX_AGE && saved.created <= Date.now() + 60000) return saved.id;
    const fresh = { id: hex(16), created: Date.now() };
    localStorage.setItem(VISITOR_KEY, JSON.stringify(fresh));
    return fresh.id;
  } catch {
    memoryVisitor ??= hex(16); // 저장이 막힌 브라우저 — 이 문서 동안만
    return memoryVisitor;
  }
}

function eventId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const h = hex(16).split('');
  h[12] = '4';
  h[16] = '89ab'[parseInt(h[16], 16) & 3];
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** 지금 주소 → 화면 이름(그쪽 vibe_analytics 의 page) */
export function pageOf(pathname = location.pathname, search = location.search) {
  const r = parsePath(pathname, search);
  if (!r) return 'home';
  if (r.post) return 'post';
  if (r.category) return 'category';
  if (r.page === 'pair') return 'pair';
  if (r.page === 'banner' || r.page === 'mine') return 'neighbor';
  return ROOM_PATHS[r.room] || 'home';
}

/** 404.html 을 거쳐 왔으면 그 문서가 넘긴 원래 값(유입 출처 · 새로 들어왔나) — 한 번만 */
function bounced() {
  try {
    const v = JSON.parse(sessionStorage.getItem('hsh:route-visit') || 'null');
    sessionStorage.removeItem('hsh:route-visit');
    return v && typeof v.ref === 'string' ? v : null;
  } catch {
    return null;
  }
}

/** 새로 들어온 문서인가(새로고침 · 뒤로/앞으로 가기가 아님) */
function freshNavigation() {
  try {
    const entry = performance.getEntriesByType('navigation')[0];
    return !entry || entry.type === 'navigate' || entry.type === 'prerender';
  } catch {
    return true;
  }
}

/**
 * 통계 대시보드의 '바이브.me 에도 적용' 링크(?hsh-optout=1|0) — '내 방문 집계 제외'를 이 브라우저의
 * 바이브.me 저장소에도 적는다(주소가 달라 그쪽 값을 읽을 수 없다). 주소에서는 바로 지우고 잠깐 알린다.
 */
function applyOptoutLink() {
  const q = new URLSearchParams(location.search);
  const v = q.get('hsh-optout');
  if (v !== '1' && v !== '0') return;
  q.delete('hsh-optout');
  const s = q.toString();
  history.replaceState(history.state, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
  let ok = false;
  try {
    if (v === '1') localStorage.setItem(OPTOUT_KEY, '1');
    else localStorage.removeItem(OPTOUT_KEY);
    ok = optedOut() === (v === '1');
  } catch { /* 저장이 막힌 브라우저 */ }
  const note = document.createElement('p');
  note.className = 'hsh-visit-note';
  note.setAttribute('role', 'status');
  note.textContent = !ok ? '이 브라우저에 설정을 저장하지 못했어요.'
    : v === '1' ? '이제 이 브라우저의 바이브.me 방문은 세지 않아요.' : '이 브라우저의 바이브.me 방문을 다시 세요.';
  document.body.append(note);
  setTimeout(() => note.remove(), 4000);
}

/** main.js 가 한 번 부른다 */
export function startVisits() {
  applyOptoutLink();
  if (location.protocol !== 'https:' || !HOSTS.includes(location.hostname)) return;
  if (navigator.webdriver) return;
  const via = bounced();
  let last = null;
  let first = true;
  const note = () => {
    const page = pageOf();
    if (page === last) return;
    last = page;
    if (optedOut() || ownerSaved()) return; // 도중에 주인으로 로그인했거나 제외를 켰다
    const entry = first && (via ? via.fresh : freshNavigation());
    const ref = first ? (via ? via.ref : document.referrer) : '';
    const body = JSON.stringify({ v: 1, site: 'vibe', eid: eventId(), vid: visitorId(), page, entry, ref });
    first = false;
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body })
      .catch(() => { /* 세지 못해도 화면은 그대로 */ });
  };
  // 창을 열고 닫을 때 주소만 바뀐다(plan/room-window.js 의 pushState · replaceState) — 바뀐 뒤에 본다
  for (const k of ['pushState', 'replaceState']) {
    const orig = history[k];
    history[k] = function patched(...args) {
      const out = orig.apply(this, args);
      queueMicrotask(note);
      return out;
    };
  }
  addEventListener('popstate', note);
  note();
}
