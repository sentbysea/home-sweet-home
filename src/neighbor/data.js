// neighbor 데이터 — hongjiwon.love 와 같은 Supabase(banners 표 · 배너 카테고리)를 같이 쓴다.
//   보기 · 신청: 누구나 — 공개 키로 REST 를 바로 부른다(supabase-js 없이, 첫 화면이 가볍게).
//   고치기 · 신청 확인: 사이트 주인만 — supabase-js 클라이언트(content/supabase.js)로.
//     배너 추가 · 삭제는 hongjiwon.love 의 posts-view-banner-form.js 와 같다
//     (이미지 파일은 user-banners 버킷 {user_id}/category-banners/{uuid}/image).
//   신청은 banner_requests 표 — 표는 직접 열지 않고 RPC 로만
//     (web 저장소 supabase/migrations/20261026100000_banner_requests.sql · 20261027100000_neighbor_houses.sql).
//   집 모양은 banners.house · banner_requests.house(jsonb). house 열이 아직 없는 DB 면 열 없이 다시 읽는다(모두 기본 모양).

import { SUPABASE_URL, SUPABASE_KEY, getClient } from '../content/supabase.js';

export const CATEGORY_ID = 4; // hongjiwon.love 배너 카테고리 — 신청 승인 RPC 도 같은 값
export const BUCKET = 'user-banners';

// 내 배너 — 바이브.me. 이미지는 늘 같은 주소(admin MY BANNER 가 같은 자리에 덮어써서 남의 사이트에 심은 코드가 그대로 산다)
export const MY_BANNER = {
  name: '바이브.me',
  site: 'https://xn--9g3b29an0p.me', // 한글 주소를 못 받는 곳도 있어서 퓨니코드로
  image: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/cfe0dc66-7fa2-450e-8817-44073a4a5aab/banner`, // 3000×600
};

/** 남의 사이트에 붙일 배너 코드 — 200×40(5:1) */
export function bannerCode(b = MY_BANNER) {
  return `<a href="${b.site}" target="_blank" rel="noopener"><img src="${b.image}" alt="${b.name}" width="200" height="40"></a>`;
}

/** http(s) 주소만 — 비었으면 '', 나머지(javascript: · data: …)는 null */
export function httpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const u = new URL(text);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** 이름이 비어 있는 배너는 주소로(hongjiwon.love · luvlog.me/lucky) */
export function siteLabel(b) {
  const name = String(b.name || '').trim();
  if (name) return name;
  try {
    const u = new URL(b.url);
    return (u.host.replace(/^www\./, '') + u.pathname).replace(/\/+$/, '');
  } catch {
    return String(b.url || '');
  }
}

/**
 * 사이트 제목(탭에 뜨는 <title>) — 이름을 비워 두면 이걸로. 남의 사이트 HTML 은 브라우저가 바로 못 읽어서
 * Supabase Edge Function(site-title, web 저장소 supabase/functions/site-title)이 대신 읽는다.
 * 함수가 없거나 못 읽으면 주소(hongjiwon.love · luvlog.me/lucky)로. 늘 1~40자.
 */
export async function siteTitle(url) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/site-title?url=${encodeURIComponent(url)}`, {
      headers: { apikey: SUPABASE_KEY },
      signal: AbortSignal.timeout(6000),
    });
    const title = res.ok ? String((await res.json())?.title || '').replace(/\s+/g, ' ').trim() : '';
    if (title) return [...title].slice(0, 40).join('');
  } catch { /* 아래로 */ }
  return [...(siteLabel({ url }) || 'neighbor')].slice(0, 40).join('');
}

const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SUPABASE_KEY, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
});

export async function fetchBanners() {
  const q = (cols) => `select=${cols}&category_id=eq.${CATEGORY_ID}&order=sort_order.asc`;
  const cols = 'id,name,url,image_url,image_path,sort_order';
  let res = await rest(`banners?${q(`${cols},house`)}`);
  if (res.status === 400) res = await rest(`banners?${q(cols)}`); // house 열 적용 전
  if (!res.ok) throw new Error(`banners ${res.status}`);
  return res.json();
}

/**
 * 배너 교환 신청 — 누구나.
 * @returns {Promise<'ok' | 'pending' | 'listed' | 'busy' | 'unavailable' | 'invalid:site_name' | 'invalid:site_url' | 'invalid:image_url' | 'invalid:message'>}
 *   네트워크 · 서버 오류는 throw(다시 시도 안내)
 */
export async function submitRequest({ name, url, image, message, house = null }) {
  const res = await rest('rpc/submit_banner_request', {
    method: 'POST',
    body: JSON.stringify({ p_site_name: name, p_site_url: url, p_image_url: image, p_message: message || null, p_house: house }),
  });
  const body = await res.json().catch(() => null);
  if (res.ok) return body;
  if (body?.code === '22023') return `invalid:${body.message}`;
  // 신청 RPC 가 아직 없다(DB 변경 적용 전) — 저장하지 못했다고 알린다
  if (res.status === 404 || body?.code === 'PGRST202') return 'unavailable';
  throw new Error(`submit ${res.status} ${body?.message || ''}`);
}

// ---------- 주인 ----------

export async function listRequests() {
  const client = await getClient();
  const { data, error } = await client.rpc('list_banner_requests');
  if (error) throw error;
  return data || [];
}

/** @returns {Promise<'approved' | 'rejected' | 'missing'>} */
export async function reviewRequest(id, approve) {
  const client = await getClient();
  const { data, error } = await client.rpc('review_banner_request', { p_id: id, p_approve: approve });
  if (error) throw error;
  return data;
}

const storagePath = (userId, path) => `${userId}/category-banners/${path}/image`;

/**
 * 배너 파일을 5:1 로 — 비율이 다르면 가운데를 잘라 낸다(이미 5:1 이면 · 움직이는 GIF 는 그대로 — 화면이 5:1 로 잘라 보인다).
 * 너무 크면 3000px 폭까지 줄인다. 못 읽으면 원본 그대로.
 */
export async function cropBanner(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return file; }
  const { width: w, height: h } = bmp;
  if (!w || !h || Math.abs(w / h - 5) < 0.05) { bmp.close(); return file; }
  const sw = Math.min(w, h * 5);
  const sh = sw / 5;
  const out = Math.min(3000, Math.round(sw));
  const c = document.createElement('canvas');
  c.width = out;
  c.height = Math.round(out / 5);
  c.getContext('2d').drawImage(bmp, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await new Promise((resolve) => c.toBlob(resolve, file.type, 0.92));
  return blob ? new File([blob], file.name, { type: file.type }) : file;
}

/** 파일 올리기(5:1 로 잘라서) — 같은 폼에서 다시 고르면 같은 자리에 덮어쓴다. @returns {{ path, url }} */
export async function uploadImage(userId, input, path = crypto.randomUUID()) {
  const file = await cropBanner(input);
  const client = await getClient();
  const full = storagePath(userId, path);
  const { error } = await client.storage.from(BUCKET).upload(full, file, { upsert: true, contentType: file.type, cacheControl: '60' });
  if (error) throw error;
  return { path, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${full}` };
}

export async function removeImage(userId, path) {
  const client = await getClient();
  await client.storage.from(BUCKET).remove([storagePath(userId, path)]);
}

/**
 * 홍차네 집 모양(neighbor_home 한 줄 · web 저장소 20261029100000_neighbor_home.sql) — 누구나 읽는다.
 * 표가 아직 없거나 비었으면 null(화면이 기본 모양 HOME_HOUSE)
 */
export async function fetchHome() {
  try {
    const res = await rest('neighbor_home?select=house&limit=1');
    if (!res.ok) return null;
    return (await res.json())?.[0]?.house ?? null;
  } catch {
    return null;
  }
}

/** 주인 — 홍차네 집 모양 고치기(null 이면 기본 모양) */
export async function setHomeHouse(house) {
  const client = await getClient();
  const { data, error } = await client.rpc('set_home_house', { p_house: house });
  if (error) throw error;
  if (data !== 'ok') throw new Error(`set_home_house ${data}`);
}

/** 주인 — 이웃집 모양 고치기(null 이면 기본 모양) */
export async function setHouse(id, house) {
  const client = await getClient();
  const { data, error } = await client.rpc('set_banner_house', { p_id: id, p_house: house });
  if (error) throw error;
  if (data !== 'ok') throw new Error(`set_banner_house ${data}`);
}

export async function addBanner(userId, { name, url, imageUrl, imagePath, house = null }, banners) {
  const client = await getClient();
  const { error } = await client.from('banners').insert({
    category_id: CATEGORY_ID,
    user_id: userId,
    name: name || '',
    url,
    image_url: imageUrl,
    image_path: imagePath || null,
    sort_order: banners.length ? Math.max(...banners.map((b) => b.sort_order ?? 0)) + 1 : 0,
    ...(house ? { house } : {}),
  });
  if (error) throw error;
}

/** 주인 — 이웃집 내용(이름 · 주소 · 배너 이미지) 고치기 */
export async function updateBanner(userId, id, { name, url, imageUrl, imagePath }) {
  const client = await getClient();
  const { data, error } = await client.from('banners')
    .update({ name: name || '', url, image_url: imageUrl, image_path: imagePath || null })
    .eq('id', id).eq('user_id', userId).eq('category_id', CATEGORY_ID)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('update missing');
}

export async function deleteBanner(userId, banner) {
  const client = await getClient();
  const { error } = await client.from('banners').delete().eq('id', banner.id).eq('user_id', userId);
  if (error) throw error;
  if (banner.image_path) await removeImage(userId, banner.image_path);
}
