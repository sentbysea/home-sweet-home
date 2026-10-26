// neighbor 데이터 — hongjiwon.love 와 같은 Supabase(banners 표 · 배너 카테고리)를 같이 쓴다.
//   보기 · 신청: 누구나 — 공개 키로 REST 를 바로 부른다(supabase-js 없이, 첫 화면이 가볍게).
//   고치기 · 신청 확인: 사이트 주인만 — supabase-js 클라이언트(content/supabase.js)로.
//     배너 추가 · 삭제는 hongjiwon.love 의 posts-view-banner-form.js 와 같다
//     (이미지 파일은 user-banners 버킷 {user_id}/category-banners/{uuid}/image).
//   신청은 banner_requests 표 — 표는 직접 열지 않고 RPC 셋으로만
//     (web 저장소 supabase/migrations/20261026100000_banner_requests.sql).

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

const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SUPABASE_KEY, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
});

export async function fetchBanners() {
  const q = `select=id,name,url,image_url,image_path,sort_order&category_id=eq.${CATEGORY_ID}&order=sort_order.asc`;
  const res = await rest(`banners?${q}`);
  if (!res.ok) throw new Error(`banners ${res.status}`);
  return res.json();
}

/**
 * 배너 교환 신청 — 누구나.
 * @returns {Promise<'ok' | 'pending' | 'listed' | 'busy' | 'unavailable' | 'invalid:site_name' | 'invalid:site_url' | 'invalid:image_url' | 'invalid:message'>}
 *   네트워크 · 서버 오류는 throw(다시 시도 안내)
 */
export async function submitRequest({ name, url, image, message }) {
  const res = await rest('rpc/submit_banner_request', {
    method: 'POST',
    body: JSON.stringify({ p_site_name: name, p_site_url: url, p_image_url: image, p_message: message || null }),
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

/** 파일 올리기 — 같은 폼에서 다시 고르면 같은 자리에 덮어쓴다. @returns {{ path, url }} */
export async function uploadImage(userId, file, path = crypto.randomUUID()) {
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

export async function addBanner(userId, { name, url, imageUrl, imagePath }, banners) {
  const client = await getClient();
  const { error } = await client.from('banners').insert({
    category_id: CATEGORY_ID,
    user_id: userId,
    name: name || '',
    url,
    image_url: imageUrl,
    image_path: imagePath || null,
    sort_order: banners.length ? Math.max(...banners.map((b) => b.sort_order ?? 0)) + 1 : 0,
  });
  if (error) throw error;
}

export async function deleteBanner(userId, banner) {
  const client = await getClient();
  const { error } = await client.from('banners').delete().eq('id', banner.id).eq('user_id', userId);
  if (error) throw error;
  if (banner.image_path) await removeImage(userId, banner.image_path);
}
