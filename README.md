# home sweet home

로딩 화면만 있는 첫 단계. SVG + CSS, 의존성 없음.
(평면도·방 내부는 아직 없다. 디자인이 안정되면 hongjiwon.love 로 옮길 예정.)

![preview](docs/preview.png)

## 실행

```sh
npm run dev        # node scripts/serve.mjs — 설치할 것 없음
```

- 실제 화면 — http://localhost:5173/
- 데모 도구 — http://localhost:5173/demo.html (다시 재생 · 화면 크기 · 준비 완료 시점)

`?ready=ms` 로 준비 완료 시점을 늦출 수 있다(기본 1200ms).

## 구조

```
index.html              로딩 화면 마크업(SVG 집 + 글자)
src/styles/loader.css   모양 · 위글 · 페이드 · 모션 줄이기
src/loader/typing.js    타이핑 · 지우기 · 반복 — 글자 opacity 만 바꿔 위치 고정
src/loader/status.js    방문 단계(초인종 → 달려나옴 → 문) · 들어가기 안내
src/loader/enter.js     화면 누르기(키보드 Enter 도 받음)
src/loader/ready.js     준비 완료 신호(createReadySignal / demoReady)
src/loader/exit.js      페이드 아웃 후 DOM 제거
src/loader/wobble.js    손그림 위글 — 윤곽 4장 · 글자 기울임을 190ms 마다(필터 없음)
src/loader/index.js     runLoader — 타이핑 + 방문 단계 + 준비 완료 → 안내 → 누르기 → 종료
src/main.js             연결(지금은 데모 신호)
tools/wobble.mjs        윤곽 변형 4장 생성기
```

## 실제 준비 신호로 바꾸기

```js
import { runLoader } from './loader/index.js';
import { createReadySignal } from './loader/ready.js';

const ready = createReadySignal();
runLoader(document.querySelector('.hsh-loader'), { ready: ready.promise });
// …데이터·이미지가 준비되면
ready.resolve();
```

들어가서 로더가 사라지면 `document` 에 `hsh:loader-done` 이벤트가 온다.

## 흐름

1. 집과 글자가 위글거리고 home → sweet → home → `...` 를 한 번 타이핑하고 그대로 둔다(글자는 하나씩 살짝 기울어 흔들린다). 방문 단계가 끝나는 때에 맞춰 천천히 쓰고, 마지막 점은 준비 완료 뒤에 찍는다.
2. 집 아래에 방문 단계가 차례로 뜬다 — 초인종 누르는 중 → (차우연이 · 홍지원이 중 랜덤) 달려나오는 중 → 문 열리는 중. 작은 글도 같은 방식으로 흔들린다.
3. 마지막 점을 찍자마자 `집을 눌러 들어가기`(모바일·데스크톱 같은 문구). 동시에 집 윤곽을 꼭짓점 → 왼쪽 → 아래 → 오른쪽으로 굵은 선이 빠르게 덧그린다(`draw.js`).
4. 집을 누르면(키보드 Enter 도 됨) 글자는 숨고 집이 사용자 쪽으로 다가오며(확대) 평면도로 넘어간다.

- 윤곽: 조금씩 다른 4장을 190ms 씩 번갈아(`wobble.js`). 집 크기·위치는 움직이지 않는다.
- SVG 필터는 쓰지 않는다 — iOS Safari 에서 필터 영역이 검게 깜빡였다.
- 배경: 아이보리(`--hsh-paper`) 위에 회청색 별(`--hsh-pattern`). 새로고침마다 66px 칸마다 하나씩 무작위 위치·기울기.
- 방문 단계 글은 `status.js` 의 `VISIT_STEPS`. 글을 바꾸면 한글 서브셋 폰트도 다시 받아야 한다(아래).
- `prefers-reduced-motion: reduce` — 위글·타이핑·아이콘 모션 없이 완성 상태. 단계 글은 바뀌고 눌러서 들어간다.

## 폰트

Nanum Gothic Coding (SIL Open Font License 1.1). `src/fonts/` 에 라틴 서브셋과, 방문 단계 글에 쓰는 한글만 담은 서브셋이 있다.
한글 서브셋은 Google Fonts `css2?family=Nanum+Gothic+Coding&text=<쓰는 글자>` 의 woff2 를 받아 `nanum-gothic-coding-status.woff2` 로 바꾼다.
