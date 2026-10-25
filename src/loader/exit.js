// 종료 — 부드럽게 사라진 뒤 DOM 에서 뺀다.

/**
 * @param {HTMLElement} el  .hsh-loader
 * @returns {Promise<void>} 페이드가 끝나고 제거된 뒤
 */
export function exitLoader(el) {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      el.remove();
      resolve();
    };
    const onEnd = (e) => { if (e.target === el && e.propertyName === 'opacity') done(); };
    // transitionend 가 오지 않는 경우(탭 숨김 등) 대비
    const fade = parseFloat(getComputedStyle(el).getPropertyValue('--hsh-fade')) || 700;
    const fallback = setTimeout(done, fade + 200);

    el.addEventListener('transitionend', onEnd);
    el.classList.add('is-leaving');
  });
}
