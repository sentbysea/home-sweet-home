// 글 · 갤러리 · 메모 데이터 — hongjiwon.love 의 원본(같은 Supabase 표)을 그대로 읽는다. 복사본은 없다.
//   그쪽에서 글을 쓰고 · 고치고 · 지우면 다음 조회부터 여기에도 그대로 보인다.
//   조회 모양 · 정렬은 그쪽 공개 화면과 같다(괄호 안은 그쪽 파일).
//   공개 범위는 DB 가 정한다 — 비공개 글 · 나만 보기 폴더는 방문자에게 행이 오지 않고,
//   비밀글 본문은 비밀번호 RPC 로만, 비밀번호 폴더 안은 열람 표가 있어야 온다(RLS).

import { getClient } from './supabase.js';

const SITE_OWNER_ID = 'cfe0dc66-7fa2-450e-8817-44073a4a5aab'; // 그쪽 core/site-config.js · DB site_owner_id() 와 같은 값(비밀 아님)
const GALLERY_PAGE_SIZES = [6, 12, 18, 24]; // posts-view-gallery.js
const GALLERY_DEFAULT_PAGE_SIZE = 12;

const missingColumn = (error) => error && (error.code === '42703' || error.code === 'PGRST204');

/**
 * 카테고리 하나 — id(숫자) 또는 slug 로. 이름은 관리자에서 바뀔 수 있어 쓰지 않는다
 * (posts-view-list.js selectCategoryForPage)
 */
export async function fetchCategory(ref) {
  const client = await getClient();
  const byId = /^\d+$/.test(String(ref));
  const query = (cols) => {
    let q = client.from('categories').select(cols).eq('user_id', SITE_OWNER_ID);
    q = byId ? q.eq('id', Number(ref)) : q.eq('slug', String(ref));
    return q.maybeSingle();
  };
  let { data, error } = await query('id, user_id, name, slug, type, page_size');
  if (missingColumn(error)) ({ data, error } = await query('id, user_id, name, slug, type'));
  if (error) throw error;
  return data;
}

/** 이 카테고리를 주인이 보고 있나(빈 폴더 · 잠금 표시가 달라진다) */
export async function viewerOf(category) {
  const client = await getClient();
  const { data } = await client.auth.getSession();
  const user = data?.session?.user ?? null;
  return { user, owner: Boolean(user && category && user.id === category.user_id) };
}

/** 일반 카테고리 — 글 전부 + 폴더 전부(posts-view-list.js selectCategoryPosts · selectCategoryFolders) */
export async function fetchCategoryTree(categoryId) {
  const client = await getClient();
  const postsReq = client.from('posts')
    .select('id, title, created_at, visibility, folder_id, sort_order')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: false });
  const folders = async (cols) => client.from('post_folders').select(cols).eq('category_id', categoryId).order('sort_order', { ascending: true });
  const [posts, folderRes] = await Promise.all([postsReq, (async () => {
    let r = await folders('id, parent_id, name, depth, sort_order, series_title_mode, visibility');
    if (missingColumn(r.error)) r = await folders('id, parent_id, name, depth, sort_order, series_title_mode');
    return r;
  })()]);
  if (posts.error) throw posts.error;
  if (folderRes.error && folderRes.error.code !== 'PGRST205' && folderRes.error.code !== '42P01') throw folderRes.error;
  return { posts: posts.data || [], folders: folderRes.data || [] };
}

export const galleryPageSizeOf = (category) =>
  GALLERY_PAGE_SIZES.includes(Number(category?.page_size)) ? Number(category.page_size) : GALLERY_DEFAULT_PAGE_SIZE;

/** 갤러리 한 페이지 — 범위 밖이면 마지막 페이지로(posts-view-gallery.js fetchGalleryPage) */
export async function fetchGalleryPage(category, requested) {
  const client = await getClient();
  const size = galleryPageSizeOf(category);
  const query = (page) => client.from('posts')
    .select('id, title, created_at, visibility, folder_id, sort_order', { count: 'exact' })
    .eq('category_id', category.id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: false })
    .range((page - 1) * size, page * size - 1);
  let page = Math.max(1, Math.floor(Number(requested)) || 1);
  let { data, error, count } = await query(page);
  if (error && (error.code === 'PGRST103' || error.status === 416)) {
    const head = await client.from('posts').select('id', { count: 'exact', head: true }).eq('category_id', category.id);
    if (head.error) throw head.error;
    page = Math.max(1, Math.ceil((head.count || 0) / size));
    ({ data, error, count } = await query(page));
  }
  if (error) throw error;
  const posts = data || [];
  return { posts, page, totalPages: Math.max(1, Math.ceil((count || 0) / size)), thumbnails: await fetchGalleryThumbnails(posts) };
}

/** 대표 사진 → 없으면 첫 사진. 비밀글은 사진을 묻지도 않는다(fetchGalleryThumbnails) */
async function fetchGalleryThumbnails(posts) {
  const ids = posts.filter((p) => p.visibility !== 'secret').map((p) => p.id);
  const thumbs = new Map();
  if (!ids.length) return thumbs;
  const client = await getClient();
  const { data, error } = await client.from('post_gallery_images')
    .select('id, post_id, position, is_primary')
    .in('post_id', ids)
    .order('position', { ascending: true });
  if (error) {
    if (error.code !== 'PGRST205' && error.code !== '42P01') console.error('갤러리 썸네일을 불러오지 못했습니다:', error);
    return thumbs;
  }
  const best = new Map();
  for (const row of data || []) {
    const cur = best.get(row.post_id);
    if (!cur || (row.is_primary && !cur.is_primary) || (row.is_primary === cur.is_primary && row.position < cur.position)) best.set(row.post_id, row);
  }
  best.forEach((row, postId) => thumbs.set(Number(postId), row.id));
  return thumbs;
}

/** 글 한 줄(posts-view-detail.js openPostPage) */
export async function fetchPost(id) {
  const client = await getClient();
  const { data, error } = await client.from('posts')
    .select('id, category_id, user_id, title, content_type, visibility, created_at, quote_preset_id, folder_id')
    .eq('id', Number(id))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 본문 — 공개 글 · 주인만(RLS). 비밀글은 unlockSecretPost */
export async function fetchPostContent(id) {
  const client = await getClient();
  const { data, error } = await client.from('post_contents').select('content').eq('post_id', Number(id)).maybeSingle();
  if (error) throw error;
  return data?.content || '';
}

/**
 * 비밀글 — 비밀번호가 맞으면 본문, 틀리면 null(posts-view-secret-gate.js)
 * 본문에 사진이 있으면 1시간 읽기 표도 받는다(issue_gallery_read_token)
 */
export async function unlockSecretPost(postId, password) {
  const client = await getClient();
  const { data, error } = await client.rpc('get_secret_post_content', { p_post_id: Number(postId), p_password: password });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  let galleryToken = null;
  if (String(row.content || '').includes('/api/post-cover?image=')) {
    const res = await client.rpc('issue_gallery_read_token', { p_post_id: Number(postId), p_password: password });
    if (!res.error && /^[0-9a-f-]{36}$/i.test(res.data || '')) galleryToken = res.data;
    else console.error('비밀글 사진 읽기 표를 받지 못했습니다:', res.error);
  }
  return { content: row.content || '', galleryToken };
}

/** 비밀번호 폴더 — 맞으면 열람 표를 이 브라우저에 둔다(그쪽 core/folder-access.js 의 rememberFolderAccessToken) */
export async function unlockFolder(folderId, password) {
  const client = await getClient();
  const { data: token, error } = await client.rpc('issue_post_folder_token', { p_folder_id: Number(folderId), p_password: password });
  return !error && typeof window.rememberFolderAccessToken === 'function' && window.rememberFolderAccessToken(folderId, token);
}

export const hasFolderToken = (folderId) => typeof window.hasFolderAccessToken === 'function' && window.hasFolderAccessToken(folderId);

// ---------- 폴더 트리(posts-view-folder.js · posts-view-folder-lock.js 와 같은 비교 · 판정) ----------

const sameFolder = (a, b) => (a == null ? b == null : Number(a) === Number(b));
const treeOrder = (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || Number(b.id) - Number(a.id);
const MAX_DEPTH = 3;

export function makeTree({ posts, folders }, { owner }) {
  const find = (id) => (id == null ? null : folders.find((f) => Number(f.id) === Number(id)) || null);
  const children = (parentId) => folders.filter((f) => sameFolder(f.parent_id, parentId)).sort(treeOrder);
  const postsIn = (folderId) => posts.filter((p) => sameFolder(p.folder_id, folderId)).sort(treeOrder);
  const path = (folderId) => {
    const out = [];
    let f = find(folderId);
    while (f && out.length <= MAX_DEPTH) { out.unshift(f); f = find(f.parent_id); }
    return out;
  };
  const hasVisible = (folderId) => postsIn(folderId).length > 0 || children(folderId).some((c) => hasVisible(c.id));
  /** 방문자에게 이 폴더(또는 조상)가 비밀번호로 잠겨 있으면 가장 바깥 잠긴 폴더 */
  const locked = (folderId) => (owner || folderId == null ? null
    : path(folderId).find((f) => (f.visibility || 'public') === 'password' && !hasFolderToken(f.id)) || null);
  /** 그릴 하위 폴더 — 방문자에게는 보이는 글이 있거나 잠긴 것만(비공개 글만 든 폴더는 드러내지 않는다) */
  const visibleChildren = (parentId) => (owner ? children(parentId) : children(parentId).filter((f) => hasVisible(f.id) || locked(f.id)));
  const countIn = (folderId) => postsIn(folderId).length + visibleChildren(folderId).length;
  return { find, children, postsIn, path, locked, visibleChildren, countIn };
}
