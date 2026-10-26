// 글 본문 그리기 — hongjiwon.love 의 공개 글 화면(posts/view/posts-view-detail.js renderPostDetailBody)과 같은 길.
//   그쪽 파일을 같은 판으로 불러(remote.js) 그 함수를 그대로 부른다. 이 파일에는 서식 · 프리셋 규칙을 다시 적지 않는다.
//     richtext  프리셋 고르기(글에 지정된 quote_preset_id → 주인의 사용 중 → 'Vibe' → 기본값, posts-style-preset.js)
//               → renderStyledPostContentInto(정리 · 서식 · 강조 · 대사 · 블록) → 글자 크기 ± (posts-reader-scale.js)
//     html      저장된 HTML 그대로(코드 울타리만 벗긴다) → 화면보다 넓으면 줄인다(posts-view-html-fit.js).
//               이 사이트에서는 shadow root 안에 그린다 — 글에 든 <style> 이 홈 화면에 번지지 않고,
//               창 꾸밈 CSS 도 글 안을 건드리지 않는다. 안쪽에는 그쪽 공개 화면과 같은 바탕 CSS(style.css)를 건다.
//   본문 사진은 /api/post-cover?image=<id>(그쪽 함수)로만 받는다 — images.js 가 주소를 그쪽 도메인으로 바꾼다.

import { loadScripts, loadStyles } from './remote.js';
import { getClient } from './supabase.js';
import { hydrateBodyImages, bodyImageUrl } from './images.js';

// 그쪽 index.html POSTS_MODULE_SCRIPTS 에서 공개 본문에 쓰는 것만 — 순서 그대로(앞 파일의 const 를 뒤 파일이 쓴다)
const RENDER_SCRIPTS = [
  'core/site-config.js',
  'core/font-catalog.js',
  'posts/posts-sanitize.js',
  'posts/posts-format.js',
  'posts/posts-reader-scale.js',
  'posts/style/posts-style-preset.js',
  'posts/style/posts-style-dialogue.js',
  'posts/style/posts-body-layout.js',
  'posts/style/posts-body-blocks.js',
  'posts/style/posts-body-decor.js',
  'posts/style/posts-style-render.js',
  'posts/posts-view-html-fit.js',
];

// 본문 모양(글꼴 여섯 · 본문 공용 · 블록 · 상세 본문 기본값 · 모바일). 전부 .post-* 로만 걸린 규칙이라 홈 화면을 건드리지 않는다
const RENDER_STYLES = [
  'core/fonts.css',
  'posts/posts-body-shared.css',
  'posts/posts-body-blocks.css',
  'posts/posts-list-detail.css',
  'posts/posts-mobile.css',
];

// HTML 글 안쪽 — 그쪽 공개 화면에서 HTML 글이 받는 규칙(style.css 의 * { box-sizing }).
//   글자 크기 · 색 · 줄 간격은 바깥 .post-detail-content(posts-list-detail.css)에서 그대로 물려받는다.
const HTML_POST_STYLES = ['style.css'];
// 그쪽 style.css 의 html, body 글꼴 — shadow root 안에서는 html · body 규칙이 닿지 않아 같은 값을 둔다
const HTML_POST_HOST = ':host { font-family: "Pretendard", sans-serif; }';

// 그쪽 posts-refs.js · posts-state.js 가 두는 전역 — 그쪽 함수가 이 이름으로 찾는다. 창을 열 때 우리 요소를 넣는다
const GLOBAL_SLOTS = [
  'postStyleSettings',
  'postDetailContent', 'postDetailContentWrap',
  'postDetailFontScale', 'postDetailFontScaleDown', 'postDetailFontScaleUp',
  // 에디터 색 견본(setPostStyleSettings 가 있으면 칠한다) — 이 사이트에는 없다
  'postEditorCustomSwatch', 'postEditorFloatingCustomSwatch',
  'postEditorCustomPointSwatch', 'postEditorFloatingCustomPointSwatch',
  'postEditorRuleSwatch', 'postEditorFloatingRuleSwatch',
];

let readyPromise = null;

/** 렌더러 준비 — 처음 글 창을 열 때 한 번 */
export function renderReady() {
  readyPromise ??= (async () => {
    for (const name of GLOBAL_SLOTS) if (!(name in window)) window[name] = null;
    await getClient(); // supabaseClient · getSignedInUser 가 먼저 있어야 프리셋을 받는다
    await Promise.all([loadScripts(RENDER_SCRIPTS), loadStyles(RENDER_STYLES)]);
    // 본문 사진 주소만 그쪽 도메인으로(posts-sanitize.js 가 부를 때마다 이 함수를 찾는다)
    window.buildPostBodyImageUrl = bodyImageUrl;
  })().catch((e) => { readyPromise = null; throw e; });
  return readyPromise;
}

/**
 * 상세 화면 요소를 그쪽 전역 자리에 둔다(글자 크기 ± · HTML 맞춤이 이 이름으로 찾는다)
 * @param {{ content: HTMLElement, wrap: HTMLElement, scale: HTMLElement, down: HTMLButtonElement, up: HTMLButtonElement }} els
 */
export function bindDetail(els) {
  window.postDetailContent = els.content;
  window.postDetailContentWrap = els.wrap;
  window.postDetailFontScale = els.scale;
  window.postDetailFontScaleDown = els.down;
  window.postDetailFontScaleUp = els.up;
}

/** 글자 크기 ± — 그쪽 posts-list-detail-nav.js 의 버튼과 같은 계산 */
export function stepFontScale(dir) {
  const w = window;
  // READER_FONT_SCALE_STEP 은 그쪽 파일의 전역 const(window 속성이 아니다) — 이름으로 바로 찾는다
  // eslint-disable-next-line no-undef
  if (typeof w.setReaderFontScale !== 'function' || typeof READER_FONT_SCALE_STEP !== 'number') return;
  // eslint-disable-next-line no-undef
  w.setReaderFontScale(w.getReaderFontScale() + dir * READER_FONT_SCALE_STEP);
}

/**
 * 글 본문을 그린다 — renderPostDetailBody 와 같은 순서
 * @param {HTMLElement} content  .post-detail-content — 글마다 새 요소(HTML 글은 shadow root 를 붙여서 다시 못 쓴다)
 * @param {{ contentType: string, text: string, presetId: number|null, ownerId: string|null, access: object }} post
 */
export async function renderPostBody(content, { contentType, text, presetId, ownerId, access }) {
  await renderReady();
  const w = window;
  content.replaceChildren();

  if (contentType === 'html') {
    content.classList.add('is-html-content');
    const root = content.shadowRoot || content.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    inner.className = 'hsh-html-post';
    inner.innerHTML = w.stripOuterHtmlCodeFence(text || '');
    const host = document.createElement('style');
    host.textContent = HTML_POST_HOST;
    root.append(host);
    await loadStyles(HTML_POST_STYLES, root);
    root.append(inner);
    hydrateBodyImages(root, access);
    requestAnimationFrame(() => w.fitHtmlContentToWidth(content, content.parentElement));
    w.hideReaderFontScaleControl();
    return;
  }

  content.classList.remove('is-html-content');
  w.resetHtmlPostContentFit();
  // 프리셋은 늘 글 주인의 것 — 보는 사람과 무관(그쪽과 같다)
  if (presetId) await w.loadPostStylePresetById(presetId, ownerId);
  else await w.loadPostStylePreset(ownerId);
  w.renderStyledPostContentInto(content, text || '', w.postStyleSettings || {});
  hydrateBodyImages(content, access);
  w.initReaderFontScaleForCurrentPost();
}

/** 창 크기가 바뀌면 HTML 글 다시 맞추기(그쪽 resize 처리와 같은 함수) */
export function refitHtml(content) {
  if (content?.classList.contains('is-html-content')) window.fitHtmlContentToWidth?.(content, content.parentElement);
}

/** 날짜 · 제목 표시 — 그쪽 posts-format.js(Asia/Seoul) */
export const format = {
  date: (iso) => window.formatPostDetailDate?.(iso) ?? '',
  listDate: (iso) => window.formatPostFinderDate?.(iso) ?? '',
  title: (el, visibility, title) => window.applyPostVisibilityTitle(el, visibility, title),
};
