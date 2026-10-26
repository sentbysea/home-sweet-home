// 글 창의 Quote — 주인만. 발췌 구간 고르기(시작점 · 끝점 버튼) → Quote 화면(quote.html iframe)에서 미리보기 · copy · export.
//   구간 → 원본 HTML 은 hongjiwon.love 의 공용 파일(posts/preview/posts-excerpt-range.js)이 정한다 — 그쪽 에디터도 같은 함수를 쓸 수 있게.
//   이미지 표현(프리셋 · 페이지 · 배경 · 캡처)은 Quote 화면이 그쪽 에디터 코드를 그대로 돌려 만든다(src/quote/studio.js).
//   구간을 고르지 않으면 글 전체 — 그쪽 에디터의 발췌와 같다.

import { loadScripts } from './remote.js';

const RANGE_SCRIPT = 'posts/preview/posts-excerpt-range.js';
let rangeReady = null;

/** 부분 발췌 함수(그쪽 배포에 그 파일이 있어야 한다 — 없으면 글 전체만) */
export function excerptRangeReady() {
  rangeReady ??= loadScripts([RANGE_SCRIPT])
    .then(() => typeof window.createPostExcerptMap === 'function' && typeof window.getPostExcerptHTML === 'function')
    .catch(() => false);
  return rangeReady;
}

/** 탭한 자리 → 본문 안 한 점 */
function pointAt(x, y, content) {
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  return node && content.contains(node) ? { node, offset } : null;
}

const HIGHLIGHT = 'hsh-quote-range';

/**
 * 발췌 구간 고르기 줄 — 본문 위에 붙인다
 * @param {{ content: HTMLElement, text: string, h: Function, onGo: (range: {start:number,end:number}|null) => void, onResize: Function }} o
 */
export function quotePicker({ content, text, h, onGo, onResize }) {
  let armed = null; // 'start' | 'end' | null
  let start = null;
  let end = null;
  let map = null;

  const state = h('p', { class: 'hsh-ct__pick-state', role: 'status' });
  const btn = (pick, label) => h('button', { class: 'hsh-ct__pick-btn', type: 'button', 'data-pick': pick, 'aria-pressed': 'false', text: label });
  const startBtn = btn('start', '시작점');
  const endBtn = btn('end', '끝점');
  const allBtn = btn('all', '글 전체');
  const goBtn = h('button', { class: 'hsh-ct__btn', type: 'button', text: '미리보기 →' });
  const bar = h('div', { class: 'hsh-ct__pick' },
    h('p', { class: 'hsh-ct__pick-hint', text: '발췌할 곳 — 시작점 · 끝점을 누르고 본문에서 그 자리를 탭하세요. 고르지 않으면 글 전체예요.' }),
    h('div', { class: 'hsh-ct__pick-row' }, startBtn, endBtn, allBtn, goBtn),
    state);

  const textOf = (a, b) => {
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  };
  const edges = () => {
    const first = document.createRange();
    first.selectNodeContents(content);
    return { head: { node: first.startContainer, offset: first.startOffset }, tail: { node: first.endContainer, offset: first.endOffset } };
  };
  const ordered = () => {
    const { head, tail } = edges();
    let a = start || head;
    let b = end || tail;
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    if (r.comparePoint(b.node, b.offset) < 0) [a, b] = [b, a];
    return [a, b];
  };

  const paint = () => {
    startBtn.setAttribute('aria-pressed', String(armed === 'start'));
    endBtn.setAttribute('aria-pressed', String(armed === 'end'));
    allBtn.disabled = !start && !end;
    content.classList.toggle('is-picking', Boolean(armed));
    if (CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
    if (!start && !end) {
      state.textContent = '글 전체';
      onResize();
      return;
    }
    const [a, b] = ordered();
    const range = textOf(a, b);
    if (CSS.highlights && window.Highlight) CSS.highlights.set(HIGHLIGHT, new window.Highlight(range));
    const picked = range.toString().replace(/\s+/g, ' ').trim();
    state.textContent = picked
      ? `“${picked.slice(0, 18)}${picked.length > 36 ? ' … ' : ''}${picked.length > 36 ? picked.slice(-14) : picked.slice(18)}” · ${picked.length}자`
      : '고른 곳이 비어 있어요';
    onResize();
  };

  bar.addEventListener('click', (e) => {
    const pick = e.target.closest?.('[data-pick]')?.dataset.pick;
    if (pick === 'start' || pick === 'end') armed = armed === pick ? null : pick;
    if (pick === 'all') { start = end = null; armed = null; }
    paint();
  });

  // 본문 탭 — 고르는 중이면 그 자리를 점으로(사진 크게 보기보다 먼저)
  content.addEventListener('click', (e) => {
    if (!armed) return;
    const p = pointAt(e.clientX, e.clientY, content);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    if (armed === 'start') { start = p; armed = end ? null : 'end'; } else { end = p; armed = null; }
    paint();
  }, true);

  goBtn.addEventListener('click', async () => {
    if (!start && !end) { onGo(null); return; }
    const ok = await excerptRangeReady();
    if (!ok) { onGo(null); return; }
    map ??= window.createPostExcerptMap(content, text);
    const [a, b] = ordered();
    onGo(window.postExcerptRangeFromRendered(map, a, b));
  });

  // 부분 발췌 파일이 없는 판(그쪽 배포 전)이면 글 전체만
  excerptRangeReady().then((ok) => {
    if (ok) return;
    startBtn.disabled = endBtn.disabled = true;
    state.textContent = '글 전체(부분 발췌는 hongjiwon.love 새 배포 뒤에 쓸 수 있어요)';
  });

  paint();
  return {
    bar,
    dispose() {
      if (CSS.highlights) CSS.highlights.delete(HIGHLIGHT);
      content.classList.remove('is-picking');
    },
  };
}

/**
 * Quote 화면 — 같은 출처 iframe(quote.html). 높이는 창 안 고정(content.css), 안쪽이 스크롤한다 —
 * 그쪽 모바일 발췌 칸은 화면 높이(vh) 기준이라 iframe 을 내용에 맞춰 늘이면 서로 키우며 커진다.
 * @param {HTMLElement} host
 * @param {{ contentType: string, html: string, title: string, presetId: number|null, postId: number, viewer: boolean, tint?: string, ink?: string, note?: string }} post
 * @param {() => void} onResize
 */
export function mountQuote(host, post, onResize) {
  const frame = document.createElement('iframe');
  frame.className = 'hsh-ct__quote-frame';
  frame.title = 'Quote 만들기';
  frame.allow = 'clipboard-write; web-share';
  frame.src = new URL('../../quote.html', import.meta.url).href + location.search; // ?content-origin 그대로(로컬 시험)
  host.append(frame);
  frame.addEventListener('load', async () => {
    const win = frame.contentWindow;
    for (let i = 0; i < 200 && !win.hshQuote; i++) await new Promise((r) => setTimeout(r, 50));
    try {
      await win.hshQuote.open(post);
    } catch (e) {
      console.error(e);
    }
    onResize();
  }, { once: true });
  return frame;
}
