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
