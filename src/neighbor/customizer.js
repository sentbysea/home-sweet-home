// 우리 집 꾸미기 — 신청 폼 · 주인 간판 걸기 · 주인 집 고치기가 같이 쓴다. 미리보기는 마을과 같은 렌더러(house-art.js).
//   몸체 · 지붕 · 문 · 창문은 작은 집 아이콘(하나만), 장식은 여러 개 켜고 끄기, 지붕 무늬는 무늬 칩.
//   벽 · 지붕 · 문 색은 파스텔 색 칩만(마을 톤을 지키려고 직접 고르기는 없다 — 칩에 없는 예전 색은 칩 하나 더). 바꾸면 미리보기가 바로 바뀐다.
//   미리보기 집 아래에 마을과 같은 이름표(nameOf — 적은 사이트 이름, 비었으면 안내 글).
//   미리보기 오른쪽 아래 주사위('랜덤으로 생성') — 누를 때마다 다른 집. 만든 뒤에도 그대로 고칠 수 있다.

import { houseSvg, houseKey, tagTone, roofPaint, randomHouse, normalizeHouse, LABELS, BODIES, ROOFS, PATTERNS, DOORS, WINDOWS, DECOS, WALLS, ROOF_COLORS, DOOR_COLORS } from './house-art.js';

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

// 주사위 — 손그림처럼 살짝 기운 둥근 네모, 눈 다섯
const DICE = '<svg class="nbh-diy__dice-art" viewBox="0 0 28 28" aria-hidden="true" focusable="false">' +
  '<rect x="4.5" y="4.5" width="19" height="19" rx="5" transform="rotate(-8 14 14)"/>' +
  '<g transform="rotate(-8 14 14)"><circle cx="9.6" cy="9.6" r="1.6"/><circle cx="18.4" cy="9.6" r="1.6"/><circle cx="14" cy="14" r="1.6"/><circle cx="9.6" cy="18.4" r="1.6"/><circle cx="18.4" cy="18.4" r="1.6"/></g></svg>';

/** 무늬 칩 — 지금 지붕 색으로 */
const swatch = (kind, color) => {
  const { defs, fill } = roofPaint(kind, color);
  return `<svg class="nbh-diy__swatch" viewBox="0 0 26 26" aria-hidden="true" focusable="false">${defs}<rect x="1.5" y="1.5" width="23" height="23" rx="6" fill="${fill}"/></svg>`;
};

/**
 * @param {HTMLElement} root
 * @param {{ initial?: object | null, nameOf?: () => string, onChange?: (house: object) => void }} opts
 */
export function mountCustomizer(root, { initial = null, nameOf = () => '', onChange = () => {} } = {}) {
  const id = `nbh-diy-${++uid}`;
  let house = normalizeHouse(initial) || randomHouse();

  root.classList.add('nbh-diy');
  root.innerHTML = `
    <div class="nbh-diy__view">
      <div class="nbh-diy__preview" aria-hidden="true"></div>
      <button class="nbh-diy__dice" type="button" data-diy="random">${DICE}<span>랜덤으로 생성</span></button>
    </div>
    <div class="nbh-diy__rows">
      ${SHAPES.map(([key, label]) => `<div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-${key}">${label}</span><div class="nbh-diy__opts" role="radiogroup" aria-labelledby="${id}-${key}" data-key="${key}"></div></div>`).join('')}
      <div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-deco">장식 <em>여럿</em></span><div class="nbh-diy__opts" role="group" aria-labelledby="${id}-deco" data-key="deco"></div></div>
      ${COLORS.map(([key, label]) => `<div class="nbh-diy__row"><span class="nbh-diy__k" id="${id}-${key}">${label} 색</span><div class="nbh-diy__opts is-colors" role="radiogroup" aria-labelledby="${id}-${key}" data-key="${key}"></div></div>`).join('')}
    </div>`;
  const preview = root.querySelector('.nbh-diy__preview');

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
      const all = list.includes(house[key]) ? list : [...list, house[key]]; // 칩에 없는 색(예전에 저장된 집)은 칩을 하나 더
      box.innerHTML = all.map((c, i) => {
        const on = house[key] === c;
        return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-v="${c}" style="--chip:${c}" aria-label="${label} 색 ${i + 1}"></button>`;
      }).join('');
    }
  };

  const set = (next, { silent = false } = {}) => {
    house = normalizeHouse(next) || house;
    paint();
    if (!silent) onChange(house);
  };

  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.nbh-diy__opts [data-v]');
    if (opt) {
      const key = opt.closest('[data-key]').dataset.key;
      const v = opt.dataset.v;
      if (key === 'deco') set({ ...house, deco: house.deco.includes(v) ? house.deco.filter((d) => d !== v) : [...house.deco, v] });
      else set({ ...house, [key]: v });
      root.querySelector(`[data-key="${key}"] [data-v="${v}"]`)?.focus();
      return;
    }
    const dice = e.target.closest('[data-diy="random"]');
    if (!dice) return;
    set(randomHouse());
    // 주사위가 한 바퀴 — 연달아 눌러도 처음부터
    dice.classList.remove('is-rolling');
    void dice.offsetWidth;
    dice.classList.add('is-rolling');
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
  };
}
