// 로딩 화면 진행
//   타이핑(한 번) + 방문 단계 + 준비 완료 → 들어가기 안내 + 집 덧그리기 → 집 누르기 → 집이 다가오며 종료
//   타이핑은 방문 단계가 끝나는 때에 맞춰 마지막 글자를 쓴다. 집 위글은 들어갈 때까지 계속된다.

import { typeLines } from './typing.js';
import { runVisitSteps, showEnterHint, visitDuration } from './status.js';
import { drawHouse } from './draw.js';
import { waitForEnter } from './enter.js';
import { exitLoader } from './exit.js';
import { startWobble } from './wobble.js';

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
  const house = el.querySelector('.hsh-loader__house');
  const stop = new AbortController();

  el.classList.add('is-started');
  const visited = runVisitSteps(status, { ready, reduced, minStep });
  const typed = typeLines(el, {
    ...typing, reduced, signal: stop.signal, duration: visitDuration({ minStep }), until: visited,
  });
  if (!reduced) startWobble(el, { signal: stop.signal }); // 글자를 나눈 뒤에 시작

  await typed; // 마지막 글자는 방문 단계·준비가 끝난 뒤

  await showEnterHint(status, { reduced });
  drawHouse(el, { reduced });
  el.classList.add('is-ready');
  await waitForEnter(house);

  await exitLoader(el);
  stop.abort();
  document.dispatchEvent(new CustomEvent('hsh:loader-done'));
}
