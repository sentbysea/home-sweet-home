import { runLoader, prefersReducedMotion } from './loader/index.js';
import { demoReady } from './loader/ready.js';
import { loadPlan, mountPlan } from './plan/index.js';
import { applyHomeSettings } from './content/home-settings.js';
import { startVisits } from './content/visits.js';

// 지금은 데모 준비 신호. 실제 앱에서는 createReadySignal() 로 바꿔 데이터가 준비되면 resolve 한다.
// ?ready=ms 로 준비 시점을 늦춰 볼 수 있다(데모 도구가 쓴다).
const params = new URLSearchParams(location.search);
const readyMs = Number(params.get('ready')) || 1200;
// 데모 도구용 — ?plan=only 로딩 건너뛰기, ?reduced=1 모션 줄이기 흉내
const planOnly = params.get('plan') === 'only';
const reduced = params.get('reduced') === '1' || prefersReducedMotion();

// 관리자 Settings > Home 의 탭 제목 · 파비콘 · 커서 — 로딩을 막지 않고 뒤에서
applyHomeSettings().catch((e) => console.warn('home settings', e));

// 방문 집계(ho.바이브.me 에서만 — 통계 대시보드의 '바이브.me')
startVisits();

// 창 주소(/notice · /post/13 …)로 들어왔다 — 새로고침 · 공유 링크 · 로그인에서 돌아오기. index.html 머리 스크립트가 첫 화면 전에 정한다.
// 로딩 화면 없이 평면도(다 그려진 채) 위에 그 창을 바로 연다. 불러오는 중은 창 안에서만 보인다
const direct = document.documentElement.dataset.hshEntry === 'direct';

const loader = document.querySelector('.hsh-loader');
const app = document.getElementById('app');
const plan = app.querySelector('.hsh-plan');

// 로딩 배경 별을 같은 자리 그대로 평면도 뒤에 옮겨 둔다 — 로딩이 바래는 동안 별은 그대로 있고 집만 사라진다
copyStars(loader.querySelector('.hsh-bg'), plan);

// 평면도 SVG 는 로딩 화면이 떠 있는 동안 받아 둔다(준비 완료에 포함).
const svg = loadPlan();

let shown = false;
const showPlan = async () => {
  if (shown) return;
  shown = true;
  app.hidden = false;
  const view = mountPlan(plan, await svg, { reduced, instant: direct });
  window.hshPlan = view; // 데모 도구가 '평면도만 다시 재생' 에 쓴다
};

if (planOnly || direct) {
  loader.remove();
  showPlan();
} else {
  const ready = Promise.all([demoReady(readyMs), svg.catch(() => {})]); // 못 받아도 로딩은 끝난다
  // 집이 다가오기 시작하고 조금 뒤 — 로딩이 바래는 동안 그 아래에서 평면도가 그려진다(밖에서 기다리다 집 안으로)
  document.addEventListener('hsh:loader-leaving', () => setTimeout(showPlan, reduced ? 0 : 380), { once: true });
  // 준비가 끝나면 '집을 눌러 들어가기' 안내가 뜨고, 집을 누르면 집이 다가오며 로딩이 사라진다.
  runLoader(loader, { ready, reduced }).then(showPlan);
}

function copyStars(bg, host) {
  const copy = bg.cloneNode(true);
  copy.setAttribute('class', 'hsh-plan__stars');
  // id 가 겹치지 않게
  copy.querySelector('#hsh-star').id = 'hsh-plan-star';
  copy.removeAttribute('id');
  copy.querySelector('#hsh-stars')?.removeAttribute('id');
  copy.querySelectorAll('use').forEach((u) => u.setAttribute('href', '#hsh-plan-star'));
  host.prepend(copy);
}
