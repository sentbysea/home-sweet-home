// 바이브.me E2E — 실제 파일(이 저장소 + 이웃 web 저장소) · 흉내 Supabase(임시 데이터, 운영 DB 에 닿지 않는다)
//
//   node tests/e2e.mjs [--only=visitor|owner|admin|routing|mobile|layout|archive|neighbor] [--browser=webkit]   (WEB_DIR=../web 이 기본)
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
  // neighbor — 배너 카테고리(4) 이웃 간판. 셋째는 이미지가 없는 주소(못 불러올 때)
  db.banners.push(
    { id: 1, category_id: 4, user_id: OWNER_ID, name: '', url: 'https://hongjiwon.love', image_url: 'https://img.test/love.png', image_path: null, sort_order: 0 },
    { id: 2, category_id: 4, user_id: OWNER_ID, name: '럭키', url: 'https://luvlog.me/lucky', image_url: 'https://img.test/lucky.png', image_path: null, sort_order: 1 },
    { id: 3, category_id: 4, user_id: OWNER_ID, name: '', url: 'https://broken.example/home/', image_url: 'https://img.test/missing.png', image_path: null, sort_order: 2 },
    { id: 9, category_id: 9, user_id: OWNER_ID, name: '다른 칸', url: 'https://other.example', image_url: 'https://img.test/love.png', image_path: null, sort_order: 0 },
  );
  db.seq.banners = 100;
  db.banner_requests = [];
  db.requestCalls = 0;
  // 흉내 DB 에 없는 RPC — 사이트 주인 · 배너 교환 신청(web supabase/migrations/20261026100000_banner_requests.sql 과 같은 규칙)
  const reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  const key = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#]+$/, '');
  db.hooks.rpc = async ({ route, name, request, uid }) => {
    const args = JSON.parse(request.postData() || '{}');
    if (name === 'site_owner_id') { await reply(route, 200, OWNER_ID); return true; }
    if (name === 'submit_banner_request') {
      db.requestCalls += 1;
      if (db.failSubmit > 0) { db.failSubmit -= 1; await reply(route, 503, { message: 'unavailable' }); return true; }
      const bad = (m) => reply(route, 400, { code: '22023', message: m, details: null, hint: null });
      const nm = String(args.p_site_name || '').trim();
      const url = String(args.p_site_url || '').trim();
      const img = String(args.p_image_url || '').trim();
      if (nm.length < 1 || nm.length > 40) { await bad('site_name'); return true; }
      if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+(\S*)$/i.test(url)) { await bad('site_url'); return true; }
      if (!/^https?:\/\/\S+$/i.test(img)) { await bad('image_url'); return true; }
      if (db.banners.some((b) => b.category_id === 4 && key(b.url) === key(url))) { await reply(route, 200, 'listed'); return true; }
      if (db.banner_requests.some((r) => r.status === 'pending' && key(r.site_url) === key(url))) { await reply(route, 200, 'pending'); return true; }
      db.banner_requests.push({ id: db.banner_requests.length + 1, site_name: nm, site_url: url, image_url: img, message: String(args.p_message || '').trim() || null, status: 'pending', created_at: new Date().toISOString() });
      await reply(route, 200, 'ok');
      return true;
    }
    if (name === 'list_banner_requests' || name === 'review_banner_request') {
      if (uid !== OWNER_ID) { await reply(route, 403, { code: '42501', message: 'owner only' }); return true; }
      if (name === 'list_banner_requests') {
        await reply(route, 200, db.banner_requests.filter((r) => r.status === 'pending').map(({ status, ...r }) => r));
        return true;
      }
      const r = db.banner_requests.find((x) => x.id === Number(args.p_id));
      if (!r) { await reply(route, 200, 'missing'); return true; }
      if (r.status !== 'pending') { await reply(route, 200, r.status); return true; }
      if (args.p_approve && !db.banners.some((b) => b.category_id === 4 && key(b.url) === key(r.site_url))) {
        const max = Math.max(-1, ...db.banners.filter((b) => b.category_id === 4).map((b) => b.sort_order));
        db.banners.push({ id: ++db.seq.banners, category_id: 4, user_id: OWNER_ID, name: r.site_name, url: r.site_url, image_url: r.image_url, image_path: null, sort_order: max + 1 });
      }
      r.status = args.p_approve ? 'approved' : 'rejected';
      await reply(route, 200, r.status);
      return true;
    }
    return false;
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
  // 이웃 배너 이미지 — 5:1 PNG(missing 은 없는 이미지)
  await context.route('https://img.test/**', (route) => {
    const name = new URL(route.request().url()).pathname;
    if (name.includes('missing')) return route.fulfill({ status: 404, body: '' });
    const color = name.includes('lucky') ? [120, 160, 240] : name.includes('new') ? [240, 200, 120] : [250, 210, 225];
    return route.fulfill({ status: 200, contentType: 'image/png', body: png(200, 40, color) });
  });
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
  check('글자 크기 ± 만(기본값 문구 없음)', !(await page.textContent('.hsh-ct__scale')).includes('두 사이트'));
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


// ---------- 주소(창마다 고유 경로) ----------

async function routing() {
  console.log('\n[routing — 주소 · 새로고침 · 뒤로/앞으로 · 닫기]');
  const { page, errors, context } = await open(null);
  const at = () => {
    const u = new URL(page.url());
    return u.pathname + (u.searchParams.get('page') ? `?page=${u.searchParams.get('page')}` : '');
  };
  const winOpen = () => page.$eval('.hsh-win', (w) => !w.hidden);
  const go = async (path) => {
    await page.goto(`${VIBE_ORIGIN}${path}${path.includes('?') ? '&' : '?'}plan=only&${Q}`);
    await page.waitForSelector('.hsh-plan.is-done', { timeout: 20000 });
  };

  // 방 — 직접 들어오기(GitHub Pages 처럼 404.html → /?route= → 되돌리기)
  await go('/notice');
  await page.waitForSelector('.hsh-win:not([hidden]) .hsh-note', { timeout: 15000 });
  check('/notice 직접 → 공지 창(404.html 을 거쳐 주소 되돌림)', at() === '/notice' && (await page.textContent('.hsh-win__title')) === 'notice', at());
  await page.click('.hsh-win__x');
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  check('× → 홈(/) · 창 닫힘', at() === '/' && !(await winOpen()), at());
  await page.goForward();
  await page.waitForSelector('.hsh-win:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('앞으로 가기 → 공지 창 다시', at() === '/notice' && (await winOpen()));
  await page.goBack();
  await page.waitForTimeout(400);
  check('뒤로 가기 → 홈 · 닫힘', at() === '/' && !(await winOpen()));

  // 버튼으로 열기 → 주소가 같이 바뀐다(페이지는 그대로)
  await page.evaluate(() => { window.__sameDocument = true; });
  const nbhOpen = () => page.$eval('.nbh', (n) => !n.hidden && n.classList.contains('is-open')).catch(() => false);
  const panelOpen = () => page.$eval('.nbh-panel', (n) => !n.hidden).catch(() => false);
  await page.locator('.hsh-sticker[data-label="neighbor"]').evaluate((s) => s.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForSelector('.nbh.is-open .nbh-sign', { state: 'attached', timeout: 10000 });
  check('neighbor 버튼 → /neighbor(창 대신 집 화면)', at() === '/neighbor' && !(await winOpen()), at());
  await page.$eval('.nbh__scroll', (s) => { s.scrollTop = s.scrollHeight; });
  await clickMail(page);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 5000 });
  check('우체통 → /neighbor/banner(배너 교환 패널)', at() === '/neighbor/banner', at());
  check('페이지를 다시 불러오지 않았다', await page.evaluate(() => window.__sameDocument === true));
  await page.reload();
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 15000 });
  check('새로고침 → 패널 그대로', at() === '/neighbor/banner' && (await nbhOpen()));
  await page.goBack();
  await page.waitForTimeout(400);
  check('새로고침 뒤 뒤로 → neighbor(패널 닫힘)', at() === '/neighbor' && (await nbhOpen()) && !(await panelOpen()), at());
  await page.goForward();
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 5000 }).catch(() => {});
  check('앞으로 → 패널 다시', at() === '/neighbor/banner' && (await panelOpen()), at());
  await page.click('.nbh-panel__x');
  await page.waitForTimeout(400);
  check('패널 × → /neighbor', at() === '/neighbor' && (await nbhOpen()) && !(await panelOpen()), at());
  await page.goBack();
  await page.waitForTimeout(400);
  check('한 번 더 뒤로 → 홈', at() === '/' && !(await nbhOpen()) && !(await winOpen()), at());

  // 글 창 — 목록 · 폴더 · 글
  await openRoom(page, '1');
  await page.waitForSelector('.hsh-ct__folders');
  check('카테고리 → /category/1', at() === '/category/1', at());
  await page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await page.waitForSelector('.hsh-ct__row');
  check('폴더 → /category/1/folder/11', at() === '/category/1/folder/11', at());
  await clickRow(page, '사진 글');
  await bodyReady(page);
  check('글 → /post/101', at() === '/post/101', at());
  await page.reload();
  await page.waitForSelector('.hsh-plan.is-done');
  await bodyReady(page);
  check('새로고침 → 같은 글', (await page.textContent('.post-detail-content')).includes('FIRSTPARA'));
  await page.goBack();
  await page.waitForSelector('.hsh-ct__row', { timeout: 10000 });
  check('뒤로 → 폴더 목록', at() === '/category/1/folder/11', at());
  await page.goForward();
  await bodyReady(page);
  check('앞으로 → 글', at() === '/post/101', at());
  await page.click('.hsh-win__x');
  await page.waitForTimeout(500);
  check('글에서 × → 홈(/)', at() === '/' && !(await winOpen()), at());

  await go('/post/104');
  await bodyReady(page);
  check('/post/104 직접 → 그 글의 카테고리 창', (await page.textContent('.hsh-ct__post-title')).includes('프리셋 지정 글') && (await page.textContent('.hsh-win__title')) === 'LOG', await page.textContent('.hsh-win__title'));
  await page.goBack();
  await page.waitForTimeout(400);
  check('직접 들어온 글에서 뒤로 → 홈(사이트 밖으로 나가지 않는다)', at() === '/' && !(await winOpen()), page.url());
  await go('/post/103');
  await page.waitForSelector('.hsh-ct__state:not(.is-loading)', { timeout: 15000 });
  check('/post/103(비공개) 직접 → 볼 수 없는 글', (await page.textContent('.hsh-ct')).includes('볼 수 없는 글'));
  check('비공개 글 내용 · 제목이 새지 않는다', !(await page.content()).includes('PRIVATEBODY') && !(await page.textContent('.hsh-win')).includes('나만 보는 글'));
  await go('/category/1/folder/10');
  await page.waitForSelector('.hsh-ct__gate', { timeout: 15000 });
  check('/category/1/folder/10(비밀번호 폴더) 직접 → 비밀번호 칸', true);
  await go('/category/2?page=1');
  await page.waitForSelector('.hsh-ct__grid', { timeout: 15000 });
  check('/category/2 직접 → 갤러리', true);
  await go('/category/with');
  await page.waitForSelector('.hsh-ct__grid', { timeout: 15000 });
  check('/category/<slug> 도 열린다', true);
  await go('/nope/really');
  await page.waitForTimeout(800);
  check('없는 주소 → 홈(/), 창 없음', at() === '/' && !(await winOpen()), at());

  // 시계 단어(말풍선 · D-day) 는 주소를 바꾸지 않는다
  const before = page.url();
  await page.locator('.hsh-clock').evaluate((c) => c.querySelectorAll('*').forEach((b) => b.dispatchEvent(new MouseEvent('click', { bubbles: true }))));
  await page.waitForTimeout(300);
  check('시계 · 말풍선 · D-day 는 주소 그대로', page.url() === before);
  check('콘솔 오류 없음(routing)', errors.length === 0, errors.join(' | '));
  await context.close();

  await direct(null, 'PC');

  // 이어서 읽기 — 위치 줄 오른쪽 버튼 → 그 칸의 글을 한 화면에, 비밀글은 그 자리에서 비밀번호
  const sr = await open(null);
  await home(sr.page);
  await openRoom(sr.page, '1');
  await sr.page.waitForSelector('.hsh-ct__row');
  check('폴더 머리에 FOLDER 글자 없음', !(await sr.page.$('.hsh-ct__kicker')));
  await sr.page.locator('.hsh-ct__folder', { hasText: 'open' }).click();
  await sr.page.waitForSelector('.hsh-ct__crumb-row .hsh-ct__crumb-tools');
  check('폴더 — ↑ UP 이 위치 줄 오른쪽', await sr.page.$eval('.hsh-ct__crumb-row', (row) => {
    const up = [...row.querySelectorAll('button')].find((b) => b.textContent.includes('UP'));
    const crumbs = row.querySelector('.hsh-ct__crumbs');
    return Boolean(up && crumbs) && Math.abs(up.getBoundingClientRect().top - crumbs.getBoundingClientRect().top) < 12 && up.getBoundingClientRect().left > crumbs.getBoundingClientRect().right;
  }));
  check('창 머리(LOG 제목 · 썸네일) 안 보임', await sr.page.$eval('.hsh-win__head', (h) => getComputedStyle(h).display === 'none'));
  await sr.page.locator('.hsh-ct__crumb-row button', { hasText: 'UP' }).click();
  await sr.page.waitForFunction(() => location.pathname === '/category/1');
  await sr.page.locator('.hsh-ct__crumb-row button', { hasText: '이어서 읽기' }).click();
  await sr.page.waitForFunction(() => document.querySelector('.hsh-ct__series')?.textContent.includes('EXPLICIT'), null, { timeout: 15000 });
  const sAt = () => new URL(sr.page.url()).pathname;
  check('이어서 읽기 → /category/1/read · 글 여러 개', sAt() === '/category/1/read' && (await sr.page.$$('.hsh-ct__post.is-series')).length === 2, sAt());
  check('이어서 읽기 — 비밀글 본문은 비밀번호 전엔 없다', !(await sr.page.content()).includes('SECRETBODY') && Boolean(await sr.page.$('.hsh-ct__series .hsh-ct__gate')));
  await sr.page.fill('.hsh-ct__series .hsh-ct__gate input', 'pw102');
  await sr.page.click('.hsh-ct__series .hsh-ct__gate button[type="submit"]');
  await sr.page.waitForFunction(() => document.querySelector('.hsh-ct__series')?.textContent.includes('SECRETBODY'), null, { timeout: 15000 }).catch(() => {});
  check('이어서 읽기 — 비밀번호 맞히면 그 자리에 본문', (await sr.page.textContent('.hsh-ct__series')).includes('SECRETBODY'));
  await sr.page.reload();
  await sr.page.waitForFunction(() => document.querySelector('.hsh-ct__series')?.textContent.includes('EXPLICIT'), null, { timeout: 20000 });
  check('이어서 읽기 새로고침 → 그대로(로딩 화면 없이)', sAt() === '/category/1/read' && !(await sr.page.evaluate(() => window.__loaderSeen)));
  await sr.page.locator('.hsh-ct__series-open', { hasText: '프리셋 지정 글' }).click();
  await bodyReady(sr.page);
  check('제목 → 그 글 하나(/post/104)', sAt() === '/post/104');
  await sr.page.goBack();
  await sr.page.waitForSelector('.hsh-ct__series', { timeout: 10000 }).catch(() => {});
  check('뒤로 → 이어서 읽기', sAt() === '/category/1/read' && Boolean(await sr.page.$('.hsh-ct__series')), sAt());
  await sr.page.goto(`${VIBE_ORIGIN}/category/1/folder/10/read?${Q}`);
  await sr.page.waitForSelector('.hsh-ct__gate', { timeout: 15000 });
  check('잠긴 폴더 이어서 읽기 직접 → 비밀번호 칸 · 본문 없음', !(await sr.page.content()).includes('LOCKEDBODY'));
  check('콘솔 오류 없음(이어서 읽기)', sr.errors.length === 0, sr.errors.join(' | '));
  await sr.context.close();

  // 이웃 로그인 — 로그인 전에 보던 주소로 돌아온다(복귀 주소 자체는 허용 목록의 /)
  const lg = await open(USERS.owner);
  await lg.page.goto(`${VIBE_ORIGIN}/?plan=only&${Q}`);
  await lg.page.evaluate(() => sessionStorage.setItem('hsh:auth-return', '/neighbor'));
  await lg.page.goto('about:blank'); // 실제 복귀처럼 다른 문서에서 넘어온다(같은 주소 + #해시는 WebKit 이 다시 불러오지 않는다)
  await lg.page.goto(`${VIBE_ORIGIN}/?plan=only&${Q}#access_token=token-owner.mock-session-0001&token_type=bearer&expires_in=3600`);
  await lg.page.waitForSelector('.nbh.is-open', { timeout: 20000 }).catch(() => {});
  check('로그인에서 돌아오면 → 보던 /neighbor', new URL(lg.page.url()).pathname === '/neighbor' && !lg.page.url().includes('access_token'), lg.page.url());
  await lg.context.close();

  // 주인 — Quote 주소 직접 · 방문자는 안내만
  const ow = await open(USERS.owner);
  await ow.page.goto(`${VIBE_ORIGIN}/post/101/quote?plan=only&${Q}`);
  await ow.page.waitForSelector('.hsh-plan.is-done');
  const frame = await quoteFrame(ow.page);
  check('/post/101/quote 직접(주인) → Quote 화면', (await frame.$eval('#postEditorPreviewPages', (p) => p.textContent)).includes('FIRSTPARA'));
  check('Quote — 안내 문구 없음', !(await ow.page.$('.hsh-ct__quote-hint')) && !(await frame.$('.hsh-quote__range')));
  const pick = await frame.$eval('.hsh-quote__preset select', (s) => ({
    first: s.closest('.post-editor-preview-subrow') === s.closest('#postEditorPreviewSection')?.querySelector('.post-editor-preview-subrow'),
    names: [...s.options].map((o) => o.textContent), value: s.value,
  })).catch(() => null);
  check('Quote — 맨 위 preset 드롭다운(프리셋 목록 · 이 글은 없음)', Boolean(pick?.first && pick.names.includes('Explicit') && pick.value === ''), JSON.stringify(pick));
  const presetWrites = db.posts.find((p) => p.id === 101).quote_preset_id;
  await frame.selectOption('.hsh-quote__preset select', '202');
  await frame.waitForFunction(() => typeof postStyleSettings !== 'undefined' && postStyleSettings?.bodySize === 19, null, { timeout: 10000 }).then(() => true).catch(() => false)
    .then((ok) => check('Quote — 프리셋을 고르면 미리보기만 그 프리셋(글에는 저장 안 함)', ok && db.posts.find((p) => p.id === 101).quote_preset_id === presetWrites));
  await ow.page.click('.hsh-ct__post.is-quote .hsh-ct__back');
  await bodyReady(ow.page);
  check('글 도구 순서 quote → − → +, 기본값 문구 없음', await ow.page.$eval('.hsh-ct__tools', (t) =>
    [...t.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' ') === 'quote − +' && !t.textContent.includes('기본값')));
  check('Quote ← → /post/101', new URL(ow.page.url()).pathname === '/post/101');
  await ow.context.close();
  const vq = await open(null);
  await vq.page.goto(`${VIBE_ORIGIN}/post/101/quote?plan=only&${Q}`);
  await vq.page.waitForSelector('.hsh-ct__state:not(.is-loading)', { timeout: 20000 });
  check('/post/101/quote(방문자) → 주인만 안내, Quote 화면 없음', (await vq.page.textContent('.hsh-ct')).includes('주인만') && !(await vq.page.$('.hsh-ct__quote-frame')));
  await vq.context.close();
}

// 창 주소로 바로 들어오기(?plan=only 없이 — 진짜 첫 화면) — 로딩 화면이 한 번도 그려지지 않고 그 창이 바로 열린다.
//   새로고침해도 · 닫아 홈(/)으로 가도 로딩 없음. 홈 주소(/)는 지금처럼 집을 누를 때까지 로딩.
async function direct(device, name) {
  const d = await open(null, device ? undefined : { width: 1280, height: 900 }, device || {});
  // 그려지는 모든 순간에 로딩 화면이 보였는지 적어 둔다(문서보다 먼저 돈다)
  await d.context.addInitScript(() => {
    window.__loaderSeen = false;
    const look = () => {
      const l = document.querySelector('.hsh-loader');
      if (l && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0) window.__loaderSeen = true;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const { page } = d;
  const at = () => new URL(page.url()).pathname;
  for (const path of ['/notice', '/category/1', '/category/1/folder/11', '/category/2?page=1', '/post/104', '/category/1/read']) {
    await page.goto(`${VIBE_ORIGIN}${path}${path.includes('?') ? '&' : '?'}${Q}`);
    await page.waitForSelector('.hsh-win.is-open', { timeout: 15000 });
    // 받는 중에 다음 주소로 가면 WebKit 이 끊긴 요청을 오류로 남긴다 — 다 그린 뒤에
    await page.waitForFunction(() => !document.querySelector('.hsh-win:not([hidden]) .is-loading'), null, { timeout: 15000 });
    await page.waitForTimeout(150);
    check(`${name} — ${path} 직접 → 로딩 화면 없이 창`, !(await page.evaluate(() => window.__loaderSeen)) && !(await page.$('.hsh-loader')), path);
  }
  // 글 — 받는 동안 창 안에 '불러오는 중'
  await page.route('**/rest/v1/posts*', async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.fallback(); });
  await page.goto(`${VIBE_ORIGIN}/post/104?${Q}`);
  const pendingShown = await page.waitForSelector('.hsh-win.is-open .hsh-ct__state.is-loading', { timeout: 5000 }).then(() => true).catch(() => false);
  check(`${name} — 글을 받는 동안 창 안에서만 불러오는 중`, pendingShown && !(await page.evaluate(() => window.__loaderSeen)));
  await bodyReady(page);
  await page.unroute('**/rest/v1/posts*');
  check(`${name} — /post/104 본문`, (await page.textContent('.hsh-ct__post')).includes('EXPLICIT'));
  await page.reload();
  await bodyReady(page);
  check(`${name} — 새로고침 → 로딩 없이 같은 글`, at() === '/post/104' && !(await page.evaluate(() => window.__loaderSeen)));
  await page.click('.hsh-win__x');
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  check(`${name} — × → 홈(/) · 로딩 다시 안 뜸`, at() === '/' && !(await page.evaluate(() => window.__loaderSeen)) && (await page.$eval('.hsh-plan', (p) => !p.hidden)));
  await page.goForward();
  await bodyReady(page);
  check(`${name} — 앞으로 → 글 다시`, at() === '/post/104');
  await page.goto(`${VIBE_ORIGIN}/?${Q}`);
  await page.waitForSelector('.hsh-loader.is-ready', { timeout: 30000 });
  await page.waitForTimeout(1500);
  check(`${name} — 홈(/)은 집을 누를 때까지 로딩 화면`, Boolean(await page.$('.hsh-loader')) && !(await page.$eval('.hsh-plan', (p) => !p.hidden)));
  await page.click('.hsh-loader__house');
  await page.waitForSelector('.hsh-plan.is-done', { timeout: 20000 });
  check(`${name} — 집 누르기 → 평면도`, !(await page.$('.hsh-loader')));
  check(`콘솔 오류 없음(${name} 직접)`, d.errors.length === 0, d.errors.join(' | '));
  await d.context.close();
}

// ---------- 휴대폰 ----------

async function mobile() {
  console.log('\n[mobile — iPhone 13]');
  await direct(playwright.devices['iPhone 13'], '휴대폰');
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

// ---------- archive — 열쇠꾸러미 ----------
//   흰 화면 가운데 3D 꾸러미(three.js 는 jsDelivr 에서 — 이 시험은 인터넷이 필요하다).
//   돌리기 · 열쇠 고르기 · 풀기 · 링크(주소 있는 사이트는 새 탭, 빈 주소는 막힘) · ← home · 주소 · 새로고침 · 목록 대체 · 정리.

const TEST_URL = 'https://example.com/hsh-archive-test';
const keyPoint = (page, i) => page.$eval('.hsh-arc__canvas', (c, i) => c.hshKeyPoint?.(i), i);
const pressed = (page) => page.$$eval('.hsh-arc__chip', (b) => b.findIndex((x) => x.getAttribute('aria-pressed') === 'true'));
const arcOpen = (page) => page.$eval('.hsh-arc', (a) => !a.hidden && a.classList.contains('is-open')).catch(() => false);

async function archiveCase(device, name) {
  const d = await open(null, device ? undefined : { width: 1280, height: 860 }, device || {});
  const { page, context } = d;
  await context.addInitScript(() => {
    window.__loaderSeen = false;
    const look = () => {
      const l = document.querySelector('.hsh-loader');
      if (l && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0) window.__loaderSeen = true;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  // twitter 는 시험 주소로(진짜 사이트에 가지 않게), luvlog 는 빈 주소로 바꿔 '빈 주소는 막힘'도 본다
  await context.route('**/src/archive/links.js', async (route) => {
    const res = await route.fetch();
    const body = (await res.text())
      .replace(/(id: 'twitter',[^}]*url: )'[^']*'/, `$1'${TEST_URL}'`)
      .replace(/(id: 'luvlog',[^}]*url: )'[^']*'/, "$1''");
    await route.fulfill({ response: res, body });
  });
  await context.route('https://example.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>ok' }));
  const popups = [];
  context.on('page', (p) => popups.push(p));
  const at = () => new URL(page.url()).pathname;
  // 휴대폰은 손가락 탭(touch → click), PC 는 마우스
  const tap = (q) => (device ? page.touchscreen.tap(q.x, q.y) : page.mouse.click(q.x, q.y));

  // 직접 들어오기 — 로딩 화면 없이 꾸러미
  await page.goto(`${VIBE_ORIGIN}/archive?${Q}`);
  await page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 });
  await page.waitForTimeout(900);
  check(`${name} — /archive 직접 → 로딩 없이 열쇠꾸러미`, at() === '/archive' && !(await page.evaluate(() => window.__loaderSeen)) && (await arcOpen(page)));
  check(`${name} — 브라우저 창 꼴 팝업은 열리지 않는다`, await page.$eval('.hsh-win', (w) => w.hidden));
  const canvas = await page.$eval('.hsh-arc__canvas', (c) => { const r = c.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check(`${name} — 꾸러미가 화면 가운데를 크게 차지`, canvas.w >= 300 && canvas.h >= 380, JSON.stringify(canvas));
  await page.screenshot({ path: path.join(OUT, `archive-${name}-1.png`) });

  // 열쇠 누르기 → 고름(앞으로 · 이름표 · 아래 링크)
  let p = await keyPoint(page, 0);
  await tap(p);
  await page.waitForTimeout(700);
  check(`${name} — 열쇠 한 번 → 고름(이름 · 링크)`, (await pressed(page)) === 0 && (await page.textContent('.hsh-arc__go')).includes('twitter') && (await page.$eval('.hsh-arc__tag', (t) => !t.hidden && t.textContent === 'twitter')));
  check(`${name} — 한 번 눌렀을 때는 새 탭 없음`, popups.length === 0);
  check(`${name} — 링크는 진짜 a 요소(새 탭 · noopener)`, await page.$eval('.hsh-arc__link', (a) => a.href === 'https://example.com/hsh-archive-test' && a.target === '_blank' && /noopener/.test(a.rel)));

  // 끌기는 누름이 아니다 — 고른 열쇠 위에서 시작해 돌려도 새 탭 · 선택 바뀜 없음
  p = await keyPoint(page, 0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(p.x + i * 22, p.y + i * 3); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(1200);
  check(`${name} — 끌어 돌리기는 새 탭을 열지 않고 선택도 그대로`, popups.length === 0 && (await pressed(page)) === 0);
  await page.screenshot({ path: path.join(OUT, `archive-${name}-2.png`) });

  // 다른 열쇠(버튼 줄로) → 선택이 바뀜, 빈 주소면 링크가 막혀 있다
  await page.click('.hsh-arc__chip[data-i="2"]');
  await page.waitForTimeout(1300);
  check(`${name} — 다른 사이트 고르면 선택이 바뀐다`, (await pressed(page)) === 2 && (await page.textContent('.hsh-arc__tag')) === 'luvlog');
  check(`${name} — 빈 주소는 링크가 비활성(href 없음)`, await page.$eval('.hsh-arc__link', (a) => a.getAttribute('aria-disabled') === 'true' && !a.hasAttribute('href')));
  p = await keyPoint(page, 2);
  await tap(p); // 고른 열쇠를 또 누름 — 빈 주소라 그대로
  await page.waitForTimeout(400);
  check(`${name} — 빈 주소 열쇠를 다시 눌러도 밖으로 나가지 않는다`, popups.length === 0 && (await pressed(page)) === 2);
  await page.click('.hsh-arc__link', { force: true }); // aria-disabled — 눌러도 그대로인지
  await page.waitForTimeout(300);
  check(`${name} — 빈 주소 링크를 눌러도 그대로`, popups.length === 0 && at() === '/archive');

  // 빈 곳 → 풀림
  const box = await page.$eval('.hsh-arc__canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; });
  await tap(box);
  await page.waitForTimeout(500);
  check(`${name} — 빈 곳 누르면 선택 해제`, (await pressed(page)) === -1 && (await page.$eval('.hsh-arc__tag', (t) => t.hidden)));

  // 고른 열쇠를 다시 누르면 새 탭(주소 있는 사이트)
  await page.click('.hsh-arc__chip[data-i="0"]');
  await page.waitForTimeout(1300);
  p = await keyPoint(page, 0);
  await tap(p);
  await page.waitForTimeout(800);
  check(`${name} — 고른 열쇠를 또 누르면 그 사이트가 새 탭으로`, popups.length === 1 && popups[0].url().startsWith(TEST_URL) && at() === '/archive', popups.map((x) => x.url()).join(','));
  await page.click('.hsh-arc__link');
  await page.waitForTimeout(800);
  check(`${name} — '사이트 이름 ↗' 링크도 새 탭`, popups.length === 2 && popups[1].url().startsWith(TEST_URL));
  for (const x of popups) await x.close();

  // ← home → 홈(/) · 로딩 없음 · 그리기 멈춤과 정리
  await page.$eval('.hsh-arc__canvas', (c) => { window.__arcCanvas = c; });
  await page.click('.hsh-arc__home');
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  check(`${name} — ← home → 홈(/) · 로딩 화면 없음`, at() === '/' && !(await arcOpen(page)) && !(await page.evaluate(() => window.__loaderSeen)) && (await page.$eval('.hsh-plan', (pl) => !pl.hidden && !pl.inert)));
  check(`${name} — archive 를 벗어나면 3D 자원 정리(캔버스 교체 · 그리기 멈춤)`, await page.evaluate(() => Boolean(window.__arcCanvas) && !document.contains(window.__arcCanvas) && !window.__arcCanvas.hshKeyPoint));
  await page.goForward();
  await page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 }).catch(() => {});
  check(`${name} — 앞으로 가기 → 꾸러미 다시(새 캔버스로 다시 그림)`, at() === '/archive' && (await arcOpen(page)) && Boolean(await keyPoint(page, 0)));

  // 새로고침 → 로딩 없이 그대로, 그 뒤 ← home 도 로딩 없이(브라우저가 홈 칸 문서를 새로 불러온다)
  await page.reload();
  await page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 });
  check(`${name} — 새로고침 → 로딩 없이 꾸러미`, at() === '/archive' && !(await page.evaluate(() => window.__loaderSeen)));
  await page.click('.hsh-arc__home');
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('.hsh-plan.is-done', { timeout: 20000 }).catch(() => {});
  check(`${name} — 새로고침 뒤 ← home → 홈 · 로딩 화면 없음`, at() === '/' && !(await arcOpen(page)) && !(await page.evaluate(() => window.__loaderSeen)));
  await page.goForward();
  await page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 }).catch(() => {});
  check(`${name} — 다시 앞으로 → 꾸러미`, at() === '/archive' && (await arcOpen(page)));
  await page.goBack();
  await page.waitForSelector('.hsh-plan.is-done', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  check(`${name} — 뒤로 가기 → 홈`, at() === '/' && !(await arcOpen(page)) && !(await page.evaluate(() => window.__loaderSeen)), JSON.stringify({ at: at(), open: await arcOpen(page), seen: await page.evaluate(() => window.__loaderSeen), entry: await page.evaluate(() => document.documentElement.dataset.hshEntry), st: await page.evaluate(() => history.state) }));

  // 홈의 archive 버튼 → /archive, Esc → 홈
  await page.locator('.hsh-sticker[data-label="archive"]').evaluate((s) => s.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 });
  check(`${name} — 홈 archive 버튼 → /archive`, at() === '/archive');
  // 키보드 — 버튼 줄로 고르고 링크로 이동
  await page.focus('.hsh-arc__chip[data-i="3"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check(`${name} — 키보드 Enter 로 고르기`, (await pressed(page)) === 3);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(`${name} — Esc → 먼저 선택 해제`, (await pressed(page)) === -1 && (await arcOpen(page)));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  check(`${name} — Esc 한 번 더 → 홈`, at() === '/' && !(await arcOpen(page)));
  check(`콘솔 오류 없음(archive ${name})`, d.errors.length === 0, d.errors.join(' | '));
  await context.close();
}

async function archive() {
  console.log('\n[archive — 열쇠꾸러미]');
  await archiveCase(null, 'PC');
  await archiveCase(playwright.devices['iPhone 13'], '휴대폰');

  // 모션 줄이기 — 그대로 고르기 · 이동이 된다
  const rm = await open(null, { width: 1000, height: 800 }, { reducedMotion: 'reduce' });
  await rm.page.goto(`${VIBE_ORIGIN}/archive?${Q}`);
  await rm.page.waitForSelector('.hsh-arc.is-ready', { timeout: 30000 });
  await rm.page.click('.hsh-arc__chip[data-i="1"]');
  await rm.page.waitForTimeout(300);
  check('모션 줄이기 — 고르기 · 별 움직임 없음', (await pressed(rm.page)) === 1 && (await rm.page.$eval('.hsh-arc .hsh-star', (s) => getComputedStyle(s).animationName)) === 'none');
  check('콘솔 오류 없음(archive 모션 줄이기)', rm.errors.length === 0, rm.errors.join(' | '));
  await rm.context.close();

  // 3D 를 쓸 수 없는 환경 — 같은 데이터로 목록(진짜 주소 그대로 — 누르지는 않는다)
  const nw = await open(null, { width: 1000, height: 800 });
  await nw.context.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : get.call(this, type, ...rest); };
  });
  await nw.page.goto(`${VIBE_ORIGIN}/archive?${Q}`);
  await nw.page.waitForSelector('.hsh-arc__list:not([hidden])', { timeout: 15000 });
  const rowsText = await nw.page.$$eval('.hsh-arc__row', (r) => r.map((x) => x.textContent.trim()));
  check('WebGL 없음 → 간단한 목록', rowsText.length === 4 && rowsText[0].startsWith('twitter') && rowsText[3].startsWith('love'), rowsText.join(' / '));
  const hrefs = await nw.page.$$eval('.hsh-arc__list a', (a) => a.map((x) => x.getAttribute('href')));
  check('목록 — 사이트마다 새 탭 링크', hrefs.join(' ') === 'https://x.com/3luespark https://3luespark.tistory.com https://v.luvlog.me https://hongjiwon.love'
    && (await nw.page.$$eval('.hsh-arc__list a', (a) => a.every((x) => x.target === '_blank' && /noopener/.test(x.rel)))), hrefs.join(' '));
  check('목록 — 설정 · 코드 안내 문구 없음', !/(links\.js|url:|TODO|설정)/.test(await nw.page.textContent('.hsh-arc')));
  check('콘솔 오류 없음(archive 목록)', nw.errors.length === 0, nw.errors.join(' | '));
  await nw.context.close();
}

// ---------- neighbor — 이웃 간판 집 ----------
//   흰 화면 가운데 손그림 3D 집(CSS 3D) · 한 줄 간판 · 맨 아래 우체통 → 배너 교환 패널(/neighbor/banner).
//   간판 순서 · 크기 · 둥실거림 · 위글 · 새 탭 · 끌어 돌리기(±12°) · 끈 뒤 링크 막힘 · 휴대폰 세로 스크롤 우선 · 화면 폭 안 · 우체통 자리 ·
//   복사 · 신청(검사 · 중복 · 다시 시도) · 신청은 공개 목록에 바로 안 걸림 · 주인 확인(승인 · 거절) · 주인 고치기 ·
//   빈 집 · 하나 · 많을 때(덩어리만 그림) · 모션 줄이기.

const MY_IMAGE = `https://iokdgqzfprtggsnrusez.supabase.co/storage/v1/object/public/user-banners/${OWNER_ID}/banner`;
const nbhAngle = (page) => page.$eval('.nbh__scene', (s) => s.hshHouse?.angle ?? null);
const signLabels = (page) => page.$$eval('.nbh-sign', (a) => a.map((x) => x.querySelector('.nbh-sign__cap').textContent.replace('↗', '').trim()));
const watchLoader = (context) => context.addInitScript(() => {
  window.__loaderSeen = false;
  const look = () => {
    const l = document.querySelector('.hsh-loader');
    if (l && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0) window.__loaderSeen = true;
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
});
const toBottom = async (page) => { await page.$eval('.nbh__scroll', (s) => { s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(350); };
const toTop = async (page) => { await page.$eval('.nbh__scroll', (s) => { s.scrollTop = 0; }); await page.waitForTimeout(350); };
const rects = (page, sel) => page.$$eval(sel, (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }).filter((r) => r.w > 0));
const union = (list) => list.reduce((u, r) => ({ x: Math.min(u.x, r.x), y: Math.min(u.y, r.y), r: Math.max(u.r, r.r), b: Math.max(u.b, r.b) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
/** 지금 그리는 장면 전체(선 · 간판 · 우체통)의 좌우 끝 */
const sceneSpan = (page) => page.evaluate(() => {
  let l = Infinity;
  let r = -Infinity;
  document.querySelectorAll('.nbh-chunk').forEach((c) => {
    if (c.style.display === 'none') return;
    c.querySelectorAll('.nbh-plane, .nbh-sign__face, .nbh-box__face, .nbh-mail__tip').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width) return;
      l = Math.min(l, b.left);
      r = Math.max(r, b.right);
    });
  });
  return { l: Math.round(l), r: Math.round(r), vw: innerWidth };
});
const clickMail = async (page) => { const m = union(await rects(page, '.nbh-mail .nbh-box__face')); await page.mouse.click((m.x + m.r) / 2, (m.y + m.b) / 2); };
/** 휴대폰 손가락 밀기(Chromium CDP 터치) */
const swiper = async (context, page) => {
  const cdp = await context.newCDPSession(page);
  return async (x0, y0, x1, y1, steps = 12) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
};
const turn = async (page, deg) => { await page.$eval('.nbh__scene', (s, d) => s.hshHouse.turn(d), deg); await page.waitForTimeout(700); };

async function neighborCase(device, name) {
  const d = await open(null, device ? undefined : { width: 1280, height: 860 }, device || {});
  const { page, context } = d;
  await watchLoader(context);
  await context.route(/^https:\/\/(hongjiwon\.love|luvlog\.me|broken\.example)\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>ok' }));
  const popups = [];
  context.on('page', (p) => popups.push(p));
  const at = () => new URL(page.url()).pathname;
  const touch = device && BROWSER === 'chromium';

  await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await page.waitForSelector('.nbh.is-open .nbh-sign', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(700);
  check(`${name} — /neighbor 직접 → 로딩 없이 집 화면(브라우저 창 꼴 아님)`, at() === '/neighbor' && !(await page.evaluate(() => window.__loaderSeen)) && (await page.$eval('.hsh-win', (w) => w.hidden)));
  const labels = await signLabels(page);
  check(`${name} — 간판은 정렬 순서대로 · 배너 카테고리만(이름 없으면 주소)`, labels.join(' / ') === 'hongjiwon.love / 럭키 / broken.example/home', labels.join(' / '));
  check(`${name} — 처음에 '끌어서 돌려 보기' 안내`, await page.$eval('.nbh__hint', (h) => !h.hidden && h.textContent.includes('끌어서')));
  await page.screenshot({ path: path.join(OUT, `neighbor-${name}-top.png`) });

  // 간판 — 5:1 · 같은 크기 · 같은 가운데 · 읽을 수 있는 크기
  const faces = await rects(page, '.nbh-sign__face');
  const boxes = await page.$$eval('.nbh-sign__face', (f) => f.map((x) => parseFloat(x.style.width) / parseFloat(x.style.height)));
  const widths = faces.map((f) => f.w);
  const centers = faces.map((f) => (f.x + f.r) / 2);
  const front0 = union(await rects(page, '.nbh-plane.is-front'));
  check(`${name} — 간판 5:1 유지`, boxes.every((r) => Math.abs(r - 5) < 0.02), boxes.map((r) => r.toFixed(2)).join(','));
  check(`${name} — 간판 크기 같다(앞뒤 차이만)`, Math.max(...widths) / Math.min(...widths) < 1.06, widths.map(Math.round).join(','));
  check(`${name} — 간판 집 안 가운데 한 줄(작은 어긋남만)`, Math.max(...centers) - Math.min(...centers) < 20, centers.map(Math.round).join(','));
  check(`${name} — 아담한 크기(PC 집 380~440 · 배너 230~270, 휴대폰은 집 안에 맞춰)`, device
    ? Math.min(...widths) >= 160 && front0.x >= 16 && front0.r <= (await page.evaluate(() => innerWidth)) - 16
    : front0.r - front0.x >= 380 && front0.r - front0.x <= 440 && Math.min(...widths) >= 230 && Math.max(...widths) <= 270,
    JSON.stringify({ house: Math.round(front0.r - front0.x), banner: widths.map(Math.round) }));
  const gaps = faces.slice(1).map((f, i) => f.y - faces[i].b);
  check(`${name} — 배너 사이 빈 간격 약 24~36px(둥실거림 ±4)`, gaps.every((g) => g >= 20 && g <= 42), gaps.map(Math.round).join(','));
  check(`${name} — 배너끼리 · 집 외곽선과 겹치지 않는다`, gaps.every((g) => g > 0) && faces.every((f) => f.x > front0.x + 8 && f.r < front0.r - 8 && f.b < front0.b - 8));
  check(`${name} — 배너가 적으면 집 · 우체통이 한 화면에`, front0.y > 0 && front0.b < (await page.evaluate(() => innerHeight)) && union(await rects(page, '.nbh-mail .nbh-box__face')).b < (await page.evaluate(() => innerHeight)), JSON.stringify(front0));
  check(`${name} — 이미지는 원본(자르지 않음 · 필터 없음)`, await page.$eval('.nbh-sign__face img', (img) => {
    const s = getComputedStyle(img);
    return img.naturalWidth === 200 && s.objectFit === 'contain' && s.filter === 'none' && s.mixBlendMode === 'normal' && s.opacity === '1';
  }));
  const broken = await page.$eval('.nbh-sign[data-i="2"]', (a) => ({
    broken: a.querySelector('.nbh-sign__face').classList.contains('is-broken'),
    alt: a.querySelector('.nbh-sign__alt').textContent,
    href: a.href,
    w: a.querySelector('.nbh-sign__face').getBoundingClientRect().width,
  }));
  check(`${name} — 이미지 실패 → 판 크기 그대로, 사이트 이름으로 방문`, broken.broken && broken.alt.includes('broken.example/home') && broken.href === 'https://broken.example/home/' && Math.abs(broken.w - widths[0]) / widths[0] < 0.06, JSON.stringify(broken));
  check(`${name} — 선반 · 지지선 · 두꺼운 테두리 없이 떠 있다`, !(await page.$('.nbh-wire')) && (await page.$eval('.nbh-sign__face', (x) => getComputedStyle(x).borderTopWidth)) === '0px');
  // 둥실둥실 — 집 하나 · 배너마다 다른 주기와 시작
  const floats = await page.evaluate(() => ({
    house: document.querySelector('.nbh-house').getAnimations().map((a) => a.effect.getTiming().duration),
    signs: [...document.querySelectorAll('.nbh-float')].map((x) => { const a = x.getAnimations()[0]; return a ? [a.effect.getTiming().duration, a.effect.getTiming().delay] : null; }),
  }));
  check(`${name} — 집은 5~7초 주기로 · 배너는 각자 다른 주기로 둥실`, floats.house.length === 1 && floats.house[0] >= 5000 && floats.house[0] <= 7000
    && floats.signs.every(Boolean) && new Set(floats.signs.map((x) => x[0])).size === floats.signs.length && new Set(floats.signs.map((x) => x[1])).size === floats.signs.length, JSON.stringify(floats));
  // 위글 — 선 변형 4장이 190ms 마다 바뀐다(이미지 · 글자는 그대로)
  const boils = new Set();
  for (let i = 0; i < 8; i++) { boils.add(await page.$eval('.nbh-house', (h) => h.dataset.boil)); await page.waitForTimeout(110); }
  const shown = await page.$$eval('.nbh-plane.is-front', (p) => p.map((x) => [...x.querySelectorAll('.nbh-v')].filter((g) => getComputedStyle(g).display !== 'none').length));
  check(`${name} — 손그림 위글(선 변형이 돌고, 한 번에 하나만)`, boils.size >= 3 && shown.every((n) => n === 1), JSON.stringify({ boils: [...boils], shown }));
  check(`${name} — 배너 이미지는 위글 · 필터 없이 선명하게`, await page.$$eval('.nbh-sign__face img', (imgs) => imgs.every((im) => !im.closest('.nbh-v') && im.getAnimations().length === 0 && getComputedStyle(im).filter === 'none')));
  check(`${name} — 링크는 새 탭 · noopener`, await page.$$eval('.nbh-sign', (a) => a.every((x) => x.target === '_blank' && /noopener/.test(x.rel))));

  // 사이트 이름 — PC 는 올리면, 휴대폰은 늘
  const capOpacity = () => page.$eval('.nbh-sign .nbh-sign__cap', (c) => getComputedStyle(c).opacity);
  if (!device) {
    check('PC — 사이트 이름은 처음엔 숨김', (await capOpacity()) === '0');
    const f0 = faces[0];
    await page.mouse.move((f0.x + f0.r) / 2, (f0.y + f0.b) / 2);
    await page.waitForTimeout(350);
    const hov = await page.$eval('.nbh-sign', (a) => ({ t: getComputedStyle(a).transform, o: getComputedStyle(a.querySelector('.nbh-sign__cap')).opacity }));
    check('PC — 올리면 그 간판만 앞으로 + 이름 ↗', hov.t !== 'none' && hov.o === '1' && (await page.$$eval('.nbh-sign', (a) => a.slice(1).every((x) => getComputedStyle(x).transform === 'none'))), JSON.stringify(hov));
    const fz = await rects(page, '.nbh-sign__face');
    check('PC — 앞으로 나와도 크기는 거의 그대로(확대 효과 아님)', fz[0].w / f0.w < 1.04 && fz[0].w / f0.w > 0.995, (fz[0].w / f0.w).toFixed(3));
    await page.mouse.move(5, 300);
    await page.focus('.nbh__home');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ sign: document.activeElement?.classList.contains('nbh-sign'), t: getComputedStyle(document.activeElement).transform }));
    check('PC — 키보드 Tab 으로 간판 포커스 → 앞으로', focused.sign && focused.t !== 'none', JSON.stringify(focused));
    await page.evaluate(() => document.activeElement.blur());
  } else {
    check(`${name} — 사이트 이름 늘 보임`, (await capOpacity()) === '1');
  }

  // 누르면 새 탭
  const f1 = faces[1];
  if (device) await page.touchscreen.tap((f1.x + f1.r) / 2, (f1.y + f1.b) / 2);
  else await page.mouse.click((f1.x + f1.r) / 2, (f1.y + f1.b) / 2);
  await until(() => popups.length > 0, 6000);
  check(`${name} — 간판 누르기 → 그 사이트 새 탭`, popups.length === 1 && popups[0].url().startsWith('https://luvlog.me/lucky') && at() === '/neighbor', popups.map((p) => p.url()).join(','));
  await Promise.all(popups.splice(0).map((p) => p.close()));

  // 돌리기
  const a0 = await nbhAngle(page);
  const gx = (faces[0].x + faces[0].r) / 2;
  const gy = (faces[0].b + faces[1].y) / 2 + 14; // 간판 사이 빈 곳
  if (!device) {
    await page.mouse.move(gx, gy);
    await page.mouse.down();
    await page.mouse.move(gx + 60, gy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const a1 = await nbhAngle(page);
    check('PC — 가로로 끌면 세로축으로 돈다', a1 > a0 + 2.5, `${a0} → ${a1}`);
    await page.mouse.move(gx, gy);
    await page.mouse.down();
    await page.mouse.move(gx + 700, gy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const aMax = await nbhAngle(page);
    await page.mouse.move(gx + 300, gy);
    await page.mouse.down();
    await page.mouse.move(gx - 900, gy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const aMin = await nbhAngle(page);
    check('PC — 좌우 ±12° 까지만', Math.abs(aMax - 12) < 0.05 && Math.abs(aMin + 12) < 0.05, `${aMax} / ${aMin}`);
    const s1 = await nbhAngle(page);
    await page.waitForTimeout(1200);
    check('PC — 놓으면 멈춘다(저절로 돌지 않음)', Math.abs((await nbhAngle(page)) - s1) < 0.05);
    // 간판 위에서 끌기 시작해 간판 위에서 놓아도 열리지 않는다
    const fs0 = (await rects(page, '.nbh-sign__face'))[0];
    await page.mouse.move(fs0.x + 30, (fs0.y + fs0.b) / 2);
    await page.mouse.down();
    await page.mouse.move(fs0.x + 110, (fs0.y + fs0.b) / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    check('PC — 끌고 난 뒤엔 간판 링크가 열리지 않음', popups.length === 0 && at() === '/neighbor', popups.map((p) => p.url()).join(','));
  } else if (touch) {
    const swipe = await swiper(context, page);
    const scrollTop = () => page.$eval('.nbh__scroll', (s) => s.scrollTop);
    const top0 = await scrollTop();
    await swipe(gx, 620, gx + 8, 260);
    await page.waitForTimeout(700);
    const top1 = await scrollTop();
    const aV = await nbhAngle(page);
    check(`${name} — 세로로 밀면 돌지 않음(스크롤은 배너 60개에서)`, Math.abs(aV - a0) < 0.2 && top1 >= top0, `scroll ${top0}→${top1}, angle ${a0}→${aV}`);
    const fm = (await rects(page, '.nbh-sign__face'))[0];
    const yy = fm.b + 20;
    await swipe(70, yy, 250, yy + 6);
    await page.waitForTimeout(600);
    const aH = await nbhAngle(page);
    const top2 = await scrollTop();
    check(`${name} — 가로로 밀면 돈다(스크롤은 그대로)`, Math.abs(aH - aV) > 2 && Math.abs(top2 - top1) < 6, `angle ${aV}→${aH}, scroll ${top1}→${top2}`);
    await swipe(fm.x + 20, (fm.y + fm.b) / 2, fm.x + 170, (fm.y + fm.b) / 2 + 3);
    await page.waitForTimeout(800);
    check(`${name} — 가로로 민 뒤 간판 위에서 떼도 열리지 않음`, popups.length === 0, popups.map((p) => p.url()).join(','));
  }

  // 화면 폭 안 — 돌린 양 끝에서도 좌우가 잘리지 않는다(위 · 맨 아래)
  for (const deg of [-12, 12]) {
    await turn(page, deg);
    await toTop(page);
    const top = await sceneSpan(page);
    await toBottom(page);
    const bottom = await sceneSpan(page);
    check(`${name} — ${deg}° 에서도 집 · 우체통이 화면 폭 안`, top.l >= 0 && top.r <= top.vw && bottom.l >= 0 && bottom.r <= bottom.vw, JSON.stringify({ top, bottom }));
  }
  await turn(page, 4);
  check(`${name} — 가로 스크롤 없음`, await page.$eval('.nbh__scroll', (s) => s.scrollWidth <= s.clientWidth));

  // 맨 아래 — 바닥 · 집 오른쪽 바깥 우체통
  await toBottom(page);
  const front = union(await rects(page, '.nbh-plane.is-front'));
  const mail = union(await rects(page, '.nbh-mail .nbh-box__face'));
  const vh = await page.evaluate(() => innerHeight);
  check(`${name} — 끝까지 내리면 바닥과 우체통이 보인다`, front.b < vh && mail.b < vh && mail.y > 0, JSON.stringify({ front, mail, vh }));
  check(`${name} — 우체통은 집 오른쪽 바깥, 바닥 높이에`, mail.x > front.r - 4 && Math.abs(mail.b - front.b) < 40, JSON.stringify({ frontR: front.r, mailX: mail.x, frontB: front.b, mailB: mail.b }));
  check(`${name} — 우체통 옆 '배너교환은 여기에서'`, (await page.textContent('.nbh-mail__tip')).trim() === '배너교환은 여기에서');
  check(`${name} — 우체통은 화면에 고정된 버튼이 아니다`, await page.$eval('.nbh-mail', (m) => { for (let n = m; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed' && !n.classList.contains('nbh')) return false; return true; }));
  await page.screenshot({ path: path.join(OUT, `neighbor-${name}-bottom.png`) });

  // 우체통 → 편지가 올라오고 → 패널
  const mc = { x: (mail.x + mail.r) / 2, y: (mail.y + mail.b) / 2 };
  const t0 = Date.now();
  if (device) await page.touchscreen.tap(mc.x, mc.y);
  else await page.mouse.click(mc.x, mc.y);
  const lifted = await page.waitForFunction(() => document.querySelector('.nbh-letter')?.getAnimations().length > 0, null, { timeout: 1500 }).then(() => true).catch(() => false);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 5000 });
  check(`${name} — 우체통 → 편지가 살짝 올라온 뒤 패널`, lifted && Date.now() - t0 >= 300 && at() === '/neighbor/banner', `${Date.now() - t0}ms`);
  await page.waitForTimeout(300);
  const sheet = (await rects(page, '.nbh-panel__sheet'))[0];
  const vw = await page.evaluate(() => innerWidth);
  check(`${name} — 패널이 화면 안`, sheet.x >= 0 && sheet.r <= vw && sheet.y >= 0 && sheet.b <= vh + 1, JSON.stringify(sheet));
  const mine = await page.evaluate(() => ({
    img: document.querySelector('.nbh-mine__preview img').getAttribute('src'),
    vals: [...document.querySelectorAll('.nbh-mine__val')].map((v) => v.textContent),
    code: document.querySelector('.nbh-mine__code').textContent,
    copies: [...document.querySelectorAll('.nbh-mine__rows [data-copy]')].map((b) => b.dataset.copy),
    text: document.querySelector('.nbh-sec[data-mode="exchange"]').textContent,
  }));
  check(`${name} — 내 배너: 실제 이미지 · 이름 · 주소 · 이미지 주소 · 삽입 코드`, mine.img === MY_IMAGE && mine.vals.join('|') === `바이브.me|https://xn--9g3b29an0p.me|${MY_IMAGE}`
    && mine.code === `<a href="https://xn--9g3b29an0p.me" target="_blank" rel="noopener"><img src="${MY_IMAGE}" alt="바이브.me" width="200" height="40"></a>`
    && mine.copies.length === 4, JSON.stringify(mine));
  check(`${name} — 예시 주소 · 임시 이미지 없음`, !/(example|placeholder|lorem|TODO)/i.test(mine.text + mine.copies.join(' ')));
  check(`${name} — 방문자에게는 받은 신청 칸 없음`, await page.$eval('.nbh-review', (r) => r.hidden));
  if (!device && BROWSER === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: VIBE_ORIGIN });
    const got = [];
    for (let i = 0; i < 4; i++) {
      await page.click(`.nbh-mine__rows [data-copy] >> nth=${i}`);
      await page.waitForTimeout(120);
      got.push({ clip: await page.evaluate(() => navigator.clipboard.readText()), label: await page.textContent(`.nbh-mine__rows [data-copy] >> nth=${i}`) });
    }
    check('PC — 복사 버튼 넷 → 클립보드에 그 값 · 복사 완료 표시', got.every((g, i) => g.clip === mine.copies[i] && g.label.includes('복사됨')), JSON.stringify(got));
  } else {
    await page.click('.nbh-mine__rows [data-copy] >> nth=1');
    await page.waitForTimeout(150);
    check(`${name} — 복사 완료 표시`, (await page.textContent('.nbh-mine__rows [data-copy] >> nth=1')).includes('복사됨'));
  }

  // Esc — 패널 → 집 → 홈
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(`${name} — Esc → 패널만 닫힘(/neighbor)`, at() === '/neighbor' && (await page.$eval('.nbh-panel', (p) => p.hidden)) && (await page.$eval('.nbh', (n) => !n.hidden)));
  await page.click('.nbh__home');
  await page.waitForTimeout(500);
  check(`${name} — ← home → 홈(/) · 집 화면 닫힘`, at() === '/' && (await page.$eval('.nbh', (n) => n.hidden)) && (await page.$eval('.hsh-plan', (p) => !p.hidden)), at());
  check(`${name} — 닫으면 장면 정리`, await page.$eval('.nbh__scene', (s) => !s.hshHouse && !s.querySelector('.nbh-house')));
  check(`콘솔 오류 없음(neighbor ${name})`, d.errors.length === 0, d.errors.join(' | '));
  await context.close();
}

async function neighborApply() {
  const v = await open(null, { width: 1280, height: 860 });
  const { page } = v;
  const at = () => new URL(page.url()).pathname;
  const F = '.nbh-form[data-form="apply"]';
  const err = (n) => page.$eval(`${F} [name="${n}"]`, (i) => i.closest('.nbh-field').querySelector('.nbh-field__err').textContent);
  const msg = () => page.textContent(`${F} .nbh-form__msg`);
  db.banner_requests.length = 0;
  db.requestCalls = 0;
  await page.goto(`${VIBE_ORIGIN}/neighbor/banner?${Q}`);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  check('/neighbor/banner 직접 → 집 + 배너 교환 패널', at() === '/neighbor/banner' && (await page.$eval('.nbh', (n) => !n.hidden)));

  await page.click(`${F} [type="submit"]`);
  check('신청 — 빈 칸이면 칸마다 안내 · 보내지 않음', (await err('name')).length > 0 && (await err('url')).length > 0 && (await err('image')).length > 0 && db.requestCalls === 0);
  await page.fill(`${F} [name="name"]`, '새 이웃');
  await page.fill(`${F} [name="url"]`, 'javascript:alert(1)');
  await page.fill(`${F} [name="image"]`, 'https://img.test/new.png');
  await page.click(`${F} [type="submit"]`);
  check('신청 — http(s) 아닌 주소 거절', (await err('url')).includes('http') && db.requestCalls === 0, await err('url'));
  await page.fill(`${F} [name="url"]`, 'new-neighbor.example/home');
  await page.focus(`${F} [name="message"]`);
  check('신청 — 주소만 적으면 https:// 를 붙여 준다', (await page.inputValue(`${F} [name="url"]`)) === 'https://new-neighbor.example/home');
  await page.fill(`${F} [name="image"]`, 'https://img.test/missing.png');
  await page.click(`${F} [type="submit"]`);
  await page.waitForFunction((F) => document.querySelector(`${F} [name="image"]`).getAttribute('aria-invalid') === 'true', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 열리지 않는 배너 이미지 거절', (await err('image')).includes('불러오지') && db.requestCalls === 0, await err('image'));
  await page.fill(`${F} [name="image"]`, 'https://img.test/new.png');
  await page.fill(`${F} [name="message"]`, '안녕하세요 ♡');
  check('신청 — 배너 미리보기', await imgLoaded(page, `${F} .nbh-form__preview img`));

  db.failSubmit = 1;
  await page.click(`${F} [type="submit"]`);
  await page.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'error', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 실패하면 다시 시도 안내 · 적은 내용 그대로', (await msg()).includes('다시 눌러') && (await page.inputValue(`${F} [name="name"]`)) === '새 이웃'
    && !(await page.$eval(`${F} [type="submit"]`, (b) => b.disabled)) && db.banner_requests.length === 0, await msg());
  const callsBefore = db.requestCalls;
  await page.$eval(F, (f) => { f.requestSubmit(); f.requestSubmit(); f.requestSubmit(); }); // 연달아 눌러도
  await page.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'done', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 연달아 눌러도 한 번만 보낸다', db.requestCalls - callsBefore === 1 && db.banner_requests.length === 1, `${db.requestCalls - callsBefore} calls`);
  const saved = db.banner_requests[0];
  check('신청 — 대기 목록에 저장(이름 · 주소 · 이미지 · 메시지)', saved?.status === 'pending' && saved.site_name === '새 이웃' && saved.site_url === 'https://new-neighbor.example/home'
    && saved.image_url === 'https://img.test/new.png' && saved.message === '안녕하세요 ♡', JSON.stringify(saved));
  check('신청 — 완료 안내 · 칸 잠김 · 다른 사이트 신청', (await msg()).includes('신청했어요') && (await page.$eval(`${F} [name="name"]`, (i) => i.disabled))
    && (await page.$eval(`${F} [data-act="again"]`, (b) => !b.hidden)));

  await page.click('.nbh-panel__x');
  await page.reload();
  await page.waitForSelector('.nbh.is-open .nbh-sign', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(400);
  check('신청만으로는 공개 이웃 목록에 걸리지 않는다', (await page.$$('.nbh-sign')).length === 3 && db.banners.filter((b) => b.category_id === 4).length === 3);

  // 다른 탭에서 같은 사이트(www · 끝 /) → 이미 신청됨
  const p2 = await v.context.newPage();
  await p2.goto(`${VIBE_ORIGIN}/neighbor/banner?${Q}`);
  await p2.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  await p2.fill(`${F} [name="name"]`, '새 이웃');
  await p2.fill(`${F} [name="url"]`, 'http://www.new-neighbor.example/home/');
  await p2.fill(`${F} [name="image"]`, 'https://img.test/new.png');
  await p2.click(`${F} [type="submit"]`);
  await p2.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'done', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 같은 사이트를 또 → 이미 신청됨 안내 · 저장 안 함', (await p2.textContent(`${F} .nbh-form__msg`)).includes('이미 신청된') && db.banner_requests.length === 1);
  await p2.click(`${F} [data-act="again"]`);
  await p2.fill(`${F} [name="name"]`, 'love');
  await p2.fill(`${F} [name="url"]`, 'https://hongjiwon.love/');
  await p2.fill(`${F} [name="image"]`, 'https://img.test/new.png');
  await p2.click(`${F} [type="submit"]`);
  await p2.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'done', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 이미 걸린 사이트 → 안내', (await p2.textContent(`${F} .nbh-form__msg`)).includes('이미 이웃 목록에') && db.banner_requests.length === 1);
  const applyErrors = v.errors.filter((e) => !/503|submit 503/.test(e)); // 일부러 낸 503(다시 시도 안내 확인)은 빼고
  check('콘솔 오류 없음(neighbor 신청)', applyErrors.length === 0, applyErrors.join(' | '));
  await v.context.close();
}

async function neighborOwner() {
  const o = await open(USERS.owner, { width: 1280, height: 860 });
  const { page } = o;
  page.on('dialog', (dlg) => dlg.accept());
  const at = () => new URL(page.url()).pathname;
  db.banner_requests.push(
    { id: 50, site_name: '대기 이웃', site_url: 'https://waiting.example', image_url: 'https://img.test/new.png', message: '잘 부탁해요', status: 'pending', created_at: '2026-10-26T01:00:00.000Z' },
    { id: 51, site_name: '거절할 이웃', site_url: 'https://nope.example', image_url: 'https://img.test/new.png', message: null, status: 'pending', created_at: '2026-10-26T02:00:00.000Z' },
  );
  const pending = db.banner_requests.filter((r) => r.status === 'pending').length;
  await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await page.waitForSelector('.nbh.is-open .nbh-sign', { state: 'attached', timeout: 20000 });
  await toBottom(page);
  await page.click('.nbh__owner [data-act="edit"]');
  await page.waitForSelector('.nbh__owner [data-act="add"]:not([hidden])', { timeout: 15000 });
  await page.waitForFunction((n) => document.querySelector('.nbh__count')?.textContent === String(n), pending, { timeout: 10000 }).catch(() => {});
  check('주인 — edit → 간판마다 × · + add banner · 받은 신청 수', (await page.$$('.nbh-del')).length === 3 && (await page.textContent('.nbh__count')) === String(pending), await page.textContent('.nbh__count'));

  await page.click('.nbh__owner [data-act="requests"]');
  await page.waitForSelector('.nbh-review:not([hidden]) .nbh-req', { timeout: 10000 });
  const reqs = await page.$$eval('.nbh-req', (l) => l.map((x) => x.textContent));
  check('주인 — 받은 신청 목록(이름 · 주소 · 메시지)', at() === '/neighbor/banner' && reqs.some((t) => t.includes('대기 이웃') && t.includes('waiting.example') && t.includes('잘 부탁해요')), reqs.join(' | '));
  await page.click('.nbh-req[data-id="50"] [data-ok="1"]');
  await until(() => db.banners.some((b) => b.url === 'https://waiting.example'), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-sign').length === 4, null, { timeout: 8000 }).catch(() => {});
  const approved = db.banners.find((b) => b.url === 'https://waiting.example');
  check('주인 — 승인 → 공개 목록 맨 뒤에 걸림', approved?.category_id === 4 && approved.sort_order === 3 && (await signLabels(page)).at(-1) === '대기 이웃'
    && db.banner_requests.find((r) => r.id === 50).status === 'approved', JSON.stringify(approved));
  await page.click('.nbh-req[data-id="51"] [data-ok="0"]');
  await until(() => db.banner_requests.find((r) => r.id === 51).status === 'rejected', 8000);
  await page.waitForTimeout(300);
  check('주인 — 거절 → 목록에서 빠지고 공개 목록은 그대로', !(await page.$('.nbh-req[data-id="51"]')) && !db.banners.some((b) => b.url === 'https://nope.example'));
  await page.click('.nbh-panel__x');
  await page.waitForTimeout(300);

  await page.click('.nbh-del[data-del="3"]');
  await until(() => !db.banners.some((b) => b.id === 3), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-sign').length === 3, null, { timeout: 8000 }).catch(() => {});
  check('주인 — × → 배너 내리기', !db.banners.some((b) => b.id === 3) && (await page.$$('.nbh-sign')).length === 3);
  await page.click('.nbh__owner [data-act="add"]');
  await page.waitForSelector('.nbh-panel.is-open [data-form="add"]', { timeout: 5000 });
  const A = '.nbh-form[data-form="add"]';
  await page.fill(`${A} [name="name"]`, '새 간판');
  await page.fill(`${A} [name="url"]`, 'https://added.example');
  await page.fill(`${A} [name="image"]`, 'https://img.test/new.png');
  await page.click(`${A} [type="submit"]`);
  await until(() => db.banners.some((b) => b.url === 'https://added.example/'), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-sign').length === 4, null, { timeout: 8000 }).catch(() => {});
  const added = db.banners.find((b) => b.url === 'https://added.example/');
  await page.waitForFunction(() => document.querySelector('.nbh-panel').hidden, null, { timeout: 3000 }).catch(() => {});
  const addedView = { labels: await signLabels(page), panelHidden: await page.$eval('.nbh-panel', (p) => p.hidden) };
  check('주인 — + add banner → 맨 뒤에 걸기', added?.category_id === 4 && added.name === '새 간판' && addedView.labels.at(-1) === '새 간판' && addedView.panelHidden, JSON.stringify({ added, addedView }));
  await page.click('.nbh__owner [data-act="edit"]');
  check('주인 — done → × 사라짐', (await page.$$('.nbh-del')).length === 0);
  check('콘솔 오류 없음(neighbor 주인)', o.errors.length === 0, o.errors.join(' | '));
  await o.context.close();
}

async function neighborShapes() {
  const saved = db.banners;
  const others = saved.filter((b) => b.category_id !== 4);
  const m = await open(null, undefined, playwright.devices['iPhone 13']);
  const { page } = m;
  const go = async () => {
    await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
    await page.waitForSelector('.nbh.is-open .nbh-house', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.nbh__scene').getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
    await page.waitForTimeout(400);
  };

  // 빈 집
  db.banners = [...others];
  await go();
  const front = union(await rects(page, '.nbh-plane.is-front'));
  check('배너 없음 — 빈 집 안내 · 아담한 집 모양 그대로', (await page.textContent('.nbh-note')).includes('아직 걸린 간판이 없어요') && (front.b - front.y) >= (front.r - front.x) * 0.9, JSON.stringify(front));
  await toBottom(page);
  const mail0 = union(await rects(page, '.nbh-mail .nbh-box__face'));
  const front0 = union(await rects(page, '.nbh-plane.is-front'));
  check('배너 없음 — 우체통은 그대로 바닥 오른쪽', mail0.x > front0.r - 4 && Math.abs(mail0.b - front0.b) < 40 && mail0.b <= 844);
  await page.screenshot({ path: path.join(OUT, 'neighbor-empty.png') });

  // 하나
  db.banners = [...others, { id: 1, category_id: 4, user_id: OWNER_ID, name: '', url: 'https://hongjiwon.love', image_url: 'https://img.test/love.png', image_path: null, sort_order: 0 }];
  await go();
  const face = (await rects(page, '.nbh-sign__face'))[0];
  const f1 = union(await rects(page, '.nbh-plane.is-front'));
  const body = { top: f1.y + (f1.r - f1.x) * 0.42, bottom: f1.b };
  const cy = (face.y + face.b) / 2;
  check('배너 하나 — 집 몸통 가운데쯤에 한 줄', Math.abs((face.x + face.r) / 2 - (f1.x + f1.r) / 2) < 16 && cy > body.top && cy < body.bottom, JSON.stringify({ face, f1 }));
  await page.screenshot({ path: path.join(OUT, 'neighbor-one.png') });

  // 많을 때 — 60개. 화면에서 먼 덩어리는 그리지 않는다
  db.banners = [...others, ...Array.from({ length: 60 }, (_, i) => ({ id: 1000 + i, category_id: 4, user_id: OWNER_ID, name: `이웃 ${i + 1}`, url: `https://n${i}.example`, image_url: `https://img.test/${i % 2 ? 'lucky' : 'love'}.png`, image_path: null, sort_order: i }))];
  await go();
  const total = await page.$$eval('.nbh-chunk', (c) => c.length);
  const shownTop = await page.$$eval('.nbh-chunk', (c) => c.filter((x) => x.style.display !== 'none').length);
  check('많을 때 — 60개 모두 한 줄로', (await page.$$('.nbh-sign')).length === 60 && (await signLabels(page)).at(-1) === '이웃 60');
  if (BROWSER === 'chromium') {
    const swipe = await swiper(m.context, page);
    const a0 = await nbhAngle(page);
    const t0 = await page.$eval('.nbh__scroll', (s) => s.scrollTop);
    await swipe(200, 560, 206, 200);
    await page.waitForTimeout(700);
    const t1 = await page.$eval('.nbh__scroll', (s) => s.scrollTop);
    check('휴대폰 — 세로로 밀면 페이지가 스크롤(집 안 스크롤 칸 없음 · 돌지 않음)', t1 > t0 + 150 && Math.abs((await nbhAngle(page)) - a0) < 0.2
      && (await page.$$eval('.nbh-house *', (els) => els.every((el) => !/(auto|scroll)/.test(getComputedStyle(el).overflowY)))), `${t0}→${t1}`);
    await page.$eval('.nbh__scroll', (s) => { s.scrollTop = 0; });
    await page.waitForTimeout(300);
  }
  check('많을 때 — 화면 근처 덩어리만 그린다', total >= 5 && shownTop <= 3, `${shownTop}/${total}`);
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const s = document.querySelector('.nbh__scroll');
    const max = s.scrollHeight - s.clientHeight;
    const scene = document.querySelector('.nbh__scene');
    const times = [];
    let i = 0;
    let last = performance.now();
    const step = (t) => {
      times.push(t - last);
      last = t;
      i += 1;
      s.scrollTop = (max * i) / 90;
      if (i % 10 === 0) scene.hshHouse.turn(i % 20 ? 8 : -8);
      if (i < 90) requestAnimationFrame(step);
      else resolve(times.slice(2).sort((a, b) => a - b));
    };
    requestAnimationFrame(step);
  }));
  const median = frames[Math.floor(frames.length / 2)];
  console.log(`        (60개 스크롤 + 돌리기 — 프레임 중간값 ${median.toFixed(1)}ms, 90%: ${frames[Math.floor(frames.length * 0.9)].toFixed(1)}ms)`);
  check('많을 때 — 스크롤 · 돌리기 프레임(중간값 50ms 안 · 소프트웨어 렌더러 기준)', median < 50, `${median.toFixed(1)}ms`);
  await toBottom(page);
  const shownBottom = await page.$$eval('.nbh-chunk', (c) => c.filter((x) => x.style.display !== 'none').length);
  const mailN = union(await rects(page, '.nbh-mail .nbh-box__face'));
  check('많을 때 — 끝까지 내리면 우체통 · 덩어리 수는 그대로 적게', mailN.b < 844 && mailN.y > 0 && shownBottom <= 4, `${shownBottom}`);
  check('콘솔 오류 없음(neighbor 빈 집 · 하나 · 많을 때)', m.errors.length === 0, m.errors.join(' | '));
  await m.context.close();
  db.banners = saved;
}

async function neighbor() {
  console.log('\n[neighbor — 이웃 간판 집]');
  await neighborCase(null, 'PC');
  await neighborCase(playwright.devices['iPhone 13'], '휴대폰');
  await neighborApply();
  await neighborOwner();
  await neighborShapes();

  // 모션 줄이기 — 편지 없이 바로 패널, 안내 화살표 · 간판 전환 없음
  const rm = await open(null, { width: 1000, height: 800 }, { reducedMotion: 'reduce' });
  await rm.page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await rm.page.waitForSelector('.nbh.is-open .nbh-sign', { state: 'attached', timeout: 20000 });
  const still = await rm.page.evaluate(() => ({
    sign: getComputedStyle(document.querySelector('.nbh-sign')).transitionDuration,
    hint: getComputedStyle(document.querySelector('.nbh__hint svg')).animationName,
    float: getComputedStyle(document.querySelector('.nbh-float')).animationName,
    house: getComputedStyle(document.querySelector('.nbh-house')).animationName,
  }));
  still.boil = [];
  for (let i = 0; i < 4; i++) { still.boil.push(await rm.page.$eval('.nbh-house', (h) => h.dataset.boil)); await rm.page.waitForTimeout(120); }
  await toBottom(rm.page);
  const t0 = Date.now();
  await clickMail(rm.page);
  await rm.page.waitForSelector('.nbh-panel.is-open', { timeout: 3000 });
  check('모션 줄이기 — 둥실거림 · 위글 · 간판 전환 · 화살표 흔들림 없음, 편지 없이 바로 패널', still.sign === '0s' && still.hint === 'none' && still.float === 'none' && still.house === 'none' && still.boil.every((b) => b === '0') && Date.now() - t0 < 300
    && (await rm.page.$eval('.nbh-letter', (l) => l.getAnimations().length)) === 0, JSON.stringify(still));
  check('콘솔 오류 없음(neighbor 모션 줄이기)', rm.errors.length === 0, rm.errors.join(' | '));
  await rm.context.close();
}

// ---------- 창 모양(글 · 발췌 · 폴더) · 주인 링크 ----------

/** 창 몸통 안에서 스스로 스크롤하는 칸(몸통 자신 빼고) */
const innerScrollers = (page) => page.evaluate(() => {
  const body = document.querySelector('.hsh-win__body');
  return [...body.querySelectorAll('*')].filter((el) => {
    const o = getComputedStyle(el).overflowY;
    return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  }).map((el) => el.className || el.tagName);
});

async function layout() {
  for (const [name, device] of [['desktop', null], ['phone', playwright.devices['iPhone 13']]]) {
    console.log(`\n[layout — ${name}]`);
    const { page, errors, context } = device ? await open(USERS.owner, undefined, device) : await open(USERS.owner);
    await home(page);
    await openRoom(page, '1');
    await page.waitForSelector('.hsh-ct__folders', { timeout: 20000 });
    const folder = page.locator('.hsh-ct__folder', { hasText: 'open' });
    await folder.hover();
    await page.waitForTimeout(300);
    const tile = await folder.evaluate((b) => {
      const cs = getComputedStyle(b);
      const iconEl = b.querySelector('.hsh-ct__icon');
      const icon = iconEl.getBoundingClientRect();
      const label = b.querySelector('.hsh-ct__folder-name');
      const box = b.getBoundingClientRect();
      return {
        border: cs.borderTopWidth === '0px' || cs.borderTopColor === 'rgba(0, 0, 0, 0)' || cs.borderTopStyle === 'none',
        outline: cs.outlineStyle === 'none' || cs.outlineWidth === '0px',
        iconW: iconEl.offsetWidth, nameSize: getComputedStyle(label).fontSize,
        inside: icon.top >= box.top && label.getBoundingClientRect().bottom <= box.bottom + 0.5,
        clipped: label.scrollWidth > label.clientWidth + 1,
      };
    });
    check(`${name} — 폴더: 마우스 올려도 테두리 없음`, tile.border && tile.outline, JSON.stringify(tile));
    check(`${name} — 폴더 아이콘 65px · 이름 13px`, Math.round(tile.iconW) === 65 && tile.nameSize === '13px', JSON.stringify(tile));
    check(`${name} — 누르는 칸이 아이콘 · 이름을 감싼다`, tile.inside && !tile.clipped, JSON.stringify(tile));
    await page.screenshot({ path: path.join(OUT, `layout-${name}-folders.png`) });
    await page.keyboard.press('Tab');

    await folder.click();
    await clickRow(page, '사진 글');
    await bodyReady(page);
    await page.waitForTimeout(500);
    const post = await page.evaluate(() => {
      const pg = getComputedStyle(document.querySelector('.hsh-win__page'));
      const body = document.querySelector('.hsh-win__body');
      const c = document.querySelector('.hsh-ct__sheet').getBoundingClientRect();
      return { pageBorder: pg.borderTopWidth, body: body.getBoundingClientRect().width, sheet: c.width, right: c.right, vw: innerWidth };
    });
    check(`${name} — 글 창: 안쪽 둥근 상자 없음`, post.pageBorder === '0px', JSON.stringify(post));
    check(`${name} — 글 창: 본문 칸이 몸통의 88% 이상`, post.sheet / post.body >= 0.88 && post.right <= post.vw, JSON.stringify(post));
    check(`${name} — 글 창: 안쪽 스크롤 칸 없음`, (await innerScrollers(page)).length === 0, (await innerScrollers(page)).join(' | '));
    await page.screenshot({ path: path.join(OUT, `layout-${name}-post.png`) });
    check(`${name} — 주인에게 'hongjiwon.love 에서 고치기'`, Boolean(await page.$('.hsh-ct__owner')));

    await page.click('.hsh-ct__tool');
    await page.waitForSelector('.hsh-ct__pick');
    await page.screenshot({ path: path.join(OUT, `layout-${name}-pick.png`) });
    await page.click('.hsh-ct__pick .hsh-ct__btn');
    const frame = await quoteFrame(page);
    await page.waitForTimeout(800);
    const q = await page.evaluate(() => {
      const f = document.querySelector('.hsh-ct__quote-frame');
      const cs = getComputedStyle(f);
      const doc = f.contentDocument.documentElement;
      return { border: cs.borderTopWidth, right: f.getBoundingClientRect().right, vw: innerWidth, inner: doc.scrollHeight > doc.clientHeight + 1, innerX: doc.scrollWidth > doc.clientWidth + 1 };
    });
    const look = await frame.evaluate(() => ({
      stage: getComputedStyle(document.querySelector('.post-editor-preview-stage')).backgroundColor,
      shadow: getComputedStyle(document.querySelector('.post-editor-preview-page')).boxShadow,
    }));
    check(`${name} — 발췌 작업 영역 회청색 · 캔버스 그림자`, look.stage === 'rgb(238, 241, 245)' && look.shadow.includes("42, 58, 82"), JSON.stringify(look));
    const gap = await frame.evaluate(() => {
      const st = document.querySelector('.post-editor-preview-stage').getBoundingClientRect();
      const pg = document.querySelector('.post-editor-preview-page').getBoundingClientRect();
      return { top: Math.round(pg.top - st.top), bottom: Math.round(st.bottom - pg.bottom) };
    });
    check(`${name} — 캔버스 위 빈 공간 = 여백만(≤ 18px)`, gap.top <= 18 && gap.bottom <= 18 && gap.top >= 0, JSON.stringify(gap));
    check(`${name} — 글 · 발췌 창에는 둘레 스티커 없음`, await page.$$eval('.hsh-win__deco', (d) => d.length > 0 && d.every((x) => getComputedStyle(x).display === 'none')));
    check(`${name} — 발췌 창: 둥근 테두리 없음`, q.border === '0px', JSON.stringify(q));
    check(`${name} — 발췌 창: 가로로 잘리지 않음`, q.right <= q.vw && !q.innerX, JSON.stringify(q));
    check(`${name} — 발췌 창: 중첩 스크롤 없음`, !q.inner && (await innerScrollers(page)).length === 0, JSON.stringify(q) + (await innerScrollers(page)).join(' | '));
    await page.screenshot({ path: path.join(OUT, `layout-${name}-quote.png`), fullPage: false });
    const label = (await frame.textContent('#postEditorPreviewExportSize')).trim();
    const out = await exportFirst(page, frame, `layout-${name}`);
    const [lw, lh] = label.split('×').map((x) => parseInt(x, 10));
    // AUTO 비율 높이는 html2canvas 가 복제본에서 다시 잰다(그쪽 주석) — 1~2px 차이는 원래 그렇다
    check(`${name} — export 크기 = 프리셋 출력 크기`, out.size.w === lw && Math.abs(out.size.h - lh) <= 2, `${label} / ${JSON.stringify(out.size)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('.hsh-plan').dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room: 'n', label: 'notice', name: '공지', bg: '#cfe0fb', fg: '#8a62dc' } })));
    await page.waitForTimeout(800);
    check(`${name} — 다른 방 창을 열면 스티커 다시`, await page.$$eval('.hsh-win__deco', (d) => d.some((x) => getComputedStyle(x).display !== 'none')));
    check(`콘솔 오류 없음(layout ${name})`, errors.length === 0, errors.join(' | '));
    await context.close();
  }

  console.log('\n[주인 링크 — 방문자 · 다른 계정]');
  for (const [name, user] of [['로그아웃', null], ['다른 Google 계정', USERS.other]]) {
    const { page, context } = await open(user);
    await home(page);
    await openRoom(page, '1');
    await clickRow(page, '프리셋 지정 글');
    await bodyReady(page);
    await page.waitForTimeout(400);
    check(`${name} — 고치기 링크 없음`, !(await page.$('.hsh-ct__owner')));
    check(`${name} — quote 버튼 없음`, !(await page.$('.hsh-ct__tool')));
    await context.close();
  }
}

try {
  if (!ONLY || ONLY === 'visitor') await visitor();
  if (!ONLY || ONLY === 'owner') await owner();
  if (!ONLY || ONLY === 'admin') { await admin(); await activeSwitch(); }
  if (!ONLY || ONLY === 'routing') await routing();
  if (!ONLY || ONLY === 'mobile') await mobile();
  if (!ONLY || ONLY === 'layout') await layout();
  if (!ONLY || ONLY === 'archive') await archive();
  if (!ONLY || ONLY === 'neighbor') await neighbor();
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
