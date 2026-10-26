// 공통 별 — 로딩 배경에 깔리는 테두리 없는 작은 별(index.html 의 #hsh-star 와 같은 모양).
//   로딩은 첫 화면 전에 그려야 해서 index.html 에 같은 path 를 인라인으로 둔다 — 모양을 바꾸면 두 곳을 같이.
//   색은 늘 --hsh-tone-stars(불러올 때 고른 집 색보다 채도 · 명도 낮은 색). 크기 · 개수 · 자리는 화면마다.

export const STAR_PATH = 'M0 -4.4L1.12 -1.54L4.18 -1.36L1.81 0.59L2.59 3.56L0 1.9L-2.59 3.56L-1.81 0.59L-4.18 -1.36L-1.12 -1.54Z';

/** 별 하나(HTML 위에 절대 위치로 얹는 작은 SVG). x · y 는 % , rot 는 도, size 는 배율(1 = 로딩 별) */
export function starSvg(x, y, rot = 0, size = 1, cls = '') {
  const px = (10 * size).toFixed(1);
  return `<svg class="hsh-star ${cls}" style="left:${x}%;top:${y}%;width:${px}px;height:${px}px;rotate:${rot}deg" viewBox="-5 -5 10 10" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg>`;
}
