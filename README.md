# home sweet home

바이브.me — 로딩 화면 · 평면도 · 방 창. SVG + CSS + ES 모듈, 빌드 · 설치 없음.
글 · 갤러리 · 메모와 관리자는 hongjiwon.love 와 같은 데이터 · 코드를 쓴다(아래).

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
2. 집 아래에 방문 단계가 차례로 뜬다 — 초인종 누르는 중 → (랜덤) 차우연이 뛰어나오는 중 · 홍지원이 걸어나오는 중 → 문 열리는 중. 작은 글도 같은 방식으로 흔들린다.
3. 마지막 점을 찍자마자 `집을 눌러 들어가기`(모바일·데스크톱 같은 문구). 동시에 집 윤곽을 꼭짓점 → 왼쪽 → 아래 → 오른쪽으로 굵은 선이 빠르게 덧그린다(`draw.js`).
4. 집을 누르면(키보드 Enter 도 됨) 글자는 숨고 집이 사용자 쪽으로 다가오며(확대) 평면도로 넘어간다.

- 윤곽: 조금씩 다른 4장을 190ms 씩 번갈아(`wobble.js`). 집 크기·위치는 움직이지 않는다.
- SVG 필터는 쓰지 않는다 — iOS Safari 에서 필터 영역이 검게 깜빡였다.
- 배경: 아이보리(`--hsh-paper`) 위에 회청색 별(`--hsh-pattern`). 새로고침마다 66px 칸마다 하나씩 무작위 위치·기울기.
- 방문 단계 글은 `status.js` 의 `VISIT_STEPS`. 글을 바꾸면 한글 서브셋 폰트도 다시 받아야 한다(아래).
- `prefers-reduced-motion: reduce` — 위글·타이핑·아이콘 모션 없이 완성 상태. 단계 글은 바뀌고 눌러서 들어간다.

## 글 · 갤러리 · 메모 (hongjiwon.love 연동)

hongjiwon.love 와 **같은 Supabase 원본**을 그대로 읽는다(복사본 없음 — 그쪽에서 쓰고 · 고치고 · 지우면 바로 보인다).
본문 렌더러 · Quote Preset 규칙 · 관리자 화면은 hongjiwon.love 의 파일을 **같은 배포 판으로 실시간으로 불러 쓴다**
(`src/content/remote.js` — 그쪽 `core/build-version.js` 를 먼저 읽고 같은 `?v=` 로). 서식을 이 저장소에 다시 적지 않는다.

```
src/content/remote.js         그쪽 파일 불러오기(같은 판) · ?content-origin=http://localhost:8788 (로컬에서만)
src/content/supabase.js       클라이언트 하나(neighbor · 글 창 · 관리자) — 공개 키만, 권한은 DB(RLS · RPC)
src/content/data.js           조회 — 카테고리 · 폴더 트리 · 갤러리 페이지 · 글 · 비밀글/폴더 비밀번호(그쪽과 같은 쿼리 · 정렬)
src/content/render.js         본문 — 그쪽 renderPostDetailBody 와 같은 길(프리셋 → renderStyledPostContentInto → 글자 크기 ±)
src/content/images.js         본문 · 갤러리 사진 — 그쪽 /api/post-cover(잠긴 사진은 머리글로 표를 실어 fetch)
src/content/viewer.js         창 안쪽 — 목록(log) · 쪽지(memo) · 폴라로이드(gallery) · 글 · 비밀번호 칸
src/content/home-settings.js  Settings > Home(바이브.me 전용 키) → 탭 제목 · 파비콘 · 커서
src/styles/content.css        창 안쪽 모양(본문 안은 건드리지 않는다)
admin/index.html              관리자 — 그쪽 /admin/ 같은 판을 받아 띄운다(src/admin/shell.js)
```

### 평면도 버튼에 연결하기

버튼(`.hsh-sticker`)에 `data-category` 를 달면 그 카테고리 창이 열린다. 값은 카테고리 **id 또는 slug**
(이름은 관리자에서 바뀔 수 있어 쓰지 않는다). 지금 카테고리: LOG `1`(slug `still`) · PIC `2`(`with`, gallery) · MEMO `3`(`you`).
`data-look` 은 모양 — `log`(목록) · `memo`(쪽지) · `gallery`(사진 칸), 비우면 카테고리 유형대로.
`tools/floorplan.mjs` 의 `tag()` 마지막 칸으로 준다:

```js
tag('e', 'log', '기록', 712, 1180, '#cfe0fb', '#8a62dc', 3, { category: 1 });
tag('kitchen', 'memo', '메모', 662, 462, '#fbd5e3', '#4a98e4', 3, { category: 3, look: 'memo' });
tag('living', 'pic', '사진', 582, 726, '#fbefae', '#e8893a', -2, { category: 2 });
```

`node tools/floorplan.mjs` 로 `src/plan/floorplan.svg` 를 다시 만든다. 버튼이 아닌 곳에서 열려면
`.hsh-plan` 에 `hsh:room` 이벤트(detail `{ room, label, name, bg, fg, category, look }`)를 보낸다.

- 목록 → 폴더 → 글로 갈 때마다 창 기록이 한 칸씩 쌓인다(< > · 휴대폰 뒤로 가기). 목록으로 돌아오면 스크롤 자리 그대로.
- 공개 범위는 DB 가 정한다 — 비공개 글 · 나만 보기 폴더는 방문자에게 오지 않고, 비밀글 · 비밀번호 폴더는 칸에 비밀번호를 넣어야 열린다.
- HTML 모드 글은 shadow root 안에 그린다(글 안 `<style>` 이 홈 화면에 번지지 않게) — 화면보다 넓으면 그쪽과 같은 계산으로 줄인다.
- 글쓰기 · 고치기 · Quote 발췌 이미지 만들기는 hongjiwon.love 에서(주인에게는 글 아래 링크).

### 관리자 `/admin/`

SETTINGS(HOME · CATEGORY) · QUOTE PRESET · DASHBOARD. 로그인은 Google(같은 계정), 주인 계정이 아니면 화면을 닫는다.

- HOME — 키 `vibe_site_title` · `vibe_site_favicon_url` · `vibe_site_cursor`(같은 `site_settings` 표, hongjiwon.love 값과 따로).
- CATEGORY · QUOTE PRESET — hongjiwon.love 와 **같은 데이터**. 바꾸면 두 사이트에 같이 반영된다.
- DASHBOARD — hongjiwon.love `/api/ops`(그쪽이 이 출처에만 CORS 를 연다). 통계는 hongjiwon.love 방문 기준.

## 폰트

Nanum Gothic Coding (SIL Open Font License 1.1). `src/fonts/` 에 라틴 서브셋과, 방문 단계 글에 쓰는 한글만 담은 서브셋이 있다.
한글 서브셋은 Google Fonts `css2?family=Nanum+Gothic+Coding&text=<쓰는 글자>` 의 woff2 를 받아 `nanum-gothic-coding-status.woff2` 로 바꾼다.
