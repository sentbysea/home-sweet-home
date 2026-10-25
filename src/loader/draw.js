// 집 윤곽 덧그리기 — 들어가기 안내와 함께, 꼭짓점에서 왼쪽 → 아래 → 오른쪽으로 굵은 선을 빠르게 긋는다.
//   윤곽 4장(.hsh-loader__frame)을 그대로 본떠 굵은 선 4장을 겹친다(위글이 같은 장을 함께 켠다).
//   윤곽 경로는 꼭짓점에서 오른쪽으로 돌아 꼭짓점으로 끝나므로, 대시를 끝에서부터 당기면 왼쪽부터 그려진다.
//   펜 느낌은 평면도 선(plan/index.js)과 같은 곡선.

const DRAW_MS = 720;
const EASE = 'cubic-bezier(.45,.05,.35,1)';

/**
 * @param {HTMLElement} el  .hsh-loader
 * @param {{ reduced?: boolean }} [opts]
 * @returns {Promise<void>} 다 그은 뒤
 */
export function drawHouse(el, { reduced = false } = {}) {
  const frames = [...el.querySelectorAll('.hsh-loader__frame')];
  const inks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  inks.setAttribute('class', 'hsh-loader__inks');
  frames.forEach((f) => {
    const ink = f.cloneNode();
    ink.setAttribute('class', `hsh-loader__ink${f.classList.contains('is-on') ? ' is-on' : ''}`);
    ink.setAttribute('pathLength', '1');
    inks.append(ink);
  });
  frames[0].parentNode.after(inks);

  if (reduced) return Promise.resolve();
  return Promise.all(
    [...inks.children].map((ink) =>
      ink.animate(
        [{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }],
        { duration: DRAW_MS, easing: EASE, fill: 'backwards' },
      ).finished,
    ),
  ).then(() => {});
}
