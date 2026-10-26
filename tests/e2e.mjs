// 바이브.me E2E — 실제 파일(이 저장소 + 이웃 web 저장소) · 흉내 Supabase(임시 데이터, 운영 DB 에 닿지 않는다)
//
//   node tests/e2e.mjs [--only=visitor|owner|admin|mobile] [--browser=webkit]   (WEB_DIR=../web 이 기본)
//
//   · web 저장소의 tests/lib/harness.mjs(Playwright 찾기 · 정적 서버) · mock-supabase.mjs(RLS 흉내 메모리 DB)를 쓴다.
//   · "hongjiwon.love" = web 작업 트리를 띄운 정적 서버(127.0.0.1:8789). 그쪽 함수 두 개는 실제 코드를 그대로 돌린다:
//       /api/post-cover  functions/api/post-cover.js — 그 함수가 부르는 Supabase(판정 RPC · Storage)만 흉내 DB 로
//       /api/ops/*       functions/api/ops/[[path]].js — 서비스 바인딩 OPS 는 가짜(주인 토큰만 통과)
//   · 바이브.me = 이 저장소 정적 서버(127.0.0.1:5174), 모든 주소에 ?content-origin=http://127.0.0.1:8789.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(process.env.WEB_DIR || path.join(ROOT, '..', 'web'));
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const BROWSER = (process.argv.find((a) => a.startsWith('--browser=')) || '--browser=chromium').slice(10); // chromium | webkit
const OUT = process.env.E2E_OUT || path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });

const { loadPlaywright, startStaticServer, createChecker } = await import(pathToFileURL(path.join(WEB, 'tests/lib/harness.mjs')).href);
const mock = await import(pathToFileURL(path.join(WEB, 'tests/lib/mock-supabase.mjs')).href);
const { onRequest: postCover } = await import(pathToFileURL(path.join(WEB, 'functions/api/post-cover.js')).href);
const { onRequest: opsProxy } = await import(pathToFileURL(path.join(WEB, 'functions/api/ops/[[path]].js')).href);
const { OWNER_ID, USERS, SUPABASE_HOST } = mock;

const WEB_PORT = 8789;
const VIBE_PORT = 5174;
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const VIBE_ORIGIN = `http://127.0.0.1:${VIBE_PORT}`;
const Q = `content-origin=${encodeURIComponent(WEB_ORIGIN)}`;
const SUPABASE = `https://${SUPABASE_HOST}`;

const { check, summary } = createChecker();

// ---------- 사진(진짜 PNG — 크기를 잴 수 있게) ----------

function png(w, h, [r, g, b]) {
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([r, (g + x) % 256, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])) >>> 0);
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

// ---------- 임시 데이터 ----------

const IMG = {
  pub: '11111111-1111-4111-8111-00000000000a',
  secret: '22222222-2222-4222-8222-00000000000b',
  priv: '33333333-3333-4333-8333-00000000000c',
  gallery: '44444444-4444-4444-8444-00000000000d',
};
const imgTag = (id) => `<img src="/api/post-cover?image=${id}" alt="" data-imory-image="${id}">`;

function seed() {
  const db = mock.createMockDb();
  const t = (d) => `2026-10-${String(d).padStart(2, '0')}T03:00:00.000Z`;
  db.categories.push(
    { id: 1, user_id: OWNER_ID, name: 'LOG', slug: 'still', sort_order: 1, type: 'post', page_size: 12, created_at: t(1) },
    { id: 2, user_id: OWNER_ID, name: 'PIC', slug: 'with', sort_order: 2, type: 'gallery', page_size: 6, created_at: t(1) },
    { id: 3, user_id: OWNER_ID, name: 'MEMO', slug: 'you', sort_order: 3, type: 'post', page_size: 12, created_at: t(1) },
  );
  db.post_folders.push(
    { id: 10, user_id: OWNER_ID, category_id: 1, parent_id: null, name: '잠긴 폴더', depth: 1, sort_order: 2, series_title_mode: 'all', visibility: 'password', password: 'folderpw' },
    { id: 11, user_id: OWNER_ID, category_id: 1, parent_id: null, name: 'open', depth: 1, sort_order: 1, series_title_mode: 'all', visibility: 'public' },
  );
  const post = (id, o) => ({
    id, user_id: OWNER_ID, category_id: 1, title: `글 ${id}`, content_type: 'richtext', visibility: 'public',
    created_at: t(id - 90), updated_at: t(id - 90), quote_preset_id: null, card_preset_id: null, folder_id: null, sort_order: id, ...o,
  });
  db.posts.push(
    post(101, { title: '사진 글', folder_id: 11 }),
    post(102, { title: '비밀 사진 글', visibility: 'secret', secret_password: 'pw102' }),
    post(103, { title: '나만 보는 글', visibility: 'private' }),
    post(104, { title: '프리셋 지정 글', quote_preset_id: 202 }),
    post(105, { title: '잠긴 폴더 글', folder_id: 10 }),
    post(106, { title: '갤러리 한 장', category_id: 2 }),
    post(107, { title: '짧은 메모', category_id: 3 }),
  );
  const content = (id, html) => db.post_contents.push({ post_id: id, content: html, ooc_content: null });
  content(101, `<div>첫 문단은 발췌에서 빠져야 하는 FIRSTPARA 문장이에요.</div><div><br></div><div>"둘째 문단 대사 SECONDQUOTE 예요."</div><div>*지문 ACTIONWORD 이 이어진다*</div><div><br></div><div>셋째 문단 THIRDPARA 끝.</div><div>${imgTag(IMG.pub)}</div>`);
  content(102, `<div>비밀 본문 SECRETBODY</div><div>${imgTag(IMG.secret)}</div>`);
  content(103, `<div>나만 보는 본문 PRIVATEBODY</div><div>${imgTag(IMG.priv)}</div>`);
  content(104, '<div>지정 프리셋 본문 EXPLICIT</div>');
  content(105, '<div>잠긴 폴더 안 본문 LOCKEDBODY</div>');
  content(106, `<div>${imgTag(IMG.gallery)}</div>`);
  content(107, '<div>메모 한 줄</div>');
  const photo = (id, postId, size, color) => {
    db.storage.set(`post-covers/${OWNER_ID}/${id}`, { bytes: png(...size, color), contentType: 'image/png' });
    db.post_gallery_images.push({ id, post_id: postId, storage_path: `${OWNER_ID}/${id}`, mime_type: 'image/png', byte_size: 1, position: 0, is_primary: true });
  };
  photo(IMG.pub, 101, [240, 160], [240, 160, 200]);
  photo(IMG.secret, 102, [200, 120], [140, 180, 240]);
  photo(IMG.priv, 103, [180, 100], [160, 220, 150]);
  photo(IMG.gallery, 106, [300, 300], [250, 220, 140]);
  const preset = (id, name, active, settings) => db.quote_presets.push({ id, user_id: OWNER_ID, name, is_active: active, settings, created_at: t(1), updated_at: t(id - 190) });
  preset(201, 'Active', true, { bodySize: 15, exportWidth: 1000, ratio: 'auto', bodyFont: 'pretendard', titleEnabled: true });
  preset(202, 'Explicit', false, { bodySize: 19, exportWidth: 1440, ratio: '1:1', bodyColor: '#123456' });
  preset(203, 'Other', false, { bodySize: 13, exportWidth: 800, ratio: 'auto' });
  // 흉내 DB 에 없는 RPC — 사이트 주인
  db.hooks.rpc = async ({ route, name }) => {
    if (name !== 'site_owner_id') return false;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(OWNER_ID) });
    return true;
  };
  return db;
}

let db = seed();

// ---------- 그쪽 함수가 부르는 Supabase(판정 RPC · Storage) — 흉내 DB 로 ----------

const realFetch = globalThis.fetch;
const coverCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin !== SUPABASE) return realFetch(input, init);
  const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const token = (headers.authorization || '').replace(/^Bearer\s+/, '');
  const uid = token === USERS.owner.token ? OWNER_ID : token === USERS.other.token ? mock.OTHER_ID : null;
  const list = (h) => String(headers[h] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const galleryTokens = list('x-imory-gallery-access');
  const folderTokens = list('x-imory-folder-access');
  coverCalls.push({ path: url.pathname, uid, galleryTokens, folderTokens });
  const readable = (image) => {
    const post = image && db.posts.find((p) => p.id === image.post_id);
    if (!post) return false;
    if (post.user_id === uid) return true;
    const folder = post.folder_id && db.post_folders.find((f) => f.id === post.folder_id);
    const folderOpen = !folder || folder.visibility === 'public' ||
      (folder.visibility === 'password' && db.post_folder_tokens.some((x) => x.folder_id === folder.id && folderTokens.includes(x.token)));
    if (!folderOpen) return false;
    if (post.visibility === 'public') return true;
    return post.visibility === 'secret' && db.gallery_read_tokens.some((x) => x.post_id === post.id && galleryTokens.includes(x.token));
  };
  if (url.pathname === '/rest/v1/rpc/get_gallery_image_object') {
    const { p_image_id: id } = JSON.parse(init.body);
    const image = db.post_gallery_images.find((g) => g.id === id);
    return new Response(JSON.stringify(readable(image) ? [{ storage_path: image.storage_path, mime_type: image.mime_type }] : []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.pathname.startsWith('/storage/v1/object/post-covers/')) {
    const key = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length));
    const image = db.post_gallery_images.find((g) => `post-covers/${g.storage_path}` === key);
    const file = db.storage.get(key);
    return file && readable(image) ? new Response(file.bytes, { status: 200, headers: { 'content-length': String(file.bytes.length) } }) : new Response('', { status: 400 });
  }
  return new Response('{}', { status: 404 });
};

// 가짜 OPS Worker — 주인 토큰만, 대시보드 묶음은 시험용
const OPS = {
  async fetch(request) {
    const owner = request.headers.get('authorization') === `Bearer ${USERS.owner.token}`;
    if (!owner) return new Response(JSON.stringify({ error: 'forbidden' }), { status: request.headers.get('authorization') ? 403 : 401, headers: { 'Content-Type': 'application/json' } });
    const bundle = {
      html: '<section class="ops-dash-mine"><label><input type="checkbox" data-ops-optout> 내 방문 제외</label></section><a class="e2e-post" href="/post/101">인기 글</a>',
      css: '.ops-dash-mine{border:1px solid #ccc}',
      js: 'window.HongjiwonOpsDashboard={mount(root,host){root.dataset.apiBase=host.apiBase;return{refresh(){}}}};',
    };
    return new Response(JSON.stringify(bundle), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
};

const toRequest = async (req) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(new URL(req.url, WEB_ORIGIN), { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body });
};
const sendResponse = async (res, r) => {
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
};

const webServer = await startStaticServer(WEB_PORT, {
  root: WEB,
  handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Cloudflare Pages 정적 파일과 같게
    const p = new URL(req.url, WEB_ORIGIN).pathname;
    const env = { CROSS_SITE_ORIGINS: VIBE_ORIGIN, OPS, SUPABASE_URL: SUPABASE };
    if (p === '/api/post-cover') { res.removeHeader('Access-Control-Allow-Origin'); toRequest(req).then((request) => postCover({ request, env })).then((r) => sendResponse(res, r)); return true; }
    if (p.startsWith('/api/ops')) { res.removeHeader('Access-Control-Allow-Origin'); toRequest(req).then((request) => opsProxy({ request, env })).then((r) => sendResponse(res, r)); return true; }
    return false;
  },
});
const vibeServer = await startStaticServer(VIBE_PORT, { root: ROOT });

const playwright = await loadPlaywright(BROWSER);
const browser = await playwright[BROWSER].launch();
console.log(`browser: ${BROWSER}`);

async function open(user, viewport = { width: 1280, height: 900 }, extra = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, ...extra });
  if (user) await context.addInitScript(mock.authInitScript(user));
  await mock.attachMockSupabase(context, db);
  const page = await context.newPage();
  const errors = [];
  const coverRequests = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|403|404)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (r.url().includes('/api/post-cover?')) coverRequests.push({ url: r.url(), headers: r.headers() }); });
  return { context, page, errors, coverRequests };
}

const openRoom = (page, category, look) => page.evaluate(([category, look]) => {
  document.querySelector('.hsh-plan').dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room: 'e', label: 'log', name: '기록', bg: '#cfe0fb', fg: '#8a62dc', category, look } }));
}, [category, look]);

async function home(page) {
  await page.goto(`${VIBE_ORIGIN}/?plan=only&${Q}`);
  await page.waitForSelector('.hsh-plan.is-done', { timeout: 20000 });
}
const rows = (page) => page.$$eval('.hsh-ct__row', (b) => b.map((x) => x.textContent.trim()));
const clickRow = async (page, text) => {
  await page.waitForSelector('.hsh-ct__row', { timeout: 15000 });
  await page.locator('.hsh-ct__row', { hasText: text }).first().click();
};
const bodyReady = (page) => page.waitForFunction(() => {
  const c = document.querySelector('.hsh-ct__post .post-detail-content');
  return c && (c.textContent.trim().length > 0 || c.shadowRoot);
}, null, { timeout: 20000 });
/** 흉내 DB 값이 바뀔 때까지(저장 응답 뒤) */
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const imgLoaded = (page, sel) => page.waitForFunction((sel) => {
  const img = document.querySelector(sel);
  return img && img.complete && img.naturalWidth > 0;
}, sel, { timeout: 15000 }).then(() => true).catch(() => false);

// ---------- 방문자 ----------

async function visitor() {
  console.log('\n[visitor — 로그인 없음]');
  const { page, errors, coverRequests, context } = await open(null);
  await home(page);
  await openRoom(page, '1');
  await page.waitForSelector('.hsh-ct__folders', { timeout: 20000 });
  const folders = await page.$$eval('.hsh-ct__folder', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  check('폴더: 공개 · 비밀번호(LOCKED)', folders.some((f) => f.startsWith('open')) && folders.some((f) => f.includes('잠긴 폴더') && f.includes('LOCKED')), folders.join(' | '));
  const root = await rows(page);
  check('비공개 글은 목록에 없다', !root.some((r) => r.includes('나만 보는 글')), root.join(' | '));
  check('비밀글은 🔒 와 함께 보인다', root.some((r) => r.includes('🔒') && r.includes('비밀 사진 글')));

  await clickRow(page, '프리셋 지정 글');
  await bodyReady(page);
  const explicit = await page.$eval('.post-detail-content', (c) => getComputedStyle(c).fontSize);
  check('글에 지정된 프리셋(202, 19px)', explicit === '19px', explicit);
  check('방문자에게 quote 버튼 없음', !(await page.$('.hsh-ct__tool')));
  await page.goBack();

  await clickRow(page, '비밀 사진 글');
  await page.waitForSelector('.hsh-ct__gate');
  await page.fill('.hsh-ct__input', 'wrong');
  await page.click('.hsh-ct__gate .hsh-ct__btn');
  await page.waitForFunction(() => document.querySelector('.hsh-ct__gate-msg')?.textContent);
  check('비밀글 오답 → 거절', (await page.textContent('.hsh-ct__gate-msg')).includes('일치하지'));
  check('오답이면 본문을 그리지 않는다', !(await page.textContent('.hsh-ct__sheet')).includes('SECRETBODY'));
  await page.fill('.hsh-ct__input', 'pw102');
  await page.click('.hsh-ct__gate .hsh-ct__btn');
  await page.waitForFunction(() => document.querySelector('.post-detail-content')?.textContent.includes('SECRETBODY'), null, { timeout: 15000 });
  check('비밀글 정답 → 본문', true);
  check('비밀글 사진 — 읽기 표 머리글로 받아 보인다', await imgLoaded(page, '.post-detail-content img'));
  check('사진 요청에 X-Imory-Gallery-Access(주소에는 표 없음)', coverRequests.some((r) => r.headers['x-imory-gallery-access'] && !/access|token/i.test(new URL(r.url).search.replace('image=', ''))));
  await page.goBack();

  await page.locator('.hsh-ct__folder', { hasText: '잠긴 폴더' }).click();
  await page.waitForSelector('.hsh-ct__gate');
  await page.fill('.hsh-ct__input', 'folderpw');
  await page.click('.hsh-ct__gate .hsh-ct__btn');
  await clickRow(page, '잠긴 폴더 글');
  await page.waitForFunction(() => document.querySelector('.post-detail-content')?.textContent.includes('LOCKEDBODY'), null, { timeout: 15000 });
  check('비밀번호 폴더 → 열람 표 → 안의 글', true);
  await page.goBack();
  await page.goBack();

  await page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await clickRow(page, '사진 글');
  await bodyReady(page);
  const active = await page.$eval('.post-detail-content', (c) => ({ size: getComputedStyle(c).fontSize, font: getComputedStyle(c).fontFamily }));
  check('지정 없는 글 → 사용 중 프리셋(201, 15px)', active.size === '15px', JSON.stringify(active));
  check('본문 글꼴 Pretendard', /Pretendard/.test(active.font), active.font);
  check('공개 사진 — 머리글 없이 그쪽 주소로', await imgLoaded(page, '.post-detail-content img'));
  check('사진이 창 밖으로 넘치지 않는다', await page.$eval('.post-detail-content img', (img) => img.getBoundingClientRect().right <= img.closest('.hsh-win__page').getBoundingClientRect().right + 1));
  await page.keyboard.press('Escape');

  await openRoom(page, '2');
  await page.waitForSelector('.hsh-ct__grid', { timeout: 15000 });
  check('갤러리 썸네일(대표 사진)', await imgLoaded(page, '.hsh-ct__ph img'));
  await page.keyboard.press('Escape');
  await openRoom(page, '3', 'memo');
  await page.waitForSelector('.hsh-ct__memos', { timeout: 15000 });
  check('메모 — 쪽지 모양', (await page.textContent('.hsh-ct__memos')).includes('짧은 메모'));
  check('콘솔 오류 없음(visitor)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------- 주인 ----------

async function quoteFrame(page) {
  await page.waitForSelector('.hsh-ct__quote-frame', { timeout: 15000 });
  const frame = await (await page.$('.hsh-ct__quote-frame')).contentFrame();
  await frame.waitForFunction(() => document.querySelectorAll('#postEditorPreviewPages .post-editor-preview-page').length > 0 && !/^\s*$/.test(document.querySelector('#postEditorPreviewExportSize')?.textContent || ''), null, { timeout: 40000 });
  await frame.waitForTimeout(600);
  return frame;
}

async function exportFirst(page, frame, name) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), frame.click('#postEditorExportButton')]);
  const file = path.join(OUT, `${name}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  return { file, size: pngSize(fs.readFileSync(file)), name: download.suggestedFilename() };
}

async function owner() {
  console.log('\n[owner — 주인 로그인(흉내 세션)]');
  const { page, errors, coverRequests, context } = await open(USERS.owner);
  const writes = [];
  page.on('request', (r) => { if (r.url().startsWith(SUPABASE) && r.method() !== 'GET' && /save_post_draft|upsert_own_post_content|\/rest\/v1\/(posts|post_contents|post_drafts)/.test(r.url())) writes.push(r.url()); });
  await home(page);
  await openRoom(page, '1');
  await page.waitForSelector('.hsh-ct__rows', { timeout: 20000 });
  const root = await rows(page);
  check('주인에게는 비공개 글(🙈)도', root.some((r) => r.includes('🙈') && r.includes('나만 보는 글')), root.join(' | '));
  await clickRow(page, '나만 보는 글');
  await bodyReady(page);
  check('비공개 글 사진 — 주인 토큰(Authorization)으로', await imgLoaded(page, '.post-detail-content img'));
  check('사진 요청 머리글에 주인 토큰', coverRequests.some((r) => r.headers.authorization === `Bearer ${USERS.owner.token}`));
  check('글자 크기 기본값 범위 표시', (await page.textContent('.hsh-ct__scale')).includes('두 사이트'));
  await page.goBack();

  // 부분 발췌 — 시작점(둘째 문단 대사) ~ 끝점(셋째 문단)
  await page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await clickRow(page, '사진 글');
  await bodyReady(page);
  await page.click('.hsh-ct__tool');
  await page.waitForSelector('.hsh-ct__pick');
  const tapWord = async (word) => {
    const box = await page.evaluate((word) => {
      const c = document.querySelector('.post-detail-content');
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = n.data.indexOf(word);
        if (i < 0) continue;
        const r = document.createRange(); r.setStart(n, i + 2); r.setEnd(n, i + 3);
        const b = r.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    }, word);
    await page.mouse.click(box.x, box.y);
  };
  await page.click('[data-pick="start"]');
  await tapWord('SECONDQUOTE');
  await page.click('[data-pick="end"]');
  await tapWord('THIRDPARA');
  const picked = await page.textContent('.hsh-ct__pick-state');
  check('시작점 · 끝점 → 고른 구간 표시', /자$/.test(picked.trim()), picked);
  await page.click('.hsh-ct__pick .hsh-ct__btn');
  let frame = await quoteFrame(page);
  const partText = await frame.$eval('#postEditorPreviewPages', (p) => p.textContent);
  check('부분 발췌 — 고른 구간만(첫 문단 빠짐)', partText.includes('SECONDQUOTE') && partText.includes('THIRDPARA') && !partText.includes('FIRSTPARA'), partText.slice(0, 200));
  check('부분 발췌 — 대사 · 지문 서식 그대로(원본 렌더러)', await frame.$eval('#postEditorPreviewPages', (p) => Boolean(p.querySelector('.post-dialogue') && p.querySelector('.post-action'))));
  check('부분 발췌 — 지문 별표는 글자로 남지 않는다', !partText.includes('*'));
  const sizeLabel = await frame.textContent('#postEditorPreviewExportSize');
  check('출력 너비 = 사용 중 프리셋(201) 1000px', sizeLabel.trim().startsWith('1000'), sizeLabel);
  check('Quote 화면 글꼴(Pretendard) 받음', await frame.evaluate(() => document.fonts.check('16px Pretendard')));
  const part = await exportFirst(page, frame, 'part');
  check('export → PNG 저장(폭 1000)', part.size.w === 1000, JSON.stringify(part));
  await page.screenshot({ path: path.join(OUT, 'owner-quote-part.png') });

  // 글 전체 — 사진 포함
  await page.click('.hsh-ct__post.is-quote .hsh-ct__back');
  await bodyReady(page);
  await page.click('.hsh-ct__tool');
  await page.click('.hsh-ct__pick .hsh-ct__btn');
  frame = await quoteFrame(page);
  const whole = await frame.$eval('#postEditorPreviewPages', (p) => ({ text: p.textContent, img: [...p.querySelectorAll('img')].map((i) => ({ w: i.naturalWidth, data: i.src.startsWith('data:') || i.src.startsWith('blob:') })) }));
  check('글 전체 발췌(첫 문단 포함)', whole.text.includes('FIRSTPARA'));
  check('발췌 안 사진 — 받아서 굳힘(raster)', whole.img.length > 0 && whole.img.every((i) => i.w > 0 && i.data), JSON.stringify(whole.img));
  const full = await exportFirst(page, frame, 'whole');
  check('글 전체 export → PNG(폭 1000)', full.size.w === 1000, JSON.stringify(full.size));

  // 글에 지정된 프리셋(202) — Quote 도 1440
  await page.keyboard.press('Escape');
  await openRoom(page, '1');
  await clickRow(page, '프리셋 지정 글');
  await bodyReady(page);
  await page.click('.hsh-ct__tool');
  await page.click('.hsh-ct__pick .hsh-ct__btn');
  frame = await quoteFrame(page);
  check('지정 프리셋 글의 Quote = 1440px', (await frame.textContent('#postEditorPreviewExportSize')).trim().startsWith('1440'));
  const exp = await exportFirst(page, frame, 'explicit');
  check('지정 프리셋 export PNG 1440 × 1440(1:1)', exp.size.w === 1440 && exp.size.h === 1440, JSON.stringify(exp.size));
  check('저장 · 임시저장 요청 없음', writes.length === 0, writes.join(' | '));
  check('콘솔 오류 없음(owner)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------- 관리자 ----------

async function admin() {
  console.log('\n[admin]');
  {
    const { page, context } = await open(null);
    await page.goto(`${VIBE_ORIGIN}/admin/?${Q}`);
    await page.waitForSelector('#loginBox', { timeout: 30000 });
    await page.waitForTimeout(800);
    check('로그아웃 상태 → 로그인 화면', await page.$eval('#loginBox', (e) => !e.hidden && getComputedStyle(e).display !== 'none'));
    await context.close();
  }
  {
    const { page, context } = await open(USERS.other);
    await page.goto(`${VIBE_ORIGIN}/admin/?${Q}`);
    await page.waitForSelector('.hsh-admin-denied:not([hidden])', { timeout: 30000 });
    check('다른 계정 → 관리 화면 닫힘', await page.$eval('#adminDashboard', (e) => getComputedStyle(e).display === 'none'));
    await context.close();
  }

  const { page, errors, context } = await open(USERS.owner);
  await page.goto(`${VIBE_ORIGIN}/admin/?${Q}`);
  await page.waitForSelector('#adminDashboard:not([hidden])', { timeout: 30000 });
  await page.waitForTimeout(800);
  check('주인 → 관리 화면', await page.$eval('#adminDashboard', (e) => getComputedStyle(e).display !== 'none') && !(await page.$('.hsh-admin-denied:not([hidden])')));
  const scopes = await page.$$eval('.hsh-admin-scope', (s) => s.map((x) => x.textContent));
  check('적용 범위 표시(Home 3 · Category · Quote · 사용 중 · Dashboard)', scopes.filter((s) => s.includes('바이브.me')).length === 3 && scopes.filter((s) => s.includes('두 사이트')).length === 3 && scopes.some((s) => s.includes('hongjiwon.love 통계')), scopes.join(' | '));

  // Home — 바이브.me 키에만, 새로고침 뒤에도
  await page.click('#openSettingsButton');
  await page.waitForSelector('#homeSettingsPanel:not([hidden])');
  await page.fill('#siteTitleInput', 'E2E 바이브 제목');
  await page.click('#siteTitleSaveButton');
  await until(() => db.site_settings.some((r) => r.key === 'vibe_site_title'));
  const row = db.site_settings.find((r) => r.key === 'vibe_site_title');
  check('Home 저장 → vibe_site_title', row?.value === 'E2E 바이브 제목', JSON.stringify(db.site_settings));
  check('hongjiwon.love 의 site_title 은 그대로(안 씀)', !db.site_settings.some((r) => r.key === 'site_title'));
  await page.reload();
  await page.waitForSelector('#adminDashboard:not([hidden])', { timeout: 30000 });
  await page.evaluate(() => showSettingsPanel());
  await page.waitForFunction(() => document.getElementById('siteTitleInput')?.value, null, { timeout: 15000 }).catch(() => {});
  check('새로고침 뒤에도 Home 값', (await page.inputValue('#siteTitleInput')) === 'E2E 바이브 제목');
  check('설정은 HOME 탭부터(PROFILE 숨김)', await page.$eval('#homeSettingsPanel', (p) => !p.hidden) && await page.$eval('#profileSettingsPanel', (p) => p.hidden));

  // Category — 같은 표, 두 사이트
  await page.click('#categoryTabButton');
  await page.waitForSelector('#categoryList .category-item');
  const memoInput = page.locator('#categoryList .category-item .category-name-input').nth(2);
  await memoInput.fill('MEMO2');
  await page.click('#categorySaveButton');
  await until(() => db.categories.find((c) => c.id === 3)?.name === 'MEMO2');
  check('Category 저장 → 같은 표', db.categories.find((c) => c.id === 3)?.name === 'MEMO2', JSON.stringify(db.categories.map((c) => c.name)));

  // Quote Preset — 201 을 고쳐 저장, 203 을 사용 중으로
  await page.evaluate(() => showQuotePanel());
  await page.waitForSelector('#quotePresetList .quote-preset-item', { timeout: 15000 });
  await page.locator('#quotePresetList .quote-preset-item', { hasText: 'Active' }).locator('.quote-preset-load').click();
  await page.waitForTimeout(500);
  // 본문 크기 칸은 접힌 아코디언 안 — 값을 넣고 그쪽 입력 처리(input)를 그대로 부른다
  await page.evaluate(() => { const i = document.getElementById('quoteFontSize'); i.value = '17'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#quoteSaveButton');
  await until(() => Number(db.quote_presets.find((p) => p.id === 201)?.settings?.bodySize) === 17);
  check('Quote Preset 저장 → 같은 표(201 bodySize 17)', Number(db.quote_presets.find((p) => p.id === 201)?.settings?.bodySize) === 17, JSON.stringify(db.quote_presets.find((p) => p.id === 201)?.settings));

  // Dashboard — 그쪽 /api/ops(이 출처에만 CORS), 인기 글은 그쪽 주소로, 내 방문 제외는 그쪽에서
  await page.evaluate(() => showStatsDashboardPanel());
  await page.waitForSelector('#statsDashboardMount .e2e-post', { timeout: 20000 });
  check('Dashboard 묶음 → 그쪽 /api/ops', (await page.$eval('#statsDashboardMount', (m) => m.dataset.apiBase)) === `${WEB_ORIGIN}/api/ops`);
  await page.waitForTimeout(300);
  check('내 방문 제외 — 여기서는 잠그고 안내', await page.$eval('[data-ops-optout]', (b) => b.disabled) && (await page.textContent('.ops-dash-mine')).includes('hongjiwon.love'));
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#statsDashboardMount .e2e-post')]);
  check('인기 글 링크 → 그쪽 글 주소', popup.url().startsWith(`${WEB_ORIGIN}/post/101`), popup.url());
  await popup.close();
  check('콘솔 오류 없음(admin)', errors.length === 0, errors.join(' | '));
  await context.close();

  // 두 사이트 반영 — 바이브.me 홈 · 글 창 / hongjiwon.love(같은 web 작업 트리)
  const v = await open(null);
  await v.page.goto(`${VIBE_ORIGIN}/?plan=only&${Q}`);
  await v.page.waitForFunction(() => document.title === 'E2E 바이브 제목', null, { timeout: 15000 }).catch(() => {});
  check('바이브.me 홈 탭 제목 = Home 값', (await v.page.title()) === 'E2E 바이브 제목', await v.page.title());
  await v.page.waitForSelector('.hsh-plan.is-done');
  await openRoom(v.page, '3', 'memo');
  await v.page.waitForSelector('.hsh-ct__memos');
  check('바이브.me 글 창 주소줄 = 바뀐 카테고리 이름', (await v.page.textContent('.hsh-win__url')).includes('MEMO2'));
  await v.page.keyboard.press('Escape');
  await openRoom(v.page, '1');
  await v.page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await clickRow(v.page, '사진 글');
  await bodyReady(v.page);
  check('바이브.me 글 — 고친 프리셋(17px)', (await v.page.$eval('.post-detail-content', (c) => getComputedStyle(c).fontSize)) === '17px');
  await v.context.close();

  const hj = await open(null);
  await hj.page.goto(`${WEB_ORIGIN}/`);
  await hj.page.waitForFunction(() => document.getElementById('categoryMenuLinks')?.textContent.includes('MEMO2'), null, { timeout: 20000 }).catch(() => {});
  check('hongjiwon.love 메뉴 = 바뀐 카테고리 이름', (await hj.page.textContent('#categoryMenuLinks')).includes('MEMO2'));
  check('hongjiwon.love 탭 제목은 Home 값과 무관', (await hj.page.title()) !== 'E2E 바이브 제목', await hj.page.title());
  await hj.page.goto(`${WEB_ORIGIN}/post/101`);
  await hj.page.waitForFunction(() => document.getElementById('postDetailContent')?.textContent.includes('FIRSTPARA'), null, { timeout: 30000 });
  check('hongjiwon.love 글 — 같은 프리셋(17px)', (await hj.page.$eval('#postDetailContent', (c) => getComputedStyle(c).fontSize)) === '17px');
  await hj.context.close();
}

// 사용 중 프리셋을 바꾼 뒤(관리자 → 203) — 글 뷰어 · Quote 가 같이 바뀐다
async function activeSwitch() {
  console.log('\n[사용 중 프리셋 바꾸기 → 글 뷰어 · Quote]');
  const a = await open(USERS.owner);
  await a.page.goto(`${VIBE_ORIGIN}/admin/?${Q}`);
  await a.page.waitForSelector('#adminDashboard:not([hidden])', { timeout: 30000 });
  await a.page.evaluate(() => showQuotePanel());
  await a.page.waitForSelector('#quotePresetList .quote-preset-item');
  await a.page.locator('#quotePresetList .quote-preset-item', { hasText: 'Other' }).locator('.quote-preset-activate').click();
  await until(() => db.quote_presets.find((p) => p.id === 203)?.is_active === true && db.quote_presets.filter((p) => p.is_active).length === 1);
  check('관리자에서 사용 중 → 203', db.quote_presets.find((p) => p.id === 203)?.is_active === true && db.quote_presets.filter((p) => p.is_active).length === 1, JSON.stringify(db.quote_presets.map((p) => [p.id, p.is_active])));
  await a.context.close();

  const { page, context, errors } = await open(USERS.owner);
  await home(page);
  await openRoom(page, '1');
  await page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await clickRow(page, '사진 글');
  await bodyReady(page);
  check('글 뷰어 = 새 사용 중 프리셋(13px)', (await page.$eval('.post-detail-content', (c) => getComputedStyle(c).fontSize)) === '13px');
  await page.click('.hsh-ct__tool');
  await page.click('.hsh-ct__pick .hsh-ct__btn');
  const frame = await quoteFrame(page);
  const out = await exportFirst(page, frame, 'switched');
  check('Quote = 새 사용 중 프리셋(폭 800)', out.size.w === 800, JSON.stringify(out.size));
  await page.reload();
  await page.waitForSelector('.hsh-plan.is-done');
  await openRoom(page, '1');
  await clickRow(page, '프리셋 지정 글');
  await bodyReady(page);
  check('새로고침 뒤 — 지정 프리셋 글은 그대로 202(19px)', (await page.$eval('.post-detail-content', (c) => getComputedStyle(c).fontSize)) === '19px');
  check('콘솔 오류 없음(switch)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------- 휴대폰 ----------

async function mobile() {
  console.log('\n[mobile — iPhone 13]');
  const { page, errors, context } = await open(USERS.owner, undefined, playwright.devices['iPhone 13']);
  await home(page);
  await openRoom(page, '1');
  await page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await clickRow(page, '사진 글');
  await bodyReady(page);
  check('휴대폰 — 본문이 창 폭 안', await page.$eval('.post-detail-content', (c) => c.getBoundingClientRect().right <= window.innerWidth));
  await page.click('.hsh-ct__tool');
  const row = await page.$eval('.hsh-ct__pick-row', (r) => r.getBoundingClientRect().right <= window.innerWidth);
  check('휴대폰 — 발췌 버튼 줄이 화면 안', row);
  await page.click('.hsh-ct__pick .hsh-ct__btn');
  const frame = await quoteFrame(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-quote.png') });
  const out = await exportFirst(page, frame, 'mobile');
  check('휴대폰 — export PNG', out.size.w > 0, JSON.stringify(out));
  await page.click('.hsh-ct__post.is-quote .hsh-ct__back');
  await bodyReady(page);
  await page.locator('.hsh-win__x').click();
  await page.waitForTimeout(400);
  check('휴대폰 — 닫기', await page.$eval('.hsh-win', (w) => w.hidden));
  check('콘솔 오류 없음(mobile)', errors.length === 0, errors.join(' | '));
  await context.close();
}

try {
  if (!ONLY || ONLY === 'visitor') await visitor();
  if (!ONLY || ONLY === 'owner') await owner();
  if (!ONLY || ONLY === 'admin') { await admin(); await activeSwitch(); }
  if (!ONLY || ONLY === 'mobile') await mobile();
} catch (e) {
  console.error(e);
  check('예외 없이 끝남', false, e.message);
} finally {
  await browser.close();
  webServer.close();
  vibeServer.close();
  globalThis.fetch = realFetch;
}
process.exit(summary() ? 0 : 1);
