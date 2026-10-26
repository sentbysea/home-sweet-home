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
  fitStageToCanvas();
  // 그쪽에서는 글쓰기 화면으로 넘어갈 때 여는 칸들 — 여기서는 처음부터 발췌 칸만
  document.getElementById('postArea').hidden = false;
  document.getElementById('postEditor').hidden = false;
  boot.remove();
}

/* global editorPreviewPages, editorPreviewPageIndex */

/**
 * 대지 높이를 캔버스 비율에 맞춘다 — 가로로 긴 캔버스 위아래에 빈 대지가 남지 않게.
 * 그쪽 applyEditorPreviewScale 은 대지 clientWidth · clientHeight 안에 캔버스를 맞춰 줄이므로(object-fit: contain),
 * 그 직전에 대지 높이를 "폭에 맞춘 캔버스 높이"(최대 --hsh-q-stage)로 정해 둔다. 캔버스 · 캡처는 건드리지 않는다.
 */
function fitStageToCanvas() {
  const scale = window.applyEditorPreviewScale;
  if (typeof scale !== 'function') return;
  window.applyEditorPreviewScale = function applyEditorPreviewScaleFitted(...args) {
    const stage = document.getElementById('postEditorPreviewStage');
    const page = editorPreviewPages?.[editorPreviewPageIndex] || editorPreviewPages?.[0];
    if (stage && page?.offsetHeight) {
      const cs = getComputedStyle(stage);
      const frame = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const max = parseFloat(getComputedStyle(document.body).getPropertyValue('--hsh-q-stage')) || 520;
      const wide = Math.min(1, stage.clientWidth / 520); // 그쪽 캔버스 폭 520 고정
      const inner = Math.min(max - frame, Math.ceil(page.offsetHeight * wide));
      stage.style.setProperty('height', `${Math.round(inner + frame)}px`, 'important');
    }
    return scale.apply(this, args);
  };
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

let presetPick = null; // 맨 위 preset 드롭다운(presetRow)

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
  presetRow(post.presetId);
  openEditorPreview();
  await updateEditorPreview();
}

/**
 * 설정 줄 맨 위 — preset 드롭다운. 목록은 그쪽 에디터의 프리셋 칸(postEditorPresetSelect)을 그대로 옮겨 온다.
 * 고르면 그쪽 에디터가 프리셋을 고를 때와 같은 함수로 미리보기만 바꾼다 — 글에 저장하지 않는다(이번 발췌에만).
 */
function presetRow(presetId) {
  if (!postEditorPresetSelect) return;
  if (!presetPick) {
    const row = document.createElement('div');
    row.className = 'post-editor-preview-subrow hsh-quote__preset';
    const label = document.createElement('span');
    label.className = 'post-editor-preview-subrow-label';
    label.textContent = 'preset';
    presetPick = document.createElement('select');
    presetPick.className = 'post-editor-preview-select';
    presetPick.setAttribute('aria-label', '이번 발췌의 프리셋');
    presetPick.addEventListener('change', async () => {
      postEditorPresetSelect.value = presetPick.value;
      await applyPostPresetById(presetPick.value);
    });
    row.append(label, presetPick);
    const first = document.getElementById('postEditorPreviewAlignRow');
    if (first) first.before(row);
    else document.getElementById('postEditorPreviewSection')?.prepend(row);
  }
  presetPick.replaceChildren(...[...postEditorPresetSelect.options].map((o) => new Option(o.textContent, o.value)));
  presetPick.value = presetId ? String(presetId) : '';
}

window.hshQuote = { open, ready };
