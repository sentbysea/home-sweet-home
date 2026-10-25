// 로딩 화면 진행 — 타이핑 완료 + 준비 완료를 모두 받으면 종료한다.

import { typeLines } from './typing.js';
import { exitLoader } from './exit.js';

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} el  .hsh-loader
 * @param {{ ready: Promise<unknown>, reduced?: boolean, holdAfter?: number, typing?: object }} opts
 *   ready      준비 완료 신호
 *   holdAfter  둘 다 끝난 뒤 완성된 화면을 잠깐 보여 주는 시간(ms)
 * @returns {Promise<void>} 로더가 사라진 뒤. document 에 'hsh:loader-done' 도 보낸다.
 */
export async function runLoader(el, { ready, reduced = prefersReducedMotion(), holdAfter = 500, typing } = {}) {
  el.classList.add('is-typing');
  const typed = typeLines(el, { ...typing, reduced }).then(() => {
    el.classList.remove('is-typing');
    el.classList.add('is-done');
  });

  await Promise.all([typed, ready]);
  if (!reduced) await new Promise((r) => setTimeout(r, holdAfter));

  await exitLoader(el);
  document.dispatchEvent(new CustomEvent('hsh:loader-done'));
}
