// 시계 단어를 누르면
//   sweet(3시)    → 화면 왼쪽 위 구석에 생각 풍선: 디데이. 6월 14일이 1일(그날 = D+1), 한국 날짜로 센다.
//                   글자 · 색은 시계와 같은 톤(가는 Helvetica · 하늘색). 꾹 눌러 끌어 옮기고 × 로 닫는다.
//   위 home(12시)  → 하단 안내(click the) 위에 지원 대사가 타이핑된다:  < (  대사  )   — 왼쪽, 청록
//   아래 home(6시) → 그 아래 줄에 우연 대사:                          (  대사  ) >  — 오른쪽, 벌꿀색
//     대사는 무작위 하나(바로 앞과 같은 건 피함). 다 치고 몇 초 뒤 사라진다. 쓰는 중에 또 누르면 무시.

const START = { y: 2026, m: 6, d: 14 }; // 디데이 1일째

// 대사 — 줄마다 하나. 지원은 부산 사투리, 우연은 표준어
const LINES = {
  jiwon: [
    '차우연, 많이 늦나.',
    '...저리 가서 혼자 놀아라.',
    '오늘은 니가 설거지 당번이다.',
    '방 좀 치워라. 꼴이 저게 뭐꼬.',
    '밥은 뭇나.',
    '니 또 내 옷 입고 나갔제.',
    '시끄럽다, 고마 자라.',
    '우산 챙깃나? 비 온다 카던데.',
    '퍼뜩 온나. 밥 식는다.',
    '내가 언제 그랬노.',
    '니 그거 다 묵을 끼가?',
    '늦게 댕기지 마라. 걱정된다 아이가.',
    '고마 웃어라. 정들겠다.',
    '...와, 니 진짜 대단하다.',
  ],
  wooyeon: [
    '오늘 저녁은 뭐 먹지?',
    '홍지원, 나 심심해!',
    '오늘은 내가 요리해봐도 돼?',
    '야, 변기 뚜껑 내리랬지!',
    '홍지원! 이거 봐봐, 완전 귀엽지?',
    '오늘 산책 갈래?',
    '내 과자 누가 먹었어?',
    '우리 영화 보자, 내가 고를게!',
    '에이, 삐졌어?',
    '나 오늘 머리 자른 거 알아챘어?',
    '아침에 알람 세 번이나 껐어…',
    '주말에 바다 가고 싶다.',
    '고양이 키우면 안 돼?',
    '잘 자, 내일 봐!',
  ],
};
const TYPE_MS = 75; // 글자 하나 치는 간격
const HOLD_MS = 3200; // 다 치고 머무는 시간
const FADE_MS = 500;
const KST_OFFSET = 9 * 3600 * 1000;
const DAY = 86400000;

/** 오늘(한국 날짜)이 몇째 날인지 — START 가 1 */
function dayCount() {
  const today = Math.floor((Date.now() + KST_OFFSET) / DAY);
  const start = Math.floor(Date.UTC(START.y, START.m - 1, START.d) / DAY);
  return today - start + 1;
}

/** 뭉게구름 윤곽 — 타원 둘레 점들 사이를 바깥으로 부푼 호로 잇는다(혹 크기는 조금씩 다르게) */
function cloudPath(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2 + Math.sin(i * 2.3) * 0.08;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const r = Math.hypot(x1 - x0, y1 - y0) * (0.56 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 0.1);
    d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d + 'Z';
}

// 풍선 모양 — viewBox 0 0 240 160, 꼬리는 왼쪽 아래
const SHAPES = {
  thought:
    `<path class="hsh-bubble__line" d="${cloudPath(128, 70, 96, 46, 10)}"/>` +
    '<circle class="hsh-bubble__line" cx="34" cy="138" r="11"/>' +
    '<circle class="hsh-bubble__line" cx="15" cy="155" r="4.5"/>',
};

let topZ = 5; // 새로 뜨거나 끌기 시작한 풍선이 맨 위

function makeBubble(plan, kind, label, { reduced, onHide } = {}) {
  const box = document.createElement('div');
  box.className = `hsh-bubble is-${kind}`;
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', label);
  box.innerHTML = `
    <svg class="hsh-bubble__art" viewBox="0 0 240 160" aria-hidden="true">${SHAPES[kind]}</svg>
    <p class="hsh-bubble__text" aria-live="polite"><span class="hsh-bubble__small"></span><span class="hsh-bubble__big"></span></p>
    <button class="hsh-bubble__x" type="button" aria-label="${label} 닫기">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3L9 9M9 3L3 9"/></svg>
    </button>`;
  plan.append(box);
  const small = box.querySelector('.hsh-bubble__small');
  const big = box.querySelector('.hsh-bubble__big');
  let from = null; // 닫으면 포커스를 돌려줄 버튼

  // 끌어 옮기기 — 화면 밖으로는 못 나가게. 판 기울이기(tilt)로 번지지 않게 막는다
  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target.closest('.hsh-bubble__x')) return;
    const r = box.getBoundingClientRect();
    const [tx, ty] = (box.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tx, ty, r };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
    box.style.zIndex = ++topZ;
  });
  box.addEventListener('pointermove', (e) => {
    e.stopPropagation();
    if (!drag || e.pointerId !== drag.id) return;
    const { r } = drag;
    const dx = Math.min(innerWidth - r.right, Math.max(-r.left, e.clientX - drag.x0));
    const dy = Math.min(innerHeight - r.bottom, Math.max(-r.top, e.clientY - drag.y0));
    box.style.translate = `${drag.tx + dx}px ${drag.ty + dy}px`;
  });
  const end = (e) => {
    if (drag && e.pointerId === drag.id) { drag = null; box.classList.remove('is-dragging'); }
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);

  const hide = () => { box.hidden = true; from?.focus({ preventScroll: true }); onHide?.(); };
  box.querySelector('.hsh-bubble__x').addEventListener('click', hide);

  return {
    box,
    /** 처음 자리(CSS 의 왼쪽 위)에 새로 띄운다. html 은 믿을 수 있는 고정 문자열만 */
    show({ smallText, bigHtml, accent, nudge = [0, 0, 0] }, button) {
      from = button;
      small.textContent = smallText;
      small.hidden = !smallText;
      big.innerHTML = bigHtml;
      box.style.setProperty('--hsh-bubble-accent', accent);
      box.style.translate = `${nudge[0]}px ${nudge[1]}px`;
      box.style.rotate = `${nudge[2]}deg`;
      box.style.zIndex = ++topZ;
      box.hidden = false;
      if (!reduced) {
        box.animate(
          [{ opacity: 0, scale: '0.6' }, { opacity: 1, scale: '1.05', offset: 0.6 }, { opacity: 1, scale: '1' }],
          { duration: 360, easing: 'cubic-bezier(.3,.7,.4,1)' },
        );
      }
    },
    hide,
    get open() { return !box.hidden; },
  };
}

/**
 * @param {HTMLElement} plan   .hsh-plan — 풍선을 붙일 곳
 * @param {HTMLElement} clock  .hsh-clock — 단어 위에 누르는 자리를 얹는다
 * @param {{ reduced?: boolean }} opts
 */
export function mountBubbles(plan, clock, { reduced = false } = {}) {
  const thought = makeBubble(plan, 'thought', '디데이', { reduced });

  // 시계 단어 위 투명 버튼 — 시계 그림은 그대로 두고 여기만 누를 수 있다(자리는 plan.css)
  const hit = (cls, label, onClick) => {
    const b = document.createElement('button');
    b.className = `hsh-clock__hit ${cls}`;
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => onClick(b));
    clock.append(b);
  };

  const dday = (button) => {
    const mm = String(START.m).padStart(2, '0');
    const dd = String(START.d).padStart(2, '0');
    thought.show({
      smallText: `since ${mm}.${dd}`,
      bigHtml: `<span class="hsh-bubble__deco">°.</span> <b>D+${dayCount()}</b> <span class="hsh-bubble__deco">⸝</span><span class="hsh-bubble__heart">♡</span>`,
      accent: '#7fb1e4',
    }, button);
  };

  // 대사 두 줄 — 하단 안내 위. 줄 자리는 늘 잡아 두고(안 보일 때도) 글자만 쳤다 지운다
  const talkBox = document.createElement('div');
  talkBox.className = 'hsh-talk';
  talkBox.setAttribute('aria-live', 'polite');
  talkBox.innerHTML =
    '<p class="hsh-talk__row is-jiwon"><span class="hsh-talk__mark">&lt; (</span><span class="hsh-talk__say"></span><span class="hsh-talk__mark">)</span></p>' +
    '<p class="hsh-talk__row is-wooyeon"><span class="hsh-talk__mark">(</span><span class="hsh-talk__say"></span><span class="hsh-talk__mark">) &gt;</span></p>';
  plan.append(talkBox);

  const last = {};
  const busy = {};
  const pickLine = (who) => {
    const lines = LINES[who];
    if (!lines.length) return '…';
    let i;
    do i = Math.floor(Math.random() * lines.length); while (lines.length > 1 && i === last[who]);
    last[who] = i;
    return lines[i];
  };

  const talk = (who) => async () => {
    if (busy[who]) return; // 쓰는 중 · 머무는 중에는 무시
    busy[who] = true;
    const row = talkBox.querySelector(`.is-${who}`);
    const say = row.querySelector('.hsh-talk__say');
    const line = pickLine(who);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    say.textContent = '';
    row.classList.remove('is-fading');
    row.classList.add('is-on', 'is-typing');
    if (reduced) say.textContent = line;
    else {
      for (const ch of line) {
        say.textContent += ch;
        await wait(TYPE_MS);
      }
    }
    row.classList.remove('is-typing');
    await wait(HOLD_MS);
    row.classList.add('is-fading');
    await wait(reduced ? 0 : FADE_MS);
    row.classList.remove('is-on', 'is-fading');
    say.textContent = '';
    busy[who] = false;
  };

  hit('is-top', '지원 한마디', talk('jiwon'));
  hit('is-sweet', '디데이 보기', dday);
  hit('is-bottom', '우연 한마디', talk('wooyeon'));

  // 자정이 지나면 디데이 숫자도 바뀌게 — 열려 있을 때만 1분마다
  setInterval(() => {
    const b = thought.box.querySelector('.hsh-bubble__big b');
    if (thought.open && b) b.textContent = `D+${dayCount()}`;
  }, 60000);
}
