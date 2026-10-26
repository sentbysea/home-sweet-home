// 바이브.me 관리자 — hongjiwon.love /admin/ 의 같은 판(마크업 · CSS · 스크립트)을 받아 이 도메인에서 그대로 띄운다.
//   다시 만들지 않는다: 입력 칸 · 저장 · 기본값 · 미리보기 · 프리셋 규칙이 그쪽과 한 벌이라 어긋날 수 없다.
//   이 파일이 하는 일은 셋뿐이다.
//     1. 메뉴를 이 사이트 범위로 — SETTINGS(HOME · CATEGORY) · QUOTE PRESET · DASHBOARD.
//        PROFILE · BGM · MY BANNER · CARD PRESET 은 이 사이트에 그 화면이 없어 숨긴다(코드는 그대로 실려 있다).
//     2. Settings > Home 키를 바이브.me 전용으로(content/home-settings.js 의 VIBE_HOME_KEYS) — 그쪽 값과 섞이지 않게.
//     3. Dashboard 를 그쪽 /api/ops 로(그쪽이 이 출처에만 CORS 를 연다). 인기 글 링크는 그쪽 글 주소로.
//   로그인 · 저장은 그쪽 코드 그대로 Supabase(같은 프로젝트)로 간다. 권한은 DB(RLS) · Worker(주인 토큰)가 정하고,
//   여기서는 화면만 주인 계정이 아니면 닫는다(site_owner_id(), neighbor 방과 같은 기준).

import { ORIGIN, loadScripts, loadStyles } from '../content/remote.js';
import { VIBE_HOME_KEYS } from '../content/home-settings.js';

const HIDDEN_SECTIONS = ['profile', 'bgm', 'mybanner'];
const boot = document.querySelector('.hsh-admin-boot');
const bootMsg = boot.querySelector('.hsh-admin-boot__msg');

let windowLoaded = document.readyState === 'complete';
window.addEventListener('load', () => { windowLoaded = true; }, { once: true });

// admin-dashboard.js 가 이 값을 읽는다(그쪽 저장소 admin/admin-dashboard.js)
window.SITE_OPS_API_BASE = `${ORIGIN}/api/ops`;

/** 그쪽 문서 안 loadVersionedStyles([...]) · loadVersionedScripts([...]) 목록 → 그쪽 루트 기준 경로 */
function listedPaths(doc, fn) {
  // 이름 앞이 글자가 아니어야 한다 — preloadVersionedScripts( 안의 loadVersionedScripts( 를 잡지 않게
  const re = new RegExp(`(^|[^A-Za-z_$])${fn}\\(`);
  const code = [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent).find((c) => re.test(c));
  if (!code) return [];
  const match = re.exec(code);
  const from = match.index + match[0].length;
  const array = code.slice(code.indexOf('[', from), code.indexOf(']', from) + 1).replace(/\/\*[\s\S]*?\*\//g, '');
  return [...array.matchAll(/"([^"]+)"/g)].map(([, p]) => new URL(p, `${ORIGIN}/admin/`).pathname.slice(1));
}

function loadExternal(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(src));
    document.head.append(s);
  });
}

/** 마크업을 이 사이트 범위로 — 스크립트가 돌기 전에 */
function trimMarkup(root) {
  root.querySelector('#openCardButton')?.setAttribute('hidden', '');
  const dash = root.querySelector('#openStatsDashboardButton .menu-number');
  if (dash) dash.textContent = '03';
  for (const id of ['profileTabButton', 'bgmTabButton', 'myBannerTabButton']) root.querySelector(`#${id}`)?.setAttribute('hidden', '');
  const title = root.querySelector('#siteTitleInput');
  if (title) title.placeholder = 'home sweet home';
  // 저장하기 전에 적용 범위가 보이게 — 저장 버튼 바로 옆에 짧게
  const VIBE_ONLY = ['바이브.me 에만', 'hongjiwon.love 의 탭 제목 · 파비콘 · 커서는 그대로예요'];
  const BOTH = ['두 사이트 함께', 'hongjiwon.love 와 같은 데이터 — 저장하면 두 사이트에 같이 반영돼요'];
  for (const id of ['siteTitleSaveButton', 'faviconSaveButton', 'cursorSaveButton']) scope(root.querySelector(`#${id}`), ...VIBE_ONLY, 'is-vibe');
  scope(root.querySelector('#categorySaveButton'), ...BOTH, 'is-both');
  scope(root.querySelector('#quoteSaveButton'), ...BOTH, 'is-both');
  // 사용 중(활성) 지정은 목록 버튼마다 — 목록 바로 위에 한 번
  const list = root.querySelector('#quotePresetList');
  if (list) list.before(chip('사용 중 지정 · 두 사이트 함께', '사용 중 프리셋은 두 사이트에서 프리셋을 따로 고르지 않은 글의 본문 · Quote 에 쓰여요', 'is-both'));
  const dashHead = root.querySelector('#statsDashboardPanel .view-heading');
  if (dashHead) dashHead.append(chip('hongjiwon.love 통계', '바이브.me 방문은 세지 않아요', 'is-origin'));
}

function chip(text, title, kind) {
  const span = document.createElement('span');
  span.className = `hsh-admin-scope ${kind}`;
  span.textContent = text;
  span.title = title;
  return span;
}

function scope(button, text, title, kind) {
  button?.after(chip(text, title, kind));
}

/** 대시보드 — 그쪽 글 주소 · '내 방문 제외'는 그쪽 브라우저 저장소라 여기서 바꿀 수 없다 */
function adaptDashboard() {
  const mount = document.getElementById('statsDashboardMount');
  if (!mount) return;
  mount.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="/post/"]');
    if (!a) return;
    e.preventDefault();
    window.open(`${ORIGIN}${a.getAttribute('href')}`, '_blank', 'noopener');
  });
  new MutationObserver(() => {
    const mine = mount.querySelector('.ops-dash-mine');
    if (!mine || mine.dataset.hshAdapted) return;
    mine.dataset.hshAdapted = '1';
    const box = mine.querySelector('[data-ops-optout]');
    if (box) box.disabled = true;
    const p = document.createElement('p');
    p.className = 'hsh-admin-note';
    p.append('방문 통계는 hongjiwon.love 방문만 셉니다. 이 설정은 그 사이트를 여는 브라우저에 저장돼서 여기서는 바꿀 수 없어요 — ');
    const a = document.createElement('a');
    a.href = `${ORIGIN}/admin/?view=dashboard`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'hongjiwon.love 관리자에서 바꾸기 ↗';
    p.append(a);
    mine.append(p);
  }).observe(mount, { childList: true, subtree: true });
}

/** 주인 계정이 아니면 관리 화면을 닫는다(데이터는 어차피 RLS 가 막는다 — 화면만) */
function guardOwner() {
  const client = window.supabaseClient ?? (typeof supabaseClient !== 'undefined' ? supabaseClient : null); // eslint-disable-line no-undef
  if (!client) return;
  const notice = document.createElement('div');
  notice.className = 'hsh-admin-denied';
  notice.hidden = true;
  notice.innerHTML = '<p>사이트 주인 계정으로만 관리할 수 있어요.</p>';
  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = '로그아웃';
  out.addEventListener('click', () => client.auth.signOut().then(() => location.reload()));
  notice.append(out);
  document.body.prepend(notice);
  const check = async (session) => {
    const user = session?.user;
    if (!user) { document.documentElement.removeAttribute('data-not-owner'); notice.hidden = true; return; }
    const { data: ownerId, error } = await client.rpc('site_owner_id');
    const owner = !error && ownerId === user.id;
    document.documentElement.toggleAttribute('data-not-owner', !owner);
    notice.hidden = owner;
  };
  client.auth.getSession().then(({ data }) => check(data?.session));
  client.auth.onAuthStateChange((_event, session) => { check(session); });
}

async function start() {
  const res = await fetch(`${ORIGIN}/admin/?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(`admin ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const styles = listedPaths(doc, 'loadVersionedStyles');
  const scripts = listedPaths(doc, 'loadVersionedScripts');
  const external = [...doc.querySelectorAll('body script[src]')].map((s) => s.getAttribute('src')).filter((s) => /^https:\/\//.test(s));
  if (!scripts.length || !doc.querySelector('main')) throw new Error('admin markup');

  await loadStyles(styles);

  // 마크업 — 그림 주소만 그쪽 기준으로(링크는 이 사이트 기준 그대로: ../ = 바이브.me 홈)
  const parts = [doc.querySelector('main'), doc.querySelector('footer')].filter(Boolean).map((n) => document.importNode(n, true));
  for (const part of parts) {
    part.querySelectorAll('[src]').forEach((el) => {
      const src = el.getAttribute('src');
      if (src && !/^(https?:|data:|blob:)/.test(src)) el.setAttribute('src', new URL(src, `${ORIGIN}/admin/`).href);
    });
    trimMarkup(part);
  }
  boot.after(...parts);

  for (const src of external) await loadExternal(src); // supabase-js
  // 설정 · 키 이름부터 — Home 키를 바이브.me 전용으로 바꾼 뒤에 관리자 스크립트가 돈다
  const configAt = scripts.indexOf('core/site-config.js');
  if (configAt >= 0) await loadScripts(scripts.slice(0, configAt + 1));
  /* global SITE_SETTING_KEYS */
  if (typeof SITE_SETTING_KEYS === 'object' && SITE_SETTING_KEYS) Object.assign(SITE_SETTING_KEYS, VIBE_HOME_KEYS);
  const loadedBefore = windowLoaded;
  await loadScripts(scripts.slice(configAt + 1));

  // 숨긴 화면으로는 가지 않게 — 그쪽 함수(전역)를 감싼다
  const showSection = window.showSettingsSection;
  if (typeof showSection === 'function') window.showSettingsSection = (s) => showSection(HIDDEN_SECTIONS.includes(s) ? 'home' : s);
  if (typeof window.showAdminHome === 'function') window.showCardPanel = () => window.showAdminHome(true);

  adaptDashboard();
  guardOwner();
  boot.remove();
  // 그쪽 스크립트는 window load 에서 시작한다(로그인 확인 · 프리셋 목록). 이미 지나갔으면 한 번 더 알린다
  if (loadedBefore) window.dispatchEvent(new Event('load'));
}

start().catch((e) => {
  console.error(e);
  bootMsg.textContent = 'hongjiwon.love 관리자 화면을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';
});
