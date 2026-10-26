// Quote 화면(quote.html) — hongjiwon.love 에디터의 발췌 미리보기 · copy · export 를 같은 판 그대로 돌린다.
//   다시 만든 것은 없다. 그쪽 공개 화면(index.html)이 쓰는 CSS · posts 스크립트 목록 · posts.html 마크업을 받아
//   이 문서에 그대로 깔고, 그쪽 에디터가 글을 열 때와 같은 순서로 함수를 부른다:
//     setEditorContentMode → setRichEditorContent(본문 또는 발췌 구간) → 제목 → prepareEditorUI(프리셋 · 세션 초기화 ·
//     미리보기) → applyPostPresetById(글에 지정된 프리셋) → openEditorPreview
//   그래서 페이지 나누기 · 프리셋 · 배경 · 사진 굳히기 · html2canvas 캡처 · 파일 이름이 그쪽과 같다.
//   보이는 것은 에디터의 발췌 칸과 copy · export 버튼뿐(quote.css) — 조작 칸 모양만 바이브.me 로 입힌다.
//   저장(save) · 임시저장은 부르지 않는다(임시저장은 에디터를 열 때 시작하는 세션이 있어야 돈다 — beginDraftSession).
//   본문 사진: 그쪽 /api/post-cover 로 — 이 도메인은 그쪽 쿠키를 못 두므로 같은 값을 머리글로 싣는다(content/images.js).

import { ORIGIN, buildVersion, loadScripts, loadStyles } from '../content/remote.js';
import { getClient, SUPABASE_URL, SUPABASE_KEY } from '../content/supabase.js';
import { bodyImageUrl, coverHeaders } from '../content/images.js';

// 그쪽 index.html 에서 이 화면이 쓰지 않는 것 — 공개 홈 화면(하트 · 메뉴 · BGM) · 주소 라우터 · footer · 방문 집계
const SKIP = ['script.js', 'site-footer.js', 'core/site-analytics.js', 'posts/editor/posts-router-init.js'];

const boot = document.querySelector('.hsh-quote__boot');
let access = {}; // 지금 글의 사진 열람 조건(coverHeaders)

/** 그쪽 문서 안 배열 리터럴(이름 = [ "..." ] 또는 함수([ "..." ])) → 그쪽 루트 기준 경로 */
function arrayAfter(doc, marker) {
  // 이름 앞이 글자가 아니어야 한다 — preloadVersionedScripts( 안의 loadVersionedScripts( 를 잡지 않게
  const re = new RegExp(`(^|[^A-Za-z_$])${marker.replace(/[()]/g, '\\$&')}`);
  const code = [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent).find((c) => re.test(c));
  if (!code) return [];
  const match = re.exec(code);
  const from = match.index + match[0].length;
  const array = code.slice(code.indexOf('[', from), code.indexOf(']', from) + 1).replace(/\/\*[\s\S]*?\*\//g, '');
  return [...array.matchAll(/"([^"]+)"/g)].map(([, p]) => new URL(p, `${ORIGIN}/`).pathname.slice(1));
}

async function fetchText(paths) {
  for (const path of paths) {
    const res = await fetch(path, { credentials: 'omit' });
    if (res.ok) return res.text();
  }
  throw new Error(paths[0]);
}

// 사진 요청에만 열람 표를 싣는다(그쪽 posts-preview-images.js 의 fetch(buildPostBodyImageUrl(id)))
const plainFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.startsWith(`${ORIGIN}/api/post-cover?`)) return plainFetch(input, init);
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(await coverHeaders(access))) headers.set(k, v);
  return plainFetch(input, { ...init, headers, credentials: 'omit' });
};

async function start() {
  const [indexHtml, version] = await Promise.all([fetchText([`${ORIGIN}/?t=${Date.now()}`]), buildVersion(), getClient()]);
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
  const styles = arrayAfter(doc, 'loadVersionedStyles(');
  const core = arrayAfter(doc, 'loadVersionedScripts(');
  const posts = arrayAfter(doc, 'POSTS_MODULE_SCRIPTS =');
  if (!posts.length) throw new Error('posts module list');

  // 그쪽 script.js 가 두는 값 — posts 스크립트가 이 이름으로 찾는다
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  const ver = encodeURIComponent(version);
  const [markup] = await Promise.all([
    // 그쪽은 확장자 없는 주소로 받는다(Pages 가 .html 을 308 로 돌린다) — 로컬 정적 서버용으로 .html 도
    fetchText([`${ORIGIN}/posts/posts?v=${ver}`, `${ORIGIN}/posts/posts.html?v=${ver}`]),
    loadStyles(styles),
  ]);
  // 바이브.me 모양은 그쪽 CSS 뒤에
  await loadLocalStyle(new URL('../styles/quote.css', import.meta.url).href);
  document.getElementById('postsMount').innerHTML = markup;

  await loadScripts([...core, ...posts].filter((p) => !SKIP.includes(p)));
  window.buildPostBodyImageUrl = bodyImageUrl; // 본문 사진 주소만 그쪽 도메인으로
  // 그쪽에서는 글쓰기 화면으로 넘어갈 때 여는 칸들 — 여기서는 처음부터 발췌 칸만
  document.getElementById('postArea').hidden = false;
  document.getElementById('postEditor').hidden = false;
  boot.remove();
}

function loadLocalStyle(href) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = resolve;
    document.head.append(link);
  });
}

const ready = start();
ready.catch((e) => {
  console.error(e);
  boot.textContent = 'Quote 화면을 불러오지 못했어요. 창을 닫았다 다시 열어 주세요.';
});

/* global setEditorContentMode, setRichEditorContent, postEditorTitle, postEditorHtmlContent, postEditorPresetSelect,
   prepareEditorUI, applyPostPresetById, loadPostPresetOptions, openEditorPreview, updateEditorPreview */

/**
 * 글 창이 부른다(같은 출처 iframe — contentWindow.hshQuote.open)
 * @param {{ contentType: string, html: string, title: string, presetId: number|null, postId: number, viewer: boolean }} post
 *   html — 발췌할 본문(구간을 골랐으면 그 구간의 원본 HTML, 아니면 글 전체)
 */
async function open(post) {
  await ready;
  access = { postIds: [post.postId], viewer: post.viewer };
  // 조작 칸 색 = 글 창을 연 버튼 색(quote.css 의 --hsh-q-tint · --hsh-q-ink)
  if (post.tint) document.body.style.setProperty('--hsh-q-tint', post.tint);
  if (post.ink) document.body.style.setProperty('--hsh-q-ink', post.ink);
  showNote(post.note || '');
  const html = post.contentType === 'html';
  // 그쪽 에디터의 글 열기(posts-view-editor-load.js)와 같은 순서
  if (typeof loadPostPresetOptions === 'function') await loadPostPresetOptions();
  setEditorContentMode(html ? 'html' : 'richtext');
  if (html) postEditorHtmlContent.value = post.html || '';
  else setRichEditorContent(post.html || '');
  postEditorTitle.value = post.title || '';
  await prepareEditorUI();
  if (post.presetId) {
    if (postEditorPresetSelect) postEditorPresetSelect.value = String(post.presetId);
    await applyPostPresetById(post.presetId);
  } else if (postEditorPresetSelect) {
    postEditorPresetSelect.value = '';
  }
  openEditorPreview();
  await updateEditorPreview();
}

/** 발췌 칸 위 한 줄 — 고른 구간 · 글 전체 */
function showNote(text) {
  let note = document.querySelector('.hsh-quote__range');
  if (!note) {
    note = document.createElement('p');
    note.className = 'hsh-quote__range';
    document.getElementById('postEditorPreviewSection')?.before(note);
  }
  note.textContent = text;
  note.hidden = !text;
}

window.hshQuote = { open, ready };
