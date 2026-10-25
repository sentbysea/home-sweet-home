// 들어가기 — 화면 누르기(클릭·탭). 키보드 사용자를 위해 Enter 키도 받는다.

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
