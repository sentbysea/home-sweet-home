// 배너 교환 패널 — 우체통을 누르면(주소 /neighbor/banner) 열린다.
//   ① 내 배너: 바이브.me 배너 미리보기 · 이름 · 주소 · 이미지 주소 · 삽입 코드(각각 복사)
//   ② 교환 신청: 사이트 이름 · 주소 · 배너 이미지 주소 · 메시지(선택) → submit_banner_request.
//      신청은 대기 목록으로만 — 공개 이웃 목록에는 주인이 승인해야 걸린다.
//      입력 검사(칸마다 안내) · 이미지가 실제로 열리는지 · 보내는 동안 다시 못 누름 · 실패하면 그대로 두고 다시 시도 안내.
//   ③ 받은 신청(주인만): 미리보기 · 메시지 · 승인 / 거절.
//   주인의 '+ add banner'(직접 걸기)도 같은 패널을 쓴다(mode 'add').

import { MY_BANNER, bannerCode, httpUrl, submitRequest, listRequests, reviewRequest, uploadImage, removeImage, addBanner } from './data.js';

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
        <section class="nbh-sec" data-mode="exchange" aria-labelledby="nbh-mine-h">
          <h4 class="nbh-tag" id="nbh-mine-h" style="--c:var(--hsh-sky)">내 배너</h4>
          <div class="nbh-mine__preview"><img src="${esc(MY_BANNER.image)}" alt="${esc(MY_BANNER.name)} 배너" width="3000" height="600" decoding="async"></div>
          <dl class="nbh-mine__rows">${rows}
            <div class="nbh-mine__row is-code">
              <dt>삽입 코드</dt>
              <dd><code class="nbh-mine__code">${esc(code)}</code><button class="nbh-copy" type="button" data-copy="${esc(code)}">복사</button></dd>
            </div>
          </dl>
        </section>
        <section class="nbh-sec" data-mode="exchange" aria-labelledby="nbh-apply-h">
          <h4 class="nbh-tag" id="nbh-apply-h" style="--c:var(--hsh-pink)">교환 신청</h4>
          <p class="nbh-sec__note">신청하면 주인이 확인한 뒤 이웃 간판으로 걸려요.</p>
          <form class="nbh-form" data-form="apply" novalidate>
            <label class="nbh-field"><span class="nbh-field__k">사이트 이름</span>
              <input name="name" maxlength="40" autocomplete="off" required aria-describedby="nbh-e-name"><small class="nbh-field__err" id="nbh-e-name"></small></label>
            <label class="nbh-field"><span class="nbh-field__k">사이트 주소</span>
              <input name="url" type="url" inputmode="url" autocomplete="url" placeholder="https://" required aria-describedby="nbh-e-url"><small class="nbh-field__err" id="nbh-e-url"></small></label>
            <label class="nbh-field"><span class="nbh-field__k">배너 이미지 주소</span>
              <input name="image" type="url" inputmode="url" autocomplete="off" placeholder="https://" required aria-describedby="nbh-e-image"><small class="nbh-field__err" id="nbh-e-image"></small></label>
            <div class="nbh-form__preview" hidden><img alt="신청할 배너 미리보기"></div>
            <label class="nbh-field"><span class="nbh-field__k">메시지 <em>선택</em></span>
              <textarea name="message" maxlength="300" rows="2" aria-describedby="nbh-e-message"></textarea><small class="nbh-field__err" id="nbh-e-message"></small></label>
            <p class="nbh-form__msg" role="status" aria-live="polite"></p>
            <div class="nbh-form__actions">
              <button class="nbh-btn" type="submit">신청하기</button>
              <button class="nbh-btn is-ghost" type="button" data-act="again" hidden>다른 사이트 신청</button>
            </div>
          </form>
        </section>
        <section class="nbh-sec nbh-review" data-mode="exchange" data-owner hidden aria-labelledby="nbh-review-h">
          <h4 class="nbh-tag" id="nbh-review-h" style="--c:var(--hsh-butter)">받은 신청 <span class="nbh-review__n"></span></h4>
          <ul class="nbh-review__list"></ul>
          <p class="nbh-review__msg" role="status" aria-live="polite"></p>
        </section>
        <section class="nbh-sec" data-mode="add" hidden aria-labelledby="nbh-add-h">
          <h4 class="nbh-tag" id="nbh-add-h" style="--c:var(--hsh-mint)">간판 걸기</h4>
          <form class="nbh-form" data-form="add" novalidate>
            <label class="nbh-field"><span class="nbh-field__k">사이트 이름 <em>선택</em></span><input name="name" maxlength="40" autocomplete="off"></label>
            <label class="nbh-field"><span class="nbh-field__k">사이트 주소</span><input name="url" type="url" inputmode="url" placeholder="https://" required></label>
            <label class="nbh-field"><span class="nbh-field__k">배너 이미지 주소</span><input name="image" type="url" inputmode="url" placeholder="이미지 주소 또는 아래 파일"></label>
            <label class="nbh-file"><input name="file" type="file" accept="image/*"><span>파일 올리기</span></label>
            <div class="nbh-form__preview" hidden><img alt="걸 배너 미리보기"></div>
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
  const review = root.querySelector('.nbh-review');
  const reviewList = root.querySelector('.nbh-review__list');
  const reviewMsg = root.querySelector('.nbh-review__msg');
  const reviewN = root.querySelector('.nbh-review__n');
  let mode = null;
  let back = null;
  let sending = false;
  let uploaded = null; // { path, url } — 주인 간판 걸기에서 올린 파일

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
    ok = fieldErr(apply, 'name', !name ? '사이트 이름을 적어 주세요.' : name.length > 40 ? '40자 안으로 적어 주세요.' : '') && ok;
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
    ok: ['신청했어요 ♡ 주인이 확인하면 이웃 간판으로 걸려요.', 'done'],
    pending: ['이미 신청된 사이트예요. 주인이 확인할 때까지 기다려 주세요.', 'done'],
    listed: ['이미 이웃 목록에 걸려 있는 사이트예요.', 'done'],
    busy: ['지금은 신청이 많아요. 잠시 뒤 다시 보내 주세요.', 'error'],
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
    say(applyMsg, '보내는 중…');
    let result;
    try {
      result = await submitRequest(v);
    } catch (err) {
      console.error(err);
      setSending(false);
      say(applyMsg, '보내지 못했어요. 연결을 확인하고 다시 눌러 주세요. 적은 내용은 그대로 있어요.', 'error');
      return;
    }
    setSending(false);
    if (String(result).startsWith('invalid:')) {
      const field = { site_name: 'name', site_url: 'url', image_url: 'image', message: 'message' }[result.slice(8)] || 'url';
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
    if (!session().owner) { review.hidden = true; return; }
    review.hidden = mode !== 'exchange';
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
      say(reviewMsg, r === 'approved' ? '간판을 걸었어요.' : r === 'rejected' ? '거절했어요.' : '이미 처리된 신청이에요.', 'done');
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
      await addBanner(s.user.id, { name: add.elements.name.value.trim(), url, imageUrl, imagePath: address ? null : uploaded.path }, banners());
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

  const discardUpload = () => {
    if (mode === 'add' && uploaded) removeImage(session().user.id, uploaded.path).catch(() => {});
    uploaded = null;
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
    /** @param {'exchange' | 'add'} next  @param {Element | null} from 닫으면 포커스를 돌려줄 곳 */
    open(next, from = null) {
      if (mode === next && !root.hidden) return;
      if (mode === 'add' && next !== 'add') discardUpload();
      mode = next;
      back = from;
      title.textContent = next === 'add' ? '간판 걸기' : '배너 교환';
      root.querySelectorAll('[data-mode]').forEach((s) => { s.hidden = s.dataset.mode !== next || (s.hasAttribute('data-owner') && !session().owner); });
      say(addMsg, '');
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('is-open');
      sheet.scrollTop = 0;
      sheet.focus({ preventScroll: true });
      if (next === 'exchange') loadRequests();
    },
    close,
    /** 받은 신청 칸까지 내려 보기 */
    showRequests() {
      review.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    },
    /** 주인인지 바뀌었을 때 — 받은 신청 수만 다시 센다 */
    refreshCount() {
      if (session().owner) loadRequests();
    },
  };
}
