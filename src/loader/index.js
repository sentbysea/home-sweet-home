// 로딩 화면 진행
//   타이핑(처음 한 번) + 방문 단계 + 준비 완료 → 들어가기 안내 → Enter → 종료
//   집 위글과 타이핑 반복은 Enter 를 누를 때까지 계속된다.

import { loopTyping } from './typing.js';
import { runVisitSteps, showEnterHint } from './status.js';
import { waitForEnter } from './enter.js';
import { exitLoader } from './exit.js';

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} el  .hsh-loader
 * @param {{ ready: Promise<unknown>, reduced?: boolean, typing?: object, minStep?: number }} opts
 *   ready    준비 완료 신호
 * @returns {Promise<void>} 로더가 사라진 뒤. document 에 'hsh:loader-done' 도 보낸다.
 */
export async function runLoader(el, { ready, reduced = prefersReducedMotion(), typing, minStep } = {}) {
  const status = el.querySelector('.hsh-status');
  const stop = new AbortController();

  el.classList.add('is-started');
  let firstTyped;
  const typed = new Promise((r) => { firstTyped = r; });
  loopTyping(el, { ...typing, reduced, signal: stop.signal, onFirstTyped: firstTyped });

  await Promise.all([typed, runVisitSteps(status, { ready, reduced, minStep })]);

  await showEnterHint(status, { reduced });
  el.classList.add('is-ready');
  await waitForEnter(el);

  await exitLoader(el);
  stop.abort();
  document.dispatchEvent(new CustomEvent('hsh:loader-done'));
}
