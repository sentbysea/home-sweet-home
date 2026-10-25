import { runLoader } from './loader/index.js';
import { demoReady } from './loader/ready.js';

// 지금은 데모 준비 신호. 실제 앱에서는 createReadySignal() 로 바꿔 데이터가 준비되면 resolve 한다.
// ?ready=ms 로 준비 시점을 늦춰 볼 수 있다(데모 도구가 쓴다).
const readyMs = Number(new URLSearchParams(location.search).get('ready')) || 1200;

const loader = document.querySelector('.hsh-loader');
const app = document.getElementById('app');

// 준비가 끝나면 'enter 키를 눌러 들어가기' 안내가 뜨고, Enter·탭으로 들어간다.
runLoader(loader, { ready: demoReady(readyMs) }).then(() => {
  app.hidden = false; // 빈 흰 화면 — 다음 단계(평면도)가 들어올 자리
});
