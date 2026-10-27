// about __VE 방 — 짧은 글, 맨 끝에 글쓴이(가운데 · 본문보다 살짝 연하게).
//   Vibe · Echo 카드 두 장은 /pair 로 옮겼다(about.js).
//   마지막 문장 {type:…} 만 화면에 들어오면 한 글자씩 써진다 — 자리는 처음부터 차지하고(글자색만 투명), 방을 다시 열기 전에는 한 번만.
//   글 · 글쓴이는 로딩 home sweet home 과 같은 글꼴 — 한글은 이 저장소 글꼴 파일에 없어서 처음 열 때 Google Fonts 에서
//   같은 글꼴을 다른 이름(HSH Hand KR)으로 불러온다(다른 화면의 한글은 그대로). 못 받으면 Pretendard.

const BODY = [
  '선생님도, 부모님도 없는 곳. 지붕이 없는 강당, 책이 없는 학교. 존재하는 것은 오로지 또래뿐이다. 하나와 하나로서만 존재했던 둘의 지루하고 재미없는 청소년기 속에 희미하게 남아 있던 동갑내기를. 우연의 품에 그 애의 눈 색을 닮은 프리지아가 활짝 피어나 있는 순간을, 아주 오래도록 바라보았다. 졸업의 의의는 바이바이에 있었고, 우리는 이미 산뜻한 작별을 배운 뒤였다. 학사모 대신 열두 살과 열세 살의 검정 훈련모가 인공 노을 아래서 자리를 지켰다. 이것은 소년기와의 작별. 집으로 돌아가고 싶었던 오랜 밤들과의 영원한 안녕.',
  '홍지원은 이제 새로운 집을 찾았다. 그 집에 같은 나이의 여자애가 살았다. 스물둘이 되어 기어이 알아보았다. 일어나야 하는 일이었다는 듯이. 고로, 바이바이. 하나와 하나로 존재하던 시간과 아주아주 작별한 채, 영원히 둘이 되어서. {type:외로움과 괴로움과 영원히 이별하여…….}',
];
const CREDIT = '© 담(@ohmyfilmbonita) All Right Reserved';

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 한글은 완성된 글자 하나씩(자모로 쪼개지 않는다)
const graphemes = (t) => (typeof Intl !== 'undefined' && Intl.Segmenter
  ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(t)].map((s) => s.segment)
  : Array.from(t));

function paragraph(src) {
  return src.replace(/\{type:([^}]+)\}|[^{]+/g, (m, typed) => {
    if (!typed) return esc(m);
    return `<span class="hsh-ab__type">${graphemes(typed).map((c) => `<span class="hsh-ab__ch">${esc(c)}</span>`).join('')}</span>`;
  });
}

/** about 방 안쪽 — 글 · 글쓴이 */
export function aboutNoteMarkup() {
  return `<div class="hsh-ab__text">${BODY.map((p) => `<p>${paragraph(p)}</p>`).join('')}<span class="hsh-ab__caret" aria-hidden="true" hidden></span></div>` +
    `<p class="hsh-ab__credit">${esc(CREDIT)}</p>`;
}

// 마지막 문장 — 글자 사이(ms). '이별하여' 뒤에 잠깐 멈추고, '…….' 은 점 하나씩(… 한 글자를 세 번에 나눠 드러낸다 — 글자는 원문 그대로)
//   시작: 문장이 화면 안에 다 들어오고 스크롤이 멈췄을 때(idle). 방을 연 직후에는 창이 열릴 동안(minStart) 기다린다.
//   치는 중에 문장이 화면 밖으로 나가면 멈췄다가, 다시 들어오고 스크롤이 멈추면 이어서.
const TYPE = { first: 300, char: 95, space: 60, pause: 560, dot: 230, blink: 380, blinks: 3, idle: 350, minStart: 1600, margin: 2 };

/**
 * about 방이 열려 있는 동안 — 마지막 문장. 방을 닫으면 close() 로 전부 정리.
 * @param {HTMLElement} root  .hsh-ab
 * @param {{ reduced?: boolean, scroller?: HTMLElement }} opts
 */
export function openAboutNote(root, { reduced = false, scroller = null } = {}) {
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const text = root.querySelector('.hsh-ab__text');
  const chars = [...root.querySelectorAll('.hsh-ab__ch')];
  const caret = root.querySelector('.hsh-ab__caret');
  const sentence = root.querySelector('.hsh-ab__type');
  // 캐럿은 드러난 만큼(frac)의 오른쪽 끝에
  const putCaret = (ch, frac = 1) => {
    const t = text.getBoundingClientRect();
    const r = ch.getBoundingClientRect();
    caret.style.left = `${r.left + r.width * frac - t.left}px`;
    caret.style.top = `${r.top - t.top}px`;
    caret.style.height = `${r.height}px`;
  };
  const show = (ch, frac) => {
    ch.style.setProperty('--reveal', String(frac));
    ch.classList.add('is-on');
  };
  // 한 번에 하나씩 드러낼 것 [글자, 드러낼 비율, 앞에서 기다릴 ms] — '…' 는 점 셋으로 나눈다
  const steps = [];
  chars.forEach((ch, i) => {
    const c = ch.textContent;
    const prev = chars[i - 1]?.textContent;
    const dotty = c === '…' || c === '.';
    const wait = i === 0 ? TYPE.first : dotty ? (prev === '…' || prev === '.' ? TYPE.dot : TYPE.pause) : c === ' ' ? TYPE.space : TYPE.char;
    if (c === '…') [1 / 3, 2 / 3, 1].forEach((f, k) => steps.push([ch, f, k ? TYPE.dot : wait]));
    else steps.push([ch, 1, wait]);
  });

  // 문장이 스크롤 칸(없으면 화면) 안에 다 들어와 있나
  const inView = () => {
    const r = sentence.getBoundingClientRect();
    const b = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    return r.height > 0 && r.top >= b.top && r.bottom <= b.bottom - TYPE.margin;
  };
  const opened = performance.now();
  let lastScroll = 0;
  let next = 0; // 다음에 드러낼 steps 번호
  let paused = true; // 시작 전 · 화면 밖이라 멈춤
  let done = false;
  let checkTimer = 0;
  const finish = () => {
    done = true;
    stopWatching();
    // 다 쓰면 커서가 두세 번 깜빡이고 사라진다(문장은 그대로)
    for (let b = 0; b < TYPE.blinks * 2; b++) later(() => caret.classList.toggle('is-off'), TYPE.blink * (b + 1));
    later(() => { caret.hidden = true; }, TYPE.blink * (TYPE.blinks * 2 + 1));
  };
  const run = () => {
    if (next >= steps.length) { finish(); return; }
    if (!inView()) { paused = true; return; } // 화면 밖으로 내려갔다 — 돌아오면 이어서
    const [ch, frac] = steps[next++];
    show(ch, frac);
    putCaret(ch, frac);
    later(run, next < steps.length ? steps[next][2] : 0);
  };
  // 스크롤이 멈추고 문장이 다 보이면 시작(또는 이어서)
  const check = () => {
    clearTimeout(checkTimer);
    if (done || !paused) return;
    const now = performance.now();
    const wait = Math.max(opened + TYPE.minStart - now, lastScroll + TYPE.idle - now);
    if (wait > 0) { checkTimer = setTimeout(check, wait); return; }
    if (!inView()) return;
    paused = false;
    caret.hidden = false;
    caret.classList.remove('is-off');
    if (next === 0) {
      putCaret(chars[0], 0);
      later(run, steps[0][2]);
    } else run();
  };
  const onScroll = () => {
    lastScroll = performance.now();
    if (paused) { clearTimeout(checkTimer); checkTimer = setTimeout(check, TYPE.idle); }
  };
  const scrollTarget = scroller || window;
  const stopWatching = () => {
    clearTimeout(checkTimer);
    scrollTarget.removeEventListener('scroll', onScroll);
  };
  if (reduced) {
    done = true;
    chars.forEach((c) => show(c, 1));
  } else {
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    check();
  }

  return {
    close() {
      stopWatching();
      timers.forEach(clearTimeout);
      timers.clear();
      // 다시 열면 처음부터 — 문장은 다시 비워 두고 커서는 숨긴다
      chars.forEach((c) => { c.classList.remove('is-on'); c.style.removeProperty('--reveal'); });
      caret.hidden = true;
    },
  };
}

let fontAsked = false;

/** 글 · 글쓴이 한글 글꼴 — 처음 한 번, Google Fonts 의 Nanum Gothic Coding 을 HSH Hand KR 이름으로(실패하면 조용히) */
export function loadAboutFont() {
  if (fontAsked) return;
  fontAsked = true;
  fetch('https://fonts.googleapis.com/css2?family=Nanum+Gothic+Coding&display=swap')
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`fonts ${res.status}`))))
    .then((css) => {
      const style = document.createElement('style');
      style.textContent = css.replace(/font-family:\s*'Nanum Gothic Coding'/g, "font-family: 'HSH Hand KR'");
      document.head.append(style);
    })
    .catch(() => { fontAsked = false; });
}
