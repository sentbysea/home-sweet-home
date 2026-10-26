// archive 열쇠꾸러미에 다는 사이트 — 이름 · 주소 · 오브젝트 · 순서를 여기 한곳에서만 고친다.
//   url     비워 두면 열쇠는 보이지만 누르거나 링크를 눌러도 밖으로 나가지 않는다(시안).
//   object  'bird'(새 키링 + 열쇠) · 'diary'(일기장 키링 + 열쇠) · 'heart'(하트 자물쇠 + 하트 열쇠) · 'house'(집 모양 머리 열쇠)
//   tone    열쇠 색 — 'silver' · 'butter'. 비우면 오브젝트 기본값
//   order   꾸러미에 매달리는 순서(작을수록 앞)
//   다른 갠홈은 object: 'house' 줄을 더 붙이면 된다(id 는 겹치지 않게).

export const ARCHIVE_LINKS = [
  { id: 'twitter', name: 'twitter', url: '', object: 'bird', order: 1 },
  { id: 'tistory', name: 'tistory', url: '', object: 'diary', order: 2 },
  { id: 'luvlog', name: 'luvlog', url: '', object: 'heart', order: 3 },
  { id: 'home-1', name: '다른 갠홈', url: '', object: 'house', order: 4 },
];

/** 순서대로, 주소는 http(s) 만 */
export function archiveLinks(list = ARCHIVE_LINKS) {
  return [...list]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url || '') ? l.url : '' }));
}
