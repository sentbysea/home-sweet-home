// 들어가기 — Enter 키 또는 화면 누르기(터치에는 Enter 가 없다).

/**
 * @param {HTMLElement} el  누르면 들어가는 영역(.hsh-loader)
 * @returns {Promise<void>}
 */
export function waitForEnter(el) {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('click', done);
      resolve();
    };
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.isComposing && !e.repeat) done();
    };
    window.addEventListener('keydown', onKey);
    el.addEventListener('click', done);
  });
}
