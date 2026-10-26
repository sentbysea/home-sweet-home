// 주소 ↔ 방 창 화면. 창을 열거나 창 안에서 다른 화면으로 갈 때 주소만 바뀐다(pushState — 페이지는 다시 불러오지 않는다).
//   /                              홈(창 없음)
//   /about /teatime /notice /neighbor /archive   방 버튼(data-label → ROOM_PATHS)
//   /neighbor/banner               neighbor 의 '배너교환은 여기에서'(내 배너)
//   /category/:id                  글 · 갤러리 · 메모 목록(:id 는 카테고리 id 또는 slug — 버튼의 data-category 그대로)
//   /category/:id/folder/:fid      폴더
//   /category/:id?page=N           갤러리 N 쪽
//   /category/:id(/folder/:fid)/read   이어서 읽기(그 칸의 글을 한 화면에)
//   /post/:id                      글 하나(hongjiwon.love 와 같은 주소 모양)
//   /post/:id/quote                Quote(주인)
//   관리자 /admin/ · Quote 화면 /quote.html · 정적 파일과는 겹치지 않는다(아래 모양 밖은 전부 홈).
//   음악 · 조명 · 이스터에그(시계 말풍선 · D-day)에는 주소를 붙이지 않는다.
//   GitHub Pages 는 없는 주소에 404.html 을 준다 — 404.html 이 /?route=<주소> 로 돌려보내고 index.html 이 주소를 되돌린다.

export const ROOM_PATHS = {
  'about __VE': 'about',
  'teatime?': 'teatime',
  notice: 'notice',
  neighbor: 'neighbor',
  archive: 'archive',
};

// 시험용 주소 값(?content-origin · ?plan · ?reduced)은 화면을 옮겨도 남긴다 — 새로고침해도 같은 조건으로
const KEEP = ['content-origin', 'plan', 'reduced'];

/** 경로 + 지금 주소의 시험용 값 */
export function withKeep(path, extra = '') {
  const now = new URLSearchParams(location.search);
  const q = new URLSearchParams(extra);
  for (const k of KEEP) if (now.has(k) && !q.has(k)) q.set(k, now.get(k));
  const s = q.toString();
  return `${path}${s ? `?${s}` : ''}`;
}

const enc = encodeURIComponent;

/** 창 화면(room-window 의 step) → 주소 */
export function pathOf(view) {
  if (!view) return '/';
  if (view.page === 'banner') return '/neighbor/banner';
  if (view.page === 'content') {
    const s = view.state || {};
    if (s.view === 'quote' && s.post) return `/post/${enc(s.post)}/quote`;
    if (s.view === 'post' && s.post) return `/post/${enc(s.post)}`;
    const base = `/category/${enc(s.cat)}${s.folder != null ? `/folder/${enc(s.folder)}` : ''}`;
    if (s.view === 'series') return `${base}/read`;
    if (s.folder != null) return base;
    if (Number(s.page) > 1) return `${base}?page=${Number(s.page)}`;
    return base;
  }
  const slug = ROOM_PATHS[view.detail?.label];
  return slug ? `/${slug}` : '/';
}

/**
 * 주소 → 무엇을 열지(없으면 null = 홈)
 * @returns {null | { room: string, page: 'room' | 'banner' } | { category: string, folder?: string, page?: number, read?: boolean } | { post: string, quote?: boolean }}
 */
export function parsePath(pathname, search = '') {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return null;
  const [head, a, b, c] = parts;
  const room = Object.entries(ROOM_PATHS).find(([, slug]) => slug === head)?.[0];
  if (room && parts.length === 1) return { room, page: 'room' };
  if (room === 'neighbor' && a === 'banner' && parts.length === 2) return { room, page: 'banner' };
  if (head === 'category' && a) {
    const rest = parts.slice(2);
    const read = rest[rest.length - 1] === 'read';
    if (read) rest.pop();
    if (!rest.length || (rest.length === 2 && rest[0] === 'folder')) {
      const page = Number(new URLSearchParams(search).get('page')) || 1;
      return { category: a, folder: rest[1] ?? null, page, read };
    }
  }
  if (head === 'post' && /^\d+$/.test(a || '') && (parts.length === 2 || (b === 'quote' && parts.length === 3))) {
    return { post: a, quote: b === 'quote' };
  }
  return null;
}
