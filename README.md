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
src/loader/typing.js    타이핑 — 글자 opacity 만 바꿔 위치 고정
src/loader/ready.js     준비 완료 신호(createReadySignal / demoReady)
src/loader/exit.js      페이드 아웃 후 DOM 제거
src/loader/index.js     runLoader — 타이핑 완료 + 준비 완료 → 종료
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

끝나면 `document` 에 `hsh:loader-done` 이벤트가 온다.

## 모션

- 윤곽: 조금씩 다른 4장을 190ms 씩 번갈아(`--hsh-boil-frame`). 집 크기·위치는 움직이지 않는다.
- 글자: home → sweet → home → `...` 순서로 한 글자씩.
- `prefers-reduced-motion: reduce` — 위글·타이핑 없이 완성 상태, 준비되면 바로 종료.

## 폰트

Nanum Gothic Coding (SIL Open Font License 1.1) 라틴 서브셋을 `src/fonts/` 에 담았다.
