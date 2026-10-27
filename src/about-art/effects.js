// about 글자 아트 — 형상이 다 모인 뒤의 움직임(shapes.js 의 fx 이름 → 여기).
//   particle(p, t, cfg, still)  글자 하나를 얼마나 옮기고 · 흐리게 할지 { dx, dy(단위), a(곱), over:[색, 농도] } 또는 null
//   under(g, t, cfg, view, still)  글자 밑에 그릴 것(창 불빛)
//   over(g, t, cfg, view, still)   글자 위에 그릴 것(굴뚝 글자)
//   busy(t, cfg)                   아직 움직이는 중인지(아니면 그리기를 멈춘다)
//   t = 다 모인 뒤 지난 ms. still(모션 줄이기)이면 마지막 모습만.

import { wordGlyph } from './glyphs.js';

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const easeInOut = (k) => 0.5 - Math.cos(Math.PI * k) / 2;

// 맞닿은 손끝이 잠시 머물다 천천히 떨어진다 — 손끝 사이 글자는 조금 남았다가 흩어지고, 마지막 모습(떨어진 두 손)으로 멈춘다
const partWays = {
  particle(p, t, cfg, still) {
    const k = still ? 1 : easeInOut(clamp01((t - cfg.hold) / cfg.apart));
    const side = p.part.endsWith('L') ? -1 : p.part.endsWith('R') ? 1 : 0;
    if (side) return { dx: (side * cfg.gap * k) / 2, dy: side * 0.6 * k };
    if (p.part !== 'spark') return null;
    // 손이 떨어지기 시작하고 linger 뒤 — 제자리에서 바깥으로 번지며 사라진다
    const q = still ? 1 : clamp01((t - cfg.hold - cfg.linger) / 1600);
    const ang = p.seed * Math.PI * 2;
    return { dx: Math.cos(ang) * 7 * q, dy: Math.sin(ang) * 4 * q - 2 * q, a: 1 - q };
  },
  busy: (t, cfg) => t < cfg.hold + Math.max(cfg.apart, cfg.linger + 1600),
};

// 창이 은은하게 밝아지고, 굴뚝 위로 글자 몇 개가 천천히 올라간다
const glowOf = (t, still) => (still ? 1 : easeInOut(clamp01((t - 200) / 1800)) * (0.88 + 0.12 * Math.sin(t / 900)));
const hearth = {
  particle(p, t, cfg, still) {
    if (p.part !== 'window') return null;
    return { over: ['glow', glowOf(t, still)] };
  },
  under(g, t, cfg, view, still) {
    const k = glowOf(t, still);
    if (k <= 0) return;
    for (const [x, y, w, h] of cfg.windows) {
      const x0 = view.X(x);
      const y0 = view.Y(y);
      const pw = w * view.s;
      const ph = h * view.s;
      const grad = g.createRadialGradient(x0 + pw / 2, y0 + ph / 2, 0, x0 + pw / 2, y0 + ph / 2, Math.max(pw, ph) * 0.75);
      grad.addColorStop(0, `rgb(255 214 120 / ${0.42 * k})`);
      grad.addColorStop(1, 'rgb(255 214 120 / 0)');
      g.fillStyle = grad;
      g.fillRect(x0 - pw * 0.3, y0 - ph * 0.3, pw * 1.6, ph * 1.6);
    }
  },
  over(g, t, cfg, view, still) {
    const [cx, top] = cfg.chimney;
    // still — 굴뚝 위에 멈춘 글자 셋
    const ages = [];
    if (still) ages.push([0, 0.25], [1, 0.5], [2, 0.75]);
    else {
      const from = t - 500; // 다 지은 뒤 조금 있다가
      const last = Math.floor(from / cfg.every);
      for (let n = Math.max(0, last - Math.ceil(cfg.life / cfg.every)); n <= last; n++) {
        const age = (from - n * cfg.every) / cfg.life;
        if (age >= 0 && age < 1) ages.push([n, age]);
      }
    }
    g.fillStyle = view.ink('soft');
    for (const [n, age] of ages) {
      const x = cx + Math.sin(age * 4 + n * 1.7) * 1.8 + age * 3;
      const y = top - age * cfg.rise;
      g.globalAlpha = Math.sin(Math.PI * age) * 0.75 * view.mul;
      g.fillText(wordGlyph('home', n), view.X(x), view.Y(y));
    }
    g.globalAlpha = 1;
  },
  busy: () => true,
};

export const EFFECTS = { 'part-ways': partWays, hearth };
