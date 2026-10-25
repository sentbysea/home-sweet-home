// 타이핑 — [data-type-line] 요소의 글자를 한 글자씩 드러낸다. 한 번 쓰면 그대로 둔다.
// 글자는 처음부터 제자리에 있고 opacity 만 바뀌므로 줄 위치·집 크기가 변하지 않는다.

export const TYPING_DEFAULTS = {
  startDelay: 450, // 첫 글자 전
  charDelay: 150,  // 글자 사이
  linePause: 420,  // 줄(단어) 사이
  slowDelay: 380,  // data-type-slow 줄(점 3개)의 글자 사이
};

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

/** 각 줄의 글자를 <tspan class="hsh-loader__char"> 로 나눈다. 두 번 불러도 같다. */
export function splitLines(root) {
  return [...root.querySelectorAll('[data-type-line]')].map((line) => {
    if (!line.dataset.typeSplit) {
      const text = line.textContent;
      line.textContent = '';
      for (const ch of text) {
        const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        span.setAttribute('class', 'hsh-loader__char');
        span.textContent = ch;
        line.append(span);
      }
      line.dataset.typeSplit = '1';
    }
    return {
      chars: [...line.querySelectorAll('.hsh-loader__char')],
      slow: line.hasAttribute('data-type-slow'),
    };
  });
}

/** 모든 글자를 바로 보인다(모션 줄이기). */
export function showAll(root) {
  for (const { chars } of splitLines(root)) chars.forEach((c) => c.classList.add('is-shown'));
}

// 글자마다 앞에서 기다리는 시간(ms) — 첫 글자는 startDelay
function gaps(lines, o) {
  return lines.flatMap(({ chars, slow }, i) =>
    chars.map((_, j) => {
      if (i === 0 && j === 0) return o.startDelay;
      if (j === 0) return slow ? o.slowDelay : o.linePause;
      return slow ? o.slowDelay : o.charDelay;
    }),
  );
}

/**
 * 순서대로 한 번 타이핑하고, 마지막 글자가 보이면 끝나는 Promise.
 *   duration  이만큼 걸리도록 글자 사이를 늘린다(줄이지는 않는다)
 *   until     마지막 글자는 이것이 끝난 뒤에 — 다 쓴 순간이 다음 단계 바로 앞이 되게
 * @param {Element} root
 * @param {{ reduced?: boolean, signal?: AbortSignal, duration?: number, until?: Promise<unknown> }
 *   & Partial<typeof TYPING_DEFAULTS>} [opts]
 */
export async function typeLines(root, { reduced, signal, duration = 0, until, ...opts } = {}) {
  const o = { ...TYPING_DEFAULTS, ...opts };
  const lines = splitLines(root);
  if (reduced) return showAll(root);

  const chars = lines.flatMap((l) => l.chars);
  const delays = gaps(lines, o);
  const natural = delays.reduce((a, b) => a + b, 0);
  const k = Math.max(1, duration / natural);

  for (let i = 0; i < chars.length; i++) {
    const last = i === chars.length - 1;
    await Promise.all([wait(delays[i] * k, signal), last && until]);
    chars[i].classList.add('is-shown');
  }
}
