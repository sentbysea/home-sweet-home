// 방 대사 — 방에 들어가면 화면 아래 대화창(talk/box.js)에 한 줄씩 나온다. 대사만 여기서 고치면 된다.
//   방 이름은 주소(plan/routes.js ROOM_PATHS)와 같다: about · teatime · notice · neighbor · archive
//   한 줄 = [화자, 대사] — 한 번에 한 문장. 화자는 아래 SPEAKERS 의 이름 그대로.
//   대사가 없는(목록에 없는) 방은 대화창이 뜨지 않는다.
//   끝까지 본 대화는 다시 뜨지 않는다(이 브라우저 기준). 대사를 고치거나 더하면 새 대화로 보고 한 번 더 뜬다.

/** 화자 — 이름표 글자 · 바탕색(base.css 파스텔) */
export const SPEAKERS = {
  차우연: { color: 'var(--hsh-butter)' }, // 연노랑
  홍지원: { color: 'var(--hsh-sky)' }, // 연하늘
};

export const TALKS = {
  archive: [
    ['차우연', '야, 열쇠고리 어디에 뒀었지?'],
    ['홍지원', '그걸 와 나한테 묻는데.'],
    ['홍지원', '...니 화장대 위에 있더라.'],
    ['차우연', '여기 있다! 땡큐.'],
  ],
};
