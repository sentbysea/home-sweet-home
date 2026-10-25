// 준비 완료 신호. 로더는 Promise 하나만 기다린다 — 무엇이 준비인지는 바깥이 정한다.

/** 직접 resolve 하는 신호. 실제 앱에서는 데이터·이미지가 준비됐을 때 ready.resolve() */
export function createReadySignal() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

/** 데모용: 페이지 load 이후 ms 만큼 더 기다린 뒤 준비 완료 */
export function demoReady(ms = 1200) {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((r) => window.addEventListener('load', r, { once: true }));
  return loaded.then(() => new Promise((r) => setTimeout(r, ms)));
}
