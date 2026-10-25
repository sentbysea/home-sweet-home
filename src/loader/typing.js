// 타이핑 — [data-type-line] 요소의 글자를 한 글자씩 드러낸다.
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

/**
 * 순서대로 타이핑하고, 마지막 글자가 보이면 끝나는 Promise.
 * @param {Element} root
 * @param {{ reduced?: boolean, signal?: AbortSignal } & Partial<typeof TYPING_DEFAULTS>} [opts]
 */
export async function typeLines(root, opts = {}) {
  const o = { ...TYPING_DEFAULTS, ...opts };
  const lines = splitLines(root);
  lines.forEach(({ chars }) => chars.forEach((c) => c.classList.remove('is-shown')));

  if (o.reduced) return showAll(root);

  await wait(o.startDelay, o.signal);
  for (let i = 0; i < lines.length; i++) {
    const { chars, slow } = lines[i];
    if (i > 0) await wait(slow ? o.slowDelay : o.linePause, o.signal);
    for (let j = 0; j < chars.length; j++) {
      if (j > 0) await wait(slow ? o.slowDelay : o.charDelay, o.signal);
      chars[j].classList.add('is-shown');
    }
  }
}
