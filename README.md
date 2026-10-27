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

## 주소

창마다 고유 주소가 있다(`src/plan/routes.js`). 창을 열거나 창 안에서 옮겨 가면 주소만 바뀐다 — 페이지는 다시 불러오지 않고,
집 배경 · 창 열리는 모양은 그대로다. 직접 들어오기 · 새로고침 · 뒤로/앞으로 모두 주소의 창을 연다. × · 덮개 · Esc 는 홈 `/` 로.

로딩 화면(집 누르기)은 홈 `/` 로 들어올 때만. 창 주소로 들어오거나(새로고침 · 공유 링크 · 로그인에서 보던 창으로 돌아오기)
그 창을 닫아 `/` 로 가도 로딩 화면은 나오지 않는다 — `index.html` 머리 스크립트가 첫 화면 전에 `data-hsh-entry="direct"` 를 달아
로딩 화면을 그리지 않고, 평면도는 다 그려진 채로 깔린다. 글을 받는 동안의 "불러오는 중" 은 창 안에만.
창에서 새로고침한 뒤 닫으면 브라우저가 홈 칸 문서를 새로 불러오는데, 창을 열 때 홈 칸에 남겨 둔 표시(`history.state.hshHome`)로 그때도 로딩 없이.

| 주소 | 화면 |
| --- | --- |
| `/` | 홈(창 없음) |
| `/about` `/teatime` `/notice` | 방 버튼 창(about __VE — 글자 아트 · 짧은 글 · teatime? · notice) |
| `/neighbor` | 이웃 마을(창 대신 아이보리 화면 — 아래 "neighbor") |
| `/archive` | 열쇠꾸러미(창 대신 아이보리 화면 — 아래 "archive") |
| `/neighbor/banner` | neighbor 우체통의 배너 교환 패널(입주 신청 · 주인은 받은 신청) |
| `/neighbor/mine` | neighbor 홍차네 집의 내 배너(이미지 · 주소 · 삽입 코드 복사) — 바이브.me 전용 이미지 `user-banners/{owner}/vibe-banner`(hongjiwon.love 는 `/banner`), 주인은 여기서 바꾼다 |
| `/pair` | about __VE 방 창에 Vibe · Echo 카드 두 장(예전 about 내용) |
| `/category/:id` · `/category/:id/folder/:fid` · `/category/:id?page=N` | 글 · 갤러리 · 메모 목록 · 폴더 · 갤러리 쪽(`:id` 는 id 또는 slug) |
| `/category/:id/read` · `/category/:id/folder/:fid/read` | 이어서 읽기 — 그 칸의 글을 목록 순서대로 한 화면에 |
| `/post/:id` · `/post/:id/quote` | 글 · Quote(주인) — hongjiwon.love 와 같은 글 주소 모양 |

- 그 카테고리 버튼이 아직 평면도에 없어도 주소로 열린다(기본 색 창, 제목은 카테고리 이름). 버튼을 붙이면 그 버튼 색 · 이름.
- 볼 수 없는 글(비공개 · 없는 글)은 창 안에 안내만 — 제목 · 내용은 오지 않는다(RLS).
- 음악 · 조명 · 이스터에그(시계 말풍선 · D-day)에는 주소가 없다. 방명록은 아직 없는 화면이라 주소도 없다.
- `/admin/` · `/quote.html` · 정적 파일과 겹치지 않는다. 그 밖의 주소는 홈.
- GitHub Pages: 없는 주소에 `404.html` → `/?route=<주소>` 로 보내고 `index.html` 이 주소(와 새로고침이면 그 칸의 화면)를 되돌린다.
  `index.html` 의 `<base href="/">` 로 상대 주소는 늘 루트 기준. 로컬 `npm run dev` 도 같은 404 처리.
- 이웃 로그인: 복귀 주소는 허용 목록의 `/` 하나, 로그인 전에 보던 주소는 적어 두었다가(sessionStorage) 돌아온 뒤 그 창을 연다.
  관리자는 `/admin/` 그대로.

## archive (열쇠꾸러미)

홈의 archive 버튼 · `/archive` — 브라우저 창 꼴 대신 아이보리 화면(홈과 같은 바탕) 가운데 3D 열쇠꾸러미. 내 계정 · 사이트 주소 모음.

```
src/archive/links.js     사이트 목록 — 이름 · 주소 · 오브젝트 · 순서(여기만 고친다)
src/archive/shapes.js    열쇠 · 키링 2D 윤곽(둥근 머리 · 하트 머리 · 집 머리 열쇠, 새 · 일기장 · 하트 자물쇠, 천 라벨)
src/archive/keyring.js   three.js 장면 — 손그림 떨림 윤곽을 얇게 뽑은 조각, 고리에 매달린 진자, 끌어 돌리기 · 관성 · 고르기
src/archive/index.js     화면 — ← home · 사이트 버튼 줄 · '이름 ↗' 링크 · 이름표 · 3D 못 쓸 때 목록 · 닫으면 정리
src/styles/archive.css
```

- 사이트 더하기 · 고치기: `links.js` 의 `ARCHIVE_LINKS` 한 줄(`label` 은 아래 링크 글자 — love 는 hongjiwon.love). `url` 이 비어 있으면 열쇠 · 이름은 보이되 밖으로 나가지 않는다(링크 비활성 · "준비 중").
  지금: twitter(x.com/3luespark) · tistory(3luespark.tistory.com) · luvlog(v.luvlog.me) · love(hongjiwon.love).
  다른 갠홈은 `object: 'house'` 줄을 더 붙이면 열쇠가 하나씩 늘어난다(색은 은색 · 버터색, 창 색은 하늘 · 연보라 · 버터를 번갈아).
- 조작: 끌면 꾸러미가 돌고(위아래는 조금) 놓으면 관성으로 돌다 멈춘다. 열쇠마다 고리의 한 점에 매달린 진자라 따로 흔들리고,
  각도는 한도 안이라 떨어지거나 화면 밖으로 날아가지 않는다. 열쇠 한 번 → 앞으로 나오며 이름표, 아래에 '이름 ↗'.
  같은 열쇠를 또 누르거나 링크 → 새 탭. (고른 열쇠는 제자리에서 화면 쪽으로 나오고 커진다) 다른 열쇠 → 선택 바뀜, 빈 곳 → 풀림, 5px(손가락 10px) 넘게 끌면 누름이 아니다.
  아래 버튼 줄로도 고른다(키보드 Tab · ← → · Enter). Esc 는 선택 풀기 → 한 번 더 누르면 홈.
- home sweet home 가죽 이름표: 작은 고리로 큰 고리 오른쪽 끝에 걸려 아래로 늘어진다(세로 글씨, 마지막 home 옆에 빨간 집, 맨 앞 줄).
- 배치: 고리를 거의 정면으로 보고 왼쪽부터 파랑새 · twitter · tistory · luvlog · love 열쇠 · home sweet home 이름표로 펼친다.
  조각은 먼 것부터 하나씩 통째로 덧그려(drawLayered) 흔들려도 서로 뚫고 지나가 보이지 않는다 — 이름표 · 파랑새 · 고른 열쇠가 앞.
- 손그림: 윤곽은 짙은 회색(`#55595d`, 평면도 선보다 한 단 짙게), 굵기가 조금씩 다르고 3장이 190ms 마다 바뀐다(평면도 위글과 같은 박자).
  색은 툰 3단 그늘뿐 — 금속 반짝임 없음. 라벨 글씨는 로딩 화면 글꼴(Nanum Gothic Coding).
- three.js(`three@0.169.0`)는 jsDelivr 에서 archive 를 열 때만 받는다 — 홈 첫 화면 무게는 그대로. WebGL 이 없거나 못 받으면 같은 데이터로 목록.
- 모션 줄이기: 저절로 흔들림 · 위글 · 관성 없이(손으로 돌리기 · 고르기는 그대로). archive 를 벗어나면 그리기를 멈추고 WebGL 자원 · 캔버스를 정리한다.

## neighbor (이웃 마을)

홈의 neighbor 버튼 · `/neighbor` — 아이보리 화면의 손그림 마을. 가운데 홍차네 집(옆 우체통), 둘레에 배너를 교환한 이웃집들이
느슨하게 모여 있다. 집마다 아래 이름표(사이트 이름) — 밑줄 색은 그 집에 쓴 색(벽 · 지붕 · 문) 중 하나이고, 배너 링크를 올렸을 때 밑줄도 같은 색. 배너는 평소에 숨기고, 집을 고르면 그 집 위에 하나만 보인다.

```
src/neighbor/house-art.js   집 렌더러(마을 · 신청 미리보기 · 집 고치기 공통) — 몸체 · 지붕 · 문 · 창 · 장식 조합, 손그림 선, 기본 모양, 배너 색 뽑기
src/neighbor/village.js     마을 — 배치 · 둥실 · 배너 미리보기(올리기 · 포커스 · 탭) · 우체통
src/neighbor/customizer.js  우리 집 꾸미기 — 아이콘 · 색 칩 · 랜덤 · 배너 색으로
src/neighbor/panel.js       패널 — 내 배너(복사) · 입주 신청 + 꾸미기 · 받은 신청(주인) · 간판 걸기 · 이웃집 고치기
src/neighbor/data.js        배너 목록(house 포함) · 내 배너(MY_BANNER) · 신청 · 주인 RPC
src/neighbor/index.js       화면 — ← home · 데이터 · 주인 edit(주인에게만) · 위글 박자 · 닫으면 정리
src/styles/neighbor.css
```

- 배치: 늘 세 줄, 줄마다 어긋난 벽돌 자리(바둑판이 아니게). 첫 화면 가운데 홍차네 집, 화면 안 자리는 그 둘레부터 가까운 순서로(정렬 순서대로) 채우고,
  넘치면 오른쪽으로 이어 붙여 가로 스크롤(휠 · 손가락 · 키보드) — 집은 줄이지 않는다. 칸 안 자리 · 높낮이는 칸 번호로 정한 작은 어긋남이라
  새로고침 · 고르기에도 그대로. 홍차네 집 오른쪽 칸은 우체통과 닿으면 비운다.
  이웃이 세 채까지면 홍차네 집 줄에 한 줄로(휴대폰은 화면에 맞게 다 같이 줄인다 · 이름표는 `.` `/` 뒤에서만 줄바꿈). 홍차네 집에 올리면 내 배너 말풍선.
  남는 둘레 칸 몇 곳에만 나무 · 울타리.
- 집 그림: 살짝 휘고 끝 · 모서리가 둥근 손그림 선(집 크기와 상관없이 같은 굵기) + 파스텔 단색. 선 변형 4장을 190ms 마다(로딩 · 평면도 위글과 같은 박자),
  꼭짓점은 그대로라 선이 벌어지지 않는다. 집마다 다른 주기로 2~4px 둥실. 배너 · 이름은 흔들지 않는다.
- 집 모양(`house`, v2): 몸체(아담 · 길쭉 · 넓은 · 2층 · 오두막) · 지붕(삼각 · 둥근 · 사다리꼴 · 헛간) · 지붕 무늬(민무늬 · 도트 · 망점 · 사선 줄무늬 · 체크 —
  사이트 스티커 무늬와 같은 결) · 문(둥근 · 네모 · 옆) · 창(하나 · 둘 · 동그란 · 격자 · 긴 창) · 장식 여러 개(굴뚝 · 화분 · 개집 · 우체통 · 작은 나무)
  · 벽 · 지붕 · 문 색(파스텔 칩만 — 마을 톤을 지키려고 직접 고르기는 없다). 굴뚝은 지붕 색 · 무늬를 따른다. 옛 꼴(v1 — 장식 하나)도 읽는다(다락창 · 없음은 장식 없음). `banners.house` 가 비어 있으면 배너 id 로 정한 기본 모양 — 새로고침해도 같다.
- 배너 보기: PC 는 집에 올리거나 Tab 포커스하면 집 위로 사라락(240ms), 집에서 배너로 옮겨도 그대로, 집을 누르면 새 탭.
  휴대폰은 한 번 누르면 배너 · 이름 · '방문하기 ↗', 방문하기를 눌러야 이동, 바깥 · 다른 집을 누르면 닫힘. 키보드 Enter → 방문하기, Esc → 닫기.
  한 번에 하나, 5:1 칸(비율이 다르면 가운데를 잘라 채움 · 주인이 올리는 파일은 올릴 때 5:1 로 잘림 — 움직이는 GIF 는 그대로), 화면 가장자리에서 잘리지 않게 자리를 고친다(위에 자리가 없으면 아래로).
- 우체통(위에 톡톡 튀어나오는 "여기요!" 낙서 강조선 · 떠는 빨간 깃발) → 배너 교환 패널(`/neighbor/banner`) — 탭 하나씩: 입주 신청 + 우리 집 꾸미기 · 받은 신청(주인만).
  내 배너(이미지 · 주소 · 이미지 주소 · 삽입 코드 복사)는 홍차네 집을 누르면(`/neighbor/mine`). 신청 이름은 선택 — 비우면 그 사이트 탭 제목(Edge Function `site-title`, 없으면 주소)
  (고르면 바로 미리보기, '랜덤으로 만들기', '배너 색으로 만들기' — 누를 때마다 같은 배너 색으로 다른 조합). 배너 색은 투명 픽셀을 빼고 뽑아 벽은 밝게 ·
  문은 벽과 대비 나게. 그 배너를 읽을 수 없으면 쉬운 말로 알리고 직접 고르기 · 랜덤은 그대로. 신청은 대기 목록에만 — **주인이 승인해야** 그 모습으로 마을에.
- 주인: 아래 `edit`(주인으로 로그인돼 있을 때만 보인다 — 로그인은 `/admin/`) → 집을 누르면 이웃집 고치기 — 탭 둘: 집 고치기(모양 · 색 · 기본 모양으로 · 내리기) · 내용 고치기(이름 · 주소 · 배너 이미지/파일), `+ add banner`(집 모양까지), `받은 신청 N`(신청한 집 미리보기 · 승인 · 거절).
- DB: web 저장소 `supabase/migrations/20261026100000_banner_requests.sql`(신청) · `20261027100000_neighbor_houses.sql`(집 모양 — `banners.house` ·
  `banner_requests.house` · 신청 RPC 에 `p_house` · `set_banner_house()`). **둘째는 아직 운영에 적용하지 않았다** — 적용 전에는 이웃집이 모두 기본 모양이고,
  신청은 '아직 신청을 저장할 수 없어요' 안내로 끝난다(성공처럼 보이지 않는다). 적용 순서 · 확인은 web 저장소 `supabase/README.md` 8단계.
  사이트 제목 읽기는 web 저장소 `supabase/functions/site-title`(`supabase functions deploy site-title --no-verify-jwt`) — 배포 전에는 이름을 비우면 주소가 이름이 된다.
- 모션 줄이기: 둥실 · 위글 · 배너 나타남 없이(배너 보기는 그대로).

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
- 글쓰기 · 고치기 · 지우기는 hongjiwon.love 에서(주인에게는 글 아래 링크).

### Quote(주인만)

글 머리의 `quote` → 발췌 구간 고르기 → `미리보기 →` 로 창 안에 Quote 화면이 열린다(copy · export).

- 구간: `시작점` · `끝점` 을 누르고 본문에서 그 자리를 탭한다(단어 · 대사 · 지문 단위로 맞춘다). 고르지 않으면 글 전체 — 그쪽 에디터 발췌와 같다.
  그려진 본문의 두 점 → 원본 HTML 구간은 그쪽 공용 파일 `posts/preview/posts-excerpt-range.js`(그쪽 배포 전이면 글 전체만).
- Quote 화면 = `quote.html`(같은 출처 iframe, `src/quote/studio.js`). 그쪽 `index.html` 의 CSS · posts 스크립트 · `posts/posts` 마크업을
  같은 판으로 깔고, 그쪽 에디터가 글을 열 때와 같은 함수(`setRichEditorContent` → `prepareEditorUI` → `applyPostPresetById` → `openEditorPreview`)를 부른다.
  페이지 나누기 · 프리셋 · 배경 · 사진 굳히기 · html2canvas 캡처 · 파일 이름이 그쪽과 같다. 조작 칸 모양만 `src/styles/quote.css`.
  iframe 인 까닭: 그쪽 에디터 스크립트가 선언하는 전역 이름이 글 창이 쓰는 이름과 겹친다.
- 저장(save) · 임시저장은 부르지 않는다. HTML 모드 글은 디자인 한 장(그쪽과 같다).

## 확인(E2E)

```sh
npm run e2e                     # node tests/e2e.mjs — 이웃 web 저장소(WEB_DIR, 기본 ../web)가 있어야 한다
npm run e2e -- --only=owner     # visitor · owner · admin · routing · mobile · layout · archive · neighbor (--browser=webkit)
```

web 저장소의 `tests/lib/harness.mjs`(Playwright · 정적 서버)와 `mock-supabase.mjs`(RLS 흉내 메모리 DB)를 쓴다 —
**운영 DB 에 닿지 않는다.** web 작업 트리를 "hongjiwon.love" 로 띄우고 그쪽 `functions/api/post-cover.js` · `ops/[[path]].js`
실제 코드를 돌린다. 방문자(잠금 폴더 · 비밀글 · 사진 표) · 주인(비공개 사진 · 부분 발췌 · export PNG 크기 · 사용 중 프리셋 바꾸기) ·
관리자(주인/다른 계정/로그아웃 · Home 저장과 새로고침 · Category · Quote Preset 이 두 사이트에 반영 · Dashboard) · 휴대폰.
Google 로그인 자체는 흉내 세션이다 — 실제 로그인은 배포 뒤에 확인한다.

### 관리자 `/admin/`

SETTINGS(HOME · CATEGORY) · QUOTE PRESET · DASHBOARD. 로그인은 Google(같은 계정), 주인 계정이 아니면 화면을 닫는다.
저장 버튼마다 옆에 적용 범위가 붙는다 — `바이브.me 에만`(HOME) · `두 사이트 함께`(CATEGORY · QUOTE PRESET 저장 · 사용 중 지정) ·
`hongjiwon.love 통계`(DASHBOARD). 글 창의 글자 크기 ± 는 주인이 누르면 두 사이트 방문자 기본값이 된다(`기본값 · 두 사이트`).

- HOME — 키 `vibe_site_title` · `vibe_site_favicon_url` · `vibe_site_cursor`(같은 `site_settings` 표, hongjiwon.love 값과 따로).
- CATEGORY · QUOTE PRESET — hongjiwon.love 와 **같은 데이터**. 바꾸면 두 사이트에 같이 반영된다.
- DASHBOARD — hongjiwon.love `/api/ops`(그쪽이 이 출처에만 CORS 를 연다). 통계는 hongjiwon.love 방문 기준.

## 폰트

Nanum Gothic Coding (SIL Open Font License 1.1). `src/fonts/` 에 라틴 서브셋과, 방문 단계 글에 쓰는 한글만 담은 서브셋이 있다.
한글 서브셋은 Google Fonts `css2?family=Nanum+Gothic+Coding&text=<쓰는 글자>` 의 woff2 를 받아 `nanum-gothic-coding-status.woff2` 로 바꾼다.
