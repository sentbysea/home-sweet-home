// 방 버튼을 누르면 뜨는 창 — 폴더 탭 + 주소창이 있는 브라우저 창 꼴에 키치한 별 · 하트를 걸쳐 둔다.
//   창 머리(탭 · 주소창 줄)는 누른 버튼의 바탕색, 제목은 버튼 글자색을 따른다.
//   뒤의 홈 화면은 반투명 덮개로 살짝 가린다. 닫기: ×, 덮개 누르기, Esc.
//   안쪽 내용은 아직 없다 — 방마다 채울 자리만 둔다.

const NS = 'http://www.w3.org/2000/svg';

/** 뾰족한 별(가시 points 개) — 가시 길이를 조금씩 달리해 손으로 오린 느낌 */
function burst(points, outer, inner, wobble = 0.18, seed = 1) {
  let d = '';
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const s = Math.sin(seed * 91.7 + i * 12.9) * 0.5 + 0.5;
    const r = i % 2 ? inner : outer * (1 - wobble + s * wobble * 2);
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}

const HEART = 'M0 9C-7 3 -12 -1 -12 -6C-12 -10 -9 -12 -6 -12C-3 -12 -1 -10 0 -8C1 -10 3 -12 6 -12C9 -12 12 -10 12 -6C12 -1 7 3 0 9Z';

// 창에 걸쳐 둘 장식 — [class, path, 위치 class]
//   모양은 모두 viewBox 를 꽉 채우게 그리고, 크기는 CSS 가 정한다
const DECOR = [
  ['blue', burst(8, 31, 7, 0.25, 1), 'is-tr'],
  ['green', burst(8, 31, 6, 0.25, 2), 'is-r'],
  ['pink', burst(8, 31, 7, 0.15, 3), 'is-l'],
  ['green', burst(5, 31, 13, 0, 4), 'is-in'],
  ['pink', burst(5, 31, 13, 0, 5), 'is-b'],
  ['green', HEART, 'is-heart-r', '-14 -14 28 28'],
];

const svgIcon = (cls, d, label = '', viewBox = '-34 -34 68 68') => {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `hsh-win__deco hsh-win__deco--${cls}`);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  if (label) svg.dataset.at = label;
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  svg.append(p);
  return svg;
};

function build() {
  const root = document.createElement('div');
  root.className = 'hsh-win';
  root.hidden = true;
  root.innerHTML = `
    <div class="hsh-win__veil" data-close></div>
    <section class="hsh-win__frame" role="dialog" aria-modal="true" aria-labelledby="hsh-win-title">
      <div class="hsh-win__tab">
        <button class="hsh-win__x" type="button" data-close aria-label="창 닫기">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2L10 10M10 2L2 10"/></svg>
        </button>
      </div>
      <div class="hsh-win__bar">
        <span class="hsh-win__nav" aria-hidden="true">
          <svg viewBox="0 0 12 12"><path d="M8 2L4 6L8 10"/></svg>
          <svg viewBox="0 0 12 12"><path d="M4 2L8 6L4 10"/></svg>
        </span>
        <span class="hsh-win__url"></span>
        <svg class="hsh-win__like" viewBox="-14 -14 28 28" aria-hidden="true"><path d="${HEART}"/></svg>
      </div>
      <div class="hsh-win__body">
        <header class="hsh-win__head">
          <span class="hsh-win__thumb" aria-hidden="true">
            <svg viewBox="-14 -14 28 28"><path d="${HEART}"/></svg>
          </span>
          <div class="hsh-win__titles">
            <h2 class="hsh-win__title" id="hsh-win-title"></h2>
            <span class="hsh-win__pill"></span>
          </div>
        </header>
        <div class="hsh-win__page">
          <p class="hsh-win__empty">곧 채워질 방이에요.</p>
        </div>
      </div>
    </section>`;
  const frame = root.querySelector('.hsh-win__frame');
  for (const [cls, d, at, box] of DECOR) frame.append(svgIcon(cls, d, at, box));
  return root;
}

/**
 * @param {HTMLElement} host     창을 붙일 곳(#app)
 * @param {HTMLElement} trigger  hsh:room 이 올라오는 곳(.hsh-plan)
 * @param {{ reduced?: boolean }} opts
 */
export function enableRoomWindow(host, trigger, { reduced = false } = {}) {
  const win = build();
  host.append(win);
  const frame = win.querySelector('.hsh-win__frame');
  const title = win.querySelector('.hsh-win__title');
  const pill = win.querySelector('.hsh-win__pill');
  const url = win.querySelector('.hsh-win__url');
  let back = null; // 닫으면 포커스를 돌려줄 버튼
  let closing = null;

  const open = ({ room, label, name, bg, fg }, from) => {
    clearTimeout(closing);
    back = from ?? null;
    win.dataset.room = room;
    win.style.setProperty('--hsh-win-tint', bg);
    win.style.setProperty('--hsh-win-ink', fg);
    title.textContent = label;
    pill.textContent = name;
    url.textContent = `home sweet home / ${label}`;
    win.hidden = false;
    win.classList.remove('is-closing');
    void win.offsetWidth; // 다시 열 때도 등장 전환이 처음부터
    win.classList.add('is-open');
    win.querySelector('.hsh-win__x').focus({ preventScroll: true });
  };

  const close = () => {
    if (win.hidden || win.classList.contains('is-closing')) return;
    win.classList.remove('is-open');
    win.classList.add('is-closing');
    closing = setTimeout(() => {
      win.hidden = true;
      win.classList.remove('is-closing');
      back?.focus?.({ preventScroll: true });
    }, reduced ? 0 : 220);
  };

  trigger.addEventListener('hsh:room', (e) => open(e.detail, e.target));
  win.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (win.hidden) return;
    if (e.key === 'Escape') close();
    // 창 안에서만 Tab 이 돌게
    if (e.key === 'Tab') {
      const items = [...frame.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
