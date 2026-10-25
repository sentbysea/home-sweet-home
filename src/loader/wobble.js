// 손그림 위글 — 필터 없이(iOS Safari 에서 SVG 필터가 검게 깜빡여서) 190ms 마다 한 프레임씩.
//   · 집 윤곽: .hsh-loader__frame 4장 중 하나만 .is-on(덧그린 굵은 선 .hsh-loader__ink 도 같은 장)
//   · 집 안 글자(SVG tspan): rotate 속성으로 글자마다 살짝 기울임
//   · 아래 작은 글(HTML span): transform 으로 살짝 기울이고 들썩임
//   · 작은 글 옆 아이콘: 선·도형마다 transform 으로 살짝(아이콘 자체 움직임과 겹쳐진다)
// 프레임은 4장으로 정해져 있어 같은 모양이 돌아온다(손그림 boil 느낌).

export const WOBBLE_FRAME = 190;
const FRAMES = 4;

// 글자 i, 프레임 k 마다 고정된 작은 값(-1..1)
function jitter(i, k, salt) {
  const s = Math.sin(i * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function paint(root, k) {
  root.querySelectorAll('.hsh-loader__frame').forEach((f, i) => f.classList.toggle('is-on', i === k));
  root.querySelectorAll('.hsh-loader__ink').forEach((f, i) => f.classList.toggle('is-on', i === k));

  root.querySelectorAll('.hsh-loader__char').forEach((c, i) => {
    c.setAttribute('rotate', (jitter(i, k, 1) * 4).toFixed(1));
  });

  root.querySelectorAll('.hsh-status__char').forEach((c, i) => {
    const r = (jitter(i, k, 2) * 4).toFixed(1);
    const y = (jitter(i, k, 3) * 0.6).toFixed(2);
    c.style.transform = `translateY(${y}px) rotate(${r}deg)`;
  });

  root.querySelectorAll('.hsh-status__icon :is(path, circle, rect)').forEach((s, i) => {
    const x = (jitter(i, k, 4) * 0.4).toFixed(2);
    const y = (jitter(i, k, 5) * 0.4).toFixed(2);
    const r = (jitter(i, k, 6) * 4).toFixed(1);
    s.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
  });
}

/** 위글 시작. signal 이 abort 되면 멈춘다. 모션 줄이기면 부르지 않는다. */
export function startWobble(root, { signal } = {}) {
  let k = 0;
  root.classList.add('is-wobbling');
  paint(root, k);
  const id = setInterval(() => {
    k = (k + 1) % FRAMES;
    paint(root, k);
  }, WOBBLE_FRAME);
  signal?.addEventListener('abort', () => clearInterval(id), { once: true });
}
