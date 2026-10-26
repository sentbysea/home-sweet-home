// 본문 · 갤러리 사진 — 파일은 비공개 버킷(post-covers)에 있고 hongjiwon.love 의 /api/post-cover?image=<id> 만 내준다.
//   그 함수가 요청마다 DB 에 "지금 볼 수 있나"를 묻는다(공개 글 / 주인 / 비밀번호를 맞힌 읽기 표 / 열린 폴더).
//   · 공개 글 사진  — <img src="https://hongjiwon.love/api/post-cover?image=…"> 그대로(인증 없음)
//   · 그 밖(비밀글 · 비밀번호 폴더 · 주인이 보는 비공개 글) — 그쪽은 쿠키로 표를 받는데 이 도메인은 그 쿠키를 둘 수 없다.
//     같은 값을 머리글로 실어 fetch 로 받아 blob 주소로 그린다(그쪽 functions/api/post-cover.js 가 이 출처에 CORS 를 연다).
//     그쪽 배포 전이라 CORS 가 없으면 평범한 주소로 되돌린다 — 공개 사진은 보이고, 잠긴 사진만 빈칸.
//   표 · 토큰은 주소에 싣지 않는다(링크 · Referer 로 새지 않게).

import { ORIGIN } from './remote.js';
import { accessToken } from './supabase.js';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GALLERY_KEY = 'hsh:gallery-access'; // 비밀글 사진 읽기 표 { [postId]: { token, expiresAt } } — 그쪽 쿠키처럼 1시간
const GALLERY_TTL = 60 * 60 * 1000;
const memory = {}; // 저장이 막힌 브라우저에서도 이번 화면 동안은

export const bodyImageUrl = (id) => `${ORIGIN}/api/post-cover?image=${encodeURIComponent(id)}`;

function readGallery() {
  try {
    const all = JSON.parse(sessionStorage.getItem(GALLERY_KEY)) || {};
    return Object.fromEntries(Object.entries(all).filter(([, v]) => ID.test(v?.token || '') && v.expiresAt > Date.now()));
  } catch { return {}; }
}

/** 비밀번호를 맞힌 비밀글의 사진 읽기 표(issue_gallery_read_token) — 이 탭에 1시간 */
export function rememberGalleryToken(postId, token) {
  if (!ID.test(token || '')) return;
  const all = readGallery();
  all[Number(postId)] = { token, expiresAt: Date.now() + GALLERY_TTL };
  try { sessionStorage.setItem(GALLERY_KEY, JSON.stringify(all)); } catch { /* 이번 화면만 */ }
  memory[Number(postId)] = token;
}

function galleryHeader(postIds) {
  const saved = readGallery();
  return postIds
    .map((id) => saved[id]?.token || memory[id])
    .filter(Boolean)
    .slice(0, 32)
    .join(',');
}

const objectUrls = new Set();
/** 창을 닫거나 다른 글로 가면 지난 blob 주소를 놓아준다 */
export function releaseImages() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls.clear();
}

/**
 * /api/post-cover 요청에 실을 머리글 — 그쪽 쿠키(imory_cover_at · imory_gallery_* · imory_folder_*)와 같은 값.
 * 없으면 빈 객체(공개 사진은 머리글 없이 받는다). Quote 화면(src/quote/studio.js)도 같은 값을 쓴다.
 * @param {{ postIds?: number[], viewer?: boolean }} access
 */
export async function coverHeaders(access = {}) {
  const headers = {};
  const folders = typeof window.getFolderAccessHeaderValue === 'function' ? window.getFolderAccessHeaderValue() : '';
  const gallery = galleryHeader(access.postIds || []);
  const token = access.viewer ? await accessToken() : null;
  if (folders) headers['X-Imory-Folder-Access'] = folders;
  if (gallery) headers['X-Imory-Gallery-Access'] = gallery;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * root 안의 사진(<img data-imory-image>)을 그쪽 주소로 받는다
 * @param {ParentNode} root
 * @param {{ postIds?: number[], viewer?: boolean }} access  postIds — 이 사진들이 든 글(비밀글 읽기 표를 찾는다), viewer — 로그인한 사람이 보고 있다
 */
export async function hydrateBodyImages(root, access = {}) {
  const imgs = [...root.querySelectorAll('img[data-imory-image]')].filter((img) => ID.test(img.dataset.imoryImage));
  if (!imgs.length) return;
  const headers = await coverHeaders(access);

  for (const img of imgs) {
    const url = bodyImageUrl(img.dataset.imoryImage);
    img.decoding = 'async';
    if (!Object.keys(headers).length) {
      img.src = url;
      continue;
    }
    img.removeAttribute('src'); // 머리글 없이 먼저 나간 요청(404)이 깨진 그림으로 남지 않게
    fetch(url, { headers, credentials: 'omit' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        objectUrls.add(u);
        img.src = u;
      })
      .catch(() => { img.src = url; }); // CORS 전 · 권한 없음 — 공개 사진이면 이 주소로 보인다
  }
}
