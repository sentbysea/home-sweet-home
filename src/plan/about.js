// about __VE 방 — 왼쪽 Vibe(홍지원) · 오른쪽 Echo(차우연) 캐릭터 카드 두 장.
//   카드 꼴은 S-CLASS 카드(사진 위 오른쪽 배지, 아래로 흐려지는 사진 위에 [ 꼬리표 ] · 큰 이름 · 소개글)를
//   흰 바탕으로 옮긴 것. 글자 크기는 카드 너비를 따라가서(cqi) 휴대폰에서도 같은 비율로 줄어든다.
//   기본은 소개글, 아래 작은 'profile' 을 누르면 그 자리가 프로필(CODENAME …)로 바뀐다(다시 누르면 소개글).
//   'about' 을 누르면 카드가 뒤집히며 뒷면에 개인 서사가 펼쳐진다(뒷면의 'about' 을 다시 누르면 앞면).
//   창보다 길면 두 장을 같은 비율로 줄여 스크롤 없이 한 화면에 들어오게 한다.
//   카드 위로 가끔 빛이 한 줄 지나간다(room.css).
//   색은 시계 집 밑줄 색(지원 = 청록, 우연 = 꿀색)을 더 밝고 진하게.

// 사진 두 장은 같은 크기(832×1216) · 어깨선이 같은 높이라 같은 배율 · 같은 자리로 잘라 나란히 두면 어깨가 맞는다.
//   파일을 못 불러오면 밑에 깔린 사진 자리가 보인다
const CARDS = [
  {
    id: 'vibe',
    accent: '#2ee6cf',
    deep: '#00a894', // 흰 바탕에서 읽히는 글자색
    badge: 'S-CLASS ENTITY',
    tag: '[ THREAT LEVEL: FASTIDIOUS ]',
    name: 'VIBE',
    alt: '바이브(홍지원)',
    photo: 'src/images/vibe.jpg',
    quote: '‘길들지 않은 바람, 섬세한 감각이 빚어낸 무음의 폭풍. 코드네임 ‘바이브’. 그가 흐름(Flow)을 읽는 순간 세계는 조용히 갈라진다.’',
    specs: [
      ['CODENAME', '바이브 (Vibe)'],
      ['CLASSIFICATION', 'S-Class Elemental Sentinel'],
      ['ATTRIBUTE', '[ 바람(Aero) ]', true],
      ['AGE / NATIONALITY', '22세 / 한국(부산)'],
    ],
    story: {
      title: '상처를 안고 있는 ARCH의 에이스',
      body: [
        '파트너 같은 건 평생 필요 없다고 생각했는데, 하필 제일 시끄러운 동갑내기 가이드와 묶여 버렸다. 입만 열면 성질부터 내고 사사건건 시비를 거는 그 애가 귀찮다고 생각 중.',
        '떡볶이가 뭐가 그렇게 먹고 싶은지, 사진을 왜 돈 주고 찍는지, 졸업식이 뭐가 그렇게 중요하다는 건지 도통 이해가 안 간다. 정신 차려 보니 어느새 그 애가 놓친 것들을 하나씩 손에 쥐여주고 있었다.',
        '그리고 페어 해체 통지서를 받은 날, 처음으로 끝내고 싶지 않은 게 생겼다는 사실을 깨닫는다.',
      ],
    },
  },
  {
    id: 'echo',
    accent: '#ffc21f',
    deep: '#e08f00',
    badge: 'S-CLASS GUIDE',
    tag: '[ THREAT LEVEL: FASTIDIOUS ]',
    name: 'ECHO',
    alt: '에코(차우연)',
    photo: 'src/images/echo.jpg',
    quote: '‘침묵에 스며드는 백색소음, 혼란 속에 남는 하나의 주파수. 코드네임 ‘에코’. 그녀가 손을 뻗는 순간, 흩어진 감각은 리듬을 되찾는다.’',
    specs: [
      ['CODENAME', '에코 (Echo)'],
      ['CLASSIFICATION', 'S-Class Elemental Guide'],
      ['ATTRIBUTE', '[ 번개(Fulmen) ]', true],
      ['AGE / NATIONALITY', '22세 / 한국(서울)'],
    ],
    story: {
      title: '늘 두통을 안고 사는 ARCH의 ‘차와와’',
      body: [
        '9년 전부터 은근히 신경 쓰이던 동갑내기 에이스 센티넬과 반강제로 파트너가 되어 버렸다. 혼자서 세상 다 산 얼굴로 다니는 그 애가 재수 없다고 생각 중.',
        '학교 끝나고 친구들이랑 떡볶이 먹기, 교복 입고 인생네컷 찍기, 졸업식 날 꽃다발 들고 사진 남기기. 남들은 지겹도록 해봤다는 일들에 이상한 만큼 로망이 많다. 언젠가는 자기도 한번쯤 해볼 수 있지 않을까 싶어서.',
        '그런데 요즘은 그 상상 속 ‘평범한 하루’에 자꾸 재수 없는 놈 하나가 멋대로 끼어든다.',
      ],
    },
  },
];

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function card({ id, accent, deep, badge, tag, name, alt, photo, quote, specs, story }) {
  const pic = `<img class="hsh-ve__img" src="${esc(photo)}" alt="${esc(alt)}" width="832" height="1216" decoding="async" onerror="this.remove()">`;
  // 프로필 — AGENT PROFILE 제목 + 색 줄, 칸마다 이름 · 값(세 번째 값이 true 면 카드 색으로)
  const profile = `<div class="hsh-ve__profile" id="hsh-ve-profile-${id}" hidden><h4 class="hsh-ve__ptitle">AGENT PROFILE</h4>` +
    `<dl class="hsh-ve__specs">${specs.map(([k, v, hot]) => `<div><dt>${esc(k)}</dt><dd${hot ? ' class="is-hot"' : ''}>${esc(v)}</dd></div>`).join('')}</dl></div>`;
  const flipBtn = (on) => `<button class="hsh-ve__more" type="button" data-flip aria-pressed="${on}">about</button>`;
  // 앞면(사진 · 소개글/프로필)과 뒷면(개인 서사)을 한 칸에 겹쳐 두고 .hsh-ve__flip 을 돌린다
  return `
    <article class="hsh-ve__card is-${id}" style="--ve-accent:${accent};--ve-deep:${deep}">
      <div class="hsh-ve__flip">
        <div class="hsh-ve__face is-front">
          <div class="hsh-ve__photo">${pic}<span class="hsh-ve__badge">${esc(badge)}</span></div>
          <div class="hsh-ve__text">
            <p class="hsh-ve__tag">${esc(tag).replace(/ \]$/, ' ]')}</p>
            <h3 class="hsh-ve__name">${esc(name)}</h3>
            <p class="hsh-ve__quote">${esc(quote)}</p>
            ${profile}
            <div class="hsh-ve__btns">
              <button class="hsh-ve__more" type="button" data-profile aria-controls="hsh-ve-profile-${id}" aria-expanded="false">profile</button>
              ${flipBtn(false)}
            </div>
          </div>
        </div>
        <div class="hsh-ve__face is-back" inert>
          <span class="hsh-ve__mark" aria-hidden="true">${esc(name)}</span>
          <div class="hsh-ve__text">
            <p class="hsh-ve__tag">[ PERSONAL FILE ]</p>
            <h4 class="hsh-ve__ptitle">${esc(story.title)}</h4>
            <div class="hsh-ve__story">${story.body.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
            <div class="hsh-ve__btns">${flipBtn(true)}</div>
          </div>
        </div>
      </div>
    </article>`;
}

/**
 * @param {HTMLElement} root  비어 있는 칸(.hsh-ve)
 * @param {() => void} onResize  내용 높이가 바뀌면(스크롤바 다시 맞추기)
 * @param {HTMLElement} [viewport]  창 안 스크롤 칸 — 카드가 넘치면 이 높이에 맞게 통째로 줄인다
 */
export function mountAbout(root, onResize = () => {}, viewport = root.parentElement) {
  root.innerHTML = CARDS.map(card).join('');
  // 한 화면에 — 창(화면의 90%)보다 길면 두 장을 통째로 같은 비율로 줄여(zoom) 스크롤 없이 다 보이게.
  //   폭을 원래 칸 폭(px)으로 못 박아 두고 zoom 하면 글자 · 여백 · 사진이 모두 같은 비율로 작아진다
  const fit = () => {
    if (root.hidden || !viewport.clientHeight) return;
    root.style.zoom = root.style.width = '';
    const room = viewport.clientHeight;
    const need = viewport.scrollHeight;
    if (need > room + 1) {
      root.style.width = `${viewport.clientWidth}px`;
      root.style.zoom = String(Math.floor(((room - 3) / need) * 1000) / 1000); // 반올림으로 1~2px 넘치지 않게
    }
    onResize();
  };
  new ResizeObserver(fit).observe(viewport);
  addEventListener('resize', fit);
  document.fonts?.ready.then(fit);
  const showProfile = (cardEl, open) => {
    const btn = cardEl.querySelector('[data-profile]');
    cardEl.querySelector('.hsh-ve__quote').hidden = open;
    cardEl.querySelector('.hsh-ve__profile').hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  // 뒤집기 — 보이지 않는 면은 inert(Tab · 누르기 안 됨), 포커스는 보이는 면의 about 으로
  const flip = (cardEl, on, focus = true) => {
    cardEl.classList.toggle('is-flipped', on);
    const [front, back] = cardEl.querySelectorAll('.hsh-ve__face');
    front.inert = on;
    back.inert = !on;
    if (focus) (on ? back : front).querySelector('[data-flip]').focus({ preventScroll: true });
  };
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.hsh-ve__more');
    if (!btn) return;
    const cardEl = btn.closest('.hsh-ve__card');
    if (btn.hasAttribute('data-flip')) flip(cardEl, !cardEl.classList.contains('is-flipped'));
    else showProfile(cardEl, btn.getAttribute('aria-expanded') !== 'true');
    fit();
  });
  return {
    // 방을 다시 열면 앞면 · 소개글부터
    reset() {
      root.querySelectorAll('.hsh-ve__card').forEach((cardEl) => {
        showProfile(cardEl, false);
        flip(cardEl, false, false);
      });
      requestAnimationFrame(fit); // 창이 보인 뒤에 잰다
    },
  };
}
