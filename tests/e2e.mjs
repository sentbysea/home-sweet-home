// 바이브.me E2E — 실제 파일(이 저장소 + 이웃 web 저장소) · 흉내 Supabase(임시 데이터, 운영 DB 에 닿지 않는다)
//
//   node tests/e2e.mjs [--only=heads|visitor|owner|admin|routing|mobile|layout|archive|neighbor] [--browser=webkit]   (WEB_DIR=../web 이 기본)
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

// 저장된 집 모양(banners.house) — 마을에 그대로 나와야 한다
const SAVED_HOUSE = { v: 1, body: 'wide', roof: 'round', door: 'side', window: 'two', deco: 'pot', wall: '#cfe0fb', roofColor: '#7fa7d9', doorColor: '#e2b36b' };
/** web supabase/migrations/20261027100000_neighbor_houses.sql 의 banner_house_ok 와 같은 꼴 */
function houseOk(h) {
  if (h == null) return true;
  if (typeof h !== 'object' || Array.isArray(h) || JSON.stringify(h).length > 400) return false;
  const keys = ['v', 'body', 'roof', 'roofPattern', 'door', 'window', 'deco', 'wall', 'roofColor', 'doorColor'];
  const hex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  const deco = typeof h.deco === 'string' ? ['chimney', 'dormer', 'pot', 'none'].includes(h.deco)
    : Array.isArray(h.deco) && h.deco.length <= 5 && new Set(h.deco).size === h.deco.length && h.deco.every((d) => ['chimney', 'pot', 'dog', 'mailbox', 'tree'].includes(d));
  return Object.keys(h).every((k) => keys.includes(k)) && ['cozy', 'tall', 'wide', 'two', 'tiny'].includes(h.body) && ['tri', 'round', 'trap', 'gable', 'twin', 'barn'].includes(h.roof)
    && (h.roofPattern === undefined || ['solid', 'halftone', 'hstripe', 'vstripe', 'gingham', 'dot', 'stripe'].includes(h.roofPattern))
    && ['arch', 'square', 'side'].includes(h.door) && ['one', 'two', 'round', 'cross', 'band'].includes(h.window) && deco
    && hex(h.wall) && hex(h.roofColor) && hex(h.doorColor);
}
/** 집 모양 → 화면의 data-house 글자(src/neighbor/house-art.js houseKey · 옛 꼴은 새 꼴로 읽은 것) */
function keyOf(h) {
  const deco = typeof h.deco === 'string' ? (['chimney', 'pot'].includes(h.deco) ? h.deco : '-') : (h.deco.join('+') || '-');
  return `${h.body}/${h.roof}/${h.roofPattern || 'solid'}/${h.door}/${h.window}/${deco}/${h.wall}/${h.roofColor}/${h.doorColor}`;
}

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
  // neighbor — 배너 카테고리(4) 이웃집. 둘째는 저장된 집 모양, 셋째는 이미지가 없는 주소(못 불러올 때)
  db.banners.push(
    { id: 1, category_id: 4, user_id: OWNER_ID, name: '', url: 'https://hongjiwon.love', image_url: 'https://img.test/love.png', image_path: null, sort_order: 0 },
    { id: 2, category_id: 4, user_id: OWNER_ID, name: '럭키', url: 'https://luvlog.me/lucky', image_url: 'https://img.test/lucky.png', image_path: null, sort_order: 1, house: SAVED_HOUSE },
    { id: 3, category_id: 4, user_id: OWNER_ID, name: '', url: 'https://broken.example/home/', image_url: 'https://img.test/missing.png', image_path: null, sort_order: 2 },
    { id: 9, category_id: 9, user_id: OWNER_ID, name: '다른 칸', url: 'https://other.example', image_url: 'https://img.test/love.png', image_path: null, sort_order: 0 },
  );
  db.seq.banners = 100;
  db.banner_requests = [];
  db.requestCalls = 0;
  db.residents = []; // 홈페이지 없는 이웃(neighbor_residents)
  // 흉내 DB 에 없는 RPC — 사이트 주인 · 배너 교환 신청(web supabase/migrations/20261026100000_banner_requests.sql 과 같은 규칙)
  const reply = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  const key = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#]+$/, '');
  // 사이트 제목(Edge Function site-title) — 이름을 비우면 이걸로
  db.titles = { 'https://added.example/': '추가된 사이트', 'https://new-neighbor.example/home': '새 이웃 사이트' };
  db.homeHouse = undefined; // 홍차네 집(neighbor_home) — undefined 면 아직 한 번도 고치지 않은 것(빈 표)
  db.hooks.beforeRequest = async ({ route, url }) => {
    if (url.pathname === '/rest/v1/neighbor_home') { await reply(route, 200, db.homeHouse === undefined ? [] : [{ house: db.homeHouse }]); return true; }
    if (url.pathname === '/rest/v1/neighbor_residents') { await reply(route, 200, [...db.residents].sort((a, b) => a.sort_order - b.sort_order)); return true; }
    if (url.pathname !== '/functions/v1/site-title') return false;
    await reply(route, 200, { title: db.titles[url.searchParams.get('url')] || '' });
    return true;
  };
  db.hooks.rpc = async ({ route, name, request, uid }) => {
    const args = JSON.parse(request.postData() || '{}');
    if (name === 'site_owner_id') { await reply(route, 200, OWNER_ID); return true; }
    if (name === 'submit_banner_request') {
      db.requestCalls += 1;
      if (db.requestsMissing) { await reply(route, 404, { code: 'PGRST202', message: 'Could not find the function public.submit_banner_request' }); return true; }
      if (db.failSubmit > 0) { db.failSubmit -= 1; await reply(route, 503, { message: 'unavailable' }); return true; }
      const bad = (m) => reply(route, 400, { code: '22023', message: m, details: null, hint: null });
      const nm = String(args.p_site_name || '').trim();
      const url = String(args.p_site_url || '').trim();
      const img = String(args.p_image_url || '').trim();
      const nosite = !url && !img; // 홈페이지 없는 신청(20261030100000_neighbor_residents.sql)
      if (nm.length < 1 || nm.length > 40) { await bad('site_name'); return true; }
      if (!nosite && !/^https?:\/\/[^\s/?#]+\.[^\s/?#]+(\S*)$/i.test(url)) { await bad('site_url'); return true; }
      if (!nosite && !/^https?:\/\/\S+$/i.test(img)) { await bad('image_url'); return true; }
      if (!houseOk(args.p_house)) { await bad('house'); return true; }
      if (!nosite && db.banners.some((b) => b.category_id === 4 && key(b.url) === key(url))) { await reply(route, 200, 'listed'); return true; }
      if (!nosite && db.banner_requests.some((r) => r.status === 'pending' && key(r.site_url) === key(url))) { await reply(route, 200, 'pending'); return true; }
      db.banner_requests.push({ id: db.banner_requests.length + 1, site_name: nm, site_url: url || null, image_url: img || null, message: String(args.p_message || '').trim() || null, house: args.p_house ?? null, status: 'pending', created_at: new Date().toISOString() });
      await reply(route, 200, 'ok');
      return true;
    }
    if (name === 'set_home_house') {
      if (uid !== OWNER_ID) { await reply(route, 403, { code: '42501', message: 'owner only' }); return true; }
      if (!houseOk(args.p_house)) { await reply(route, 400, { code: '22023', message: 'house' }); return true; }
      db.homeHouse = args.p_house ?? null;
      await reply(route, 200, 'ok');
      return true;
    }
    if (name === 'set_banner_house') {
      if (uid !== OWNER_ID) { await reply(route, 403, { code: '42501', message: 'owner only' }); return true; }
      if (!houseOk(args.p_house)) { await reply(route, 400, { code: '22023', message: 'house' }); return true; }
      const b = db.banners.find((x) => x.id === Number(args.p_id) && x.category_id === 4);
      if (b) b.house = args.p_house ?? null;
      db.houseCalls = (db.houseCalls || 0) + 1;
      await reply(route, 200, b ? 'ok' : 'missing');
      return true;
    }
    if (name === 'update_resident' || name === 'delete_resident') {
      if (uid !== OWNER_ID) { await reply(route, 403, { code: '42501', message: 'owner only' }); return true; }
      const r = db.residents.find((x) => x.id === Number(args.p_id));
      if (name === 'delete_resident') { if (r) db.residents.splice(db.residents.indexOf(r), 1); await reply(route, 200, r ? 'ok' : 'missing'); return true; }
      const nm = String(args.p_name || '').trim();
      if (nm.length < 1 || nm.length > 40) { await reply(route, 400, { code: '22023', message: 'name' }); return true; }
      if (!houseOk(args.p_house)) { await reply(route, 400, { code: '22023', message: 'house' }); return true; }
      if (r) { r.name = nm; r.house = args.p_house ?? null; }
      await reply(route, 200, r ? 'ok' : 'missing');
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
      if (args.p_approve && !r.site_url) {
        db.residents.push({ id: (db.seq.residents = (db.seq.residents || 0) + 1), name: r.site_name, house: r.house ?? null, sort_order: Math.max(-1, ...db.residents.map((x) => x.sort_order)) + 1 });
      } else if (args.p_approve && !db.banners.some((b) => b.category_id === 4 && key(b.url) === key(r.site_url))) {
        const max = Math.max(-1, ...db.banners.filter((b) => b.category_id === 4).map((b) => b.sort_order));
        db.banners.push({ id: ++db.seq.banners, category_id: 4, user_id: OWNER_ID, name: r.site_name, url: r.site_url, image_url: r.image_url, image_path: null, sort_order: max + 1, house: r.house ?? null });
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
// 다른 출처 · 읽기 허용 헤더 없는 이미지(배너 색을 못 읽는 경우)
const PLAIN_ORIGIN = `http://127.0.0.1:${VIBE_PORT + 1}`;
const plainServer = await startStaticServer(VIBE_PORT + 1, { root: path.join(WEB, 'images') });

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
    // nocors — 다른 출처에서 색을 읽지 못하게 막은 이미지(보이기는 한다)
    const headers = name.includes('nocors') ? {} : { 'access-control-allow-origin': '*' };
    return route.fulfill({ status: 200, contentType: 'image/png', headers, body: png(200, 40, color) });
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
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 10000 });
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

// ---------- neighbor — 손그림 마을 ----------
//   가운데 홍차네 집 + 이웃집(배너 카테고리, 정렬 순서) · 집 모양(저장된 것 / id 로 정한 기본) · 겹치지 않는 배치 · 새로고침해도 같은 배치 ·
//   둥실거림 · 위글 · 집을 고르면 배너 하나(PC 올리기 · 포커스 · 누르면 새 탭 / 휴대폰 한 번 누르면 배너, 그 배너를 누르면 이동) · 잘리지 않는 자리 ·
//   우체통 → 배너 교환(내 배너 복사 · 신청 + 우리 집 꾸미기 · 배너 색 · 다시 시도) · 주인(승인하면 그 모양 · 집 고치기 · 내리기 · 걸기) ·
//   3 · 12 · 30 집 · 모션 줄이기. 모두 흉내 DB — 운영에 쓰지 않는다.

const MY_IMAGE = `https://iokdgqzfprtggsnrusez.supabase.co/storage/v1/object/public/user-banners/${OWNER_ID}/vibe-banner`; // 바이브.me 전용(hongjiwon.love 는 /banner)
const watchLoader = (context) => context.addInitScript(() => {
  window.__loaderSeen = false;
  const look = () => {
    const l = document.querySelector('.hsh-loader');
    if (l && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0) window.__loaderSeen = true;
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
});
const toBottom = async (page) => { await page.$eval('.nbh__scroll', (s) => { s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(300); };
const rects = (page, sel) => page.$$eval(sel, (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }).filter((r) => r.w > 0));
const center = (r) => ({ x: (r.x + r.r) / 2, y: (r.y + r.b) / 2 });
const clickMail = async (page) => { const m = (await rects(page, '.nbh-mailbox__art'))[0]; await page.mouse.click(m.x + m.w / 2, m.y + m.h * 0.45); };
const homeLabels = (page) => page.$$eval('.nbh-home', (b) => b.map((x) => x.getAttribute('aria-label').replace(/ — .*$/, '')));
const popOpen = (page) => page.$eval('.nbh-pop', (p) => !p.hidden && p.classList.contains('is-open'));
const villageReady = (page) => page.waitForFunction(() => document.querySelector('.nbh__village')?.getAttribute('aria-busy') === 'false', null, { timeout: 20000 });
/** 집 · 홍차네 집 · 우체통 · 장식 — 서로 겹치는 짝(그림 상자 기준, 2px 여유) */
const overlaps = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('.nbh-home .nbh-art, .nbh-center .nbh-art, .nbh-mailbox__art, .nbh-deco')];
  const rs = els.map((el) => el.getBoundingClientRect());
  // 홍차네 집 · 우체통은 한 덩어리 — 그림 둘레 빈 여백끼리는 겹쳐 바짝 붙는다
  const pair = (i, j) => [els[i], els[j]].some((el) => el.closest('.nbh-center')) && [els[i], els[j]].some((el) => el.closest('.nbh-mailbox'));
  const bad = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i];
    const b = rs[j];
    const t = pair(i, j) ? 16 : 2;
    if (a.left < b.right - t && b.left < a.right - t && a.top < b.bottom - 2 && b.top < a.bottom - 2) bad.push([i, j]);
  }
  return bad;
});
/** 그림 상자들이 화면 폭 안 */
const inWidth = (page) => page.evaluate(() => [...document.querySelectorAll('.nbh-art, .nbh-mailbox__art, .nbh-deco')]
  .every((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth; }));
const layoutOf = (page) => page.$eval('.nbh__village', (v) => v.hshVillage.layout.filter((l) => !['tree', 'fence'].includes(l.kind)).map((l) => [l.kind, Math.round(l.x), Math.round(l.base)].join(':')).join('|'));

async function neighborVillage(device, name) {
  const d = await open(null, device ? undefined : { width: 1280, height: 860 }, device || {});
  const { page, context } = d;
  await watchLoader(context);
  await context.route(/^https:\/\/(hongjiwon\.love|luvlog\.me|broken\.example)\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ok</title>ok' }));
  const popups = [];
  context.on('page', (p) => popups.push(p));
  const at = () => new URL(page.url()).pathname;
  const vw = await page.evaluate(() => innerWidth);

  await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await villageReady(page);
  await page.waitForTimeout(500);
  check(`${name} — /neighbor 직접 → 로딩 없이 마을(브라우저 창 꼴 아님)`, at() === '/neighbor' && !(await page.evaluate(() => window.__loaderSeen)) && (await page.$eval('.hsh-win', (w) => w.hidden)));
  const labels = await homeLabels(page);
  check(`${name} — 이웃집은 배너 카테고리만, 정렬 순서대로(이름 없으면 주소)`, labels.join(' / ') === 'hongjiwon.love / 럭키 / broken.example/home', labels.join(' / '));
  const homeRects = await rects(page, '.nbh-home .nbh-art');
  const c = (await rects(page, '.nbh-center .nbh-art'))[0];
  const town = (await rects(page, '.nbh-town'))[0];
  check(`${name} — 홍차네 집이 가운데 · 조금 더 크다`, Math.abs(center(c).x - center(town).x) < town.w * 0.12 && homeRects.every((h) => c.w > h.w * 0.95 || c.h > h.h), JSON.stringify({ c, town }));
  check(`${name} — 가운데 집 이름표 homesweethome`, (await page.textContent('.nbh-center__tag')).trim() === 'homesweethome');
  check(`${name} — 집 · 우체통 · 장식이 겹치지 않고 화면 폭 안`, (await overlaps(page)).length === 0 && (await inWidth(page)), JSON.stringify(await overlaps(page)));
  check(`${name} — 집은 누르기 편한 크기`, homeRects.every((h) => h.w >= 44 && h.h >= 44), homeRects.map((h) => Math.round(h.w)).join(','));
  check(`${name} — 배너는 평소 숨김 · 카드 테두리 없음`, (await page.$eval('.nbh-pop', (p) => p.hidden)) && (await page.$eval('.nbh-home', (b) => getComputedStyle(b).borderTopWidth === '0px' && getComputedStyle(b).backgroundColor === 'rgba(0, 0, 0, 0)')));
  check(`${name} — 저장된 집 모양 그대로(럭키)`, (await page.$eval('.nbh-home[data-i="1"]', (b) => b.dataset.house)) === 'wide/round/solid/side/two/pot/#cfe0fb/#7fa7d9/#e2b36b');
  const tags = await page.$$eval('.nbh-home', (b) => b.map((x) => ({ text: x.querySelector('.nbh-home__tag')?.textContent, hl: x.style.getPropertyValue('--hl'), bg: x.style.getPropertyValue('--tag-bg'), house: x.dataset.house })));
  check(`${name} — 집마다 아래 이름표(이름 · 없으면 주소)`, tags.map((t) => t.text).join('|') === 'hongjiwon.love|럭키|broken.example/home', JSON.stringify(tags));
  // 이름표 종이 색 — 그 집 색 중 하나(같은 색조), 진하면 명도 80 까지 밝힌 것. 배너 링크 밑줄도 같은 색
  const hsl = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255); const mx = Math.max(...c); const mn = Math.min(...c); const l = (mx + mn) / 2; const d = mx - mn; let h = 0; if (d) h = (mx === c[0] ? (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0) : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4) * 60; return [h, l * 100]; };
  check(`${name} — 이름표 종이 색은 그 집 색에서(밝기 80 이상) · 링크 밑줄과 같은 색`, tags.every((t) => t.bg && t.bg === t.hl && hsl(t.bg)[1] >= 79.5
    && t.house.split('/').slice(6).some((c) => c === t.bg || Math.abs(hsl(c)[0] - hsl(t.bg)[0]) < 3)), JSON.stringify(tags));
  const look = await page.evaluate(() => {
    const cs = (q) => getComputedStyle(document.querySelector(q));
    const vw = document.documentElement.clientWidth;
    const labels = [...document.querySelectorAll('.nbh-label')].map((t) => { const b = t.getBoundingClientRect(); return { l: b.left, r: b.right, cut: t.scrollWidth > t.clientWidth + 1, deco: getComputedStyle(t).backgroundImage }; });
    const outer = document.querySelector('.nbh-home .nbh-v0 path:not(.d)');
    const inner = document.querySelector('.nbh-home .nbh-v0 path.d');
    return {
      title: [cs('.nbh__title').backgroundColor, cs('.nbh__title').textDecorationLine, cs('.nbh__title').textDecorationColor, document.querySelector('.nbh__title').textContent],
      stars: document.querySelectorAll('.nbh__stars .hsh-star').length, starsPass: cs('.nbh__stars').pointerEvents,
      labelsIn: labels.every((b) => b.l >= 0 && b.r <= vw && !b.cut && b.deco === 'none'),
      line: [getComputedStyle(outer).stroke, parseFloat(getComputedStyle(outer).strokeWidth), parseFloat(getComputedStyle(inner).strokeWidth)],
    };
  });
  check(`${name} — 제목은 영단어 + 노란 밑줄(색종이 없이)`, look.title.join('|') === 'rgba(0, 0, 0, 0)|underline|rgb(251, 239, 174)|Neighbor', look.title.join('|'));
  check(`${name} — 여백 별(누르기를 막지 않음)`, look.stars >= 8 && look.starsPass === 'none', JSON.stringify(look));
  check(`${name} — 이름표: 화면 안 · 잘리지 않음 · 밑줄 없음`, look.labelsIn, JSON.stringify(look));
  check(`${name} — 선은 홈처럼 부드러운 회색 · 안쪽 선이 더 얇다`, look.line[0] === 'rgb(143, 148, 151)' && look.line[1] < 1.6 && look.line[2] < look.line[1], JSON.stringify(look.line));
  check(`${name} — 우체통: 글 없이 화살표 · 빨간 깃발이 움직인다`, !(await page.$('.nbh-mailbox__tip')) && (await page.$eval('.nbh-mailbox__arrow', (a) => getComputedStyle(a).animationName === 'nbh-boing'))
    && (await page.$eval('.nbh-mailbox__pennant', (g) => getComputedStyle(g).animationName === 'nbh-flutter')));
  const looks = await page.$$eval('.nbh-home', (b) => b.map((x) => x.dataset.house));
  const lay = await layoutOf(page);
  await page.screenshot({ path: path.join(OUT, `neighbor-${name}-village.png`) });

  // 둥실 · 위글 — 집마다 다른 주기, 선 변형이 돌고 한 번에 하나만, 배너 · 이름은 위글 없이
  const bob = await page.$$eval('.nbh-home .nbh-home__art', (a) => a.map((x) => { const an = x.getAnimations()[0]; return an ? an.effect.getTiming().duration : 0; }));
  check(`${name} — 집마다 다른 주기로 둥실`, bob.every((x) => x > 3000) && new Set(bob).size === bob.length, bob.join(','));
  const boils = new Set();
  for (let i = 0; i < 8; i++) { boils.add(await page.$eval('.nbh', (n) => n.dataset.boil)); await page.waitForTimeout(110); }
  const shownV = await page.$$eval('.nbh-art', (svgs) => svgs.map((s) => [...s.querySelectorAll('.nbh-v')].filter((g) => getComputedStyle(g).display !== 'none').length));
  check(`${name} — 손그림 위글(선 변형이 돌고, 한 번에 하나만)`, boils.size >= 3 && shownV.every((n) => n === 1), JSON.stringify({ boils: [...boils], shownV }));

  const tapOrHover = async (i) => {
    const r = center((await rects(page, `.nbh-home[data-i="${i}"] .nbh-art`))[0]);
    if (device) await page.touchscreen.tap(r.x, r.y);
    else await page.mouse.move(r.x, r.y);
    await page.waitForTimeout(400);
    return r;
  };
  const popBox = async () => (await rects(page, '.nbh-pop'))[0];
  if (!device) {
    // PC — 올리면 배너, 배너로 옮겨도 그대로, 벗어나면 닫힘, 누르면 새 탭
    const h0 = await tapOrHover(0);
    const pb = await popBox();
    const pop = await page.evaluate(() => ({ link: document.querySelector('.nbh-pop__link').getAttribute('href'), shadow: getComputedStyle(document.querySelector('.nbh-pop')).boxShadow, frame: document.querySelectorAll('.nbh-pop__frame .nbh-v').length, src: document.querySelector('.nbh-pop__banner img').getAttribute('src'), name: Boolean(document.querySelector('.nbh-pop__name')), label: document.querySelector('.nbh-pop__link').getAttribute('aria-label'), ratio: (() => { const b = document.querySelector('.nbh-pop__banner').getBoundingClientRect(); return b.width / b.height; })(), fit: getComputedStyle(document.querySelector('.nbh-pop__banner img')).objectFit }));
    check('PC — 집에 올리면 그 배너가 집 위로(5:1 칸 · 비율이 달라도 꽉 채워 자름 · 배너만(이름 글 없음) · 손그림 말풍선 · 방문하기 버튼 없음)', (await popOpen(page)) && pop.link === 'https://hongjiwon.love/' && pop.shadow === 'none' && pop.frame === 4 && !(await page.$('.nbh-pop__go')) && pop.src === 'https://img.test/love.png' && !pop.name && pop.label.startsWith('hongjiwon.love') && Math.abs(pop.ratio - 5) < 0.1 && pop.fit === 'cover' && pb.b <= h0.y, JSON.stringify(pop));
    check('PC — 배너가 화면 안 · 가로로 길게(280px)', pb.x >= 0 && pb.r <= vw && pb.y >= 0 && Math.abs(pb.w - 280) < 1, JSON.stringify(pb));
    // 집 → 배너로 천천히 옮겨도 그대로
    for (let k = 1; k <= 8; k++) { await page.mouse.move(h0.x, h0.y - ((h0.y - (pb.y + pb.h / 2)) * k) / 8); await page.waitForTimeout(25); }
    await page.waitForTimeout(400);
    check('PC — 집에서 배너로 옮겨도 닫히지 않음', await popOpen(page));
    await page.mouse.move(20, 600);
    await page.waitForTimeout(500);
    check('PC — 벗어나면 닫힘', !(await popOpen(page)));
    await tapOrHover(1);
    await tapOrHover(0);
    check('PC — 배너는 한 번에 하나', (await page.$$eval('.nbh-home.is-open', (x) => x.length)) === 1 && (await page.$eval('.nbh-pop__link', (n) => n.getAttribute('aria-label'))).startsWith('hongjiwon.love'));
    const h1 = center((await rects(page, '.nbh-home[data-i="1"] .nbh-art'))[0]);
    await page.mouse.click(h1.x, h1.y);
    await until(() => popups.length > 0, 6000);
    check('PC — 집을 누르면 그 사이트 새 탭', popups.length === 1 && popups[0].url().startsWith('https://luvlog.me/lucky') && at() === '/neighbor', popups.map((x) => x.url()).join(','));
    await Promise.all(popups.splice(0).map((x) => x.close()));
    await page.mouse.move(20, 600);
    await page.waitForTimeout(400);
    // 키보드 — Tab 으로 집 → 배너, Enter → 배너(링크)로, Esc → 닫고 집으로, 배너 Enter → 새 탭
    await page.focus('.nbh__home');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(350);
    check('PC — 키보드 포커스로 배너', (await page.evaluate(() => document.activeElement?.classList.contains('nbh-home'))) && (await popOpen(page)));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check('PC — Enter → 배너 링크로 이동(아직 새 탭 아님)', (await page.evaluate(() => document.activeElement?.classList.contains('nbh-pop__link'))) && popups.length === 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    check('PC — Esc → 배너 닫고 그 집으로(화면은 그대로)', !(await popOpen(page)) && (await page.evaluate(() => document.activeElement?.classList.contains('nbh-home'))) && at() === '/neighbor');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await until(() => popups.length > 0, 6000);
    check('PC — 배너 Enter → 새 탭', popups.length === 1 && popups[0].url().startsWith('https://hongjiwon.love'), popups.map((x) => x.url()).join(','));
    await Promise.all(popups.splice(0).map((x) => x.close()));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    // 휴대폰 — 한 번 누르면 배너, 그 배너를 눌러야 이동, 바깥을 누르면 닫힘
    await tapOrHover(0);
    const pb = await popBox();
    // 말풍선은 화면 가운데 — 집이 가장자리라 꼬리가 닿지 않을 때만 집 쪽으로 그만큼 옮긴다
    const pvw = await page.evaluate(() => document.documentElement.clientWidth);
    const hx = center((await rects(page, '.nbh-home[data-i="0"]'))[0]).x;
    const mid = Math.abs(pb.x + pb.w / 2 - pvw / 2) < 2 || Math.abs(hx - pb.x - 22) < 2 || Math.abs(pb.r - hx - 22) < 2;
    check(`${name} — 한 번 누르면 배너만(이동은 아직) · 화면 폭의 70% · 가로 가운데(꼬리가 집에 닿게)`, (await popOpen(page)) && popups.length === 0 && !(await page.$('.nbh-pop__name')) && pb.x >= 0 && pb.r <= pvw && pb.w >= 230 && pb.w <= 280 && mid, JSON.stringify({ pb, pvw, hx }));
    await tapOrHover(1);
    const pb1 = await popBox();
    const hx1 = center((await rects(page, '.nbh-home[data-i="1"]'))[0]).x;
    check(`${name} — 가운데 쪽 집이면 말풍선은 화면 가운데`, Math.abs(hx1 - pvw / 2) > pb1.w / 2 - 22 || Math.abs(pb1.x + pb1.w / 2 - pvw / 2) < 2, JSON.stringify({ pb1, pvw, hx1 }));
    await tapOrHover(2);
    check(`${name} — 다른 집을 누르면 그 배너로(하나만) · 이미지 실패 → 이름`, (await page.$$eval('.nbh-home.is-open', (x) => x.length)) === 1 && (await page.$eval('.nbh-pop', (p) => p.classList.contains('is-broken'))) && (await page.textContent('.nbh-pop__alt')) === 'broken.example/home');
    const go = center((await rects(page, '.nbh-pop__banner'))[0]);
    await page.touchscreen.tap(go.x, go.y);
    await until(() => popups.length > 0, 6000);
    check(`${name} — 배너를 누르면 → 새 탭`, popups.length === 1 && popups[0].url().startsWith('https://broken.example/home'), popups.map((x) => x.url()).join(','));
    await Promise.all(popups.splice(0).map((x) => x.close()));
    await page.touchscreen.tap(10, 640);
    await page.waitForTimeout(350);
    check(`${name} — 바깥을 누르면 닫힘`, !(await popOpen(page)));
    // 가장자리 집 — 배너가 잘리지 않게
    const edge = await page.$$eval('.nbh-home', (b) => { const r = b.map((x) => x.getBoundingClientRect().left); return r.indexOf(Math.min(...r)); });
    await tapOrHover(edge);
    const pe = await popBox();
    check(`${name} — 가장자리 집에서도 배너가 화면 안`, pe.x >= 0 && pe.r <= vw && pe.y >= 0, JSON.stringify(pe));
    await page.touchscreen.tap(10, 640);
    await page.waitForTimeout(300);
  }

  // 새로고침 · 고르기 — 배치 · 모양 그대로
  await page.reload();
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await villageReady(page);
  check(`${name} — 새로고침해도 같은 배치 · 같은 집`, (await layoutOf(page)) === lay && JSON.stringify(await page.$$eval('.nbh-home', (b) => b.map((x) => x.dataset.house))) === JSON.stringify(looks));

  // 우체통 → 배너 교환
  await clickMail(page);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 5000 });
  check(`${name} — 우체통 → /neighbor/banner(배너 교환)`, at() === '/neighbor/banner');
  await page.waitForTimeout(300);
  const sheet = (await rects(page, '.nbh-panel__sheet'))[0];
  const vh = await page.evaluate(() => innerHeight);
  check(`${name} — 패널이 화면 안`, sheet.x >= 0 && sheet.r <= vw && sheet.y >= 0 && sheet.b <= vh + 1, JSON.stringify(sheet));
  const tabs = await page.$$eval('.nbh-tabs[data-mode="exchange"] [role="tab"]', (b) => b.filter((x) => !x.hidden).map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-selected')}`));
  check(`${name} — 우체통: 입주 신청만(내 배너는 홍차네 집으로)`, tabs.join('|') === '입주 신청:true' && !(await page.$('[data-ex-tab="mine"]')) && (await page.$eval('[data-mode="mine"]', (x) => x.hidden)) && !(await page.$eval('[data-ex="apply"]', (x) => x.hidden)), tabs.join('|'));
  check(`${name} — 방문자에게는 받은 신청 칸 없음`, await page.$eval('.nbh-review', (r) => r.hidden));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // 홍차네 집 → 내 배너(/neighbor/mine)
  const hc = (await rects(page, '.nbh-center .nbh-art'))[0];
  await page.mouse.click(hc.x + hc.w / 2, hc.y + hc.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="mine"]:not([hidden])', { timeout: 5000 });
  check(`${name} — 홍차네 집 → /neighbor/mine(내 배너만)`, at() === '/neighbor/mine' && (await page.textContent('.nbh-panel__title')) === '내 배너' && (await page.$eval('[data-ex="apply"]', (x) => x.hidden)), at());
  const mine = await page.evaluate(() => ({
    img: document.querySelector('.nbh-mine__preview img').getAttribute('src'),
    vals: [...document.querySelectorAll('.nbh-mine__val')].map((v) => v.textContent),
    code: document.querySelector('.nbh-mine__code').textContent,
    copies: [...document.querySelectorAll('.nbh-mine__rows [data-copy]')].map((b) => b.dataset.copy),
  }));
  check(`${name} — 내 배너: 방문자에게는 바꾸기 없음 · 아직 없으면 안내`, (await page.$eval('.nbh-mine__owner', (x) => x.hidden)) && (await page.$eval('.nbh-mine__preview', (x) => x.classList.contains('is-empty'))));
  check(`${name} — 내 배너: 바이브.me 전용 이미지 · 이름(homesweethome) · 주소 · 이미지 주소 · 삽입 코드`, mine.img === MY_IMAGE && mine.vals.join('|') === `homesweethome|https://xn--9g3b29an0p.me|${MY_IMAGE}`
    && mine.code === `<a href="https://xn--9g3b29an0p.me" target="_blank" rel="noopener"><img src="${MY_IMAGE}" alt="homesweethome" width="200" height="40"></a>` && mine.copies.length === 4, JSON.stringify(mine));
  if (!device && BROWSER === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: VIBE_ORIGIN });
    const got = [];
    for (let i = 0; i < 4; i++) {
      await page.click(`.nbh-mine__rows [data-copy] >> nth=${i}`);
      await page.waitForTimeout(120);
      got.push({ clip: await page.evaluate(() => navigator.clipboard.readText()), label: await page.textContent(`.nbh-mine__rows [data-copy] >> nth=${i}`) });
    }
    check('PC — 복사 버튼 넷 → 클립보드에 그 값 · 복사 완료 표시', got.every((g, i) => g.clip === mine.copies[i] && g.label.includes('복사됨')), JSON.stringify(got));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(`${name} — Esc → 패널만 닫힘(/neighbor)`, at() === '/neighbor' && (await page.$eval('.nbh-panel', (p) => p.hidden)) && (await page.$eval('.nbh', (n) => !n.hidden)));
  await page.click('.nbh__home');
  await page.waitForTimeout(600);
  await page.waitForSelector('.hsh-plan.is-done', { timeout: 15000 }).catch(() => {});
  check(`${name} — ← home → 홈(/) · 로딩 없이 평면도`, at() === '/' && (await page.evaluate(() => !document.querySelector('.nbh') || document.querySelector('.nbh').hidden)) && (await page.$eval('.hsh-plan', (p) => !p.hidden)) && !(await page.evaluate(() => window.__loaderSeen)), at());
  check(`${name} — 닫으면 마을 정리`, await page.evaluate(() => { const s = document.querySelector('.nbh__village'); return !s || (!s.hshVillage && !s.querySelector('.nbh-town')); }));
  check(`콘솔 오류 없음(neighbor ${name})`, d.errors.length === 0, d.errors.join(' | '));
  await context.close();
}

async function neighborApply() {
  const v = await open(null, { width: 1280, height: 860 });
  const { page } = v;
  const at = () => new URL(page.url()).pathname;
  const F = '.nbh-form[data-form="apply"]';
  const D = `${F} [data-diy="apply"]`;
  const err = (n) => page.$eval(`${F} [name="${n}"]`, (i) => i.closest('.nbh-field').querySelector('.nbh-field__err').textContent);
  const msg = () => page.textContent(`${F} .nbh-form__msg`);
  const diyMsg = () => page.textContent(`${D} .nbh-diy__msg`);
  const chosen = () => page.$eval(D, (d) => d.dataset.spec);
  db.banner_requests.length = 0;
  db.requestCalls = 0;
  await page.goto(`${VIBE_ORIGIN}/neighbor/banner?${Q}`);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  check('/neighbor/banner 직접 → 마을 + 배너 교환 패널', at() === '/neighbor/banner' && (await page.$eval('.nbh', (n) => !n.hidden)));

  // 우리 집 꾸미기 — 고르면 바로, 같은 렌더러
  const before = await page.$eval(`${D} .nbh-diy__preview`, (p) => p.innerHTML);
  await page.click(`${D} [data-key="body"] [data-v="two"]`);
  await page.click(`${D} [data-key="roof"] [data-v="trap"]`);
  await page.click(`${D} [data-key="wall"] [data-v="#cdeed6"]`);
  const after = await page.$eval(`${D} .nbh-diy__preview`, (p) => p.innerHTML);
  check('꾸미기 — 고르면 미리보기가 바로 바뀐다', before !== after && after.includes('#cdeed6') && (await chosen()).startsWith('two/trap/'), await chosen());
  const hasDeco = async (d) => (await chosen()).split('/')[5].split('+').includes(d);
  for (const d of ['dog', 'tree']) if (!(await hasDeco(d))) await page.click(`${D} [data-key="deco"] [data-v="${d}"]`);
  const potBefore = await hasDeco('pot');
  await page.click(`${D} [data-key="deco"] [data-v="pot"]`);
  check('꾸미기 — 장식은 여러 개(개집 · 작은 나무 함께 · 누르면 켜고 끄기)', (await hasDeco('dog')) && (await hasDeco('tree')) && (await hasDeco('pot')) !== potBefore, await chosen());
  await page.click(`${D} [data-key="roofPattern"] [data-v="gingham"]`);
  check('꾸미기 — 지붕 무늬(체크) → 미리보기 지붕에 무늬', (await chosen()).split('/')[2] === 'gingham' && (await page.$eval(`${D} .nbh-diy__preview svg`, (s) => Boolean(s.querySelector('pattern')) && [...s.querySelectorAll('path')].some((p) => p.getAttribute('fill').startsWith('url(#')))));
  if (!(await hasDeco('chimney'))) await page.click(`${D} [data-key="deco"] [data-v="chimney"]`);
  check('꾸미기 — 굴뚝도 지붕 무늬를 따른다', await page.$eval(`${D} .nbh-diy__preview svg .nbh-v0`, (g) => g.querySelectorAll('path[fill^="url(#"]').length === 2), await chosen());
  check('꾸미기 — 색은 칩만(직접 고르기 없음)', !(await page.$(`${D} input[type="color"]`)) && !(await page.$(`${D} .nbh-diy__custom`)));
  check('꾸미기 — 마을과 같은 렌더러(.nbh-art · 위글 변형 4장)', await page.$eval(`${D} .nbh-diy__preview svg`, (s) => s.classList.contains('nbh-art') && s.querySelectorAll('.nbh-v').length === 4));
  const opts = (key) => page.$$eval(`${D} [data-key="${key}"] [data-v]`, (b) => b.map((x) => x.dataset.v).join('|'));
  check('꾸미기 — 지붕(처마 · 쌍둥이 박공, 헛간 없음) · 무늬 순서(단색-망점-가로-세로-깅엄)', (await opts('roof')) === 'tri|round|trap|gable|twin' && (await opts('roofPattern')) === 'solid|halftone|hstripe|vstripe|gingham', `${await opts('roof')} / ${await opts('roofPattern')}`);
  const previewName = () => page.$eval(`${D} .nbh-diy__name`, (t) => t.textContent);
  check('꾸미기 — 미리보기 집 아래 이름표(비면 안내)', (await previewName()) === '사이트 이름');
  const r1 = await chosen();
  await page.click(`${D} [data-diy="random"]`);
  const r2 = await chosen();
  await page.click(`${D} [data-key="door"] [data-v="side"]`);
  check('꾸미기 — 랜덤으로 만들기 · 그 뒤 직접 고치기', r1 !== r2 && (await chosen()).split('/')[3] === 'side', `${r1} → ${r2}`);
  await page.click(`${D} [data-diy="banner"]`);
  check('꾸미기 — 배너 이미지 없으면 안내', (await diyMsg()).includes('배너 이미지 주소'));

  // 두 단계 — 첫 화면은 집 꾸미기만, 다음으로 → 사이트 정보
  const stepNow = () => page.$eval(F, (f) => ({ step: f.dataset.step, house: !f.querySelector('[data-step-pane="house"]').hidden, info: !f.querySelector('[data-step-pane="info"]').hidden }));
  let st = await stepNow();
  check('신청 — 처음엔 집 꾸미기만(사이트 칸 없음)', st.step === 'house' && st.house && !st.info && !(await page.isVisible(`${F} [name="url"]`)), JSON.stringify(st));
  await page.click(`${F} [data-step-go="info"]`);
  st = await stepNow();
  check('신청 — 다음으로 → 사이트 정보(꾸미기는 숨김)', st.step === 'info' && !st.house && st.info && (await page.isVisible(`${F} [name="url"]`)) && !(await page.isVisible(`${D}`)), JSON.stringify(st));

  // 입력 검사
  await page.click(`${F} [type="submit"]`);
  check('신청 — 빈 칸이면 칸마다 안내 · 보내지 않음(이름은 선택)', (await err('name')) === '' && (await err('url')).length > 0 && (await err('image')).length > 0 && db.requestCalls === 0);
  await page.fill(`${F} [name="name"]`, '새 이웃');
  check('꾸미기 — 이름을 적으면 미리보기 이름표도 바로', (await previewName()) === '새 이웃', await previewName());
  await page.fill(`${F} [name="url"]`, 'javascript:alert(1)');
  await page.fill(`${F} [name="image"]`, `${PLAIN_ORIGIN}/share-card-default.png`); // 다른 출처 · 읽기 허용 없음
  await page.click(`${F} [type="submit"]`);
  check('신청 — http(s) 아닌 주소 거절', (await err('url')).includes('http') && db.requestCalls === 0, await err('url'));
  await page.fill(`${F} [name="url"]`, 'new-neighbor.example/home');
  await page.focus(`${F} [name="message"]`);
  check('신청 — 주소만 적으면 https:// 를 붙여 준다', (await page.inputValue(`${F} [name="url"]`)) === 'https://new-neighbor.example/home');

  // 배너 색 — 읽을 수 없는 배너는 쉬운 말로 안내, 직접 고르기 · 랜덤은 그대로(꾸미기는 첫 단계로 돌아가서)
  await page.click(`${F} [data-step-go="house"]`);
  await page.click(`${D} [data-diy="banner"]`);
  await page.waitForFunction((D) => document.querySelector(`${D} .nbh-diy__msg`).textContent.includes('못했어요'), D, { timeout: 8000 }).catch(() => {});
  const noColor = await diyMsg();
  check('배너 색 — 못 읽으면 쉬운 안내(기술 용어 없음)', noColor.includes('가져오지 못했어요') && !/cors|origin|canvas|taint|security/i.test(noColor), noColor);
  await page.click(`${D} [data-diy="random"]`);
  check('배너 색 — 못 읽어도 랜덤 · 직접 고르기는 된다', (await chosen()).split('/').length === 9);
  await page.click(`${F} [data-step-go="info"]`);
  await page.fill(`${F} [name="image"]`, 'https://img.test/new.png');
  await page.click(`${F} [data-step-go="house"]`);
  await page.click(`${D} [data-diy="banner"]`);
  await page.waitForFunction((D) => document.querySelector(`${D} .nbh-diy__msg`).textContent.includes('지었어요'), D, { timeout: 8000 }).catch(() => {});
  const c1 = await chosen();
  const walls = await page.$$eval(`${D} [data-key="wall"] [data-v]`, (b) => b.map((x) => x.dataset.v));
  const l = (hex) => { const n = parseInt(hex.slice(1), 16); return (Math.max(n >> 16, (n >> 8) & 255, n & 255) + Math.min(n >> 16, (n >> 8) & 255, n & 255)) / 5.1; };
  const [, , , , , , wall, , door] = c1.split('/');
  check('배너 색 — 배너에서 뽑은 색으로(벽은 밝게 · 문은 벽과 대비)', (await diyMsg()).includes('배너 색으로 지었어요') && walls.length === 9 && l(wall) >= 80 && Math.abs(l(wall) - l(door)) >= 20, JSON.stringify({ c1, walls }));
  await page.click(`${D} [data-diy="banner"]`);
  await page.waitForTimeout(150);
  check('배너 색 — 다시 뽑기 → 같은 색으로 다른 조합', (await chosen()) !== c1 && (await page.textContent(`${D} [data-diy="banner"]`)).includes('다시 뽑기'), `${c1} → ${await chosen()}`);
  check('배너 색 — 원본 배너 이미지는 그대로', (await page.$eval(`${F} .nbh-form__preview img`, (i) => i.getAttribute('src'))) === 'https://img.test/new.png');
  const picked = await page.$eval(D, () => null).then(() => chosen());

  // 브라우저에 저장 — 새로고침해도 단계 · 칸 · 꾸민 집 그대로
  await page.click(`${F} [data-step-go="info"]`);
  await page.fill(`${F} [name="message"]`, '안녕하세요 ♡');
  await page.reload();
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  st = await stepNow();
  check('신청 — 새로고침해도 적던 단계 · 칸 · 꾸민 집 그대로(브라우저에 저장)', st.step === 'info' && (await page.inputValue(`${F} [name="name"]`)) === '새 이웃' && (await page.inputValue(`${F} [name="image"]`)) === 'https://img.test/new.png' && (await page.inputValue(`${F} [name="message"]`)) === '안녕하세요 ♡' && (await chosen()) === picked, JSON.stringify({ st, spec: await chosen(), picked }));

  // 실패 → 다시 시도, 연달아 눌러도 한 번, 저장(집 모양까지)
  db.failSubmit = 1;
  await page.click(`${F} [type="submit"]`);
  await page.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'error', F, { timeout: 10000 }).catch(() => {});
  check('신청 — 실패하면 다시 시도 안내 · 적은 내용 · 꾸민 집 그대로', (await msg()).includes('다시 눌러') && (await page.inputValue(`${F} [name="name"]`)) === '새 이웃' && (await chosen()) === picked && db.banner_requests.length === 0, await msg());
  const callsBefore = db.requestCalls;
  await page.$eval(F, (f) => { f.requestSubmit(); f.requestSubmit(); f.requestSubmit(); });
  await page.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'done', F, { timeout: 10000 }).catch(() => {});
  const saved = db.banner_requests[0];
  check('신청 — 연달아 눌러도 한 번 · 대기 목록에 집 모양까지', db.requestCalls - callsBefore === 1 && db.banner_requests.length === 1 && saved.site_url === 'https://new-neighbor.example/home'
    && saved.house.v === 2 && keyOf(saved.house) === picked, JSON.stringify(saved));
  check('신청 — 완료 안내 · 칸 잠김 · 저장해 둔 내용은 지움', (await msg()).includes('신청했어요') && (await page.$eval(`${F} [name="name"]`, (i) => i.disabled)) && (await page.evaluate(() => localStorage.getItem('hsh:nbh-apply'))) === null);
  await page.click('.nbh-panel__x');
  await page.reload();
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 15000 });
  await villageReady(page);
  check('신청만으로는 마을에 집이 생기지 않는다', (await page.$$('.nbh-home')).length === 3 && db.banners.filter((b) => b.category_id === 4).length === 3);
  // 일부러 낸 503(다시 시도 안내)과 읽기를 막은 배너 이미지(브라우저가 스스로 남기는 기록)는 빼고
  const applyErrors = v.errors.filter((e) => !/503|submit 503|CORS policy|ERR_FAILED/.test(e));
  check('콘솔 오류 없음(neighbor 신청)', applyErrors.length === 0, applyErrors.join(' | '));
  await v.context.close();
}

// 홈페이지가 없어요 — 신청(이름표 · 집만) → 주인 승인 → 마을에 집 + 이름표(배너 없음) → 주인 이름 고치기 · 내리기
async function neighborNosite() {
  const v = await open(null, { width: 1280, height: 860 });
  const { page } = v;
  const F = '.nbh-form[data-form="apply"]';
  const D = `${F} [data-diy="apply"]`;
  const chosen = () => page.$eval(D, (d) => d.dataset.spec);
  await page.goto(`${VIBE_ORIGIN}/neighbor/banner?${Q}`);
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  await page.click(`${D} [data-key="body"] [data-v="tall"]`);
  const spec = await chosen();
  await page.screenshot({ path: path.join(OUT, 'neighbor-apply-1.png') });
  await page.click(`${F} [data-step-go="info"]`);
  await page.check(`${F} [name="nosite"]`);
  const look = await page.evaluate((F) => ({
    url: document.querySelector(`${F} [name="url"]`).closest('.nbh-field').offsetParent !== null,
    image: document.querySelector(`${F} [name="image"]`).closest('.nbh-field').offsetParent !== null,
    k: document.querySelector(`${F} [data-name-k]`).textContent,
  }), F);
  await page.screenshot({ path: path.join(OUT, 'neighbor-apply-2.png') });
  check('홈페이지 없음 — 주소 · 배너 칸이 빠지고 이름표 칸만', !look.url && !look.image && look.k.startsWith('이름표'), JSON.stringify(look));
  await page.click(`${F} [type="submit"]`);
  check('홈페이지 없음 — 이름표는 꼭(비우면 안내 · 안 보냄)', (await page.$eval(`${F} [name="name"]`, (i) => i.closest('.nbh-field').querySelector('.nbh-field__err').textContent)).includes('이름표') && !db.banner_requests.some((r) => !r.site_url));
  await page.fill(`${F} [name="name"]`, '집만 이웃');
  await page.reload();
  await page.waitForSelector('.nbh-panel.is-open', { timeout: 20000 });
  check('홈페이지 없음 — 새로고침해도 체크 · 이름표 · 집 그대로', (await page.isChecked(`${F} [name="nosite"]`)) && (await page.inputValue(`${F} [name="name"]`)) === '집만 이웃' && (await chosen()) === spec && !(await page.isVisible(`${F} [name="url"]`)));
  await page.click(`${F} [type="submit"]`);
  await page.waitForFunction((F) => document.querySelector(`${F} .nbh-form__msg`).dataset.tone === 'done', F, { timeout: 10000 }).catch(() => {});
  const req = db.banner_requests.find((r) => !r.site_url);
  check('홈페이지 없음 — 신청(주소 · 이미지 없이 이름 · 집)', req?.site_name === '집만 이웃' && req.image_url === null && keyOf(req.house) === spec && (await page.textContent(`${F} .nbh-form__msg`)).includes('신청했어요'), JSON.stringify(req));
  check('콘솔 오류 없음(neighbor 홈페이지 없음 신청)', v.errors.length === 0, v.errors.join(' | '));
  await v.context.close();

  const o = await open(USERS.owner, { width: 1280, height: 860 });
  o.page.on('dialog', (dlg) => dlg.accept());
  await o.page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await o.page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await o.page.click('.nbh__owner [data-act="edit"]');
  await o.page.waitForSelector('.nbh__owner [data-act="requests"]:not([hidden])', { timeout: 15000 });
  await o.page.click('.nbh__owner [data-act="requests"]');
  await o.page.waitForSelector(`.nbh-req[data-id="${req.id}"]`, { timeout: 10000 });
  check('주인 — 받은 신청에 홈페이지 없음 표시(링크 · 배너 없이)', await o.page.$eval(`.nbh-req[data-id="${req.id}"]`, (li) => li.classList.contains('is-nosite') && !li.querySelector('a') && li.textContent.includes('홈페이지 없음')));
  await o.page.click(`.nbh-req[data-id="${req.id}"] [data-ok="1"]`);
  await until(() => db.residents.length === 1, 8000);
  check('주인 — 승인 → banners 가 아니라 홈페이지 없는 이웃으로', db.residents[0]?.name === '집만 이웃' && !db.banners.some((b) => b.name === '집만 이웃'), JSON.stringify(db.residents));
  await o.page.click('.nbh-panel__x');
  await o.page.waitForFunction(() => [...document.querySelectorAll('.nbh-home__tag')].some((t) => t.textContent === '집만 이웃'), null, { timeout: 10000 });
  // 고치기 — 이름만(주소 · 배너 칸 없음)
  const ri = await o.page.$$eval('.nbh-home', (b) => b.findIndex((x) => x.querySelector('.nbh-home__tag').textContent === '집만 이웃'));
  await o.page.click(`.nbh-home[data-i="${ri}"]`);
  await o.page.waitForSelector('[data-mode="house"]:not([hidden])');
  await o.page.click('[data-house-tab="info"]');
  check('주인 — 홈페이지 없는 이웃 내용 고치기는 이름만', (await o.page.isVisible('[data-form="info"] [name="name"]')) && !(await o.page.isVisible('[data-form="info"] [name="url"]')) && !(await o.page.isVisible('[data-form="info"] [name="file"]')));
  await o.page.fill('[data-form="info"] [name="name"]', '집만 이웃2');
  await o.page.click('[data-form="info"] [type="submit"]');
  await until(() => db.residents[0]?.name === '집만 이웃2', 8000);
  check('주인 — 이름 고치기 → 저장(집 모양은 그대로)', db.residents[0]?.name === '집만 이웃2' && keyOf(db.residents[0].house) === spec, JSON.stringify(db.residents));
  await o.page.click('.nbh__owner [data-act="edit"]'); // done
  await o.page.waitForFunction(() => [...document.querySelectorAll('.nbh-home__tag')].some((t) => t.textContent === '집만 이웃2'), null, { timeout: 10000 });
  await o.context.close();

  // 방문자 — 집 + 이름표만, 눌러도 배너 · 새 탭 없음
  const w = await open(null, { width: 1280, height: 860 });
  const popups = [];
  w.context.on('page', (pg) => popups.push(pg));
  await w.page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await w.page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await w.page.waitForFunction(() => [...document.querySelectorAll('.nbh-home__tag')].some((t) => t.textContent === '집만 이웃2'), null, { timeout: 10000 });
  const wi = await w.page.$$eval('.nbh-home', (b) => b.findIndex((x) => x.querySelector('.nbh-home__tag').textContent === '집만 이웃2'));
  const art = center((await rects(w.page, `.nbh-home[data-i="${wi}"] .nbh-art`))[0]);
  await w.page.mouse.move(art.x, art.y);
  await w.page.waitForTimeout(400);
  await w.page.mouse.click(art.x, art.y);
  await w.page.waitForTimeout(600);
  check('방문자 — 홈페이지 없는 집: 올리거나 눌러도 배너 · 새 탭 없음', (await w.page.$eval('.nbh-pop', (p) => p.hidden)) && popups.length === 0 && (await w.page.$eval(`.nbh-home[data-i="${wi}"]`, (b) => !b.hasAttribute('aria-haspopup'))));
  await w.page.screenshot({ path: path.join(OUT, 'neighbor-nosite.png') });
  check('콘솔 오류 없음(neighbor 홈페이지 없는 집)', w.errors.length === 0, w.errors.join(' | '));
  await w.context.close();

  // 주인 — 내리기(다음 테스트는 처음 마을 그대로)
  const o2 = await open(USERS.owner, { width: 1280, height: 860 });
  o2.page.on('dialog', (dlg) => dlg.accept());
  await o2.page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await o2.page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await o2.page.click('.nbh__owner [data-act="edit"]');
  await o2.page.waitForSelector('.nbh__owner [data-act="add"]:not([hidden])', { timeout: 15000 });
  const di = await o2.page.$$eval('.nbh-home', (b) => b.findIndex((x) => x.querySelector('.nbh-home__tag').textContent === '집만 이웃2'));
  await o2.page.click(`.nbh-home[data-i="${di}"]`);
  await o2.page.waitForSelector('[data-mode="house"]:not([hidden])');
  await o2.page.click('[data-house="delete"]');
  await until(() => db.residents.length === 0, 8000);
  check('주인 — 홈페이지 없는 이웃 내리기', db.residents.length === 0);
  await o2.context.close();
}

// 보기 스위치 — 오른쪽 위, 마을 ↔ 배너(받은 배너만 한 줄에 하나씩, 이름 없이). 고른 보기는 기억
async function neighborView(device, name) {
  const v = await open(null, device ? undefined : { width: 1280, height: 860 }, device || {});
  const { page } = v;
  await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  const sw = await page.$eval('.nbh-view', (b) => { const r = b.getBoundingClientRect(); return { checked: b.getAttribute('aria-checked'), role: b.getAttribute('role'), right: innerWidth - r.right, top: r.top }; });
  check(`${name} — 오른쪽 위 보기 스위치(처음은 마을)`, sw.role === 'switch' && sw.checked === 'false' && sw.right < 24 && sw.top < 30 && (await page.isVisible('.nbh__village')) && !(await page.isVisible('.nbh__banners')), JSON.stringify(sw));
  await page.click('.nbh-view');
  await page.waitForTimeout(700);
  const bl = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.nbh-bl__a')];
    const r = document.querySelector('.nbh-bl').getBoundingClientRect();
    return {
      checked: document.querySelector('.nbh-view').getAttribute('aria-checked'),
      village: document.querySelector('.nbh__village').offsetParent !== null,
      n: items.length,
      links: items.every((a) => a.target === '_blank' && /noopener/.test(a.rel) && a.href),
      cols: new Set(items.map((a) => Math.round(a.getBoundingClientRect().left))).size,
      ratio: items[0].getBoundingClientRect().width / items[0].getBoundingClientRect().height,
      names: document.querySelectorAll('.nbh__banners .nbh-label, .nbh-bl__name').length,
      visibleText: items.filter((a) => !a.classList.contains('is-broken')).some((a) => a.textContent.trim() && a.querySelector('.nbh-bl__alt').offsetParent !== null),
      w: r.width,
    };
  });
  check(`${name} — 스위치 → 배너 보기: 받은 배너만 한 줄에 하나씩(5:1 · 이름 없음 · 새 탭)`, bl.checked === 'true' && !bl.village && bl.n === 3 && bl.links && bl.cols === 1 && Math.abs(bl.ratio - 5) < 0.1 && bl.names === 0 && !bl.visibleText, JSON.stringify(bl));
  if (device) check(`${name} — 배너 폭은 화면의 70%`, Math.abs(bl.w - vw * 0.7) < 2, JSON.stringify({ w: bl.w, vw }));
  await page.screenshot({ path: path.join(OUT, `neighbor-${name}-banners.png`) });
  await page.reload();
  await page.waitForSelector('.nbh.is-open', { timeout: 20000 });
  await page.waitForSelector('.nbh-bl__a', { timeout: 10000 });
  check(`${name} — 새로고침해도 배너 보기 그대로(기억)`, (await page.$eval('.nbh-view', (b) => b.getAttribute('aria-checked'))) === 'true' && !(await page.isVisible('.nbh__village')));
  await page.click('.nbh-view');
  await page.waitForTimeout(600);
  check(`${name} — 다시 누르면 마을`, (await page.$eval('.nbh-view', (b) => b.getAttribute('aria-checked'))) === 'false' && (await page.$$('.nbh-home')).length === 3);
  check(`콘솔 오류 없음(neighbor 보기 ${name})`, v.errors.length === 0, v.errors.join(' | '));
  await v.context.close();
}

async function neighborOwner() {
  const o = await open(USERS.owner, { width: 1280, height: 860 });
  const { page } = o;
  page.on('dialog', (dlg) => dlg.accept());
  const at = () => new URL(page.url()).pathname;
  const pending = db.banner_requests.find((r) => r.status === 'pending');
  await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  await villageReady(page);
  await page.click('.nbh__owner [data-act="edit"]');
  await page.waitForSelector('.nbh__owner [data-act="add"]:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.nbh__count')?.textContent === '1', null, { timeout: 10000 }).catch(() => {});
  check('주인 — edit → 집마다(홍차네 집까지) 고치기 표시 · + add banner · 받은 신청 수', (await page.$$('.nbh-home__edit')).length === 4 && (await page.textContent('.nbh__count')) === '1');

  await page.click('.nbh__owner [data-act="requests"]');
  await page.waitForSelector('.nbh-review:not([hidden]) .nbh-req', { timeout: 10000 });
  check('주인 — 받은 신청에 신청한 집 미리보기', at() === '/neighbor/banner' && (await page.$eval(`.nbh-req[data-id="${pending.id}"] .nbh-req__house svg`, (s, wall) => s.innerHTML.includes(wall), pending.house.wall)));
  await page.click(`.nbh-req[data-id="${pending.id}"] [data-ok="1"]`);
  await until(() => db.banners.some((b) => b.url === pending.site_url), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-home').length === 4, null, { timeout: 8000 }).catch(() => {});
  const h = pending.house;
  check('주인 — 승인 → 신청한 모습 그대로 마을에(맨 뒤)', (await page.$eval('.nbh-home[data-i="3"]', (b) => b.dataset.house)) === keyOf(h));
  await page.click('.nbh-panel__x');
  await page.waitForTimeout(300);

  // 기존 이웃집 고치기 — 지붕 · 색 → 저장, 기본 모양으로, 내리기
  const h0 = (await rects(page, '.nbh-home[data-i="0"] .nbh-art'))[0];
  await page.mouse.click(h0.x + h0.w / 2, h0.y + h0.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="house"]:not([hidden])', { timeout: 5000 });
  check('주인 — 집을 누르면 그 집 고치기(새 탭 아님)', (await page.textContent('.nbh-house__who')) === 'hongjiwon.love' && (await page.textContent('.nbh-panel__title')) === '이웃집 고치기');
  const exTabsGone = () => page.$eval('.nbh-tabs[data-mode="exchange"]', (t) => getComputedStyle(t).display === 'none');
  check('주인 — 이웃집 고치기 창에는 입주 신청 · 받은 신청 탭이 안 보임', await exTabsGone());
  const H = '[data-diy="house"]';
  await page.click(`${H} [data-key="roof"] [data-v="round"]`);
  await page.click(`${H} [data-key="roofColor"] [data-v="#b39ddb"]`);
  await page.click('[data-house="save"]');
  await until(() => db.banners.find((b) => b.id === 1).house?.roofColor === '#b39ddb', 8000);
  await page.waitForTimeout(400);
  check('주인 — 이웃집 모양 · 색 고치기 → 저장 · 마을에 반영', db.banners.find((b) => b.id === 1).house.roof === 'round' && (await page.$eval('.nbh-home[data-i="0"]', (b) => b.dataset.house)).includes('/round/') && (await page.$eval('.nbh-panel', (p) => p.hidden)));
  await page.mouse.click(h0.x + h0.w / 2, h0.y + h0.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="house"]:not([hidden])', { timeout: 5000 });
  await page.click('[data-house="reset"]');
  await page.click('[data-house="save"]');
  await until(() => db.banners.find((b) => b.id === 1).house === null, 8000);
  check('주인 — 기본 모양으로 → 저장(비워 두면 늘 같은 기본 모양)', db.banners.find((b) => b.id === 1).house === null);
  await page.waitForTimeout(400);
  const h2 = (await rects(page, '.nbh-home[data-i="2"] .nbh-art'))[0];
  await page.mouse.click(h2.x + h2.w / 2, h2.y + h2.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="house"]:not([hidden])', { timeout: 5000 });
  await page.click('[data-house="delete"]');
  await until(() => !db.banners.some((b) => b.id === 3), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-home').length === 3, null, { timeout: 8000 }).catch(() => {});
  check('주인 — 내리기', !db.banners.some((b) => b.id === 3) && (await page.$$('.nbh-home')).length === 3);
  // 홍차네 집 고치기 — edit 중 홍차네 집을 누르면 모양만(내용 탭 · 내리기 없음) → set_home_house
  await page.waitForTimeout(400);
  const hcr = (await rects(page, '.nbh-center .nbh-art'))[0];
  await page.mouse.click(hcr.x + hcr.w / 2, hcr.y + hcr.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="house"]:not([hidden])', { timeout: 5000 });
  check('주인 — edit 중 홍차네 집 → 홍차네 집 고치기(모양만)', (await page.textContent('.nbh-panel__title')) === 'homesweethome 고치기'
    && (await page.$eval('[data-mode="house"] [role="tablist"]', (t) => getComputedStyle(t).display === 'none')) && (await page.$eval('[data-house="delete"]', (b) => getComputedStyle(b).display === 'none')) && at() === '/neighbor');
  await page.click(`${H} [data-key="roof"] [data-v="twin"]`);
  await page.click('[data-house="save"]');
  await until(() => db.homeHouse?.roof === 'twin', 8000);
  await page.waitForFunction(() => document.querySelector('.nbh-center')?.dataset.house.includes('/twin/'), null, { timeout: 8000 }).catch(() => {});
  check('주인 — 홍차네 집 모양 저장 · 마을에 반영', db.homeHouse?.roof === 'twin' && (await page.$eval('.nbh-center', (b) => b.dataset.house)).includes('/twin/'), JSON.stringify(db.homeHouse));

  // 내용 고치기 — 집 고치기 옆 탭에서 이름 · 주소 · 배너 이미지
  await page.waitForTimeout(400);
  const h1 = (await rects(page, '.nbh-home[data-i="1"] .nbh-art'))[0];
  await page.mouse.click(h1.x + h1.w / 2, h1.y + h1.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="house"]:not([hidden])', { timeout: 5000 });
  const houseTabs = await page.$$eval('[data-house-tab]', (b) => b.map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-selected')}`).join('|'));
  check('주인 — 이웃집 고치기: 집 고치기(처음) · 내용 고치기 탭', houseTabs === '집 고치기:true|내용 고치기:false' && (await page.$eval('[data-house-pane="info"]', (x) => getComputedStyle(x).display === 'none')), houseTabs);
  await page.click('[data-house-tab="info"]');
  const I = '.nbh-form[data-form="info"]';
  const filled = [await page.inputValue(`${I} [name="name"]`), await page.inputValue(`${I} [name="url"]`), await page.inputValue(`${I} [name="image"]`)].join('|');
  check('주인 — 내용 고치기: 지금 내용이 채워져 있다 · 집 고치기는 숨김', filled === '럭키|https://luvlog.me/lucky|https://img.test/lucky.png' && (await page.$eval('[data-house-pane="shape"]', (x) => getComputedStyle(x).display === 'none')), filled);
  await page.fill(`${I} [name="name"]`, '럭키네');
  await page.fill(`${I} [name="image"]`, 'https://img.test/lucky2.png');
  await page.click(`${I} [type="submit"]`);
  await until(() => db.banners.find((b) => b.id === 2).name === '럭키네', 8000);
  await page.waitForFunction(() => document.querySelector('.nbh-home[data-i="1"] .nbh-home__tag')?.textContent === '럭키네', null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const b2 = db.banners.find((b) => b.id === 2);
  check('주인 — 내용 고치기 → 저장 · 이름표 · 배너에 반영(집 모양은 그대로)', b2.name === '럭키네' && b2.image_url === 'https://img.test/lucky2.png' && b2.url === 'https://luvlog.me/lucky' && keyOf(b2.house) === keyOf(SAVED_HOUSE)
    && (await page.textContent('.nbh-home[data-i="1"] .nbh-home__tag')) === '럭키네' && (await page.$eval('.nbh-panel', (x) => x.hidden)), JSON.stringify(b2));
  // 간판 걸기 — 집 모양까지, 이름을 비우면 사이트 제목으로
  await page.click('.nbh__owner [data-act="add"]');
  await page.waitForSelector('.nbh-panel.is-open [data-form="add"]', { timeout: 5000 });
  check('주인 — 이웃집 짓기 창에는 입주 신청 · 받은 신청 탭이 안 보임', await exTabsGone());
  const A = '.nbh-form[data-form="add"]';
  // 5:1 이 아닌 파일은 가운데를 잘라 5:1 로 올린다
  await page.setInputFiles(`${A} [name="file"]`, { name: 'tall.png', mimeType: 'image/png', buffer: png(400, 200, [200, 150, 150]) });
  await page.waitForFunction((A) => document.querySelector(`${A} .nbh-form__msg`).textContent.includes('업로드 완료'), A, { timeout: 8000 }).catch(() => {});
  const up = [...db.storage.entries()].find(([k]) => k.startsWith(`user-banners/${OWNER_ID}/category-banners/`))?.[1]?.bytes;
  const dims = up ? [up.readUInt32BE(16), up.readUInt32BE(20)] : null;
  check('주인 — 5:1 이 아닌 배너 파일은 5:1 로 잘라 올린다', dims && dims[0] === 400 && dims[1] === 80, JSON.stringify(dims));
  await page.fill(`${A} [name="url"]`, 'https://added.example');
  await page.fill(`${A} [name="image"]`, 'https://img.test/new.png');
  await page.click(`${A} [data-diy="add"] [data-key="body"] [data-v="tall"]`);
  await page.click(`${A} [type="submit"]`);
  await until(() => db.banners.some((b) => b.url === 'https://added.example/'), 8000);
  await page.waitForFunction(() => document.querySelectorAll('.nbh-home').length === 4, null, { timeout: 8000 }).catch(() => {});
  const added = db.banners.find((b) => b.url === 'https://added.example/');
  check('주인 — + add banner → 맨 뒤에 그 집 모양으로 · 이름을 비우면 사이트 제목', added?.house?.body === 'tall' && added.name === '추가된 사이트' && (await page.$eval('.nbh-home[data-i="3"]', (b) => b.dataset.house)).startsWith('tall/'), JSON.stringify(added));
  await page.click('.nbh__owner [data-act="edit"]');
  check('주인 — done → 고치기 표시 사라짐', (await page.$$('.nbh-home__edit')).length === 0);
  // 바이브.me 배너 바꾸기 — 홍차네 집 → 내 배너 → 파일 → {owner}/vibe-banner 에 덮어쓰기(hongjiwon.love /banner 는 그대로)
  await page.waitForTimeout(300);
  const hm = (await rects(page, '.nbh-center .nbh-art'))[0];
  await page.mouse.click(hm.x + hm.w / 2, hm.y + hm.h / 2);
  await page.waitForSelector('.nbh-panel.is-open [data-mode="mine"]:not([hidden])', { timeout: 5000 });
  check('주인 — 내 배너에 배너 바꾸기', !(await page.$eval('.nbh-mine__owner', (x) => x.hidden)));
  const hjBefore = db.storage.get(`user-banners/${OWNER_ID}/banner`);
  await page.setInputFiles('[data-mode="mine"] [name="mybanner"]', { name: 'vibe.png', mimeType: 'image/png', buffer: png(600, 200, [180, 200, 240]) });
  await page.waitForFunction(() => document.querySelector('.nbh-mine__msg').dataset.tone === 'done', null, { timeout: 8000 }).catch(() => {});
  const vb = db.storage.get(`user-banners/${OWNER_ID}/vibe-banner`)?.bytes;
  check('주인 — 바이브.me 배너 저장(전용 경로 · 5:1) · hongjiwon.love 배너는 그대로', vb && vb.readUInt32BE(16) === 600 && vb.readUInt32BE(20) === 120
    && db.storage.get(`user-banners/${OWNER_ID}/banner`) === hjBefore && (await page.$eval('.nbh-mine__preview img', (i) => i.getAttribute('src'))).includes('/vibe-banner?v='), vb ? `${vb.readUInt32BE(16)}x${vb.readUInt32BE(20)}` : 'none');
  check('콘솔 오류 없음(neighbor 주인)', o.errors.length === 0, o.errors.join(' | '));
  await o.context.close();
}

async function neighborShapes() {
  const saved = db.banners;
  const others = saved.filter((b) => b.category_id !== 4);
  const make = (n) => Array.from({ length: n }, (_, i) => ({ id: 1000 + i, category_id: 4, user_id: OWNER_ID, name: `이웃 ${i + 1}`, url: `https://n${i}.example`, image_url: `https://img.test/${i % 2 ? 'lucky' : 'love'}.png`, image_path: null, sort_order: i }));
  for (const [device, name] of [[null, 'PC'], [playwright.devices['iPhone 13'], '휴대폰']]) {
    const m = await open(null, device ? undefined : { width: 1280, height: 860 }, device || {});
    const { page } = m;
    let prev = null;
    for (const n of [0, 1, 3, 12, 30]) {
      db.banners = [...others, ...make(n)];
      await page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
      await page.waitForSelector('.nbh.is-open .nbh-town', { state: 'attached', timeout: 20000 });
      await villageReady(page);
      await page.waitForTimeout(300);
      const homes = await rects(page, '.nbh-home .nbh-art');
      const town = (await rects(page, '.nbh-town'))[0];
      const c = (await rects(page, '.nbh-center .nbh-art'))[0];
      const ok = homes.length === n && (await overlaps(page)).length === 0 && (await inWidth(page)) && Math.abs(center(c).x - center(town).x) < town.w * 0.14;
      check(`${name} — 이웃 ${n}채: 홍차네 집 가운데 · 겹침 없음 · 화면 폭 안`, ok, JSON.stringify({ n: homes.length, overlaps: await overlaps(page) }));
      if (n === 0) check(`${name} — 이웃 없음: 안내 · 홍차네 집 · 우체통은 그대로`, (await page.textContent('.nbh-note')).includes('아직 이웃집이 없어요') && (await page.$$('.nbh-mailbox')).length === 1);
      const scales = await page.$$eval('.nbh-home .nbh-art', (s) => s.map((x) => Math.round((x.width.baseVal.value / x.viewBox.baseVal.width) * 100) / 100));
      if (prev && n > prev.n) {
        check(`${name} — ${prev.n} → ${n}채: 집을 줄이지 않고 마을이 아래로`, town.h >= prev.h && scales.every((x) => x === prev.scale), JSON.stringify({ h: [prev.h, town.h], scale: [prev.scale, ...new Set(scales)] }));
      }
      if (homes.length) prev = { n, h: town.h, scale: scales[0] };
      if (n === 30) {
        await page.screenshot({ path: path.join(OUT, `neighbor-${name}-30.png`), fullPage: false });
        check(`${name} — 30채: 페이지가 아래로 스크롤`, await page.$eval('.nbh__scroll', (s) => s.scrollHeight > s.clientHeight + 200));
        await toBottom(page);
        const last = (await rects(page, '.nbh-home[data-i="29"] .nbh-art'))[0];
        check(`${name} — 30채: 끝까지 내리면 마지막 집`, last && last.b <= (await page.evaluate(() => innerHeight)));
      }
      if (n === 12) await page.screenshot({ path: path.join(OUT, `neighbor-${name}-12.png`) });
    }
    check(`콘솔 오류 없음(neighbor ${name} 3 · 12 · 30)`, m.errors.length === 0, m.errors.join(' | '));
    await m.context.close();
  }
  db.banners = saved;
}

async function neighbor() {
  console.log('\n[neighbor — 손그림 마을]');
  await neighborVillage(null, 'PC');
  await neighborVillage(playwright.devices['iPhone 13'], '휴대폰');
  await neighborView(null, 'PC');
  await neighborView(playwright.devices['iPhone 13'], '휴대폰');
  await neighborApply();
  await neighborOwner();
  await neighborNosite();
  await neighborShapes();

  // 모션 줄이기 — 둥실 · 위글 · 나타남 없이
  const rm = await open(null, { width: 1000, height: 800 }, { reducedMotion: 'reduce' });
  await rm.page.goto(`${VIBE_ORIGIN}/neighbor?${Q}`);
  await rm.page.waitForSelector('.nbh.is-open .nbh-home', { timeout: 20000 });
  const still = await rm.page.evaluate(() => ({
    bob: getComputedStyle(document.querySelector('.nbh-home__art')).animationName,
    pop: getComputedStyle(document.querySelector('.nbh-pop')).transitionDuration,
  }));
  const boil = [];
  for (let i = 0; i < 4; i++) { boil.push(await rm.page.$eval('.nbh', (n) => n.dataset.boil)); await rm.page.waitForTimeout(120); }
  const h = center((await rects(rm.page, '.nbh-home[data-i="0"] .nbh-art'))[0]);
  await rm.page.mouse.move(h.x, h.y);
  await rm.page.waitForTimeout(150);
  check('모션 줄이기 — 둥실 · 위글 · 나타남 없이, 배너는 그대로 보인다', still.bob === 'none' && still.pop === '0s' && boil.every((b) => b === '0') && (await popOpen(rm.page)), JSON.stringify({ still, boil }));
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

// ---------- 방 창 머리(사진 · 제목 · 검정 알약) — 주인만 edit ----------

const openNotice = (page) => page.evaluate(() => document.querySelector('.hsh-plan').dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room: 'living', label: 'notice', name: '공지', bg: '#e4d4fb', fg: '#34b468' } })));
const headLook = (page) => page.evaluate(() => ({
  edit: !document.querySelector('.hsh-win__edit').hidden,
  head: getComputedStyle(document.querySelector('.hsh-win__head')).display !== 'none',
  title: document.querySelector('.hsh-win__title').textContent,
  pill: document.querySelector('.hsh-win__pill').textContent,
  thumb: document.querySelector('.hsh-win__thumb').style.backgroundImage,
}));

async function heads() {
  console.log('\n[방 창 머리 — 주인만 edit]');
  for (const [name, user] of [['방문자', null], ['다른 Google 계정', USERS.other]]) {
    const { page, context, errors } = await open(user);
    await home(page);
    await openNotice(page);
    await page.waitForTimeout(1500);
    const h = await headLook(page);
    check(`${name} — edit 안 보임 · 기본 머리(notice · 이름표 · 공지 사진)`, !h.edit && h.head && h.title === 'notice' && h.pill === '@3tatichearts · 수아' && h.thumb.includes('notice-thumb'), JSON.stringify(h));
    check(`콘솔 오류 없음(머리 ${name})`, errors.length === 0, errors.join(' | '));
    await context.close();
  }

  const o = await open(USERS.owner);
  // 실제 로그인처럼 저장된 로그인 자리를 둔다(흉내 세션은 이 자리를 쓰지 않는다) — 있을 때만 주인인지 본다
  await o.context.addInitScript(() => localStorage.setItem('sb-iokdgqzfprtggsnrusez-auth-token', '{}'));
  await home(o.page);
  await openNotice(o.page);
  await o.page.waitForSelector('.hsh-win__edit:not([hidden])', { timeout: 15000 });
  const editBox = await o.page.$eval('.hsh-win__edit', (b) => { const r = b.getBoundingClientRect(); const f = b.closest('.hsh-win__body').getBoundingClientRect(); return { right: f.right - r.right, top: r.top - f.top }; });
  check('주인 — 창 오른쪽 위에 작은 edit', editBox.right < 20 && editBox.top < 16, JSON.stringify(editBox));
  await o.page.click('.hsh-win__edit');
  await o.page.waitForSelector('.hsh-win__editor:not([hidden])');
  check('주인 — 고치기 창: 빈 칸에 지금 기본값이 안내로', (await o.page.$eval('[name="head-title"]', (i) => i.placeholder)) === 'notice' && (await o.page.$eval('[name="head-pill"]', (i) => i.placeholder)) === '@3tatichearts · 수아');
  await o.page.screenshot({ path: path.join(OUT, 'heads-editor.png') });
  await o.page.fill('[name="head-title"]', '공지사항');
  await o.page.fill('[name="head-pill"]', 'E2E 알약');
  await o.page.fill('[name="st-min"]', '7');
  await o.page.fill('[name="st-max"]', '5');
  await o.page.setInputFiles('[name="photo"]', { name: 'wide.png', mimeType: 'image/png', buffer: png(300, 200, [200, 120, 160]) });
  await o.page.click('.hsh-win__ed-save');
  await until(() => db.site_settings.some((r) => r.key === 'vibe_room_heads'), 10000);
  await o.page.waitForSelector('.hsh-win__editor[hidden]', { state: 'attached', timeout: 10000 });
  const saved = JSON.parse(db.site_settings.find((r) => r.key === 'vibe_room_heads')?.value || '{}').notice || {};
  const photoKey = `user-banners/${saved.imagePath}`;
  const photo = db.storage.get(photoKey);
  let h = await headLook(o.page);
  check('주인 — 저장 → 제목 · 검정 알약 · 사진이 바로 바뀜', h.title === '공지사항' && h.pill === 'E2E 알약' && h.thumb.includes('/vibe-rooms/'), JSON.stringify(h));
  const n1 = (await o.page.$$eval('.hsh-win__deco', (d) => d.length));
  check('주인 — 스티커 개수 7 ~ 5 → 5 ~ 7 로 맞춰 저장, 바로 그만큼 다시 붙음', n1 >= 5 && n1 <= 7, String(n1));
  check('주인 — site_settings(vibe_room_heads) 한 칸 · 사진은 내 폴더 vibe-rooms 에 정사각형으로', saved.title === '공지사항' && saved.pill === 'E2E 알약' && saved.stickers?.join('~') === '5~7' && saved.imagePath?.startsWith(`${OWNER_ID}/vibe-rooms/`) && photo && pngSize(Buffer.from(photo.bytes)).w === 200 && pngSize(Buffer.from(photo.bytes)).h === 200, JSON.stringify(saved));

  // 머리 숨기기 — edit 는 그대로 남는다
  await o.page.click('.hsh-win__edit');
  await o.page.check('[name="headless"]');
  await o.page.fill('[name="st-min"]', '0');
  await o.page.fill('[name="st-max"]', '');
  await o.page.click('.hsh-win__ed-save');
  await o.page.waitForSelector('.hsh-win__editor[hidden]', { state: 'attached', timeout: 10000 });
  h = await headLook(o.page);
  check('주인 — 상단 바 숨기기 → 사진 · 제목 · 알약 줄이 빠지고 edit 는 남음', !h.head && h.edit, JSON.stringify(h));
  check('주인 — 스티커 한 칸만 0 → 딱 0개', (await o.page.$$eval('.hsh-win__deco', (d) => d.length)) === 0);

  // Esc — 고치기 창만 닫힌다
  await o.page.click('.hsh-win__edit');
  await o.page.keyboard.press('Escape');
  await o.page.waitForTimeout(300);
  check('주인 — Esc 는 고치기 창만 닫는다', (await o.page.$eval('.hsh-win__editor', (f) => f.hidden)) && !(await o.page.$eval('.hsh-win', (w) => w.hidden)));

  // 방문자에게도 고친 머리가
  const v = await open(null);
  await home(v.page);
  await openNotice(v.page);
  await v.page.waitForTimeout(1500);
  h = await headLook(v.page);
  check('방문자 — 주인이 숨긴 머리는 안 보임 · edit 없음 · 스티커 0개', !h.head && !h.edit && (await v.page.$$eval('.hsh-win__deco', (d) => d.length)) === 0, JSON.stringify(h));
  await v.context.close();

  // 되돌리기 — 사진 지우기 · 칸 비우기 · 숨기기 끄기 → 기본값, 예전 사진은 지운다
  await o.page.click('.hsh-win__edit');
  await o.page.click('[data-ed="clear"]');
  await o.page.fill('[name="head-title"]', '');
  await o.page.fill('[name="head-pill"]', '');
  await o.page.uncheck('[name="headless"]');
  await o.page.fill('[name="st-min"]', '');
  await o.page.fill('[name="st-max"]', '');
  await o.page.click('.hsh-win__ed-save');
  await o.page.waitForSelector('.hsh-win__editor[hidden]', { state: 'attached', timeout: 10000 });
  await until(() => !db.storage.has(photoKey), 5000);
  h = await headLook(o.page);
  const back = JSON.parse(db.site_settings.find((r) => r.key === 'vibe_room_heads')?.value || '{}');
  check('주인 — 다 비우면 기본 머리로 · 예전 사진 지움', h.head && h.title === 'notice' && h.pill === '@3tatichearts · 수아' && h.thumb.includes('notice-thumb') && !back.notice && !db.storage.has(photoKey), JSON.stringify({ h, back }));

  // about — 스크롤바는 길 없이 창 오른쪽 끝 · 집은 반 크기 · 문 없이 꽉
  await o.page.keyboard.press('Escape');
  await o.page.waitForTimeout(500);
  await o.page.setViewportSize({ width: 390, height: 700 }); // 글이 넘쳐 스크롤바가 나오게
  await o.page.evaluate(() => document.querySelector('.hsh-plan').dispatchEvent(new CustomEvent('hsh:room', { bubbles: true, detail: { room: 'v', label: 'about __VE', name: '지원 · 우연 소개', bg: '#fbefae', fg: '#e8893a' } })));
  await o.page.waitForTimeout(1200);
  const ab = await o.page.evaluate(() => {
    const rail = document.querySelector('.hsh-win__rail');
    const body = document.querySelector('.hsh-win__body').getBoundingClientRect();
    const house = document.querySelector('.hsh-ab__house');
    const rows = house.textContent.split('\n');
    return {
      railShown: !rail.hidden && (() => { const k = document.querySelector('.hsh-win__knob').getBoundingClientRect(); return document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2) === document.querySelector('.hsh-win__knob'); })(),
      railBg: getComputedStyle(rail).backgroundImage, railGap: body.right - rail.getBoundingClientRect().right,
      size: parseFloat(getComputedStyle(house).fontSize),
      half: Math.max(8.5, Math.min(innerWidth * 0.029, 13)) / 2, // 예전 clamp(8.5px, 2.9vw, 13px) 의 반
      holes: rows.slice(-5).some((r) => r.trim().includes(' ')),
      font: getComputedStyle(document.querySelector('.hsh-ab__text')).fontFamily,
      lh: parseFloat(getComputedStyle(document.querySelector('.hsh-ab__text')).lineHeight) / 14,
    };
  });
  check('about — 스크롤바: 가운데 선 없이 창 오른쪽 끝(테두리 안쪽)에 딱', ab.railShown && ab.railBg === 'none' && ab.railGap >= 0 && ab.railGap <= 1.5, JSON.stringify(ab));
  check('about — 집 반 크기 · 문 없이 벽이 꽉', Math.abs(ab.size - ab.half) < 0.05 && !ab.holes, JSON.stringify(ab));
  await o.page.waitForTimeout(800); // 한글 글꼴(Google Fonts)이 오도록
  await o.page.screenshot({ path: path.join(OUT, 'heads-about.png') });
  check('about — 글은 로딩 글꼴(Nanum Gothic Coding) · 줄간격 1.8', ab.font.includes('HSH Hand KR') && ab.font.includes('Nanum Gothic Coding') && Math.abs(ab.lh - 1.8) < 0.01, JSON.stringify(ab));
  check('콘솔 오류 없음(머리 주인)', o.errors.length === 0, o.errors.join(' | '));
  await o.context.close();
}

try {
  if (!ONLY || ONLY === 'heads') await heads();
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
  plainServer.close();
  globalThis.fetch = realFetch;
}
process.exit(summary() ? 0 : 1);
