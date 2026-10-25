// 홈 화면 오른쪽 위 아날로그 시계 — 시안 A. 테두리 · 배경판 없이 글자와 바늘만.
//   12시 home / 3시 sweet / 6시 home, 나머지는 숫자. 위아래로 납작한 타원에 놓는다.
//   늘 한국 시간(Asia/Seoul). 한국은 1988년 뒤로 서머타임이 없어 UTC+9 고정으로 계산한다.
//   위글 없이 또렷하게. 초침은 1초마다 딸깍.

const NS = 'http://www.w3.org/2000/svg';
const KST_OFFSET = 9 * 3600 * 1000;

// 좌표(viewBox 단위) — 가운데 0,0. 'sweet' 가 3시 자리에서 조금 오른쪽으로 나가 viewBox 가 오른쪽으로 조금 넓다.
const RX = 90; // 숫자 타원 가로 반지름
const RY = 50; // 세로 반지름 — 위아래로 납작한 타원
// 12 · 3 · 6 은 단어 — 숫자처럼 그 자리(11 · 1 / 2 · 4 / 5 · 7 사이)에 놓고 가로만 좁힌다
const WORDS = { 12: ['home', 0, -RY], 3: ['sweet', RX + 4, 0], 6: ['home', 0, RY] };
const WORD_SQUEEZE = 0.78; // 단어 장평
const VIEW = { x: -104, y: -66, w: 228, h: 132 };
const HANDS = { hour: 22, minute: 34, second: 40, tail: 7 }; // 12 · 6 자리 home 에 닿지 않게 짧게

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function label(text, x, y, cls) {
  const t = el('text', { x, y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  t.textContent = text;
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
    // 눈금 — 글자 안쪽에 짧게. 단어(12 · 3 · 6)가 있는 쪽은 비운다
    if (h !== 12 && h !== 3 && h !== 6) {
      face.append(el('line', {
        class: 'hsh-clock__tick',
        x1: (sx * RX * 0.74).toFixed(1), y1: (cy * RY * 0.74).toFixed(1),
        x2: (sx * RX * 0.8).toFixed(1), y2: (cy * RY * 0.8).toFixed(1),
      }));
    }
    const word = WORDS[h];
    if (word) {
      const [text, x, y] = word;
      const t = label(text, 0, 0, 'hsh-clock__word');
      t.setAttribute('transform', `translate(${x} ${y}) scale(${WORD_SQUEEZE} 1)`); // 0,0 에서 좁힌 뒤 자리로
      face.append(t);
    } else {
      face.append(label(String(h), (sx * RX).toFixed(1), (cy * RY).toFixed(1), 'hsh-clock__num'));
    }
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
  return { svg, hour, minute, second };
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
 */
export function mountClock(host) {
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

  // 탭에 돌아오면 바로 지금 시각으로(멈춰 있던 타이머를 기다리지 않는다)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
}
