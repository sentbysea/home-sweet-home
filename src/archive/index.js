// archive — 브라우저 창 대신 흰 화면 가운데 열쇠꾸러미(keyring.js). 주소 /archive(routes.js), 여닫기는 room-window.js 가 맡는다.
//   · 열쇠를 한 번 누르면 앞으로 나와 이름표가 붙고, 아래에 '사이트 이름 ↗' 링크. 같은 열쇠를 또 누르거나 링크를 누르면 새 탭.
//     빈 곳을 누르면 풀린다. 주소가 비어 있는 사이트는 보이기만 하고 밖으로 나가지 않는다.
//   · 사이트 이름은 아래 버튼 줄에도 있다(키보드 · 화면 읽기 프로그램으로 고르기 · 이동, hover 없이).
//   · 3D 를 쓸 수 없으면(WebGL 없음 · three.js 를 못 받음) 같은 데이터로 간단한 목록.
//   · 닫으면 그리기를 멈추고 WebGL 자원을 정리한다.

import { archiveLinks } from './links.js';
import { createKeyring, canUseWebGL } from './keyring.js';

// 버튼 줄 작은 그림 — 꾸러미 오브젝트와 같은 색
const ICONS = {
  bird: { color: '#cfe0fb', svg: '<path d="M5 13c0-3.6 2.6-6 6-6 3 0 5 2 5.4 4.4L20 9l-1.4 4.6c-.8 2.6-3.4 4.4-7 4.4C7.6 18 5 16 5 13z"/><path d="M5.2 11.6L2.6 12.4l2.6 1"/><circle cx="8.4" cy="11.4" r=".6" class="dot"/>' },
  diary: { color: '#dfd2f6', svg: '<rect x="5.5" y="4" width="13" height="16" rx="1.6"/><path d="M8.5 4v16"/><path d="M13.6 10.2c-.6-1-2.2-.8-2.2.5 0 1 1.4 1.9 2.2 2.6.8-.7 2.2-1.6 2.2-2.6 0-1.3-1.6-1.5-2.2-.5z" class="fill"/>' },
  heart: { color: '#f9cadb', svg: '<path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M12 20c-4-2.8-6.6-5-6.6-7.6 0-2 1.5-3.4 3.3-3.4 1.4 0 2.6.8 3.3 2 .7-1.2 1.9-2 3.3-2 1.8 0 3.3 1.4 3.3 3.4 0 2.6-2.6 4.8-6.6 7.6z"/>' },
  house: { color: '#e4e7ea', svg: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 9.6V20h11V9.6"/><path d="M10.4 20v-4.6h3.2V20"/>' },
};

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 뒤에 흩어 둔 손그림 별 · 동그라미(첨부 그림처럼)
const SPARKS = [
  [8, 16, 'star', '#fbefae', -12], [88, 12, 'star', '#cfe0fb', 14], [14, 62, 'dot', '#cfe0fb', 0],
  [91, 48, 'star', '#dfd2f6', -6], [80, 78, 'dot', '#fbefae', 0], [6, 86, 'star', '#cfe0fb', 20],
  [70, 22, 'dot', '#dfd2f6', 0], [26, 30, 'dot', '#fbefae', 0],
];
const STAR = 'M0 -9L2.4 -3.1L8.6 -2.8L3.8 1.2L5.4 7.4L0 3.9L-5.4 7.4L-3.8 1.2L-8.6 -2.8L-2.4 -3.1Z';

function build(links) {
  const root = document.createElement('section');
  root.className = 'hsh-arc';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'hsh-arc-title');
  root.tabIndex = -1; // 열면 화면 자체에 포커스(첫 버튼에 테두리가 늘 떠 있지 않게)
  const sparks = SPARKS.map(([x, y, kind, color, rot]) => (kind === 'star'
    ? `<svg class="hsh-arc__spark" style="left:${x}%;top:${y}%;rotate:${rot}deg" viewBox="-11 -11 22 22"><path d="${STAR}" fill="${color}"/></svg>`
    : `<svg class="hsh-arc__spark is-dot" style="left:${x}%;top:${y}%" viewBox="-8 -8 16 16"><circle r="5.5" fill="${color}"/></svg>`)).join('');
  const chips = links.map((l, i) => {
    const icon = ICONS[l.object] || ICONS.house;
    return `<button class="hsh-arc__chip" type="button" data-i="${i}" aria-pressed="false" style="--c:${icon.color}">` +
      `<span class="hsh-arc__badge"><svg class="hsh-arc__icon" viewBox="0 0 24 24" aria-hidden="true">${icon.svg}</svg></span>` +
      `<span class="hsh-arc__name">${esc(l.name)}</span></button>`;
  }).join('');
  const list = links.map((l) => {
    const icon = ICONS[l.object] || ICONS.house;
    const inner = `<svg class="hsh-arc__icon" viewBox="0 0 24 24" aria-hidden="true">${icon.svg}</svg><span>${esc(l.name)}</span>`;
    return `<li style="--c:${icon.color}">${l.url
      ? `<a class="hsh-arc__row" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${inner}<span class="hsh-arc__arrow" aria-hidden="true">↗</span></a>`
      : `<span class="hsh-arc__row is-off" aria-disabled="true">${inner}<span class="hsh-arc__soon">준비 중</span></span>`}</li>`;
  }).join('');
  root.innerHTML = `
    <div class="hsh-arc__sparks" aria-hidden="true">${sparks}</div>
    <header class="hsh-arc__top">
      <button class="hsh-arc__home" type="button"><span aria-hidden="true">←</span> home</button>
      <h2 class="hsh-arc__title" id="hsh-arc-title">Archive</h2>
    </header>
    <div class="hsh-arc__stage">
      <canvas class="hsh-arc__canvas" role="img" aria-label="열쇠꾸러미 — 끌어서 돌리고, 열쇠를 눌러 고르기"></canvas>
      <span class="hsh-arc__tag" aria-hidden="true" hidden></span>
      <ul class="hsh-arc__list" hidden>${list}</ul>
    </div>
    <footer class="hsh-arc__foot">
      <div class="hsh-arc__chips" role="group" aria-label="사이트" style="--n:${links.length}">${chips}</div>
      <p class="hsh-arc__go" aria-live="polite"></p>
    </footer>`;
  return root;
}

/**
 * @param {HTMLElement} host   붙일 곳(#app)
 * @param {{ reduced?: boolean, cover?: HTMLElement }} opts   cover — 열려 있는 동안 키보드가 닿지 않게 할 홈 화면(.hsh-plan)
 */
export function mountArchive(host, { reduced = false, cover = null } = {}) {
  const links = archiveLinks();
  let root = null;
  let ring = null;
  let opening = 0; // 열 때마다 하나씩 — 받는 동안 닫았다 다시 열면 앞의 것은 버린다
  let selected = null;
  let back = null;
  let onHome = () => {};
  let hiding = 0;
  let tagRaf = 0;

  const $ = (q) => root.querySelector(q);

  const paintGo = () => {
    const go = $('.hsh-arc__go');
    const tag = $('.hsh-arc__tag');
    root.querySelectorAll('.hsh-arc__chip').forEach((c, i) => c.setAttribute('aria-pressed', String(i === selected)));
    if (selected == null) {
      go.innerHTML = '';
      tag.hidden = true;
      return;
    }
    const l = links[selected];
    const text = esc(l.label || l.name); // label — 링크에 보일 글자(없으면 이름), love 는 hongjiwon.love
    go.style.setProperty('--c', (ICONS[l.object] || ICONS.house).color);
    go.innerHTML = l.url
      ? `<a class="hsh-arc__link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${text}<span class="hsh-arc__arrow-dot" aria-hidden="true">↗</span></a>`
      : `<a class="hsh-arc__link is-off" role="link" aria-disabled="true">${text}<span class="hsh-arc__arrow-dot">준비 중</span></a>`;
    tag.textContent = l.name;
    tag.hidden = !ring;
  };

  // 이름표 — 고른 열쇠 옆을 따라다닌다
  const followTag = () => {
    cancelAnimationFrame(tagRaf);
    const tag = $('.hsh-arc__tag');
    const stage = $('.hsh-arc__stage');
    const step = () => {
      if (!ring || selected == null || root.hidden) return;
      tagRaf = requestAnimationFrame(step);
      const p = ring.anchor(selected);
      if (!p) return;
      const w = stage.clientWidth;
      const tw = tag.offsetWidth;
      const x = Math.min(w - tw - 8, Math.max(8, p.x + 6));
      const y = Math.min(stage.clientHeight - 40, Math.max(8, p.y - 18));
      tag.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    };
    step();
  };

  const setSelected = (i) => {
    selected = i;
    paintGo();
    if (i != null) followTag();
  };

  const nudge = (el) => {
    if (reduced || !el) return;
    el.animate([{ translate: '0' }, { translate: '-4px' }, { translate: '4px' }, { translate: '0' }], { duration: 260, easing: 'ease-out' });
  };

  /** 그 사이트로 — 주소가 비어 있으면 밖으로 나가지 않는다 */
  const activate = (i) => {
    const l = links[i];
    if (!l?.url) { nudge($('.hsh-arc__go')); return; }
    window.open(l.url, '_blank', 'noopener,noreferrer');
  };

  const fallback = () => {
    $('.hsh-arc__canvas').hidden = true;
    $('.hsh-arc__tag').hidden = true;
    $('.hsh-arc__list').hidden = false;
    $('.hsh-arc__foot').hidden = true;
    root.classList.add('is-list');
  };

  const ensure = () => {
    if (root) return;
    root = build(links);
    root.classList.toggle('is-reduced', reduced);
    host.append(root);
    $('.hsh-arc__home').addEventListener('click', () => onHome());
    $('.hsh-arc__chips').addEventListener('click', (e) => {
      const c = e.target.closest('.hsh-arc__chip');
      if (!c) return;
      const i = Number(c.dataset.i);
      const next = i === selected ? null : i;
      if (ring) ring.select(next); // onSelect 가 화면을 고친다
      else setSelected(next);
    });
    // 버튼 줄 안에서 ← → 로 옮겨 가기
    $('.hsh-arc__chips').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const all = [...root.querySelectorAll('.hsh-arc__chip')];
      const at = all.indexOf(document.activeElement);
      if (at < 0) return;
      e.preventDefault();
      all[(at + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length].focus();
    });
    $('.hsh-arc__go').addEventListener('click', (e) => {
      const a = e.target.closest('.hsh-arc__link');
      if (a?.classList.contains('is-off')) { e.preventDefault(); nudge(a); }
    });
    // 캔버스를 누르면 포커스가 꾸러미 밖(body)으로 가므로 문서에서 받는다
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || root.hidden || root.classList.contains('is-closing')) return;
      e.preventDefault();
      if (selected != null) { if (ring) ring.select(null); else setSelected(null); return; }
      onHome();
    });
  };

  const start = async () => {
    const my = ++opening;
    if (!canUseWebGL()) { fallback(); return; }
    try {
      const made = await createKeyring($('.hsh-arc__canvas'), links, {
        reduced,
        onSelect: (i) => setSelected(i),
        onActivate: (i) => activate(i),
      });
      if (my !== opening || root.hidden) { made.dispose(); return; }
      ring = made;
      root.classList.add('is-ready');
      if (selected != null) ring.select(selected);
      else paintGo();
    } catch (e) {
      console.warn('archive 3d', e);
      if (my === opening) fallback();
    }
  };

  const stop = () => {
    opening++;
    cancelAnimationFrame(tagRaf);
    if (ring) {
      ring.dispose();
      // 잃어버린(forceContextLoss) WebGL 캔버스는 다시 쓸 수 없다 — 다음에 열 때를 위해 새 캔버스로
      const c = $('.hsh-arc__canvas');
      const fresh = c.cloneNode(false);
      fresh.classList.remove('is-dragging');
      c.replaceWith(fresh);
    }
    ring = null;
    root?.classList.remove('is-ready');
  };

  return {
    get open() { return Boolean(root && !root.hidden && !root.classList.contains('is-closing')); },
    /** @param {{ from?: Element | null, home: () => void }} o */
    show({ from = null, home }) {
      ensure();
      onHome = home;
      clearTimeout(hiding);
      if (this.open) return;
      back = from;
      selected = null;
      root.classList.remove('is-closing', 'is-list');
      $('.hsh-arc__canvas').hidden = false;
      $('.hsh-arc__list').hidden = true;
      $('.hsh-arc__foot').hidden = false;
      root.hidden = false;
      if (cover) cover.inert = true;
      document.documentElement.classList.add('hsh-arc-on');
      paintGo();
      void root.offsetWidth;
      root.classList.add('is-open');
      root.focus({ preventScroll: true });
      start();
    },
    hide({ instant = false } = {}) {
      if (!root || root.hidden) return;
      stop();
      if (cover) cover.inert = false;
      document.documentElement.classList.remove('hsh-arc-on');
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      const done = () => {
        root.hidden = true;
        root.classList.remove('is-closing');
        back?.focus?.({ preventScroll: true });
      };
      clearTimeout(hiding);
      if (instant || reduced) done();
      else hiding = setTimeout(done, 200);
    },
  };
}
