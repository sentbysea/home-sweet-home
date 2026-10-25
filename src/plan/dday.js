// 시계 'sweet' 를 누르면 왼쪽 위에 생각 풍선이 떠서 디데이를 보여 준다.
//   6월 14일이 1일(그날 = D+1). 날짜는 시계처럼 늘 한국 날짜로 센다.
//   풍선은 꾹 누른 채 끌어 옮길 수 있고, × 로 닫는다. 'sweet' 를 다시 누르면 처음 자리로 다시 뜬다.
//   글자 · 색은 시계와 같은 톤(가는 Helvetica · 하늘색, 하트는 초침 분홍).

const START = { y: 2026, m: 6, d: 14 }; // 1일째
const KST_OFFSET = 9 * 3600 * 1000;
const DAY = 86400000;
const NS = 'http://www.w3.org/2000/svg';

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

function build() {
  const box = document.createElement('div');
  box.className = 'hsh-dday';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', '디데이');
  box.innerHTML = `
    <svg class="hsh-dday__art" viewBox="0 0 240 160" aria-hidden="true">
      <path class="hsh-dday__cloud" d="${cloudPath(128, 70, 96, 46, 10)}"/>
      <circle class="hsh-dday__cloud" cx="34" cy="138" r="11"/>
      <circle class="hsh-dday__cloud" cx="15" cy="155" r="4.5"/>
    </svg>
    <p class="hsh-dday__text">
      <span class="hsh-dday__since">since ${String(START.m).padStart(2, '0')}.${String(START.d).padStart(2, '0')}</span>
      <span class="hsh-dday__count"><span class="hsh-dday__deco">°.</span> <b></b> <span class="hsh-dday__deco">⸝</span><span class="hsh-dday__heart">♡</span></span>
    </p>
    <button class="hsh-dday__x" type="button" aria-label="디데이 닫기">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3L9 9M9 3L3 9"/></svg>
    </button>`;
  return box;
}

/**
 * @param {HTMLElement} plan   .hsh-plan — 풍선을 붙일 곳
 * @param {HTMLElement} clock  .hsh-clock — 'sweet' 위에 누르는 자리를 얹는다
 * @param {{ reduced?: boolean }} opts
 */
export function mountDday(plan, clock, { reduced = false } = {}) {
  const box = build();
  plan.append(box);
  const count = box.querySelector('.hsh-dday__count b');

  // 'sweet' 자리(3시)에 투명 버튼 — 시계 그림은 그대로 두고 여기만 누를 수 있다
  const hit = document.createElement('button');
  hit.className = 'hsh-clock__sweet';
  hit.type = 'button';
  hit.setAttribute('aria-label', '디데이 보기');
  clock.append(hit);

  const place = () => { box.style.translate = ''; }; // 처음 자리(CSS 의 왼쪽 위)

  const show = () => {
    count.textContent = `D+${dayCount()}`;
    place();
    box.hidden = false;
    if (!reduced) {
      box.animate(
        [{ opacity: 0, scale: '0.6' }, { opacity: 1, scale: '1.05', offset: 0.6 }, { opacity: 1, scale: '1' }],
        { duration: 360, easing: 'cubic-bezier(.3,.7,.4,1)' },
      );
    }
  };
  const hide = () => { box.hidden = true; hit.focus({ preventScroll: true }); };

  hit.addEventListener('click', show);
  box.querySelector('.hsh-dday__x').addEventListener('click', hide);

  // 끌어 옮기기 — 화면 밖으로는 못 나가게. 판 기울이기(tilt)로 번지지 않게 막는다
  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target.closest('.hsh-dday__x')) return;
    const r = box.getBoundingClientRect();
    const [tx, ty] = (box.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tx, ty, r };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
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

  // 자정이 지나면 숫자도 바뀌게 — 열려 있을 때만 1분마다 확인
  setInterval(() => { if (!box.hidden) count.textContent = `D+${dayCount()}`; }, 60000);
}
