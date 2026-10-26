// about __VE 방 — 글자로 지은 작은 집 한 채와 짧은 글. 집 아래로 글, 맨 끝에 글쓴이(가운데 · 본문보다 살짝 연하게).
//   Vibe · Echo 카드 두 장은 /pair 로 옮겼다(about.js).
//   집: 'homesweethome' 을 끊지 않고 이어 써서 굴뚝 · 지붕 · 벽을 채우고, 창 둘 · 문은 비워 둔다(고정폭 글꼴, 좌우 대칭).

const HOUSE = (() => {
  const W = 35; // 칸 수
  const C = 17; // 가운데 칸
  const ROOF = 3; // 지붕 첫 줄
  const WALL = 12; // 벽 첫 줄
  const END = 23; // 마지막 줄
  const filled = (x, y) => {
    if (y >= ROOF && y < WALL && Math.abs(x - C) <= 1 + (y - ROOF) * 2) return true; // 지붕
    if (x >= 24 && x <= 26 && y >= 1 && y < ROOF + 5) return true; // 굴뚝
    if (y < WALL || x < 3 || x > 31) return false;
    if (y >= 14 && y <= 16 && ((x >= 6 && x <= 11) || (x >= 23 && x <= 28))) return false; // 창
    if (y >= 17 && x >= 14 && x <= 20) return false; // 문
    return true;
  };
  const unit = 'homesweethome';
  let k = 0;
  const rows = [];
  for (let y = 0; y <= END; y++) {
    let row = '';
    for (let x = 0; x < W; x++) row += filled(x, y) ? unit[k++ % unit.length] : ' ';
    rows.push(row.trimEnd());
  }
  return rows.join('\n').replace(/^\n+/, '');
})();

const BODY = [
  '선생님도, 부모님도 없는 곳. 지붕이 없는 강당, 책이 없는 학교. 존재하는 것은 오로지 또래뿐이다. 하나와 하나로서만 존재했던 둘의 지루하고 재미없는 청소년기 속에 희미하게 남아 있던 동갑내기를. 우연의 품에 그 애의 눈 색을 닮은 프리지아가 활짝 피어나 있는 순간을, 아주 오래도록 바라보았다. 졸업의 의의는 바이바이에 있었고, 우리는 이미 산뜻한 작별을 배운 뒤였다. 학사모 대신 열두 살과 열세 살의 검정 훈련모가 인공 노을 아래서 자리를 지켰다. 이것은 소년기와의 작별. 집으로 돌아가고 싶었던 오랜 밤들과의 영원한 안녕.',
  '홍지원은 이제 새로운 집을 찾았다. 그 집에 같은 나이의 여자애가 살았다. 스물둘이 되어 기어이 알아보았다. 일어나야 하는 일이었다는 듯이. 고로, 바이바이. 하나와 하나로 존재하던 시간과 아주아주 작별한 채, 영원히 둘이 되어서. 외로움과 괴로움과 영원히 이별하여…….',
];
const CREDIT = '© 담(@ohmyfilmbonita) All Right Reserved';

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** about 방 안쪽 — 집 · 글 · 글쓴이 */
export function aboutNoteMarkup() {
  return `<pre class="hsh-ab__house" role="img" aria-label="homesweethome 을 이어 써서 지은 작은 집 — 굴뚝 · 지붕 · 창 둘 · 문">${esc(HOUSE)}</pre>` +
    `<div class="hsh-ab__text">${BODY.map((p) => `<p>${esc(p)}</p>`).join('')}</div>` +
    `<p class="hsh-ab__credit">${esc(CREDIT)}</p>`;
}
