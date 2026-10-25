// 배경 소용돌이 경로 — 반원을 두 중심에서 번갈아 이어 붙인다(간격 일정, 경로가 짧다).
// 실행: node tools/spiral.mjs  →  index.html 의 .hsh-bg__spiral path d 에 붙여 넣는다.
// 좌표계는 배경 viewBox "-640 -400 1280 800" (가운데가 0,0).

const GAP = 34;      // 줄 사이 간격
const MAX_R = 800;   // 화면 대각선 절반보다 크게

const r1 = (n) => Math.round(n * 10) / 10;
const ox = -GAP / 4; // 두 중심의 가운데를 0 에 맞춘다
let x = GAP / 2 + ox, y = 0;
let d = `M${r1(x)} ${y}`;
for (let k = 1; k * GAP / 2 <= MAX_R; k++) {
  const r = (k * GAP) / 2;
  const cx = (k % 2 ? 0 : GAP / 2) + ox;
  x = 2 * cx - x; // 반원 — 중심을 지나 반대편
  d += `A${r1(r)} ${r1(r)} 0 0 0 ${r1(x)} 0`;
}
console.log(d);
