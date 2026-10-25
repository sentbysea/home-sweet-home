// 방문 단계 — 집 아래 작은 글과 아이콘. 초인종 → 달려나옴 → 문 순서.
// 각 단계는 최소 minStep 동안 보이고, 마지막 단계는 준비 완료 신호가 올 때까지 머문다.
// 글을 바꾸면 한글 서브셋 폰트도 다시 받는다(README).

const HOSTS = ['차우연이', '홍지원이'];
const host = HOSTS[Math.floor(Math.random() * HOSTS.length)]; // 불러올 때마다 한 명

export const VISIT_STEPS = [
  { key: 'bell', text: '초인종 누르는 중' },
  { key: 'run', text: `${host} 달려나오는 중` },
  { key: 'door', text: '문 열리는 중' },
];

const SWAP = 220; // 글 바꿀 때 페이드(ms) — loader.css 의 .hsh-status 전환과 같다

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function show(el, key, text) {
  el.dataset.step = key;
  el.querySelector('.hsh-status__text').textContent = text;
}

async function swap(el, key, text, reduced) {
  if (reduced) return show(el, key, text);
  el.classList.add('is-swapping');
  await sleep(SWAP);
  show(el, key, text);
  el.classList.remove('is-swapping');
}

/**
 * @param {HTMLElement} el  .hsh-status
 * @param {{ ready: Promise<unknown>, reduced?: boolean, minStep?: number, steps?: typeof VISIT_STEPS }} opts
 * @returns {Promise<void>} 모든 단계를 보였고 준비도 끝났을 때
 */
export async function runVisitSteps(el, { ready, reduced = false, minStep = 1600, steps = VISIT_STEPS }) {
  for (let i = 0; i < steps.length; i++) {
    if (i === 0) show(el, steps[i].key, steps[i].text);
    else await swap(el, steps[i].key, steps[i].text, reduced);
    await sleep(minStep);
  }
  await ready;
}

/** 들어가기 안내 — 모바일·데스크톱 같은 문구 */
export function showEnterHint(el, { reduced = false } = {}) {
  return swap(el, 'tap', '화면을 눌러 들어가기', reduced);
}
