import { runLoader, prefersReducedMotion } from './loader/index.js';
import { demoReady } from './loader/ready.js';
import { loadPlan, mountPlan } from './plan/index.js';

// 지금은 데모 준비 신호. 실제 앱에서는 createReadySignal() 로 바꿔 데이터가 준비되면 resolve 한다.
// ?ready=ms 로 준비 시점을 늦춰 볼 수 있다(데모 도구가 쓴다).
const params = new URLSearchParams(location.search);
const readyMs = Number(params.get('ready')) || 1200;
// 데모 도구용 — ?plan=only 로딩 건너뛰기, ?reduced=1 모션 줄이기 흉내
const planOnly = params.get('plan') === 'only';
const reduced = params.get('reduced') === '1' || prefersReducedMotion();

const loader = document.querySelector('.hsh-loader');
const app = document.getElementById('app');
const plan = app.querySelector('.hsh-plan');

// 평면도 SVG 는 로딩 화면이 떠 있는 동안 받아 둔다(준비 완료에 포함).
const svg = loadPlan();
const ready = Promise.all([demoReady(readyMs), svg.catch(() => {})]); // 못 받아도 로딩은 끝난다

const entered = planOnly
  ? (loader.remove(), Promise.resolve())
  // 준비가 끝나면 '집을 눌러 들어가기' 안내가 뜨고, 집을 누르면 집이 다가오며 로딩이 사라진다.
  : runLoader(loader, { ready, reduced });

entered.then(async () => {
  app.hidden = false;
  const view = mountPlan(plan, await svg, { reduced });
  window.hshPlan = view; // 데모 도구가 '평면도만 다시 재생' 에 쓴다
});
