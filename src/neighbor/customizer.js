// 우리 집 꾸미기 — 신청 폼 · 주인 간판 걸기 · 주인 집 고치기가 같이 쓴다. 미리보기는 마을과 같은 렌더러(house-art.js).
//   몸체 · 지붕 · 문 · 창문 · 장식은 작은 집 아이콘, 벽 · 지붕 · 문 색은 색 칩. 바꾸면 미리보기가 바로 바뀐다.
//   '랜덤으로 만들기' · '배너 색으로 만들기'(누를 때마다 같은 배너 색으로 다른 조합). 만든 뒤에도 그대로 고칠 수 있다.
//   배너 색을 못 읽으면(이미지를 못 받거나 그 사이트가 읽기를 막음) 쉬운 말로 알리고, 직접 고르기 · 랜덤은 그대로.

import { houseSvg, randomHouse, houseFromColors, bannerColors, normalizeHouse, LABELS, BODIES, ROOFS, DOORS, WINDOWS, DECOS, WALLS, ROOF_COLORS, DOOR_COLORS } from './house-art.js';

const SHAPES = [
  ['body', '몸체', BODIES],
  ['roof', '지붕', ROOFS],
  ['door', '문', DOORS],
  ['window', '창문', WINDOWS],
  ['deco', '장식', DECOS],
];
const COLORS = [
  ['wall', '벽', WALLS],
  ['roofColor', '지붕', ROOF_COLORS],
  ['doorColor', '문', DOOR_COLORS],
];

let uid = 0;

/**
 * @param {HTMLElement} root
 * @param {{ initial?: object | null, imageUrl?: () => string, onChange?: (house: object) => void }} opts
 */
export function mountCustomizer(root, { initial = null, imageUrl = () => '', onChange = () => {} } = {}) {
  const id = `nbh-diy-${++uid}`;
  let house = normalizeHouse(initial) || randomHouse();
  let colors = null; // 배너에서 뽑은 색(주소별)
  let colorsFrom = '';

  root.classList.add('nbh-diy');
  root.innerHTML = `
    <div class="nbh-diy__preview" aria-hidden="true"></div>
    <div class="nbh-diy__rows">
      ${SHAPES.map(([key, label]) => `<div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-${key}">${label}</span><div class="nbh-diy__opts" role="radiogroup" aria-labelledby="${id}-${key}" data-key="${key}"></div></div>`).join('')}
      ${COLORS.map(([key, label]) => `<div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-${key}">${label} 색</span><div class="nbh-diy__opts is-colors" role="radiogroup" aria-labelledby="${id}-${key}" data-key="${key}"></div></div>`).join('')}
    </div>
    <div class="nbh-diy__actions">
      <button class="nbh-btn is-ghost is-small" type="button" data-diy="random">랜덤으로 만들기</button>
      <button class="nbh-btn is-ghost is-small" type="button" data-diy="banner">배너 색으로 만들기</button>
    </div>
    <p class="nbh-diy__msg" role="status" aria-live="polite"></p>`;
  const preview = root.querySelector('.nbh-diy__preview');
  const msg = root.querySelector('.nbh-diy__msg');
  const bannerBtn = root.querySelector('[data-diy="banner"]');

  const paint = () => {
    preview.innerHTML = houseSvg(house, { scale: 1.45, seed: 7 }).svg;
    for (const [key, , list] of SHAPES) {
      const box = root.querySelector(`[data-key="${key}"]`);
      box.innerHTML = list.map((v) => {
        const icon = houseSvg({ ...house, [key]: v }, { scale: 0.42, still: true, cls: 'nbh-diy__icon' }).svg;
        const on = house[key] === v;
        return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-v="${v}" title="${LABELS[key][v]}" aria-label="${LABELS[key][v]}">${key === 'deco' && v === 'none' ? '<span class="nbh-diy__none">없음</span>' : icon}</button>`;
      }).join('');
    }
    for (const [key, label, list] of COLORS) {
      const box = root.querySelector(`[data-key="${key}"]`);
      const all = list.includes(house[key]) ? list : [...list, house[key]]; // 배너에서 뽑은 색은 칩을 하나 더
      box.innerHTML = all.map((c, i) => {
        const on = house[key] === c;
        return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-v="${c}" style="--chip:${c}" aria-label="${label} 색 ${i + 1}${list.includes(c) ? '' : '(배너 색)'}"></button>`;
      }).join('');
    }
  };

  const set = (next, { silent = false } = {}) => {
    house = normalizeHouse(next) || house;
    paint();
    if (!silent) onChange(house);
  };

  root.addEventListener('click', async (e) => {
    const opt = e.target.closest('.nbh-diy__opts [data-v]');
    if (opt) {
      const key = opt.closest('[data-key]').dataset.key;
      set({ ...house, [key]: opt.dataset.v });
      root.querySelector(`[data-key="${key}"] [data-v="${opt.dataset.v}"]`)?.focus();
      return;
    }
    const act = e.target.closest('[data-diy]')?.dataset.diy;
    if (act === 'random') { msg.textContent = ''; set(randomHouse()); }
    if (act === 'banner') {
      const url = imageUrl();
      if (!url) { msg.textContent = '먼저 배너 이미지 주소를 적어 주세요.'; return; }
      if (colorsFrom !== url) {
        msg.textContent = '배너 색을 살펴보는 중…';
        bannerBtn.disabled = true;
        try {
          colors = await bannerColors(url);
          colorsFrom = url;
        } catch {
          colors = null;
          colorsFrom = '';
          msg.textContent = '이 배너에서는 색을 가져오지 못했어요. 색을 직접 고르거나 랜덤으로 만들어 보세요.';
          bannerBtn.disabled = false;
          return;
        } finally {
          bannerBtn.disabled = false;
        }
      }
      set(houseFromColors(colors));
      msg.textContent = '배너 색으로 지었어요. 한 번 더 누르면 다른 조합이에요.';
      bannerBtn.textContent = '배너 색으로 다시 뽑기';
    }
  });
  // 칩 줄 안에서 ← → 로 고르기(라디오처럼)
  root.addEventListener('keydown', (e) => {
    const opt = e.target.closest?.('.nbh-diy__opts [data-v]');
    if (!opt || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const all = [...opt.parentElement.querySelectorAll('[data-v]')];
    const next = all[(all.indexOf(opt) + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + all.length) % all.length];
    next.click();
  });

  paint();

  return {
    get value() { return { ...house }; },
    set: (next) => set(next, { silent: true }),
    /** 배너 주소가 바뀌면 — 뽑아 둔 색을 버리고 버튼 글을 처음대로 */
    bannerChanged() {
      colors = null;
      colorsFrom = '';
      bannerBtn.textContent = '배너 색으로 만들기';
      msg.textContent = '';
    },
  };
}
