// neighbor 패널 — 우체통(주소 /neighbor/banner)은 배너 교환, 홍차네 집(/neighbor/mine)은 내 배너.
//   ① 내 배너(mode 'mine'): 바이브.me 배너 미리보기 · 이름 · 주소 · 이미지 주소 · 삽입 코드(각각 복사)
//   ② 교환 신청: 사이트 이름 · 주소 · 배너 이미지 주소 · 메시지(선택) → submit_banner_request.
//      신청은 대기 목록으로만 — 공개 이웃 목록에는 주인이 승인해야 걸린다.
//      입력 검사(칸마다 안내) · 이미지가 실제로 열리는지 · 보내는 동안 다시 못 누름 · 실패하면 그대로 두고 다시 시도 안내.
//   ③ 받은 신청(주인만): 미리보기 · 메시지 · 승인 / 거절.
//   ④ 우리 집 꾸미기(customizer.js) — 신청에 집 모양을 같이 보낸다. 승인하면 그 모습으로 마을에.
//   주인의 '+ add banner'(직접 걸기 · mode 'add')와 이웃집 고치기(mode 'house')도 같은 패널.
//     이웃집 고치기는 탭 둘: 집 고치기(모양 · 색 · 기본 모양으로 · 내리기) · 내용 고치기(이름 · 주소 · 배너 이미지).
//     홍차네 집 고치기(item.home)는 모양만 — 내용 탭 · 내리기 없이, 저장은 set_home_house.

import { MY_BANNER, bannerCode, httpUrl, siteLabel, submitRequest, listRequests, reviewRequest, uploadImage, removeImage, addBanner, setHouse, setHomeHouse, updateBanner, deleteBanner, siteTitle } from './data.js';
import { mountCustomizer } from './customizer.js';
import { houseSvg, normalizeHouse, defaultHouse, randomHouse, HOME_HOUSE } from './house-art.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SENT_KEY = 'hsh:nbh-sent';

/** 클립보드에 — 안 되는 브라우저(오래된 iOS · http)는 숨긴 textarea 로 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* 아래로 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  try { document.execCommand('copy'); } catch { /* 복사 못 해도 조용히 */ }
  ta.remove();
}

/** 주소 칸 — 'example.com' 처럼 적으면 https:// 를 붙여 준다 */
function withScheme(value) {
  const t = String(value || '').trim();
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  return /^[^\s/]+\.[^\s/]+/.test(t) ? `https://${t.replace(/^\/+/, '')}` : t;
}

const siteKey = (url) => String(url).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#]+$/, '');

const readSent = () => {
  try { return JSON.parse(sessionStorage.getItem(SENT_KEY)) || []; } catch { return []; }
};
const writeSent = (list) => {
  try { sessionStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-20))); } catch { /* 이번 화면에서만 */ }
};

const MINE_ROWS = [
  ['사이트 이름', MY_BANNER.name],
  ['주소', MY_BANNER.site],
  ['배너 이미지', MY_BANNER.image],
];

function markup() {
  const rows = MINE_ROWS.map(([k, v]) => `
    <div class="nbh-mine__row">
      <dt>${k}</dt>
      <dd><span class="nbh-mine__val">${esc(v)}</span><button class="nbh-copy" type="button" data-copy="${esc(v)}">복사</button></dd>
    </div>`).join('');
  const code = bannerCode();
  return `
    <div class="nbh-panel__veil" data-panel-close></div>
    <section class="nbh-panel__sheet" role="dialog" aria-modal="true" aria-labelledby="nbh-panel-title" tabindex="-1">
      <header class="nbh-panel__head">
        <h3 class="nbh-panel__title" id="nbh-panel-title">배너 교환</h3>
        <button class="nbh-panel__x" type="button" data-panel-close aria-label="닫기"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2L10 10M10 2L2 10"/></svg></button>
      </header>
      <div class="nbh-panel__body">
        <div class="nbh-tabs" data-mode="exchange" role="tablist" aria-label="배너 교환">
          <button class="nbh-tag nbh-tabs__tab" type="button" role="tab" id="nbh-extab-apply" aria-controls="nbh-ex-apply" aria-selected="true" data-ex-tab="apply" style="--c:var(--hsh-pink)">교환 신청</button>
          <button class="nbh-tag nbh-tabs__tab" type="button" role="tab" id="nbh-extab-review" aria-controls="nbh-ex-review" aria-selected="false" tabindex="-1" data-ex-tab="review" data-owner hidden style="--c:var(--hsh-butter)">받은 신청 <span class="nbh-review__n"></span></button>
        </div>
        <section class="nbh-sec" data-mode="exchange" data-ex="apply" id="nbh-ex-apply" role="tabpanel" aria-labelledby="nbh-extab-apply">
          <p class="nbh-sec__note">신청하면 주인이 확인한 뒤 마을에 이웃집으로 지어져요.</p>
          <form class="nbh-form" data-form="apply" novalidate>
            <label class="nbh-field"><span class="nbh-field__k">사이트 이름 <em>선택 · 마을에서 집 아래 이름표 · 비우면 사이트 제목으로</em></span>
              <input name="name" maxlength="40" autocomplete="off" aria-describedby="nbh-e-name"><small class="nbh-field__err" id="nbh-e-name"></small></label>
            <label class="nbh-field"><span class="nbh-field__k">사이트 주소</span>
              <input name="url" type="url" inputmode="url" autocomplete="url" placeholder="https://" required aria-describedby="nbh-e-url"><small class="nbh-field__err" id="nbh-e-url"></small></label>
            <label class="nbh-field"><span class="nbh-field__k">배너 이미지 주소</span>
              <input name="image" type="url" inputmode="url" autocomplete="off" placeholder="https://" required aria-describedby="nbh-e-image"><small class="nbh-field__err" id="nbh-e-image"></small></label>
            <div class="nbh-form__preview" hidden><img alt="신청할 배너 미리보기"></div>
            <div class="nbh-field"><span class="nbh-field__k">우리 집 꾸미기 <em>승인되면 마을에 이 모습으로 지어져요</em></span><div data-diy="apply"></div></div>
            <label class="nbh-field"><span class="nbh-field__k">메시지 <em>선택</em></span>
              <textarea name="message" maxlength="300" rows="2" aria-describedby="nbh-e-message"></textarea><small class="nbh-field__err" id="nbh-e-message"></small></label>
            <p class="nbh-form__msg" role="status" aria-live="polite"></p>
            <div class="nbh-form__actions">
              <button class="nbh-btn" type="submit">신청하기</button>
              <button class="nbh-btn is-ghost" type="button" data-act="again" hidden>다른 사이트 신청</button>
            </div>
          </form>
        </section>
        <section class="nbh-sec" data-mode="mine" aria-label="내 배너" hidden>
          <div class="nbh-mine__preview"><img src="${esc(MY_BANNER.image)}" alt="${esc(MY_BANNER.name)} 배너" width="3000" height="600" decoding="async"></div>
          <dl class="nbh-mine__rows">${rows}
            <div class="nbh-mine__row is-code">
              <dt>삽입 코드</dt>
              <dd><code class="nbh-mine__code">${esc(code)}</code><button class="nbh-copy" type="button" data-copy="${esc(code)}">복사</button></dd>
            </div>
          </dl>
        </section>
        <section class="nbh-sec nbh-review" data-mode="exchange" data-ex="review" data-owner id="nbh-ex-review" role="tabpanel" aria-labelledby="nbh-extab-review" hidden>
          <ul class="nbh-review__list"></ul>
          <p class="nbh-review__msg" role="status" aria-live="polite"></p>
        </section>
        <section class="nbh-sec" data-mode="add" hidden aria-labelledby="nbh-add-h">
          <h4 class="nbh-tag" id="nbh-add-h" style="--c:var(--hsh-mint)">이웃집 짓기</h4>
          <form class="nbh-form" data-form="add" novalidate>
            <label class="nbh-field"><span class="nbh-field__k">사이트 이름 <em>선택 · 비우면 사이트 제목으로</em></span><input name="name" maxlength="40" autocomplete="off"></label>
            <label class="nbh-field"><span class="nbh-field__k">사이트 주소</span><input name="url" type="url" inputmode="url" placeholder="https://" required></label>
            <label class="nbh-field"><span class="nbh-field__k">배너 이미지 주소</span><input name="image" type="url" inputmode="url" placeholder="이미지 주소 또는 아래 파일"></label>
            <label class="nbh-file"><input name="file" type="file" accept="image/*"><span>파일 올리기</span></label>
            <div class="nbh-form__preview" hidden><img alt="걸 배너 미리보기"></div>
            <div class="nbh-field"><span class="nbh-field__k">집 모양</span><div data-diy="add"></div></div>
            <p class="nbh-form__msg" role="status" aria-live="polite"></p>
            <div class="nbh-form__actions">
              <button class="nbh-btn is-ghost" type="button" data-panel-close>취소</button>
              <button class="nbh-btn" type="submit">저장</button>
            </div>
          </form>
        </section>
        <section class="nbh-sec" data-mode="house" hidden aria-label="이웃집 고치기">
          <div class="nbh-tabs" role="tablist" aria-label="고칠 것">
            <button class="nbh-tag nbh-tabs__tab" type="button" role="tab" id="nbh-tab-shape" aria-controls="nbh-pane-shape" aria-selected="true" data-house-tab="shape" style="--c:var(--hsh-lilac)">집 고치기</button>
            <button class="nbh-tag nbh-tabs__tab" type="button" role="tab" id="nbh-tab-info" aria-controls="nbh-pane-info" aria-selected="false" tabindex="-1" data-house-tab="info" style="--c:var(--hsh-sky)">내용 고치기</button>
          </div>
          <p class="nbh-sec__note nbh-house__who"></p>
          <div class="nbh-house__pane" id="nbh-pane-shape" role="tabpanel" aria-labelledby="nbh-tab-shape" data-house-pane="shape">
            <div data-diy="house"></div>
            <p class="nbh-form__msg nbh-house__msg" role="status" aria-live="polite"></p>
            <div class="nbh-form__actions">
              <button class="nbh-btn is-ghost" type="button" data-house="delete">내리기</button>
              <button class="nbh-btn is-ghost" type="button" data-house="reset">기본 모양으로</button>
              <button class="nbh-btn" type="button" data-house="save">저장</button>
            </div>
          </div>
          <form class="nbh-form nbh-house__pane" id="nbh-pane-info" role="tabpanel" aria-labelledby="nbh-tab-info" data-house-pane="info" data-form="info" hidden novalidate>
            <label class="nbh-field"><span class="nbh-field__k">사이트 이름 <em>선택 · 비우면 사이트 제목으로</em></span><input name="name" maxlength="40" autocomplete="off"></label>
            <label class="nbh-field"><span class="nbh-field__k">사이트 주소</span><input name="url" type="url" inputmode="url" placeholder="https://" required></label>
            <label class="nbh-field"><span class="nbh-field__k">배너 이미지 주소</span><input name="image" type="url" inputmode="url" placeholder="이미지 주소 또는 아래 파일"></label>
            <label class="nbh-file"><input name="file" type="file" accept="image/*"><span>파일 올리기</span></label>
            <div class="nbh-form__preview" hidden><img alt="배너 미리보기"></div>
            <p class="nbh-form__msg" role="status" aria-live="polite"></p>
            <div class="nbh-form__actions">
              <button class="nbh-btn is-ghost" type="button" data-panel-close>취소</button>
              <button class="nbh-btn" type="submit">저장</button>
            </div>
          </form>
        </section>
      </div>
    </section>`;
}

/** 미리보기 칸 — 주소가 바뀌면 다시 불러오고, 열리는지 기다릴 수 있다 */
function previewer(box) {
  const img = box.querySelector('img');
  let src = '';
  let status = 'none'; // none | loading | ok | error
  let waiters = [];
  const settle = (s) => { status = s; waiters.forEach((w) => w(s)); waiters = []; };
  img.addEventListener('load', () => { if (img.getAttribute('src') === src) settle('ok'); });
  img.addEventListener('error', () => { if (img.getAttribute('src') === src) settle('error'); });
  return {
    set(next) {
      if (next === src) return;
      src = next;
      box.hidden = !next;
      if (!next) { img.removeAttribute('src'); settle('none'); return; }
      status = 'loading';
      img.src = next;
    },
    get status() { return status; },
    get ratio() { return img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0; },
    /** 다 불러올 때까지(최대 ms) */
    wait(ms = 8000) {
      if (status !== 'loading') return Promise.resolve(status);
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve('timeout'), ms);
        waiters.push((s) => { clearTimeout(t); resolve(s); });
      });
    },
  };
}

/**
 * @param {HTMLElement} root  비어 있는 칸(.nbh-panel)
 * @param {{ reduced?: boolean, session: () => { user: any, owner: boolean }, banners: () => any[], onClose: () => void, onChanged: () => Promise<void> | void, onCount?: (n: number) => void }} opts
 */
export function mountPanel(root, { reduced = false, session, banners, onClose, onChanged, onCount = () => {} }) {
  root.innerHTML = markup();
  const sheet = root.querySelector('.nbh-panel__sheet');
  const title = root.querySelector('.nbh-panel__title');
  const apply = root.querySelector('[data-form="apply"]');
  const applyMsg = apply.querySelector('.nbh-form__msg');
  const applyBtn = apply.querySelector('[type="submit"]');
  const againBtn = apply.querySelector('[data-act="again"]');
  const applyPreview = previewer(apply.querySelector('.nbh-form__preview'));
  const add = root.querySelector('[data-form="add"]');
  const addMsg = add.querySelector('.nbh-form__msg');
  const addPreview = previewer(add.querySelector('.nbh-form__preview'));
  const reviewList = root.querySelector('.nbh-review__list');
  const reviewMsg = root.querySelector('.nbh-review__msg');
  const reviewN = root.querySelector('.nbh-review__n');
  let mode = null;
  let back = null;
  let sending = false;
  let uploaded = null; // { path, url } — 주인 간판 걸기에서 올린 파일
  let editing = null; // 고치는 이웃집(mode 'house')

  // 우리 집 꾸미기 — 신청 · 간판 걸기 · 집 고치기
  const imageOf = (form) => () => httpUrl(withScheme(form.image.value)) || '';
  // 미리보기 이름표 — 적은 이름, 비었으면 주소(마을과 같이)
  const nameOf = (form) => () => form.elements.name.value.trim() || (httpUrl(withScheme(form.url.value)) ? siteLabel({ url: httpUrl(withScheme(form.url.value)) }) : '');
  const diyApply = mountCustomizer(root.querySelector('[data-diy="apply"]'), { imageUrl: imageOf(apply), nameOf: nameOf(apply) });
  const diyAdd = mountCustomizer(root.querySelector('[data-diy="add"]'), { imageUrl: () => httpUrl(withScheme(add.image.value)) || uploaded?.url || '', nameOf: nameOf(add) });
  const houseBox = root.querySelector('[data-mode="house"]');
  const houseMsg = houseBox.querySelector('.nbh-house__msg');
  const diyHouse = mountCustomizer(houseBox.querySelector('[data-diy="house"]'), { imageUrl: () => (editing?.home ? MY_BANNER.image : httpUrl(withScheme(info.image.value)) || infoUploaded?.url || editing?.image || ''), nameOf: () => (editing ? (editing.home ? editing.label : nameOf(root.querySelector('[data-form="info"]'))() || editing.label) : '') });
  const info = root.querySelector('[data-form="info"]');
  const infoMsg = info.querySelector('.nbh-form__msg');
  const infoPreview = previewer(info.querySelector('.nbh-form__preview'));
  let infoUploaded = null; // { path, url } — 내용 고치기에서 새로 올린 파일
  apply.image.addEventListener('input', () => diyApply.bannerChanged());
  add.image.addEventListener('input', () => diyAdd.bannerChanged());
  for (const [form, diy] of [[apply, diyApply], [add, diyAdd]]) {
    for (const n of ['name', 'url']) form.elements[n].addEventListener('input', () => diy.renamed());
  }

  // ---------- 복사 ----------

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    await copyText(btn.dataset.copy);
    btn.textContent = '복사됨 ♡';
    btn.classList.add('is-done');
    clearTimeout(btn.timer);
    btn.timer = setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('is-done'); }, 1400);
  });

  // ---------- 신청 ----------

  const fieldErr = (form, name, text) => {
    const input = form.elements[name];
    const err = input.closest('.nbh-field')?.querySelector('.nbh-field__err');
    input.setAttribute('aria-invalid', String(Boolean(text)));
    if (err) err.textContent = text || '';
    return !text;
  };

  const say = (el, text, tone = '') => {
    el.textContent = text;
    el.dataset.tone = tone;
  };

  const syncApplyPreview = () => {
    const a = httpUrl(withScheme(apply.image.value));
    applyPreview.set(a || '');
  };
  apply.image.addEventListener('input', syncApplyPreview);
  for (const name of ['url', 'image']) {
    apply.elements[name].addEventListener('blur', () => {
      const v = withScheme(apply.elements[name].value);
      if (v !== apply.elements[name].value) { apply.elements[name].value = v; if (name === 'image') syncApplyPreview(); }
    });
  }
  apply.addEventListener('input', (e) => {
    if (e.target.name) fieldErr(apply, e.target.name, '');
    if (applyMsg.dataset.tone === 'error') say(applyMsg, '');
  });

  const validateApply = () => {
    const name = apply.elements.name.value.trim();
    const url = httpUrl(withScheme(apply.url.value));
    const image = httpUrl(withScheme(apply.image.value));
    const message = apply.message.value.trim();
    let ok = true;
    ok = fieldErr(apply, 'name', name.length > 40 ? '40자 안으로 적어 주세요.' : '') && ok;
    ok = fieldErr(apply, 'url', !url ? 'http:// 또는 https:// 로 시작하는 주소를 적어 주세요.' : !/^https?:\/\/[^/?#]+\.[^/?#]+/i.test(url) ? '사이트 주소를 다시 확인해 주세요.' : '') && ok;
    ok = fieldErr(apply, 'image', !image ? 'http:// 또는 https:// 로 시작하는 이미지 주소를 적어 주세요.' : '') && ok;
    ok = fieldErr(apply, 'message', message.length > 300 ? '300자 안으로 적어 주세요.' : '') && ok;
    return ok ? { name, url, image, message } : null;
  };

  const setSending = (on) => {
    sending = on;
    applyBtn.disabled = on;
    applyBtn.textContent = on ? '보내는 중…' : '신청하기';
    apply.setAttribute('aria-busy', String(on));
  };

  const RESULT = {
    ok: ['신청했어요 ♡ 주인이 확인하면 마을에 우리 집이 지어져요.', 'done'],
    pending: ['이미 신청된 사이트예요. 주인이 확인할 때까지 기다려 주세요.', 'done'],
    listed: ['이미 이웃 목록에 걸려 있는 사이트예요.', 'done'],
    busy: ['지금은 신청이 많아요. 잠시 뒤 다시 보내 주세요.', 'error'],
    unavailable: ['아직 신청을 저장할 수 없어요 — 교환 신청을 준비하는 중이에요. 위의 내 배너 정보 복사는 지금도 쓸 수 있어요.', 'error'],
  };

  apply.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const v = validateApply();
    if (!v) { apply.querySelector('[aria-invalid="true"]')?.focus(); say(applyMsg, '빨간 안내를 확인해 주세요.', 'error'); return; }
    apply.url.value = v.url;
    apply.image.value = v.image;
    syncApplyPreview();
    // 이번 창에서 이미 보낸 사이트 — 서버도 막지만 두 번 부르지 않게
    if (readSent().includes(siteKey(v.url))) { finishApply('pending'); return; }
    setSending(true);
    say(applyMsg, '배너 이미지를 확인하는 중…');
    const img = await applyPreview.wait();
    if (img !== 'ok') {
      setSending(false);
      fieldErr(apply, 'image', img === 'timeout' ? '이미지를 확인하지 못했어요. 다시 눌러 주세요.' : '이미지를 불러오지 못했어요. 주소를 확인해 주세요.');
      say(applyMsg, '');
      apply.image.focus();
      return;
    }
    if (!v.name) { say(applyMsg, '사이트 제목을 찾는 중…'); v.name = await siteTitle(v.url); }
    say(applyMsg, '보내는 중…');
    let result;
    try {
      result = await submitRequest({ ...v, house: diyApply.value });
    } catch (err) {
      console.error(err);
      setSending(false);
      say(applyMsg, '보내지 못했어요. 연결을 확인하고 다시 눌러 주세요. 적은 내용은 그대로 있어요.', 'error');
      return;
    }
    setSending(false);
    if (String(result).startsWith('invalid:')) {
      const field = { site_name: 'name', site_url: 'url', image_url: 'image', message: 'message' }[result.slice(8)];
      // 집 모양 · 모르는 칸 — 적은 칸 탓이 아니니 칸에 빨간 안내를 달지 않는다
      if (!field) { say(applyMsg, '우리 집 모양을 저장하지 못했어요. 잠시 뒤 다시 보내 주세요. 적은 내용 · 꾸민 집은 그대로 있어요.', 'error'); return; }
      fieldErr(apply, field, '형식을 다시 확인해 주세요.');
      say(applyMsg, '빨간 안내를 확인해 주세요.', 'error');
      apply.elements[field].focus();
      return;
    }
    if (result === 'ok' || result === 'pending') writeSent([...readSent(), siteKey(v.url)]);
    finishApply(result);
  });

  const finishApply = (result) => {
    const [text, tone] = RESULT[result] || ['보내지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error'];
    say(applyMsg, text, tone);
    if (tone === 'done') {
      apply.classList.add('is-sent');
      applyBtn.hidden = true;
      againBtn.hidden = false;
      for (const el of apply.elements) if (el.name) el.disabled = true;
    }
  };

  const resetApply = () => {
    apply.reset();
    apply.classList.remove('is-sent');
    for (const el of apply.elements) if (el.name) { el.disabled = false; fieldErr(apply, el.name, ''); }
    applyBtn.hidden = false;
    againBtn.hidden = true;
    say(applyMsg, '');
    applyPreview.set('');
    diyApply.set(randomHouse());
    diyApply.bannerChanged();
  };
  againBtn.addEventListener('click', () => { resetApply(); apply.elements.name.focus(); });

  // ---------- 받은 신청(주인) ----------

  const date = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  let requests = [];
  const paintReview = () => {
    reviewN.textContent = requests.length ? String(requests.length) : '';
    onCount(requests.length);
    reviewList.innerHTML = requests.map((r) => {
      const url = httpUrl(r.site_url) || '';
      return `
      <li class="nbh-req" data-id="${esc(r.id)}">
        <div class="nbh-req__img"><img src="${esc(httpUrl(r.image_url) || '')}" alt="${esc(r.site_name)} 배너" loading="lazy" decoding="async"></div>
        <div class="nbh-req__house" title="신청한 집">${houseSvg(normalizeHouse(r.house) || defaultHouse(r.site_url), { scale: 0.9, seed: 5, cls: 'nbh-req__art' }).svg}</div>
        <p class="nbh-req__name">${esc(r.site_name)} <a href="${esc(url || '#')}" target="_blank" rel="noopener noreferrer">${esc(r.site_url)} ↗</a></p>
        ${r.message ? `<p class="nbh-req__msg">${esc(r.message)}</p>` : ''}
        <p class="nbh-req__date">${date(r.created_at)}</p>
        <div class="nbh-req__act">
          <button class="nbh-btn is-ghost" type="button" data-review="${esc(r.id)}" data-ok="0">거절</button>
          <button class="nbh-btn" type="button" data-review="${esc(r.id)}" data-ok="1">승인</button>
        </div>
      </li>`;
    }).join('');
    if (!requests.length) say(reviewMsg, '기다리는 신청이 없어요.');
  };

  const loadRequests = async () => {
    if (!session().owner) { if (exNow === 'review') exTab('apply'); return; }
    say(reviewMsg, '불러오는 중…');
    try {
      requests = await listRequests();
      say(reviewMsg, '');
    } catch (err) {
      console.error(err);
      requests = [];
      say(reviewMsg, '신청 목록을 불러오지 못했어요.', 'error');
      return;
    }
    paintReview();
  };

  reviewList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-review]');
    if (!btn) return;
    const id = Number(btn.dataset.review);
    const ok = btn.dataset.ok === '1';
    const item = btn.closest('.nbh-req');
    item.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    say(reviewMsg, ok ? '거는 중…' : '거절하는 중…');
    try {
      const r = await reviewRequest(id, ok);
      requests = requests.filter((x) => Number(x.id) !== id);
      paintReview();
      say(reviewMsg, r === 'approved' ? '마을에 집을 지었어요.' : r === 'rejected' ? '거절했어요.' : '이미 처리된 신청이에요.', 'done');
      if (r === 'approved') await onChanged();
    } catch (err) {
      console.error(err);
      item.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      say(reviewMsg, '처리하지 못했어요. 다시 눌러 주세요.', 'error');
    }
  });

  // ---------- 간판 걸기(주인) ----------

  add.file.addEventListener('change', async () => {
    const file = add.file.files?.[0];
    const s = session();
    if (!file || !s.owner) return;
    say(addMsg, '업로드 중…');
    try {
      uploaded = await uploadImage(s.user.id, file, uploaded?.path);
    } catch (err) {
      console.error(err);
      say(addMsg, '업로드하지 못했어요.', 'error');
      add.file.value = '';
      return;
    }
    add.file.value = '';
    add.image.value = ''; // 마지막에 고른 쪽이 저장된다
    say(addMsg, '업로드 완료 ♡', 'done');
    addPreview.set(`${uploaded.url}?t=${Date.now()}`);
  });
  add.image.addEventListener('input', () => {
    const a = httpUrl(withScheme(add.image.value));
    addPreview.set(a === '' ? (uploaded ? `${uploaded.url}?t=1` : '') : a || '');
  });

  add.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = session();
    const url = httpUrl(withScheme(add.url.value));
    const address = httpUrl(withScheme(add.image.value));
    if (!url) { say(addMsg, '사이트 주소는 http:// 또는 https:// 로 시작해야 해요.', 'error'); return; }
    if (address === null) { say(addMsg, '이미지 주소는 http:// 또는 https:// 로 시작해야 해요.', 'error'); return; }
    const imageUrl = address || uploaded?.url;
    if (!imageUrl) { say(addMsg, '이미지 주소를 적거나 파일을 올려 주세요.', 'error'); return; }
    const submit = add.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await addBanner(s.user.id, { name: add.elements.name.value.trim() || await siteTitle(url), url, imageUrl, imagePath: address ? null : uploaded.path, house: diyAdd.value }, banners());
    } catch (err) {
      console.error(err);
      submit.disabled = false;
      say(addMsg, '저장하지 못했어요. 다시 눌러 주세요.', 'error');
      return;
    }
    submit.disabled = false;
    // 주소로 저장했으면 이번에 올렸다 안 쓴 파일은 지운다
    if (address && uploaded) removeImage(s.user.id, uploaded.path).catch(() => {});
    uploaded = null;
    add.reset();
    addPreview.set('');
    say(addMsg, '');
    close();
    await onChanged();
  });

  // ---------- 이웃집 고치기(주인) ----------

  const houseBusy = (on) => houseBox.querySelectorAll('[data-house]').forEach((b) => { b.disabled = on; });
  houseBox.addEventListener('click', async (e) => {
    const act = e.target.closest('button[data-house]')?.dataset.house;
    if (!act || !editing) return;
    const base = editing.home ? HOME_HOUSE : defaultHouse(editing.id); // 기본 모양
    if (act === 'reset') { diyHouse.set(base); say(houseMsg, '기본 모양으로 바꿨어요. 저장을 눌러야 마을에 반영돼요.'); return; }
    if (act === 'delete' && !confirm(`'${editing.label}' 이웃집을 내릴까요?`)) return;
    houseBusy(true);
    say(houseMsg, act === 'save' ? '저장하는 중…' : '내리는 중…');
    try {
      if (act === 'save') {
        const same = JSON.stringify(diyHouse.value) === JSON.stringify(normalizeHouse(base));
        // 기본 모양 그대로면 비워 둔다(id 로 · 홍차네 집은 HOME_HOUSE 로 늘 같은 모양)
        if (editing.home) await setHomeHouse(same ? null : diyHouse.value);
        else await setHouse(editing.id, same ? null : diyHouse.value);
      } else {
        await deleteBanner(session().user.id, editing.banner);
      }
    } catch (err) {
      console.error(err);
      houseBusy(false);
      say(houseMsg, act === 'save' ? '저장하지 못했어요. 다시 눌러 주세요.' : '내리지 못했어요. 다시 눌러 주세요.', 'error');
      return;
    }
    houseBusy(false);
    say(houseMsg, '');
    close();
    await onChanged();
  });

  // ---------- 이웃집 내용 고치기(주인) ----------

  const houseTab = (tab) => {
    houseBox.querySelectorAll('[data-house-tab]').forEach((b) => {
      const on = b.dataset.houseTab === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    houseBox.querySelectorAll('[data-house-pane]').forEach((p) => { p.hidden = p.dataset.housePane !== tab; });
  };
  houseBox.querySelector('[role="tablist"]').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-house-tab]');
    if (tab) houseTab(tab.dataset.houseTab);
  });
  houseBox.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = houseBox.querySelector('[data-house-tab][aria-selected="false"]');
    houseTab(next.dataset.houseTab);
    next.focus();
  });

  // ---------- 배너 교환 탭(교환 신청 · 내 배너 · 받은 신청) ----------

  const exBar = root.querySelector('.nbh-tabs[data-mode="exchange"]');
  let exNow = 'apply';
  const exTab = (tab) => {
    if (tab === 'review' && !session().owner) tab = 'apply';
    exNow = tab;
    exBar.querySelectorAll('[data-ex-tab]').forEach((b) => {
      const on = b.dataset.exTab === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (b.hasAttribute('data-owner')) b.hidden = !session().owner;
    });
    root.querySelectorAll('[data-ex]').forEach((sec) => { sec.hidden = mode !== 'exchange' || sec.dataset.ex !== tab; });
  };
  exBar.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-ex-tab]');
    if (tab) exTab(tab.dataset.exTab);
  });
  exBar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const all = [...exBar.querySelectorAll('[data-ex-tab]:not([hidden])')];
    const at = all.findIndex((b) => b.dataset.exTab === exNow);
    const next = all[(at + (e.key === 'ArrowLeft' ? -1 : 1) + all.length) % all.length];
    exTab(next.dataset.exTab);
    next.focus();
  });

  const discardInfoUpload = () => {
    if (infoUploaded) removeImage(session().user.id, infoUploaded.path).catch(() => {});
    infoUploaded = null;
  };
  const fillInfo = () => {
    discardInfoUpload();
    const b = editing.banner;
    info.elements.name.value = b.name || '';
    info.url.value = b.url || '';
    info.image.value = b.image_url || '';
    infoPreview.set(httpUrl(b.image_url) || '');
    say(infoMsg, '');
  };

  info.file.addEventListener('change', async () => {
    const file = info.file.files?.[0];
    const s = session();
    if (!file || !s.owner) return;
    say(infoMsg, '업로드 중…');
    try {
      infoUploaded = await uploadImage(s.user.id, file, infoUploaded?.path);
    } catch (err) {
      console.error(err);
      say(infoMsg, '업로드하지 못했어요.', 'error');
      info.file.value = '';
      return;
    }
    info.file.value = '';
    info.image.value = ''; // 마지막에 고른 쪽이 저장된다
    say(infoMsg, '업로드 완료 ♡', 'done');
    infoPreview.set(`${infoUploaded.url}?t=${Date.now()}`);
    diyHouse.bannerChanged();
  });
  for (const n of ['name', 'url']) info.elements[n].addEventListener('input', () => diyHouse.renamed());
  info.image.addEventListener('input', () => {
    const a = httpUrl(withScheme(info.image.value));
    infoPreview.set(a === '' ? (infoUploaded ? `${infoUploaded.url}?t=1` : '') : a || '');
    diyHouse.bannerChanged();
  });

  info.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editing) return;
    const s = session();
    const b = editing.banner;
    const url = httpUrl(withScheme(info.url.value));
    const address = httpUrl(withScheme(info.image.value));
    if (!url) { say(infoMsg, '사이트 주소는 http:// 또는 https:// 로 시작해야 해요.', 'error'); return; }
    if (address === null) { say(infoMsg, '이미지 주소는 http:// 또는 https:// 로 시작해야 해요.', 'error'); return; }
    // 이미지: 적힌 주소가 그대로면 이전 것(올린 파일이면 그 경로까지), 새 주소면 주소만, 비우고 파일을 올렸으면 그 파일
    let image;
    if (address && address === httpUrl(b.image_url)) image = { imageUrl: b.image_url, imagePath: b.image_path };
    else if (address) image = { imageUrl: address, imagePath: null };
    else if (infoUploaded) image = { imageUrl: infoUploaded.url, imagePath: infoUploaded.path };
    else { say(infoMsg, '이미지 주소를 적거나 파일을 올려 주세요.', 'error'); return; }
    const submit = info.querySelector('[type="submit"]');
    submit.disabled = true;
    say(infoMsg, '저장하는 중…');
    let name = info.elements.name.value.trim();
    if (!name) name = await siteTitle(url);
    try {
      await updateBanner(s.user.id, b.id, { name, url, ...image });
    } catch (err) {
      console.error(err);
      submit.disabled = false;
      say(infoMsg, '저장하지 못했어요. 다시 눌러 주세요.', 'error');
      return;
    }
    submit.disabled = false;
    // 쓰지 않게 된 파일 — 이전에 올린 이미지 · 이번에 올렸다 안 쓴 것
    if (b.image_path && b.image_path !== image.imagePath) removeImage(s.user.id, b.image_path).catch(() => {});
    if (infoUploaded && infoUploaded.path !== image.imagePath) removeImage(s.user.id, infoUploaded.path).catch(() => {});
    infoUploaded = null;
    say(infoMsg, '');
    close();
    await onChanged();
  });

  const discardUpload = () => {
    if (mode === 'add' && uploaded) removeImage(session().user.id, uploaded.path).catch(() => {});
    uploaded = null;
    if (mode === 'house') discardInfoUpload();
  };

  // ---------- 열고 닫기 ----------

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-panel-close]')) { e.preventDefault(); close(); }
  });
  // Esc · Tab 은 패널 안에서
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...sheet.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function close({ silent = false } = {}) {
    if (root.hidden) return;
    discardUpload();
    root.classList.remove('is-open');
    const done = () => { root.hidden = true; };
    if (reduced) done();
    else setTimeout(done, 180);
    const was = mode;
    mode = null;
    back?.focus?.({ preventScroll: true });
    if (!silent) onClose(was);
  }

  return {
    get mode() { return mode; },
    /**
     * @param {'exchange' | 'mine' | 'add' | 'house'} next  @param {Element | null} from 닫으면 포커스를 돌려줄 곳
     * @param {{ item?: { id: any, label: string, image: string, house?: object | null, banner?: object, home?: boolean } }} extra  house — 고칠 집(home — 홍차네 집)
     */
    open(next, from = null, extra = {}) {
      if (next === 'house') {
        if (mode === 'house') discardInfoUpload();
        editing = extra.item;
        houseTab(extra.tab || 'shape');
        if (!editing.home) fillInfo();
        // 홍차네 집은 모양만 — 내용 탭 · 내리기 없음
        houseBox.querySelector('[role="tablist"]').hidden = Boolean(editing.home);
        houseBox.querySelector('[data-house="delete"]').hidden = Boolean(editing.home);
        diyHouse.set(normalizeHouse(editing.house) || (editing.home ? HOME_HOUSE : defaultHouse(editing.id)));
        diyHouse.bannerChanged();
        houseBox.querySelector('.nbh-house__who').textContent = editing.label;
        say(houseMsg, '');
        houseBusy(false);
      }
      if (mode === next && !root.hidden && next !== 'house') return;
      if (mode === 'add' && next !== 'add') discardUpload();
      mode = next;
      back = from;
      title.textContent = next === 'add' ? '이웃집 짓기' : next === 'house' ? (editing.home ? '홍차네 집 고치기' : '이웃집 고치기') : next === 'mine' ? '내 배너' : '배너 교환';
      root.querySelectorAll('[data-mode]').forEach((s) => { s.hidden = s.dataset.mode !== next || (s.hasAttribute('data-owner') && !session().owner); });
      say(addMsg, '');
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('is-open');
      sheet.scrollTop = 0;
      sheet.focus({ preventScroll: true });
      if (next === 'exchange') { exTab(extra.tab || 'apply'); loadRequests(); }
    },
    close,
    /** 받은 신청 칸까지 내려 보기 */
    showRequests() {
      exTab('review');
    },
    /** 주인인지 바뀌었을 때 — 받은 신청 수만 다시 센다 */
    refreshCount() {
      if (session().owner) loadRequests();
    },
  };
}
