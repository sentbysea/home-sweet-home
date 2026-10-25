// 집 윤곽선의 손그림 변형(boil frame)을 만든다. 의존성 없음.
// 실행: node tools/wobble.mjs  →  index.html 의 .wobble path d 에 붙여 넣는다.
// 좌표계는 viewBox "0 0 340 318" (첨부 이미지의 집을 그대로 옮긴 값).

const HOUSE = [
  [170, 5],   // 지붕 꼭대기
  [335, 152], // 오른쪽 처마
  [276, 152],
  [276, 313], // 오른쪽 아래
  [56, 313],  // 왼쪽 아래
  [56, 152],
  [5, 152],   // 왼쪽 처마
];

const VERTEX_JITTER = 1.3; // 꼭짓점 흔들림(viewBox 단위)
const BOW = 1.6;           // 변이 휘는 정도

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 * 2 - 1; // -1..1
  };
}

const r1 = (n) => Math.round(n * 10) / 10;

function variant(seed) {
  const rand = rng(seed);
  const pts = HOUSE.map(([x, y]) => [x + rand() * VERTEX_JITTER, y + rand() * VERTEX_JITTER]);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    const k = rand() * BOW * Math.min(1, len / 160); // 짧은 변(처마)은 거의 곧게
    const cx = (ax + bx) / 2 + nx * k, cy = (ay + by) / 2 + ny * k;
    d += `Q${r1(cx)} ${r1(cy)} ${r1(bx)} ${r1(by)}`;
  }
  return d + 'Z';
}

for (const seed of [11, 23, 37, 53]) console.log(variant(seed));
