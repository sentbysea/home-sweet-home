// 우리 집 꾸미기 — 신청 폼 · 주인 간판 걸기 · 주인 집 고치기가 같이 쓴다. 미리보기는 마을과 같은 렌더러(house-art.js).
//   몸체 · 지붕 · 문 · 창문은 작은 집 아이콘(하나만), 장식은 여러 개 켜고 끄기, 지붕 무늬는 무늬 칩.
//   벽 · 지붕 · 문 색은 파스텔 색 칩만(마을 톤을 지키려고 직접 고르기는 없다 — 배너에서 뽑은 색은 칩 하나 더). 바꾸면 미리보기가 바로 바뀐다.
//   미리보기 집 아래에 마을과 같은 이름표(nameOf — 적은 사이트 이름, 비었으면 안내 글).
//   '랜덤으로 만들기' · '배너 색으로 만들기'(누를 때마다 같은 배너 색으로 다른 조합). 만든 뒤에도 그대로 고칠 수 있다.
//   배너 색을 못 읽으면(이미지를 못 받거나 그 사이트가 읽기를 막음) 쉬운 말로 알리고, 칩 고르기 · 랜덤은 그대로.

import { houseSvg, houseKey, tagTone, roofPaint, randomHouse, houseFromColors, bannerColors, normalizeHouse, LABELS, BODIES, ROOFS, PATTERNS, DOORS, WINDOWS, DECOS, WALLS, ROOF_COLORS, DOOR_COLORS } from './house-art.js';

const SHAPES = [
  ['body', '몸체', BODIES],
  ['roof', '지붕', ROOFS],
  ['roofPattern', '지붕 무늬', PATTERNS],
  ['door', '문', DOORS],
  ['window', '창문', WINDOWS],
];
const COLORS = [
  ['wall', '벽', WALLS],
  ['roofColor', '지붕', ROOF_COLORS],
  ['doorColor', '문', DOOR_COLORS],
];

let uid = 0;

/** 무늬 칩 — 지금 지붕 색으로 */
const swatch = (kind, color) => {
  const { defs, fill } = roofPaint(kind, color);
  return `<svg class="nbh-diy__swatch" viewBox="0 0 26 26" aria-hidden="true" focusable="false">${defs}<rect x="1.5" y="1.5" width="23" height="23" rx="6" fill="${fill}"/></svg>`;
};

/**
 * @param {HTMLElement} root
 * @param {{ initial?: object | null, imageUrl?: () => string, nameOf?: () => string, onChange?: (house: object) => void }} opts
 */
export function mountCustomizer(root, { initial = null, imageUrl = () => '', nameOf = () => '', onChange = () => {} } = {}) {
  const id = `nbh-diy-${++uid}`;
  let house = normalizeHouse(initial) || randomHouse();
  let colors = null; // 배너에서 뽑은 색(주소별)
  let colorsFrom = '';

  root.classList.add('nbh-diy');
  root.innerHTML = `
    <div class="nbh-diy__preview" aria-hidden="true"></div>
    <div class="nbh-diy__rows">
      ${SHAPES.map(([key, label]) => `<div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-${key}">${label}</span><div class="nbh-diy__opts" role="radiogroup" aria-labelledby="${id}-${key}" data-key="${key}"></div></div>`).join('')}
      <div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-deco">장식 <em>여럿</em></span><div class="nbh-diy__opts" role="group" aria-labelledby="${id}-deco" data-key="deco"></div></div>
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

  const paintName = () => {
    const tag = preview.querySelector('.nbh-diy__name');
    if (!tag) return;
    const name = String(nameOf() || '').trim();
    tag.textContent = name || '사이트 이름';
    tag.classList.toggle('is-empty', !name);
  };

  const paint = () => {
    root.dataset.spec = houseKey(house); // 시험 · 비교용
    preview.innerHTML = `<div class="nbh-diy__stage" style="--tag-bg:${tagTone(house)};--tilt:-1.5deg">${houseSvg(house, { scale: 1.45, seed: 7 }).svg}<span class="nbh-label nbh-diy__name"></span></div>`;
    paintName();
    for (const [key, , list] of SHAPES) {
      const box = root.querySelector(`[data-key="${key}"]`);
      box.innerHTML = list.map((v) => {
        const icon = key === 'roofPattern'
          ? swatch(v, house.roofColor)
          : houseSvg({ ...house, [key]: v }, { scale: 0.42, still: true, cls: 'nbh-diy__icon' }).svg;
        const on = house[key] === v;
        return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-v="${v}" title="${LABELS[key][v]}" aria-label="${LABELS[key][v]}">${icon}</button>`;
      }).join('');
    }
    // 장식 — 그 장식 하나만 단 집 아이콘, 켜고 끄기
    root.querySelector('[data-key="deco"]').innerHTML = DECOS.map((v) => {
      const icon = houseSvg({ ...house, deco: [v] }, { scale: 0.42, still: true, cls: 'nbh-diy__icon' }).svg;
      return `<button type="button" role="checkbox" aria-checked="${house.deco.includes(v)}" data-v="${v}" title="${LABELS.deco[v]}" aria-label="${LABELS.deco[v]}">${icon}<span class="nbh-diy__cap" aria-hidden="true">${LABELS.deco[v]}</span></button>`;
    }).join('');
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
      const v = opt.dataset.v;
      if (key === 'deco') set({ ...house, deco: house.deco.includes(v) ? house.deco.filter((d) => d !== v) : [...house.deco, v] });
      else set({ ...house, [key]: v });
      root.querySelector(`[data-key="${key}"] [data-v="${v}"]`)?.focus();
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
  // 하나만 고르는 줄 안에서 ← → 로 고르기(라디오처럼)
  root.addEventListener('keydown', (e) => {
    const opt = e.target.closest?.('.nbh-diy__opts[role="radiogroup"] [data-v]');
    if (!opt || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const all = [...opt.parentElement.querySelectorAll('[data-v]')];
    const next = all[(all.indexOf(opt) + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + all.length) % all.length];
    next.click();
  });

  paint();

  return {
    get value() { return { ...house, deco: [...house.deco] }; },
    set: (next) => set(next, { silent: true }),
    /** 사이트 이름 칸이 바뀌면 — 미리보기 이름표만 */
    renamed: paintName,
    /** 배너 주소가 바뀌면 — 뽑아 둔 색을 버리고 버튼 글을 처음대로 */
    bannerChanged() {
      colors = null;
      colorsFrom = '';
      bannerBtn.textContent = '배너 색으로 만들기';
      msg.textContent = '';
    },
  };
}
