// 방 창 머리(사진 · 제목 · 검정 알약) — 주인이 창 오른쪽 위 edit 로 고친다(room-window.js).
//   저장 자리: hongjiwon.love 와 같은 site_settings 표의 한 칸(vibe_room_heads) — 값은 JSON 글자
//     { [방 label]: { title, pill, image, imagePath, hidden } }. 누구나 읽고 주인만 쓴다. 비운 칸은 코드의 기본값.
//   사진: user-banners/{주인}/vibe-rooms/{uuid} — 고를 때마다 새 경로(주소가 바뀌어 캐시에 예전 사진이 남지 않는다),
//     저장이 끝난 뒤에 밀려난 예전 사진을 지운다. 정사각형으로 가운데를 잘라 600px 까지 줄인다(움직이는 GIF 는 그대로).

import { SUPABASE_URL, SUPABASE_KEY, getClient } from '../content/supabase.js';
import { SITE_OWNER_ID } from '../content/home-settings.js';

const KEY = 'vibe_room_heads';
const BUCKET = 'user-banners';
const FOLDER = 'vibe-rooms';

/** 방마다 머리 — 못 읽으면 {}(코드 기본값 그대로) */
export async function fetchRoomHeads() {
  try {
    const q = `select=value&user_id=eq.${SITE_OWNER_ID}&key=eq.${KEY}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?${q}`, { headers: { apikey: SUPABASE_KEY } });
    if (!res.ok) return {};
    const value = (await res.json())?.[0]?.value;
    const heads = typeof value === 'string' ? JSON.parse(value) : value;
    return heads && typeof heads === 'object' ? heads : {};
  } catch {
    return {};
  }
}

/** 주인 — 방마다 머리 전부를 한 칸에 */
export async function saveRoomHeads(userId, heads) {
  const client = await getClient();
  const { error } = await client.from('site_settings').upsert({ user_id: userId, key: KEY, value: JSON.stringify(heads) }, { onConflict: 'user_id,key' });
  if (error) throw error;
}

/** 정사각형으로 가운데를 잘라 600px 까지 — 못 읽으면 원본 그대로 */
async function squarePhoto(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return file; }
  const { width: w, height: h } = bmp;
  const side = Math.min(w, h);
  if (!side) { bmp.close(); return file; }
  const out = Math.min(600, side);
  const c = document.createElement('canvas');
  c.width = c.height = out;
  c.getContext('2d').drawImage(bmp, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  bmp.close();
  const blob = await new Promise((resolve) => c.toBlob(resolve, file.type, 0.92));
  return blob ? new File([blob], file.name, { type: file.type }) : file;
}

/** 주인 — 사진 올리기. @returns {{ path, url }} */
export async function uploadRoomPhoto(userId, input) {
  const file = await squarePhoto(input);
  const client = await getClient();
  const path = `${userId}/${FOLDER}/${crypto.randomUUID()}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600' });
  if (error) throw error;
  return { path, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` };
}

/** 밀려난 사진 지우기 — 실패해도 조용히(파일만 남는다) */
export async function removeRoomPhoto(path) {
  if (!path || !path.includes(`/${FOLDER}/`)) return;
  try {
    const client = await getClient();
    await client.storage.from(BUCKET).remove([path]);
  } catch { /* 남아도 화면에는 안 쓰인다 */ }
}
