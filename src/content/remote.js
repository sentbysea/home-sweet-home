// hongjiwon.love 의 파일을 **복사하지 않고 그대로** 불러 쓴다 — 글 렌더러 · 프리셋 규칙 · 관리자 화면.
//   같은 Supabase 를 쓰는 자매 사이트라 렌더 규칙이 한 벌이어야 글 · Quote · 프리셋 미리보기가 어긋나지 않는다.
//   그 사이트의 배포 버전(core/build-version.js, 늘 새로 받는다)을 먼저 읽고, 나머지는 같은 ?v= 주소로 받는다 —
//   그쪽 화면과 정확히 같은 판이 들어오고, 그쪽이 새로 배포하면 다음 방문부터 같이 바뀐다.
//   정적 파일은 Access-Control-Allow-Origin: * 로 나간다(Cloudflare Pages 기본).
//   classic script 라 전역(함수 · const)을 남긴다 — 순서는 넣은 순서 그대로(async = false).

const DEFAULT_ORIGIN = 'https://hongjiwon.love';

// 로컬에서만 ?content-origin=http://localhost:8788 처럼 다른 출처(로컬 web 저장소)를 시험할 수 있다
function pickOrigin() {
  const asked = new URLSearchParams(location.search).get('content-origin');
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return asked && local && /^https?:\/\/[^/]+$/.test(asked) ? asked : DEFAULT_ORIGIN;
}

export const ORIGIN = pickOrigin();

let versionPromise = null;

/** 그쪽 배포 버전 — 이 파일만 ?t= 로 매번 새로 받는다(그쪽 index.html 과 같은 방식) */
export function buildVersion() {
  versionPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${ORIGIN}/core/build-version.js?t=${Date.now()}`;
    s.onload = () => (window.APP_BUILD_VERSION ? resolve(window.APP_BUILD_VERSION) : reject(new Error('build version')));
    s.onerror = () => { versionPromise = null; reject(new Error('build version')); };
    document.head.append(s);
  });
  return versionPromise;
}

/** 그쪽 경로(앞 / 없이, 예 'posts/posts-sanitize.js') → 같은 판 주소 */
export async function remoteUrl(path) {
  const v = await buildVersion();
  return `${new URL(path, `${ORIGIN}/`).href}?v=${encodeURIComponent(v)}`;
}

const scripts = new Map();
const styles = new Map();

/** classic script 를 넣은 순서대로 실행 — 같은 경로는 한 번만 */
export async function loadScripts(paths) {
  const v = await buildVersion();
  return Promise.all(paths.map((path) => {
    const href = new URL(path, `${ORIGIN}/`).href;
    if (!scripts.has(href)) {
      scripts.set(href, new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.async = false;
        s.src = `${href}?v=${encodeURIComponent(v)}`;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`script ${path}`));
        document.body.append(s);
      }));
    }
    return scripts.get(href);
  }));
}

/**
 * 전역을 남기지 않고 한 파일을 실행해 그 안의 함수를 꺼낸다 — 그 파일이 기대하는 전역은 env 로 대신 넣는다.
 * (예: core/site-meta.js 를 이 사이트 기본값으로 — 그 파일이 스스로 그쪽 설정을 적용하지 않게)
 * @param {string} path
 * @param {Record<string, unknown>} env   이름 → 값(파일 안에서 전역처럼 보인다)
 * @param {string[]} names                꺼낼 함수 이름
 */
export async function loadIsolated(path, env, names) {
  const res = await fetch(await remoteUrl(path), { credentials: 'omit' });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  const code = `${await res.text()}\n;return { ${names.join(', ')} };`;
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(env), code)(...Object.values(env));
}

/** 스타일시트 — 다 받을 때까지 기다린다(그리기 전에 규칙이 있어야 첫 모양이 튀지 않는다) */
export async function loadStyles(paths, parent = document.head) {
  const v = await buildVersion();
  return Promise.all(paths.map((path) => {
    const href = new URL(path, `${ORIGIN}/`).href;
    const key = parent === document.head ? href : null; // shadow root 안에는 매번 따로 건다
    if (key && styles.has(key)) return styles.get(key);
    const done = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${href}?v=${encodeURIComponent(v)}`;
      link.onload = resolve;
      link.onerror = resolve; // 못 받아도 글은 보인다(모양만 기본)
      parent.append(link);
    });
    if (key) styles.set(key, done);
    return done;
  }));
}
