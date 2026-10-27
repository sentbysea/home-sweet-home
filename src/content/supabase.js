// hongjiwon.love 와 같은 Supabase — 클라이언트는 이 사이트에 하나만(neighbor 방 · 글 창 · 관리자가 같이 쓴다).
//   공개(publishable) 키만 쓴다. 권한은 전부 DB(RLS · RPC)가 정한다 — 이 파일은 비밀을 갖지 않는다.
//   요청마다 비밀번호 폴더 열람 표를 머리글로 싣는 fetch(그쪽 core/folder-access.js 의 folderAccessFetch)를 쓴다.
//   supabase-js 는 처음 필요할 때 받는다 — 홈 화면 첫 표시를 막지 않게.

import { loadScripts } from './remote.js';

export const SUPABASE_URL = 'https://iokdgqzfprtggsnrusez.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_N9mPjBMUQJEhKYPo9ZMlZg_9i7GEsYp'; // 공개(publishable) 키
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js'; // hongjiwon.love 와 같은 판
export const AUTH_KEY = 'sb-iokdgqzfprtggsnrusez-auth-token'; // supabase-js 가 로그인 정보를 두는 자리

function loadSupabaseJs() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SUPABASE_JS;
    s.onload = resolve;
    s.onerror = () => reject(new Error('supabase-js'));
    document.head.append(s);
  });
}

let clientPromise = null;

/** 한 번만 만든다 — 그쪽 렌더러가 부르는 전역 supabaseClient · getSignedInUser 도 같이 둔다 */
export function getClient() {
  clientPromise ??= (async () => {
    // 열람 표 fetch 를 못 받아도(그쪽 장애) 클라이언트는 만든다 — 잠긴 폴더만 안 열린다
    const [, folders] = await Promise.allSettled([loadSupabaseJs(), loadScripts(['core/folder-access.js'])]);
    if (!window.supabase?.createClient) throw new Error('supabase-js');
    const fetchWithFolders = folders.status === 'fulfilled' && typeof window.folderAccessFetch === 'function'
      ? (...args) => window.folderAccessFetch(...args)
      : undefined;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, fetchWithFolders ? { global: { fetch: fetchWithFolders } } : {});
    window.supabaseClient = client;
    // 그쪽 posts/editor/posts-state.js 의 getSignedInUser 와 같은 일(posts-reader-scale.js 가 부른다)
    window.getSignedInUser = async () => {
      const { data, error } = await client.auth.getUser();
      return error || !data?.user ? null : data.user;
    };
    return client;
  })().catch((e) => { clientPromise = null; throw e; });
  return clientPromise;
}

/** 로그인한 사람과, 그 사람이 사이트 주인인지(DB 의 site_owner_id() 가 기준) */
export async function ownerSession(client) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { user: null, owner: false };
  const { data: ownerId } = await client.rpc('site_owner_id');
  return { user, owner: ownerId === user.id };
}

/**
 * Google 로그인에서 돌아오는 주소 — 늘 사이트 루트(Supabase 허용 목록에 `https://ho.xn--9g3b29an0p.me/` 한 줄).
 * 관리자는 그쪽 admin-session.js 가 `${origin}/admin/` 으로 정한다(허용 목록의 다른 한 줄).
 */
export const HOME_REDIRECT = `${location.origin}/`;

/**
 * 로그인이 실패해 돌아왔으면(#error=… / ?error=…) 주소에서 지우고 이유를 돌려준다 — 없으면 ''.
 * 허용 목록에 없는 주소였다면 Supabase 는 여기로 오지 않고 Site URL(hongjiwon.love)로 보낸다.
 */
export function consumeAuthError() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const error = hash.get('error') || query.get('error');
  if (!error) return '';
  const why = hash.get('error_description') || query.get('error_description') || error;
  for (const k of ['error', 'error_code', 'error_description']) query.delete(k);
  const q = query.toString();
  history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}`);
  return why.replace(/\+/g, ' ');
}

/** 이번에 Google 로그인에서 돌아왔나(성공 #access_token · ?code / 실패 error) — 모듈을 읽는 때, 주소를 정리하기 전에 잰다 */
export const AUTH_RETURN = /access_token=|[?&]code=|[#&?]error=/.test(location.hash + location.search);

const RETURN_KEY = 'hsh:auth-return';

/** 로그인하러 나가기 전 — 지금 보던 바이브.me 주소(돌아온 뒤 그 창을 다시 연다, plan/room-window.js) */
export function rememberReturnPath() {
  try { sessionStorage.setItem(RETURN_KEY, location.pathname + location.search); } catch { /* 홈으로 돌아온다 */ }
}

/** 적어 둔 주소를 꺼낸다(한 번만) — 이 사이트 안 경로만 */
export function takeReturnPath() {
  let path = null;
  try { path = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch { /* 없음 */ }
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/** 저장된 로그인이 있나(supabase-js 를 받기 전에 — 주인일 때만 미리 깨우려고) */
export function hasSavedLogin() {
  try { return Boolean(localStorage.getItem(AUTH_KEY)); } catch { return false; }
}

/** 지금 access token(주인이 비공개 글 사진을 받을 때) — 없으면 null */
export async function accessToken() {
  if (!clientPromise) return null;
  const client = await clientPromise;
  const { data } = await client.auth.getSession();
  return data?.session?.access_token ?? null;
}
