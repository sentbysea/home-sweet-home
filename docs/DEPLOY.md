# 배포 — 글 · 갤러리 · 메모 · 관리자 · Quote (hongjiwon.love 연동)

두 저장소가 같이 움직인다. 바이브.me 는 hongjiwon.love 의 파일을 **그 사이트의 지금 배포 판**으로 불러 쓰므로,
web 을 먼저 배포한다. 순서가 바뀌어도 깨지지는 않는다(아래 "한쪽만 배포된 동안").

| 저장소 | 브랜치 | 배포 |
| --- | --- | --- |
| `sentbysea/hongjiwon.love`(로컬 `web`) | `feat/vibe-me-cross-site` | main 머지 → Cloudflare Pages 자동 빌드 |
| `sentbysea/home-sweet-home` | `feat/content-admin` | main 머지 → GitHub Pages(정식 주소 ho.바이브.me) |
| `sentbysea/vibe-me-redirect` | main | 옛 주소 바이브.me → ho.바이브.me 로 넘기기(아래 "주소") |
| `sentbysea/hongjiwon-ops` | 바꾸지 않음 | — |

## 0. Supabase(콘솔에서만)

Authentication → **URL Configuration** → Redirect URLs 에 두 줄이 있는지 보고, 없으면 더한다(Site URL 은 그대로 `https://hongjiwon.love`).

```
https://ho.xn--9g3b29an0p.me/admin/
https://ho.xn--9g3b29an0p.me/
https://xn--9g3b29an0p.me/admin/
https://xn--9g3b29an0p.me/
```

- 옛 주소 두 줄은 지우지 않는다 — 옮기기 전에 열어 둔 탭에서 로그인하면 옛 주소로 돌아오고, 그 주소가 해시(#access_token)째 새 주소로 넘긴다.

- 지우지 않는다: `https://hongjiwon.love/admin/` 와 기존 pages.dev · localhost 줄(hongjiwon.love 로그인용).
- `www.` 주소는 넣지 않아도 된다 — www · http 는 옛 주소로 모인 뒤 새 주소로 넘어간다(아래 "주소").
- 바이브.me 홈(neighbor 방 edit)은 늘 `/` 로, 관리자는 `/admin/` 로 돌아오게 되어 있다(src/content/supabase.js `HOME_REDIRECT`, 그쪽 admin-session.js).
- 목록에 없는 주소면 Supabase 가 Site URL(hongjiwon.love)로 보낸다 — 로그인 뒤 hongjiwon.love 로 가 버리면 이 줄이 빠진 것이다.
- Google Cloud 의 OAuth 리디렉션 URI 는 Supabase 콜백이라 바꾸지 않는다.
- DB · migration 변경은 없다(새 키 `vibe_site_title` · `vibe_site_favicon_url` · `vibe_site_cursor` 는 기존 `site_settings` 행일 뿐).

## 1. web 배포

머지 전 로컬: `node tests/functions/post-cover-test.mjs` · `ops-proxy-test.mjs` · `og-post-test.mjs` · `tests/e2e/*` 와
이 저장소의 `npm run e2e`(WEB_DIR=web 작업 트리).

배포 뒤 확인(hongjiwon.love 그대로인지 먼저):
- hongjiwon.love 공개 글 · 사진 · 관리자 로그인 · DASHBOARD 가 전과 같다.
- `curl -s https://hongjiwon.love/core/build-version.js | grep APP_BUILD_VERSION` — 새 커밋.
- `curl -sI -X OPTIONS -H "Origin: https://ho.xn--9g3b29an0p.me" https://hongjiwon.love/api/ops/stats` → 204 + `access-control-allow-origin: https://ho.xn--9g3b29an0p.me`
- `curl -sI -X OPTIONS -H "Origin: https://evil.example" https://hongjiwon.love/api/ops/stats` → 405, CORS 없음
- `curl -sI -X OPTIONS -H "Origin: https://ho.xn--9g3b29an0p.me" "https://hongjiwon.love/api/post-cover?image=00000000-0000-4000-8000-000000000000"` → 204
- `curl -s -o /dev/null -w "%{http_code}" https://hongjiwon.love/posts/preview/posts-excerpt-range.js` → 200

## 2. 바이브.me 배포

배포 뒤 확인:
- 로그아웃 상태: 평면도 · 방 창(about · notice · neighbor)이 전과 같다. 버튼을 붙였다면 글 창 목록 → 글 → 뒤로.
- 주소: `/notice` · `/neighbor/banner` · `/category/1` · `/post/<공개 글>` 를 주소창에 바로 넣기 · 새로고침 · 뒤로/앞으로 · × → `/`.
  없는 주소(`/nope`)는 홈. `/admin/` 은 관리자 그대로.
  창 주소로 바로 들어오기 · 새로고침 · × 로 `/` — 로딩 화면이 한 번도 비치지 않는다(PC · 휴대폰). `/` 로 들어오면 로딩 → 집 누르기.
- 이웃 방(`/neighbor`)에서 edit → Google 로그인 → `/neighbor` 로 돌아와 고치기 모드.
- `https://ho.xn--9g3b29an0p.me/admin/` → Google 로그인 → **바이브.me 로 돌아와** 관리 화면(주인 계정).
  다른 Google 계정이면 "사이트 주인 계정으로만" 이 떠야 한다.
- HOME 에서 제목 저장 → 바이브.me 새로고침 → 탭 제목. hongjiwon.love 탭 제목은 그대로.
- CATEGORY · QUOTE PRESET 은 운영 데이터다 — 바꿔 볼 때는 되돌릴 값을 적어 두고 확인 뒤 되돌린다.
- DASHBOARD 숫자가 hongjiwon.love 관리자와 같다. 인기 글을 누르면 hongjiwon.love 글이 새 탭으로.
- 주인으로 글 창 → quote → 시작점 · 끝점 → 미리보기 → export. 이미지가 hongjiwon.love 에디터 발췌와 같은지(같은 글 · 같은 프리셋) 나란히 본다.
- 비밀글(정답) · 비공개 글(주인)의 사진이 보인다. 비밀번호 폴더 안 사진도.

## 주소 — 정식 ho.바이브.me, 옛 바이브.me 는 넘기기

| 주소 | 무엇 | 설정 |
| --- | --- | --- |
| `https://ho.xn--9g3b29an0p.me` | 이 저장소(GitHub Pages) | 후이즈 DNS `ho` CNAME → `sentbysea.github.io.` · Pages Custom domain · 저장소 `CNAME` |
| `https://xn--9g3b29an0p.me` · `www.` | `sentbysea/vibe-me-redirect`(GitHub Pages) | 후이즈 DNS 그대로(A 185.199.108~111.153 · www CNAME → `sentbysea.github.io.`) |

- 옛 주소는 어떤 경로든 `https://ho.xn--9g3b29an0p.me` + 같은 경로 · 쿼리 · 해시로 넘긴다(index.html · 404.html 의 location.replace).
  GitHub Pages 는 다른 호스트로 301 을 못 해서 문서가 넘긴다 — `/` 는 새 주소 로딩 → 홈, `/post/13` 같은 주소는 로딩 없이 그 창.
- 주소마다 브라우저 저장소가 따로라 새 주소에서는 로그인(주인 edit · 관리자) · 방 하트 · 이웃 보기 방식 · 입주 신청 적던 글 · 비밀글 사진 열람(sessionStorage) 같은 이 브라우저 기억이 처음부터다 — 한 번 다시 로그인하면 된다.
- hongjiwon.love CORS(`/api/ops` · `/api/post-cover`)는 새 주소 · 옛 주소 둘 다 연다(web `functions/`).

## 배포 뒤에만 확인할 수 있는 것

- 실제 Google 로그인 왕복(복귀 주소 허용 목록) · 주인 판정(`site_owner_id()`).
- 실제 Worker 를 거친 DASHBOARD(CORS · 주인 토큰), 운영 Storage 의 비밀글 · 비공개 사진.
- 실제 기기(iOS Safari · 카카오톡 인앱)의 Quote export(다운로드 · 공유 시트 · 클립보드 copy). iframe 에 `allow="clipboard-write; web-share"` 를 준다.
- 운영 데이터의 사진 든 글(지금 운영에는 공개 사진 글이 없다).

## 한쪽만 배포된 동안

- web 만 새것: hongjiwon.love 는 그대로(새 CORS 는 바이브.me 출처에만, 새 파일은 그 사이트가 부르지 않는다). 지금 바이브.me(main)는 neighbor 방만 Supabase 를 쓴다 — 영향 없음.
- 바이브.me 만 새것(web 은 예전 판): 글 · 목록 · 비밀글 본문 · Quote 생성(글 전체)은 된다. 비밀글 · 비공개 · 잠금 폴더 **사진**은 빈칸,
  부분 발췌 버튼은 꺼지고 안내가 뜨며, DASHBOARD 는 "불러오지 못했습니다". web 배포 뒤 새로고침하면 된다(바이브.me 는 다시 배포할 필요 없음).

## 되돌리기

- 바이브.me: main 에서 머지 커밋을 `git revert -m 1 <머지>` → push(GitHub Pages 가 다시 빌드). 데이터는 건드리지 않았으므로 되돌릴 것 없음.
  Home 값(`vibe_site_*`)은 남아도 예전 화면이 읽지 않는다.
- web: Cloudflare Pages → Deployments → 직전 배포 → **Rollback to this deployment**(즉시). 그 뒤 main 에서 revert 커밋.
  바이브.me 가 이미 새것이면 위 "바이브.me 만 새것" 상태가 된다(깨지지 않음).
- Supabase 복귀 주소 두 줄은 남겨 둬도 해가 없다(그 주소로만 돌아갈 수 있게 하는 허용 목록).
