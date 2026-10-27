// 글자 아트의 밝기 지도 — 참고 그림에서 배경을 빼고 칸마다 부위 · 진하기를 잰다(청소년기 · 프리지아).
// 실행: node tools/tone-art.mjs [youth|freesia]  →  src/about-art/<이름>-tone.js 를 새로 쓴다.
//   참고 그림(src/images/<이름>-ref.png · .jpg · .webp)은 로컬에만 둔다(.gitignore) — 사이트에는 밝기 지도만 싣는다.
//
//   · 좌표: 그림 px → 형상 단위 u = (x - cx) / k, v = (y - top) / k (shapes.js 의 좌표와 같은 배율이 되게 대상마다 정한다).
//   · 배경 빼기
//       white  가장자리에서 이어진 밝고 무채색인 픽셀을 지운다(flood fill) — 흰 바탕 그림. 인물 안쪽 흰 옷은 윤곽선에 막혀 남는다.
//       hue    정한 색 범위(부위마다)에 드는 픽셀만 남긴다 — 하늘 · 구름 · 손이 있는 사진.
//   · 칸(CELL px)마다 값 0 = 배경, 아니면 부위 구간 안의 진하기(1 - 밝기, 부위 안에서 늘린다). 4비트씩 두 칸을 한 바이트에 담아 base64.
//   · 그림을 읽는 데는 web 저장소 테스트와 같은 Playwright(브라우저 캔버스)를 쓴다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(process.env.WEB_DIR || path.join(ROOT, '..', 'web'));

const TARGETS = {
  // 흰 바탕 전신 그림 832×1216 — 높이 1216 = 100(shapes.js 의 G())
  youth: {
    height: 1216,
    k: 12.16,
    cx: 416,
    top: 0,
    cell: 5,
    bg: 'white',
    classes: [['body', 1, 15]],
  },
  // 하늘 앞 꽃다발 사진 736×1309 — 꽃다발 부분(아래쪽)만, 노란 꽃 · 초록 줄기 따로
  freesia: {
    height: 1309,
    crop: [20, 840, 716, 1246], // 아래 손은 뺀다
    k: 5,
    cx: 368,
    top: 820,
    cell: 3,
    bg: 'hue',
    // [부위, 값 구간 시작, 끝, 색상(도) 범위, 최소 채도, 최소 명도]
    classes: [['flower', 1, 9, [26, 62], 0.42, 0.42], ['stem', 10, 15, [62, 160], 0.28, 0.2]],
  },
};

const NAME = process.argv[2] || 'youth';
const T = TARGETS[NAME];
if (!T) { console.error(`대상은 ${Object.keys(TARGETS).join(' · ')}`); process.exit(1); }
const SRC = ['png', 'jpg', 'jpeg', 'webp'].map((e) => path.join(ROOT, 'src/images', `${NAME}-ref.${e}`)).find((f) => fs.existsSync(f));
if (!SRC) { console.error(`src/images/${NAME}-ref.png(.jpg · .webp) 가 없어요.`); process.exit(1); }
const OUT = path.join(ROOT, `src/about-art/${NAME}-tone.js`);
const CONST = `${NAME.toUpperCase()}_TONE`;

const { loadPlaywright } = await import(pathToFileURL(path.join(WEB, 'tests/lib/harness.mjs')).href);
const pw = await loadPlaywright('chromium');
const browser = await pw.chromium.launch();
const page = await browser.newPage();
const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(SRC).toLowerCase()];
const url = `data:${type};base64,${fs.readFileSync(SRC).toString('base64')}`;

const map = await page.evaluate(async ({ url, T }) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const W = Math.round((img.naturalWidth * T.height) / img.naturalHeight);
  const H = T.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const [cx0, cy0, cx1, cy1] = T.crop || [0, 0, W, H];
  const lum = new Float32Array(W * H);
  const cls = new Int8Array(W * H).fill(-1); // 픽셀 부위(-1 = 배경)
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4] / 255;
    const gg = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    lum[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const x = i % W;
    const y = (i - x) / W;
    if (x < cx0 || x >= cx1 || y < cy0 || y >= cy1) continue;
    if (T.bg === 'white') { cls[i] = 0; continue; }
    const mx = Math.max(r, gg, b);
    const mn = Math.min(r, gg, b);
    const sat = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = (60 * ((gg - b) / (mx - mn)) + 360) % 360;
      else if (mx === gg) hue = 60 * ((b - r) / (mx - mn)) + 120;
      else hue = 60 * ((r - gg) / (mx - mn)) + 240;
    }
    T.classes.forEach(([, , , [h0, h1], s0, v0], k) => {
      if (cls[i] < 0 && hue >= h0 && hue < h1 && sat >= s0 && mx >= v0) cls[i] = k;
    });
  }
  if (T.bg === 'white') {
    // 가장자리에서 이어진 밝고 무채색인 픽셀 = 배경
    const bgish = (i) => lum[i] > 228 / 255 && Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) - Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 30;
    const seen = new Uint8Array(W * H);
    const stack = [];
    const push = (i) => { if (!seen[i] && bgish(i)) { seen[i] = 1; cls[i] = -1; stack.push(i); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W;
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (i >= W) push(i - W);
      if (i < W * (H - 1)) push(i + W);
    }
  }
  // 부위마다 진하기 범위(아래 · 위 2%)를 재서 그 안에서 0~1 로 늘린다 — 노란 꽃처럼 밝은 부위도 명암이 살게
  const ranges = T.classes.map((_, k) => {
    const v = [];
    for (let i = 0; i < W * H; i += 3) if (cls[i] === k) v.push(1 - lum[i]);
    v.sort((a, b) => a - b);
    return v.length ? [v[Math.floor(v.length * 0.02)], v[Math.floor(v.length * 0.98)]] : [0, 1];
  });
  const C = T.cell;
  const x0 = cx0;
  const y0 = cy0;
  const w = Math.ceil((cx1 - cx0) / C);
  const h = Math.ceil((cy1 - cy0) / C);
  const out = new Uint8Array(w * h);
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      let n = 0;
      const cnt = T.classes.map(() => 0);
      const dark = T.classes.map(() => 0);
      for (let y = y0 + cy * C; y < Math.min(cy1, y0 + cy * C + C); y++) {
        for (let x = x0 + cx * C; x < Math.min(cx1, x0 + cx * C + C); x++) {
          const i = y * W + x;
          n++;
          if (cls[i] >= 0) { cnt[cls[i]]++; dark[cls[i]] += 1 - lum[i]; }
        }
      }
      const fg = cnt.reduce((a, b) => a + b, 0);
      if (fg * 2 <= n) continue;
      const k = cnt.indexOf(Math.max(...cnt));
      const [, from, to] = T.classes[k];
      const [lo, hi] = ranges[k];
      const d = Math.max(0, Math.min(1, (dark[k] / cnt[k] - lo) / (hi - lo || 1)));
      out[cy * w + cx] = from + Math.round(d * (to - from));
    }
  }
  let bin = '';
  for (let i = 0; i < out.length; i += 2) bin += String.fromCharCode((out[i] << 4) | (out[i + 1] || 0));
  return { w, h, x0, y0, x1: x0 + w * C, y1: y0 + h * C, data: btoa(bin) };
}, { url, T });
await browser.close();

const u = (x) => ((x - T.cx) / T.k).toFixed(3);
const v = (y) => ((y - T.top) / T.k).toFixed(3);
const src = `// 자동 생성 — node tools/tone-art.mjs ${NAME} (참고 그림 ${path.basename(SRC)}, 로컬에만). 직접 고치지 않는다.
//   ${map.w}×${map.h} 칸(그림 ${T.cell}px 마다 한 칸), 4비트(앞 칸이 윗자리): 0 = 배경, classes 의 구간 = 그 부위의 진하기(구간 안 위치).
export const ${CONST} = {
  w: ${map.w},
  h: ${map.h},
  x0: ${u(map.x0)},
  x1: ${u(map.x1)},
  y0: ${v(map.y0)},
  y1: ${v(map.y1)},
  classes: ${JSON.stringify(T.classes.map(([part, from, to]) => [part, from, to]))},
  data: '${map.data}',
};
`;
fs.writeFileSync(OUT, src);
console.log(`${path.relative(ROOT, OUT)} — ${map.w}×${map.h}, ${(src.length / 1024).toFixed(1)} KB`);
