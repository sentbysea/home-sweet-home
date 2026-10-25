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
src/loader/status.js    방문 단계(초인종 → 달려나옴 → 문 → 신발) · 들어가기 안내
src/loader/enter.js     화면 누르기(키보드 Enter 도 받음)
src/loader/ready.js     준비 완료 신호(createReadySignal / demoReady)
src/loader/exit.js      페이드 아웃 후 DOM 제거
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

1. 집이 위글거리고 home → sweet → home → `...` 를 타이핑한다. 다 쓰면 잠시 머물렀다 지우고 다시 쓴다(들어갈 때까지 반복).
2. 집 아래에 방문 단계가 차례로 뜬다 — 초인종 누르는 중 → (차우연이 · 홍지원이 중 랜덤) 달려나오는 중 → 문 열리는 중 → 신발 벗는 중. 글·아이콘에 손그림 위글(SVG 필터).
3. 첫 타이핑 · 네 단계 · 준비 완료가 모두 끝나면 `화면을 눌러 들어가기`(모바일·데스크톱 같은 문구).
4. 화면을 누르면(키보드 Enter 도 됨) 서서히 사라지고 빈 흰 화면.

- 윤곽: 조금씩 다른 4장을 190ms 씩 번갈아(`--hsh-boil-frame`). 집 크기·위치는 움직이지 않는다.
- 방문 단계 글은 `status.js` 의 `VISIT_STEPS`. 글을 바꾸면 한글 서브셋 폰트도 다시 받아야 한다(아래).
- `prefers-reduced-motion: reduce` — 위글·타이핑·아이콘 모션 없이 완성 상태. 단계 글은 바뀌고 눌러서 들어간다.

## 폰트

Nanum Gothic Coding (SIL Open Font License 1.1). `src/fonts/` 에 라틴 서브셋과, 방문 단계 글에 쓰는 한글만 담은 서브셋이 있다.
한글 서브셋은 Google Fonts `css2?family=Nanum+Gothic+Coding&text=<쓰는 글자>` 의 woff2 를 받아 `nanum-gothic-coding-status.woff2` 로 바꾼다.
