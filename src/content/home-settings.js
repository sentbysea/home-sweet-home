// Settings > Home(탭 제목 · 파비콘 · 커서) — 바이브.me 전용 값.
//   저장 자리는 hongjiwon.love 와 같은 site_settings 표, 키만 따로(VIBE_HOME_KEYS) — 그쪽 값과 섞이지 않는다.
//   관리자(바이브.me /admin/)는 그쪽 관리자 화면 코드를 그대로 쓰고 키 이름만 이 값으로 바꿔 끼운다(src/admin/shell.js).
//   홈 화면에 적용하는 계산(커서 JSON 해석 · CSS 만들기 · 파비콘 주소 검사)은 그쪽 core/site-meta.js 를 같은 판으로
//   받아 그대로 쓴다. 그 파일은 불러오자마자 그쪽 설정을 적용하려 하므로 전역 없이(loadIsolated) 함수만 꺼낸다.
//   값이 비어 있으면 지금 정적 마크업 그대로(제목 'home sweet home', 기본 파비콘, 기본 커서).

import { loadIsolated } from './remote.js';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';

export const VIBE_HOME_KEYS = {
  title: 'vibe_site_title',
  faviconUrl: 'vibe_site_favicon_url',
  cursor: 'vibe_site_cursor',
};
const SITE_OWNER_ID = 'cfe0dc66-7fa2-450e-8817-44073a4a5aab'; // 사이트 주인(그쪽 core/site-config.js · DB site_owner_id() 와 같다)
const DEFAULT_TITLE = 'home sweet home';

async function fetchHomeSettings() {
  const keys = Object.values(VIBE_HOME_KEYS).join(',');
  const q = `select=key,value&user_id=eq.${SITE_OWNER_ID}&key=in.(${keys})`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?${q}`, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`site_settings ${res.status}`);
  return Object.fromEntries((await res.json()).map((r) => [r.key, r.value]));
}

/** 홈 화면에 적용 — 실패해도 조용히(정적 기본값이 그대로 남는다) */
export async function applyHomeSettings() {
  const settings = await fetchHomeSettings();
  if (!Object.values(settings).some((v) => typeof v === 'string' && v.trim())) return; // 다 비었으면 기본 그대로
  const meta = await loadIsolated('core/site-meta.js', {
    supabaseClient: undefined, // 그 파일의 자동 실행(loadSiteMeta)은 이 값이 없으면 아무것도 안 한다
    SITE_OWNER_ID,
    SITE_SETTING_KEYS: VIBE_HOME_KEYS,
    SITE_DEFAULT_TITLE: DEFAULT_TITLE,
  }, ['applySiteTitle', 'applySiteFavicon', 'applySiteCursor', 'isSafeHttpUrl']);
  const title = settings[VIBE_HOME_KEYS.title];
  if (typeof title === 'string' && title.trim()) meta.applySiteTitle(title);
  const favicon = settings[VIBE_HOME_KEYS.faviconUrl];
  if (meta.isSafeHttpUrl(favicon)) {
    meta.applySiteFavicon(favicon);
    // SVG 를 못 읽는 브라우저용 PNG 아이콘이 먼저 골라지지 않게 — 올린 아이콘 하나만 남긴다
    document.querySelectorAll('link[rel="icon"]:not(#siteFaviconLink)').forEach((l) => l.remove());
  }
  meta.applySiteCursor(settings[VIBE_HOME_KEYS.cursor] || '');
}
