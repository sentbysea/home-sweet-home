// neighbor 방 — 친구 배너 모음. hongjiwon.love 와 같은 Supabase(banners 표 · 배너 카테고리)를 같이 쓴다.
//   보기: 누구나 — 공개 키로 REST 를 바로 읽는다(라이브러리 없음).
//   고치기: 사이트 주인만 — 맨 아래 'edit' 를 누르면 supabase-js 를 불러 Google 로 로그인하고,
//     추가(파일 올리기 또는 이미지 주소) · 삭제를 한다. 방식은 hongjiwon.love 의 posts-view-banner-form.js 와 같다
//     (이미지 파일은 user-banners 버킷 {user_id}/category-banners/{uuid}/image).
//   클라이언트는 글 창 · 관리자와 같은 하나(content/supabase.js).

import { SUPABASE_URL, SUPABASE_KEY, getClient, ownerSession, hasSavedLogin } from '../content/supabase.js';

const CATEGORY_ID = 4; // hongjiwon.love 배너 카테고리
const BUCKET = 'user-banners';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** http(s) 주소만 — 나머지(javascript: · data: …)는 null */
function httpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const u = new URL(text);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

async function fetchBanners() {
  const q = `select=id,name,url,image_url,image_path,sort_order&category_id=eq.${CATEGORY_ID}&order=sort_order.asc`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/banners?${q}`, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`banners ${res.status}`);
  return res.json();
}

/**
 * @param {HTMLElement} root  비어 있는 칸(.hsh-nb)
 * @param {() => void} onResize  내용 높이가 바뀌면(스크롤바 다시 맞추기)
 */
export function mountNeighbor(root, onResize = () => {}) {
  let banners = [];
  let editing = false;
  let session = { user: null, owner: false };
  let uploaded = null; // { path, url } — 이번 폼에서 올린 파일

  root.innerHTML = `
    <ul class="hsh-nb__grid" aria-live="polite"></ul>
    <p class="hsh-nb__msg" hidden></p>
    <form class="hsh-nb__form" hidden novalidate>
      <label class="hsh-nb__field"><span>url</span><input name="url" type="url" inputmode="url" placeholder="https://" required></label>
      <label class="hsh-nb__field"><span>image</span><input name="image" type="url" inputmode="url" placeholder="이미지 주소 (또는 아래 파일)"></label>
      <label class="hsh-nb__file"><input name="file" type="file" accept="image/*"><span>파일 올리기</span></label>
      <img class="hsh-nb__preview" alt="" hidden>
      <p class="hsh-nb__form-msg"></p>
      <div class="hsh-nb__actions">
        <button class="hsh-nb__btn is-ghost" type="button" data-act="cancel">취소</button>
        <button class="hsh-nb__btn" type="submit">저장</button>
      </div>
    </form>
    <div class="hsh-nb__foot">
      <button class="hsh-nb__link" type="button" data-act="add" hidden>+ add banner</button>
      <button class="hsh-nb__link" type="button" data-act="edit">edit</button>
    </div>`;

  const grid = root.querySelector('.hsh-nb__grid');
  const msg = root.querySelector('.hsh-nb__msg');
  const form = root.querySelector('.hsh-nb__form');
  const formMsg = root.querySelector('.hsh-nb__form-msg');
  const preview = root.querySelector('.hsh-nb__preview');
  const addBtn = root.querySelector('[data-act="add"]');
  const editBtn = root.querySelector('[data-act="edit"]');

  const say = (text) => { msg.textContent = text; msg.hidden = !text; onResize(); };

  const render = () => {
    grid.innerHTML = banners.map((b) => `
      <li class="hsh-nb__card">
        <a href="${esc(httpUrl(b.url) || '#')}" target="_blank" rel="noopener">
          <img src="${esc(b.image_url)}" alt="${esc(b.name || b.url)}" loading="lazy" decoding="async">
        </a>
        ${editing ? `<button class="hsh-nb__del" type="button" data-del="${b.id}" aria-label="배너 삭제">×</button>` : ''}
      </li>`).join('');
    if (!banners.length) say(editing ? '' : '아직 걸린 배너가 없어요.');
    addBtn.hidden = !editing;
    editBtn.textContent = editing ? 'done' : 'edit';
    grid.querySelectorAll('img').forEach((img) => img.addEventListener('load', onResize, { once: true }));
    onResize();
  };

  const load = async () => {
    try {
      banners = await fetchBanners();
      say('');
    } catch (e) {
      console.error(e);
      say('배너를 불러오지 못했어요.');
    }
    render();
  };

  const setPreview = (src) => {
    preview.hidden = !src;
    if (src) preview.src = src;
    else preview.removeAttribute('src');
    onResize();
  };

  const closeForm = () => {
    form.hidden = true;
    form.reset();
    uploaded = null;
    formMsg.textContent = '';
    setPreview('');
  };

  // edit — 로그인 안 했으면 Google 로, 주인이면 고치기 모드
  const toggleEdit = async () => {
    if (editing) { editing = false; closeForm(); render(); return; }
    say('확인 중...');
    let client;
    try { client = await getClient(); } catch { say('불러오지 못했어요.'); return; }
    session = await ownerSession(client);
    if (!session.user) {
      say('Google 로그인으로 이동 중...');
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}${location.pathname}` },
      });
      if (error) { console.error(error); say('로그인하지 못했어요.'); }
      return;
    }
    if (!session.owner) { say('사이트 주인만 고칠 수 있어요.'); return; }
    say('');
    editing = true;
    render();
  };

  // 파일 올리기 — 같은 폼에서 다시 고르면 같은 자리에 덮어쓴다
  form.file.addEventListener('change', async () => {
    const file = form.file.files?.[0];
    if (!file || !session.owner) return;
    formMsg.textContent = '업로드 중...';
    const client = await getClient();
    const path = uploaded?.path || crypto.randomUUID();
    const storagePath = `${session.user.id}/category-banners/${path}/image`;
    const { error } = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: true, contentType: file.type, cacheControl: '60' });
    form.file.value = '';
    if (error) { console.error(error); formMsg.textContent = '업로드하지 못했어요.'; return; }
    uploaded = { path, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}` };
    form.image.value = ''; // 마지막에 고른 쪽이 저장된다
    formMsg.textContent = '업로드 완료 ♡';
    setPreview(`${uploaded.url}?t=${Date.now()}`);
  });

  form.image.addEventListener('input', () => {
    const a = httpUrl(form.image.value);
    setPreview(a === '' ? uploaded?.url || '' : a || '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = httpUrl(form.url.value);
    const address = httpUrl(form.image.value);
    if (!url) { formMsg.textContent = 'url 은 http:// 또는 https:// 로 시작해야 해요.'; return; }
    if (address === null) { formMsg.textContent = '이미지 주소는 http:// 또는 https:// 로 시작해야 해요.'; return; }
    const imageUrl = address || uploaded?.url;
    if (!imageUrl) { formMsg.textContent = '이미지 주소를 적거나 파일을 올려 주세요.'; return; }
    const client = await getClient();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const { error } = await client.from('banners').insert({
      category_id: CATEGORY_ID,
      user_id: session.user.id,
      name: '',
      url,
      image_url: imageUrl,
      image_path: address ? null : uploaded.path,
      sort_order: banners.length ? Math.max(...banners.map((b) => b.sort_order ?? 0)) + 1 : 0,
    });
    submit.disabled = false;
    if (error) { console.error(error); formMsg.textContent = '저장하지 못했어요.'; return; }
    // 주소로 저장했으면 이번에 올렸다 안 쓴 파일은 지운다
    if (address && uploaded) await client.storage.from(BUCKET).remove([`${session.user.id}/category-banners/${uploaded.path}/image`]);
    closeForm();
    await load();
  });

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'edit') toggleEdit();
    if (act === 'add') { form.hidden = false; form.url.focus(); onResize(); }
    if (act === 'cancel') {
      // 올렸다가 취소한 파일은 지운다
      if (uploaded) (await getClient()).storage.from(BUCKET).remove([`${session.user.id}/category-banners/${uploaded.path}/image`]);
      closeForm();
    }
    const del = e.target.closest('[data-del]');
    if (del && confirm('이 배너를 삭제할까요?')) {
      const id = Number(del.dataset.del);
      const b = banners.find((x) => x.id === id);
      const client = await getClient();
      const { error } = await client.from('banners').delete().eq('id', id).eq('user_id', session.user.id);
      if (error) { console.error(error); say('삭제하지 못했어요.'); return; }
      if (b?.image_path) await client.storage.from(BUCKET).remove([`${session.user.id}/category-banners/${b.image_path}/image`]);
      await load();
    }
  });

  // Google 로그인에서 돌아왔거나 이미 로그인돼 있으면 클라이언트를 미리 깨워 둔다(주소의 토큰을 받아 저장)
  const back = /access_token=|[?&]code=/.test(location.hash + location.search);
  if (back || hasSavedLogin()) getClient().catch(() => {});

  let loaded = false;
  return {
    /** 방을 열 때마다 — 처음 한 번만 불러온다 */
    show() {
      if (!loaded) { loaded = true; load(); }
      else onResize();
    },
  };
}
