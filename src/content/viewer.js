// 글 · 갤러리 · 메모 창 안쪽 — 목록 → 글. 방 창(plan/room-window.js)의 스크롤 칸 안에 그린다.
//   데이터는 hongjiwon.love 원본(data.js), 본문은 그쪽 렌더러(render.js) — 이 파일은 바이브.me 모양만 맡는다.
//   화면 하나 = 상태 하나 { cat, look, view: 'list' | 'gallery' | 'post', folder, page, post, nav, back }.
//   다른 화면으로 갈 때마다 onNavigate(상태)로 창 기록을 한 칸 쌓는다 — < > · 휴대폰 뒤로 가기가 목록 ↔ 글을 오간다.
//   모양(look): 버튼의 data-look 이 정한다. 없으면 카테고리 유형으로 — gallery → 'gallery', 나머지 → 'log'.
//     'memo' 는 같은 목록을 짧은 쪽지처럼 그린다(데이터 · 순서 · 공개 범위는 같다).

import { renderReady, renderPostBody, bindDetail, stepFontScale, format } from './render.js';
import {
  fetchCategory, viewerOf, fetchCategoryTree, fetchGalleryPage, fetchPost, fetchPostContent,
  unlockSecretPost, unlockFolder, makeTree,
} from './data.js';
import { hydrateBodyImages, releaseImages, rememberGalleryToken } from './images.js';
import { ORIGIN } from './remote.js';

const PAGER_WINDOW = 5; // posts-view-gallery.js GALLERY_PAGER_WINDOW

/** 작은 DOM 도우미 — 글자는 늘 textContent 로 */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v; // 이 파일의 고정 그림(SVG)만
    else if (k.startsWith('data-')) el.setAttribute(k, v === true ? '' : v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}

/** 있는 것만 붙인다(없으면 null 을 돌려주는 조각용) */
function put(parent, ...kids) {
  parent.append(...kids.filter((k) => k != null && k !== false));
}

// 손그림 아이콘 — 홈 화면 선과 같은 얇은 회색(room.css 의 --hsh-win-line)
const ICON = {
  folder: '<svg viewBox="0 0 48 38" aria-hidden="true"><path class="f" d="M3.5 7.2c0-1.9 1.2-3.1 3-3.1h11.3c1.2 0 1.9.5 2.6 1.5l2 2.6h18.9c1.9 0 3.1 1.2 3.1 3v20.6c0 1.9-1.2 3.1-3.1 3.1H6.6c-1.9 0-3.1-1.2-3.1-3.1z"/><path d="M3.8 12.6h40.4"/></svg>',
  paper: '<svg viewBox="0 0 24 28" aria-hidden="true"><path class="f" d="M4 2.6h11.2l5 5.1v17.6H4z"/><path d="M15.2 2.6v5.1h5M7.6 13h9M7.6 17h9M7.6 21h6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="f" x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/><circle cx="12" cy="15.4" r="1.3"/></svg>',
  photo: '<svg viewBox="0 0 40 32" aria-hidden="true"><rect class="f" x="3" y="4" width="34" height="24" rx="2"/><path d="M3 23l9-8 7 6 5-4 13 10"/><circle cx="27.5" cy="11.5" r="2.6"/></svg>',
};

export function mountContent(root, { onNavigate = () => {}, onResize = () => {}, onTitle = () => {} } = {}) {
  root.classList.add('hsh-ct');
  let state = null;
  let seq = 0; // 늦게 온 응답은 버린다
  const categories = new Map(); // ref → 카테고리 행(창을 닫아도 둔다 — 이름 · 유형은 잘 안 바뀐다)
  const trees = new Map(); // 카테고리 id → { posts, folders } — 창을 다시 열 때 · 폴더를 열 때 새로 받는다

  new ResizeObserver(() => onResize()).observe(root);

  const go = (next) => {
    state = next;
    onNavigate(next);
    render(next);
  };

  const status = (text, retry) => {
    root.replaceChildren(h('div', { class: 'hsh-ct__state', role: 'status' },
      h('p', { text }),
      retry && h('button', { class: 'hsh-ct__btn is-ghost', type: 'button', text: '다시 불러오기', onclick: () => render(state, { fresh: true }) })));
    onResize();
  };

  const loading = () => {
    root.replaceChildren(h('div', { class: 'hsh-ct__state is-loading', role: 'status' },
      h('p', {}, '불러오는 중', h('span', { class: 'hsh-ct__dots', 'aria-hidden': 'true', text: '...' }))));
    onResize();
  };

  async function categoryOf(ref) {
    if (!categories.has(String(ref))) categories.set(String(ref), await fetchCategory(ref));
    return categories.get(String(ref));
  }

  async function treeOf(category, fresh) {
    if (fresh || !trees.has(category.id)) trees.set(category.id, await fetchCategoryTree(category.id));
    return trees.get(category.id);
  }

  async function render(s, { fresh = false } = {}) {
    const my = ++seq;
    const stale = () => my !== seq;
    releaseImages();
    loading();
    try {
      await renderReady();
      const category = await categoryOf(s.cat);
      if (stale()) return;
      if (!category) { onTitle(''); status('찾을 수 없는 카테고리예요.'); return; }
      const look = s.look || (category.type === 'gallery' ? 'gallery' : 'log');
      root.dataset.look = look;
      root.dataset.view = s.view;
      const who = await viewerOf(category);
      if (stale()) return;
      if (category.type === 'banner') {
        onTitle(category.name);
        status('배너 모음은 neighbor 방에서 볼 수 있어요.');
        return;
      }
      if (s.view === 'post') await renderPost(s, category, who, stale);
      else if (category.type === 'gallery') await renderGallery(s, category, who, stale);
      else await renderList(s, category, who, stale, fresh);
    } catch (e) {
      if (stale()) return;
      console.error(e);
      status('불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.', true);
    }
  }

  // ---------- 목록(일반 · 메모) ----------

  async function renderList(s, category, who, stale, fresh) {
    const data = await treeOf(category, fresh || s.fresh);
    if (stale()) return;
    const tree = makeTree(data, who);
    const folder = tree.find(s.folder);
    const trail = tree.path(s.folder);
    onTitle(category.name, trail.map((f) => f.name));

    const page = h('div', { class: 'hsh-ct__list' });
    put(page, crumbs(category, trail, s));

    const lockedBy = tree.locked(s.folder);
    if (lockedBy) {
      page.append(folderGate(lockedBy, s, category));
      root.replaceChildren(page);
      return;
    }

    if (folder) {
      page.append(h('div', { class: 'hsh-ct__folder-head' },
        h('p', { class: 'hsh-ct__kicker', text: 'FOLDER' }),
        h('h3', { class: 'hsh-ct__folder-title', text: folder.name }),
        h('button', { class: 'hsh-ct__link', type: 'button', text: '↑ UP', onclick: () => go({ ...s, folder: folder.parent_id ?? null, view: 'list' }) })));
    }

    const subfolders = tree.visibleChildren(s.folder);
    const posts = tree.postsIn(s.folder);
    if (!subfolders.length && !posts.length) {
      page.append(h('p', { class: 'hsh-ct__empty', text: s.folder ? '이 폴더는 비어 있어요.' : '아직 기록이 없어요.' }));
      root.replaceChildren(page);
      onResize();
      return;
    }

    if (subfolders.length) {
      page.append(h('ul', { class: 'hsh-ct__folders' }, subfolders.map((f) => {
        const vis = f.visibility || 'public';
        return h('li', {}, h('button', { class: 'hsh-ct__folder', type: 'button', onclick: () => go({ ...s, folder: f.id, view: 'list' }) },
          h('span', { class: 'hsh-ct__icon is-folder', html: ICON.folder }),
          h('span', { class: 'hsh-ct__folder-name', text: f.name }),
          vis !== 'public' && h('span', { class: 'hsh-ct__mark', text: vis === 'private' ? '나만 보기' : '🔒', title: vis === 'private' ? '나만 보기 폴더' : '비밀번호 폴더' }),
          h('span', { class: 'hsh-ct__count', text: tree.locked(f.id) ? 'LOCKED' : `${tree.countIn(f.id)} ITEMS` })));
      })));
    }

    if (posts.length) {
      const nav = posts.map((p) => p.id);
      const back = { view: 'list', folder: s.folder ?? null };
      const memo = root.dataset.look === 'memo';
      page.append(h('ul', { class: memo ? 'hsh-ct__memos' : 'hsh-ct__rows' }, posts.map((p, i) => {
        const title = h('span', { class: 'hsh-ct__row-title' });
        format.title(title, p.visibility, p.title);
        return h('li', memo ? { style: `--tilt:${[-1.4, 0.9, -0.6, 1.3][i % 4]}deg` } : {},
          h('button', { class: memo ? 'hsh-ct__memo' : 'hsh-ct__row', type: 'button', onclick: () => go({ ...s, view: 'post', post: p.id, nav, back }) },
            !memo && h('span', { class: 'hsh-ct__icon is-paper', html: ICON.paper }),
            title,
            h('time', { class: 'hsh-ct__date', dateTime: p.created_at, text: format.listDate(p.created_at) })));
      })));
    }
    root.replaceChildren(page);
    onResize();
  }

  function crumbs(category, trail, s) {
    if (!trail.length) return null;
    const bar = h('nav', { class: 'hsh-ct__crumbs', 'aria-label': '위치' });
    bar.append(h('button', { type: 'button', text: category.name, onclick: () => go({ ...s, folder: null, view: 'list' }) }));
    trail.forEach((f, i) => {
      bar.append(h('span', { class: 'hsh-ct__sep', 'aria-hidden': 'true', text: '›' }));
      bar.append(i === trail.length - 1
        ? h('span', { 'aria-current': 'page', text: f.name })
        : h('button', { type: 'button', text: f.name, onclick: () => go({ ...s, folder: f.id, view: 'list' }) }));
    });
    return bar;
  }

  function gate({ label, onSubmit }) {
    const input = h('input', { class: 'hsh-ct__input', type: 'password', autocomplete: 'off', required: true, 'aria-label': '비밀번호' });
    const msg = h('p', { class: 'hsh-ct__gate-msg', role: 'alert' });
    const btn = h('button', { class: 'hsh-ct__btn', type: 'submit', text: '열기' });
    const form = h('form', { class: 'hsh-ct__gate', novalidate: true },
      h('span', { class: 'hsh-ct__icon is-lock', html: ICON.lock }),
      h('p', { class: 'hsh-ct__gate-label', text: label }),
      h('div', { class: 'hsh-ct__gate-row' }, input, btn),
      msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!input.value) { input.focus(); return; }
      btn.disabled = true;
      msg.textContent = '';
      const ok = await onSubmit(input.value).catch(() => false);
      btn.disabled = false;
      if (!ok) { msg.textContent = '비밀번호가 일치하지 않습니다.'; input.select(); }
    });
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
    return form;
  }

  function folderGate(folder, s, category) {
    return gate({
      label: Number(folder.id) === Number(s.folder) ? '비밀번호를 입력하면 이 폴더의 글을 볼 수 있습니다.' : `'${folder.name}' 폴더의 비밀번호를 입력해 주세요.`,
      onSubmit: async (pw) => {
        if (!(await unlockFolder(folder.id, pw))) return false;
        trees.delete(category.id); // 이제 RLS 가 안의 글을 준다 — 다시 받는다
        render(s, { fresh: true });
        return true;
      },
    });
  }

  // ---------- 갤러리 ----------

  async function renderGallery(s, category, who, stale) {
    const res = await fetchGalleryPage(category, s.page || 1);
    if (stale()) return;
    onTitle(category.name, res.totalPages > 1 ? [`${res.page} / ${res.totalPages}`] : []);
    const page = h('div', { class: 'hsh-ct__gallery' });
    if (!res.posts.length) {
      page.append(h('p', { class: 'hsh-ct__empty', text: '아직 사진이 없어요.' }));
      root.replaceChildren(page);
      onResize();
      return;
    }
    const nav = res.posts.map((p) => p.id);
    const back = { view: 'gallery', page: res.page };
    const grid = h('ul', { class: 'hsh-ct__grid' }, res.posts.map((p, i) => {
      const secret = p.visibility === 'secret';
      const imageId = !secret && res.thumbnails.get(Number(p.id));
      const title = h('span', { class: 'hsh-ct__card-title' });
      format.title(title, p.visibility, p.title);
      return h('li', { style: `--tilt:${[-1.2, 0.8, -0.4, 1.1, -0.9, 0.5][i % 6]}deg` },
        h('button', { class: 'hsh-ct__card', type: 'button', onclick: () => go({ ...s, view: 'post', post: p.id, nav, back }) },
          h('span', { class: `hsh-ct__ph${secret ? ' is-locked' : imageId ? '' : ' is-empty'}` },
            secret ? h('span', { class: 'hsh-ct__icon is-lock', html: ICON.lock })
              : imageId ? h('img', { alt: '', loading: 'lazy', 'data-imory-image': imageId })
                : h('span', { class: 'hsh-ct__icon is-photo', html: ICON.photo })),
          title));
    }));
    page.append(grid);
    hydrateBodyImages(grid, { viewer: Boolean(who.user) });
    grid.querySelectorAll('img').forEach((img) => img.addEventListener('load', onResize, { once: true }));
    if (res.totalPages > 1) put(page, pager(res.page, res.totalPages, (n) => go({ ...s, view: 'gallery', page: n })));
    root.replaceChildren(page);
    onResize();
  }

  function pager(current, total, to) {
    const half = Math.floor(PAGER_WINDOW / 2);
    const start = Math.max(1, Math.min(current - half, total - PAGER_WINDOW + 1));
    const end = Math.min(total, start + PAGER_WINDOW - 1);
    const nums = [];
    for (let n = start; n <= end; n++) {
      nums.push(n === current
        ? h('span', { class: 'hsh-ct__page is-current', 'aria-current': 'page', text: String(n) })
        : h('button', { class: 'hsh-ct__page', type: 'button', text: String(n), onclick: () => to(n) }));
    }
    return h('nav', { class: 'hsh-ct__pager', 'aria-label': '페이지' },
      h('button', { class: 'hsh-ct__page', type: 'button', text: '‹', 'aria-label': '이전 페이지', disabled: current <= 1, onclick: () => to(current - 1) }),
      nums,
      h('button', { class: 'hsh-ct__page', type: 'button', text: '›', 'aria-label': '다음 페이지', disabled: current >= total, onclick: () => to(current + 1) }));
  }

  // ---------- 글 ----------

  async function renderPost(s, category, who, stale) {
    const post = await fetchPost(s.post);
    if (stale()) return;
    // 다른 카테고리의 글 번호가 섞여 들어와도 이 창에서는 열지 않는다
    if (!post || Number(post.category_id) !== Number(category.id)) {
      onTitle(category.name);
      status('볼 수 없는 글이에요. 지워졌거나 공개 범위가 바뀌었을 수 있어요.');
      return;
    }
    const data = category.type === 'gallery' ? null : await treeOf(category).catch(() => null);
    if (stale()) return;
    const tree = data && makeTree(data, who);
    const folder = tree?.find(post.folder_id);
    onTitle(category.name, [...(tree ? tree.path(post.folder_id).map((f) => f.name) : []), post.title || '']);

    // 잠긴 폴더 안의 글로 바로 들어왔다 — 폴더 비밀번호부터(RLS 가 글 행을 안 줬으면 위에서 이미 '볼 수 없는 글')
    const lockedBy = tree?.locked(post.folder_id);
    if (lockedBy) {
      root.replaceChildren(h('div', { class: 'hsh-ct__list' }, folderGate(lockedBy, s, category)));
      return;
    }

    const backState = s.back || (category.type === 'gallery' ? { view: 'gallery', page: 1 } : { view: 'list', folder: post.folder_id ?? null });
    const backLabel = backState.view === 'list' && folder && Number(backState.folder) === Number(folder.id) ? folder.name : category.name;

    const title = h('h3', { class: 'hsh-ct__post-title' });
    format.title(title, post.visibility, post.title);
    const down = h('button', { class: 'hsh-ct__scale-btn', type: 'button', 'aria-label': '글자 작게', text: '−', onclick: () => stepFontScale(-1) });
    const up = h('button', { class: 'hsh-ct__scale-btn', type: 'button', 'aria-label': '글자 크게', text: '+', onclick: () => stepFontScale(1) });
    const scale = h('span', { class: 'hsh-ct__scale', hidden: true }, down, up);
    const content = h('div', { class: 'post-detail-content' });
    const wrap = h('div', { class: 'post-detail-content-wrap' }, content);
    const sheet = h('div', { class: 'hsh-ct__sheet' }, wrap);

    const article = h('article', { class: 'hsh-ct__post' },
      h('button', { class: 'hsh-ct__back', type: 'button', onclick: () => go({ ...s, ...backState, post: null, nav: null, back: null }) },
        h('span', { 'aria-hidden': 'true', text: '← ' }), backLabel),
      h('header', { class: 'hsh-ct__post-head' },
        title,
        h('p', { class: 'hsh-ct__post-meta' },
          h('time', { dateTime: post.created_at, text: format.date(post.created_at) }),
          scale)),
      sheet,
      postNav(s, post));
    if (who.owner) {
      // 글쓰기 · 고치기 · 지우기는 hongjiwon.love 에서(에디터 · Quote 발췌는 그쪽에만 있다)
      article.append(h('a', { class: 'hsh-ct__owner', href: `${ORIGIN}/post/${post.id}`, target: '_blank', rel: 'noopener', text: 'hongjiwon.love 에서 고치기 ↗' }));
    }
    root.replaceChildren(article);
    bindDetail({ content, wrap, scale, down, up });
    sheet.addEventListener('click', zoomImage);

    const access = { postIds: [post.id], viewer: Boolean(who.user) };
    const draw = async (text) => {
      await renderPostBody(content, { contentType: post.content_type, text, presetId: post.quote_preset_id, ownerId: post.user_id, access });
      (content.shadowRoot || content).querySelectorAll('img').forEach((img) => img.addEventListener('load', onResize, { once: true }));
      onResize();
    };

    if (post.visibility === 'secret' && !who.owner) {
      // 비밀번호를 맞히기 전엔 본문을 요청하지 않는다(그쪽과 같다)
      wrap.hidden = true;
      sheet.append(gate({
        label: '비밀글입니다. 비밀번호를 입력해 주세요.',
        onSubmit: async (pw) => {
          const res = await unlockSecretPost(post.id, pw);
          if (!res) return false;
          if (res.galleryToken) rememberGalleryToken(post.id, res.galleryToken);
          sheet.querySelector('.hsh-ct__gate')?.remove();
          wrap.hidden = false;
          await draw(res.content);
          return true;
        },
      }));
      onResize();
      return;
    }
    const text = await fetchPostContent(post.id);
    if (stale()) return;
    await draw(text);
  }

  // 같은 목록(폴더 · 갤러리 페이지) 안의 이전 · 다음 글 — 목록에서 열었을 때만 순서를 안다
  function postNav(s, post) {
    const ids = Array.isArray(s.nav) ? s.nav : [];
    const i = ids.findIndex((id) => Number(id) === Number(post.id));
    if (i < 0 || ids.length < 2) return null;
    const to = (id) => go({ ...s, post: id });
    return h('nav', { class: 'hsh-ct__post-nav', 'aria-label': '이전 · 다음 글' },
      h('button', { class: 'hsh-ct__link', type: 'button', text: '← prev', disabled: i <= 0, onclick: () => to(ids[i - 1]) }),
      h('span', { class: 'hsh-ct__post-pos', text: `${i + 1} / ${ids.length}` }),
      h('button', { class: 'hsh-ct__link', type: 'button', text: 'next →', disabled: i >= ids.length - 1, onclick: () => to(ids[i + 1]) }));
  }

  // 본문 사진을 누르면 창 안에서 크게(갤러리 감상) — 누르거나 Esc 로 닫는다
  function zoomImage(e) {
    const img = e.target.closest?.('img');
    if (!img || !img.src) return;
    const big = h('button', { class: 'hsh-ct__zoom', type: 'button', 'aria-label': '크게 보기 닫기' }, h('img', { src: img.src, alt: img.alt || '' }));
    const close = () => { big.remove(); document.removeEventListener('keydown', esc, true); };
    const esc = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    big.addEventListener('click', close);
    document.addEventListener('keydown', esc, true);
    root.closest('.hsh-win__frame')?.append(big);
    big.focus({ preventScroll: true });
  }

  return {
    /** 버튼에서 처음 열 때의 상태 */
    initial({ category, look }) {
      trees.clear(); // 다시 열면 새 목록(원본이 바뀌었을 수 있다)
      return { cat: category, look: look || null, view: 'list', folder: null, page: 1, post: null };
    },
    /** 기록에서 돌아온 상태 · 처음 상태를 그린다 */
    show(s) {
      state = s;
      return render(s);
    },
    close() {
      seq++;
      releaseImages();
      root.closest('.hsh-win__frame')?.querySelector('.hsh-ct__zoom')?.remove();
    },
  };
}
