// 홈 화면 오른쪽 위 아날로그 시계 — 시안 A. 테두리 · 배경판 없이 글자와 바늘만.
//   12시 home / 3시 sweet / 6시 home, 나머지는 숫자. 세로로 조금 긴 타원에 놓는다.
//   늘 한국 시간(Asia/Seoul). 한국은 1988년 뒤로 서머타임이 없어 UTC+9 고정으로 계산한다.
//   글자만 손그림 위글(로딩처럼 190ms · 4프레임) — 자리 · 크기는 그대로, 획만 조금씩. 바늘은 위글 없음.
//   초침은 1초마다 딸깍. 모션 줄이기면 위글만 끈다.

const NS = 'http://www.w3.org/2000/svg';
const KST_OFFSET = 9 * 3600 * 1000;

// 좌표(viewBox 단위) — 가운데 0,0. 'sweet' 가 오른쪽으로 길게 나가서 viewBox 가 오른쪽으로 넓다.
const RX = 70; // 숫자 타원 가로 반지름
const RY = 84; // 세로 반지름(조금 길게)
const WORD_Y = 112; // 위 · 아래 'home' — 11 · 1 · 5 · 7 과 겹치지 않게 숫자 타원보다 바깥
const SWEET_X = 66; // 'sweet' 왼쪽 끝 — 분침 끝(56)보다 바깥
const VIEW = { x: -88, y: -134, w: 244, h: 268 };
const HANDS = { hour: 38, minute: 56, second: 62, tail: 10 };

const WOBBLE_FRAME = 190;
const FRAMES = 4;

// 글자 i, 프레임 k 마다 고정된 작은 값(-1..1) — loader/wobble.js 와 같은 식
function jitter(i, k, salt) {
  const s = Math.sin(i * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/** 글자를 한 자씩 tspan 으로 — 위글이 글자마다 따로 흔든다 */
function label(text, x, y, cls, anchor = 'middle') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor, 'dominant-baseline': 'central' });
  for (const ch of text) {
    const s = el('tspan');
    s.textContent = ch;
    t.append(s);
  }
  return t;
}

function build() {
  const svg = el('svg', {
    class: 'hsh-clock__svg',
    viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`,
    'aria-hidden': 'true',
  });

  const face = el('g', { class: 'hsh-clock__face' });
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const sx = Math.sin(a);
    const cy = -Math.cos(a);
    // 눈금 — 글자 안쪽에 짧게. 단어(12 · 3)가 있는 쪽은 비운다
    if (h !== 12 && h !== 3) {
      face.append(el('line', {
        class: 'hsh-clock__tick',
        x1: (sx * RX * 0.74).toFixed(1), y1: (cy * RY * 0.74).toFixed(1),
        x2: (sx * RX * 0.8).toFixed(1), y2: (cy * RY * 0.8).toFixed(1),
      }));
    }
    if (h === 12) face.append(label('home', 0, -WORD_Y, 'hsh-clock__word'));
    else if (h === 6) face.append(label('home', 0, WORD_Y, 'hsh-clock__word'));
    else if (h === 3) face.append(label('sweet', SWEET_X, 0, 'hsh-clock__word', 'start'));
    else face.append(label(String(h), (sx * RX).toFixed(1), (cy * RY).toFixed(1), 'hsh-clock__num'));
  }

  const hand = (cls, len, tail = 0) => {
    const g = el('g', { class: `hsh-clock__hand ${cls}` });
    g.append(el('line', { x1: 0, y1: tail, x2: 0, y2: -len }));
    return g;
  };
  const hour = hand('hsh-clock__hour', HANDS.hour);
  const minute = hand('hsh-clock__minute', HANDS.minute);
  const second = hand('hsh-clock__second', HANDS.second, HANDS.tail);
  const pin = el('circle', { class: 'hsh-clock__pin', r: 4.6 });

  svg.append(face, hour, minute, second, pin);
  return { svg, hour, minute, second, chars: [...face.querySelectorAll('tspan')] };
}

/** 지금 한국 시각 — 시 · 분 · 초(소수 포함) */
function seoulNow() {
  const t = (Date.now() + KST_OFFSET) / 1000;
  const sec = t % 60;
  const min = (t / 60) % 60;
  const hr = (t / 3600) % 12;
  return { hr, min, sec };
}

/**
 * @param {HTMLElement} host  .hsh-clock
 * @param {{ reduced?: boolean }} opts
 */
export function mountClock(host, { reduced = false } = {}) {
  const c = build();
  host.replaceChildren(c.svg);

  let lastLabel = '';
  const paint = () => {
    const { hr, min, sec } = seoulNow();
    c.second.setAttribute('transform', `rotate(${Math.floor(sec) * 6})`); // 초침은 1초마다 딸깍
    c.minute.setAttribute('transform', `rotate(${(min * 6).toFixed(2)})`); // 분침도 초에 따라 조금씩
    c.hour.setAttribute('transform', `rotate(${(hr * 30).toFixed(2)})`); // 시침도 분 · 초에 따라 조금씩
    // 읽어 주는 이름은 분이 바뀔 때만
    const h = Math.floor(hr) || 12;
    const m = Math.floor(min);
    const text = `한국 시각 ${h}시 ${m}분`;
    if (text !== lastLabel) host.setAttribute('aria-label', (lastLabel = text));
  };

  // 초가 바뀌는 순간에 맞춰 1초마다 다시 그린다(밀리지 않게 매번 다음 초 경계까지 남은 시간을 잰다)
  const tick = () => {
    paint();
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  };
  tick();

  if (!reduced) {
    let k = 0;
    setInterval(() => {
      if (document.hidden) return;
      k = (k + 1) % FRAMES;
      // 자리 · 크기는 그대로 — 글자마다 아주 조금 기울이고 획 굵기만 살짝 바꾼다
      c.chars.forEach((s, i) => {
        s.setAttribute('rotate', (jitter(i, k, 1) * 1.6).toFixed(2));
        s.style.strokeWidth = (0.25 + (jitter(i, k, 2) + 1) * 0.3).toFixed(2);
      });
    }, WOBBLE_FRAME);
  }
  // 탭에 돌아오면 바로 지금 시각으로(멈춰 있던 타이머를 기다리지 않는다)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
}
