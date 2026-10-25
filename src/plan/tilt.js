// 누른 채 끌 때만 평면도 판이 살짝 기울어진다. 놓으면 CSS transition 으로 제자리.
//   올리기 · 그냥 움직이기에는 반응하지 않는다. 자이로 센서는 쓰지 않는다.
//   끌었으면 그 뒤에 오는 click 은 막는다 — 나중에 방 누르기와 섞이지 않게.

const MAX_TILT = 3.5; // deg
const MAX_SHIFT = 5; // px
const REACH = 160; // 이만큼 끌면 거의 끝까지 기운다(px)
const DRAG_SLOP = 6; // 이보다 덜 움직이면 클릭(px)

/**
 * @param {HTMLElement} area  누르는 영역(.hsh-plan, 화면 전체)
 * @param {HTMLElement} card  기우는 판(.hsh-plan__card)
 * @returns {() => void} 해제
 */
export function enableTilt(area, card) {
  let id = null; // 누르고 있는 포인터
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let dy = 0;
  let dragged = false;
  let frame = 0;

  const soft = (v) => Math.tanh(v / REACH); // 끝으로 갈수록 덜 기울어 ±1 을 넘지 않는다

  const paint = () => {
    frame = 0;
    const sx = soft(dx);
    const sy = soft(dy);
    card.style.setProperty('--ry', `${(sx * MAX_TILT).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${(-sy * MAX_TILT).toFixed(2)}deg`);
    card.style.setProperty('--tx', `${(sx * MAX_SHIFT).toFixed(2)}px`);
    card.style.setProperty('--ty', `${(sy * MAX_SHIFT).toFixed(2)}px`);
  };

  const release = () => {
    if (id === null) return;
    if (area.hasPointerCapture?.(id)) area.releasePointerCapture(id);
    id = null;
    cancelAnimationFrame(frame);
    frame = 0;
    card.classList.remove('is-pressed'); // transition 이 다시 켜진 뒤 0 으로
    for (const k of ['--rx', '--ry', '--tx', '--ty']) card.style.removeProperty(k);
  };

  const onDown = (e) => {
    if (id !== null || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = dy = 0;
    dragged = false;
    area.setPointerCapture?.(id);
    card.classList.add('is-pressed');
  };

  const onMove = (e) => {
    if (e.pointerId !== id) return; // 누르지 않고 움직이는 것은 무시
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { release(); return; } // 창 밖에서 뗀 경우
    dx = e.clientX - x0;
    dy = e.clientY - y0;
    if (!dragged && Math.hypot(dx, dy) > DRAG_SLOP) dragged = true;
    if (!frame) frame = requestAnimationFrame(paint);
  };

  const onUp = (e) => { if (e.pointerId === id) release(); };

  // 끌었다 놓은 뒤의 click 은 방 누르기로 넘기지 않는다
  const onClick = (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const onHide = () => { if (document.hidden) release(); };

  area.addEventListener('pointerdown', onDown);
  area.addEventListener('pointermove', onMove);
  area.addEventListener('pointerup', onUp);
  area.addEventListener('pointercancel', onUp);
  area.addEventListener('lostpointercapture', onUp);
  area.addEventListener('click', onClick, true);
  area.addEventListener('contextmenu', release);
  area.addEventListener('dragstart', (e) => e.preventDefault());
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    release();
    area.removeEventListener('pointerdown', onDown);
    area.removeEventListener('pointermove', onMove);
    area.removeEventListener('pointerup', onUp);
    area.removeEventListener('pointercancel', onUp);
    area.removeEventListener('lostpointercapture', onUp);
    area.removeEventListener('click', onClick, true);
    area.removeEventListener('contextmenu', release);
    window.removeEventListener('blur', release);
    document.removeEventListener('visibilitychange', onHide);
  };
}
