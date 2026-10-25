// 시계 단어를 누르면 왼쪽 위에 풍선이 뜬다 — 글자 · 색은 시계와 같은 톤(가는 Helvetica · 하늘색).
//   sweet(3시)  → 생각 풍선: 디데이. 6월 14일이 1일(그날 = D+1), 한국 날짜로 센다.
//   위 home(12시) → 말풍선: 지원 대사(청록 밑줄) 중 하나를 무작위로
//   아래 home(6시) → 말풍선: 우연 대사(벌꿀색 밑줄) 중 하나를 무작위로
//     말풍선은 누를 때마다 새로 하나씩 — 최신 것이 위에 덮인다(조금씩 어긋나게, 많아지면 오래된 것부터 사라짐).
//   풍선은 꾹 누른 채 끌어 옮길 수 있고, × 로 닫는다. 디데이는 다시 누르면 처음 자리로 새로 뜬다.

const START = { y: 2026, m: 6, d: 14 }; // 디데이 1일째

// 대사 — 줄마다 하나. 비어 있으면 '…' 를 띄운다
const LINES = {
  jiwon: [],
  wooyeon: [],
};
const PEOPLE = {
  jiwon: { name: '지원', color: '#4fb3a9' }, // 청록 — clock.js 위 home 밑줄과 같다
  wooyeon: { name: '우연', color: '#e5a83a' }, // 벌꿀색 — 아래 home 밑줄과 같다
};

const SPEECH_MAX = 8; // 쌓아 두는 말풍선 수
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

// 풍선 모양 — 둘 다 viewBox 0 0 240 160, 꼬리는 왼쪽 아래
const SHAPES = {
  thought:
    `<path class="hsh-bubble__line" d="${cloudPath(128, 70, 96, 46, 10)}"/>` +
    '<circle class="hsh-bubble__line" cx="34" cy="138" r="11"/>' +
    '<circle class="hsh-bubble__line" cx="15" cy="155" r="4.5"/>',
  // 타원 말풍선 + 왼쪽 아래 짧은 꼬리(한 획) — 타원 둘레 160° 에서 128° 까지를 돌아 꼬리 끝으로
  speech:
    '<path class="hsh-bubble__line" d="M33.9 100A104 56 0 1 1 54.4 113.6L16 140Z"/>',
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

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * @param {HTMLElement} plan   .hsh-plan — 풍선을 붙일 곳
 * @param {HTMLElement} clock  .hsh-clock — 단어 위에 누르는 자리를 얹는다
 * @param {{ reduced?: boolean }} opts
 */
export function mountBubbles(plan, clock, { reduced = false } = {}) {
  const thought = makeBubble(plan, 'thought', '디데이', { reduced });
  const speeches = []; // 쌓인 말풍선 — 오래된 것부터

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

  const last = {};
  const talk = (who) => (button) => {
    const lines = LINES[who];
    let line = '…';
    if (lines.length) {
      // 바로 앞과 같은 대사는 피한다(둘 이상일 때)
      let i;
      do i = Math.floor(Math.random() * lines.length); while (lines.length > 1 && i === last[who]);
      last[who] = i;
      line = lines[i];
    }
    // 새 말풍선을 맨 위에 — 조금씩 어긋나게 덮는다
    const b = makeBubble(plan, 'speech', `${PEOPLE[who].name} 한마디`, {
      reduced,
      onHide: () => { b.box.remove(); speeches.splice(speeches.indexOf(b), 1); },
    });
    speeches.push(b);
    if (speeches.length > SPEECH_MAX) speeches.shift().box.remove();
    const n = speeches.length - 1;
    b.show({
      smallText: '',
      bigHtml: `<span class="hsh-bubble__say">${esc(line)}</span>`, // 밑줄 색으로 누구 말인지
      accent: PEOPLE[who].color,
      nudge: [(n % 4) * 10 + Math.random() * 8, (n % 4) * 14 + Math.random() * 8, Math.random() * 8 - 4],
    }, button);
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
