/* «Ответошная» — источники отзывов (только в программе).
   Вход в кабинеты — в окне программы, один раз. Сбор — скрытым окном теми же скриптами,
   что использует нынешний сбор; результат пишется в реестр, низкие оценки — в тревоги. */
(function () {
  "use strict";
  if (!window.__OTV_APP) return;
  var T = window.__TAURI__, invoke = T.core.invoke, listen = T.event.listen;
  var DAYS = 14;
  /* журнал работы: только события и ошибки (без текстов отзывов, писем и имён) */
  function jlog(line) { try { invoke("log_append", { line: String(line).slice(0, 500) }).catch(function () {}); } catch (e) {} }
  window.__otvLog = jlog;
  window.addEventListener("error", function (e) { jlog("ошибка страницы: " + (e && e.message || "") + " @" + String(e && e.filename || "").split("/").pop() + ":" + (e && e.lineno || "")); });
  window.addEventListener("unhandledrejection", function (e) { jlog("ошибка (promise): " + String(e && e.reason && (e.reason.message || e.reason) || "").slice(0, 200)); });

  /* ---------- скрипты площадок (выполняются на странице кабинета) ---------- */
  async function PD() {
    const days = 14, cutoff = Date.now() - days * 864e5, out = [];
    for (let p = 1; p <= 10; p++) {
      const r = await fetch(`/api/cabinet/rates/?lpu=21011&page=${p}`, { credentials: 'include' }).then(r => r.json());
      const items = r.results || r.items || r.data || r;
      if (!Array.isArray(items) || !items.length) break;
      let older = 0;
      for (const it of items) {
        const t = Date.parse(it.dt_created);
        if (t < cutoff) { older++; continue; }
        const published = it.rate_status === 'accepted' && it.avg_rate !== '' && it.avg_rate != null;
        const r5 = published ? Math.round((Number(it.avg_rate) + 3) * 10) / 10 : null;
        out.push({
          id: 'pd-' + it.id, platform: 'ПроДокторов', published, status: it.rate_status,
          page: it.rate_type === 'ratelpu' ? 'Страница больницы' : it.name,
          date: it.dt_created.slice(0, 10), time: it.dt_created.slice(11, 16), rating: r5, threshold: 4,
          low: published && r5 < 4, author: '',
          text: [it.comment, it.comment_plus, it.comment_minus].filter(Boolean).join('\n').slice(0, 20000),
          answered: !!it.answer_moderation_status,
          // текст ответа больницы, если площадка его отдаёт и он не отклонён модерацией
          reply: /reject|declin|delet|отклон/i.test(String(it.answer_moderation_status || '')) ? '' : ([it.answer, it.answer_text, it.lpu_answer, it.answer_comment, it.answer && it.answer.text, it.answer && it.answer.comment].find(v => typeof v === 'string' && v.trim().length > 10) || '').trim(),
          link: `https://prodoctorov.ru/cabinet/lpu-rates/${it.rate_type}/${it.id}/?lpu=21011`
        });
      }
      if (older === items.length) break;
    }
    return out;
  }

  async function YA() {
    const days = 14, cutoff = Date.now() - days * 864e5;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    if (/временно недоступен|технического сбоя/i.test((document.body && document.body.innerText || '').slice(0, 600))) throw new Error('сбой у площадки: кабинет Яндекс Бизнеса временно не работает');
    if (/showcaptcha|captcha/i.test(location.href) || document.querySelector('.CheckboxCaptcha, .SmartCaptcha, form[action*="captcha"]')) throw new Error('нужен вход: Яндекс просит подтвердить, что вы не робот');
    if ([...document.querySelectorAll('input[type=password]')].some(e => e.offsetParent)) throw new Error('нужен вход в Яндекс');
    const find = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 8) return null;
      if (Array.isArray(o)) { if (o.length && o[0] && typeof o[0] === 'object' && 'time_created' in o[0] && 'rating' in o[0]) return o; }
      for (const k of Object.keys(o)) { const r = find(o[k], depth + 1); if (r) return r; }
      return null;
    };
    let items = null;
    for (let i = 0; i < 20 && !items; i++) {
      const pd = window.__PRELOAD_DATA;
      try { items = pd.initialState.edit.reviews.list.items; } catch (e) { items = null; }
      if (!Array.isArray(items)) items = pd ? find(pd, 0) : null;
      if (!items) await sleep(500);
    }
    if (!items) throw new Error('не нашла список отзывов на странице Яндекса');
    const msk = t => new Date(t + 3 * 3600e3).toISOString();
    // у одного автора может быть несколько отзывов: второй и дальше получают своё имя (первый сохраняет прежнее)
    const seenYa = {};
    return items.filter(x => x.time_created >= cutoff).sort((a, b) => a.time_created - b.time_created).map(x => {
      const base = 'ya-' + (x.author && x.author.public_id || x.time_created), id = seenYa[base] ? base + '-' + x.time_created : base; seenYa[base] = 1;
      return ({
      id: id, platform: 'Яндекс', published: true,
      page: 'Карточка больницы', date: msk(x.time_created).slice(0, 10), time: msk(x.time_created).slice(11, 16),
      rating: x.rating, threshold: 4, low: x.rating < 4,
      author: x.author && x.author.user || '', text: (x.full_text || '').slice(0, 20000),
      answered: !!(x.owner_comment && x.owner_comment.text),
      reply: (x.owner_comment && x.owner_comment.text || '').trim(),
      link: x.author && x.author.public_id ? 'https://yandex.ru/maps/org/1022361531/reviews?reviews%5BpublicId%5D=' + x.author.public_id + '&utm_source=review' : 'https://yandex.ru/maps/org/1022361531/reviews/'
    }); });
  }

  async function GIS() {
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    const M = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 };
    const days = 14, cutoff = Date.now() - days * 864e5, out = [];
    for (const f of document.querySelectorAll('[class*="rating__front"]')) {
      let c = f;
      for (let i = 0; i < 12 && c; i++) { c = c.parentElement; if (c && [...c.querySelectorAll('*')].some(b => b.children.length === 0 && b.textContent.trim() === 'Ответить')) break; }
      if (!c) continue;
      const rating = Math.round(parseFloat(f.style.width) / 90 * 50) / 10;
      const lines = c.innerText.split('\n').map(s => s.trim()).filter(Boolean);
      const dl = lines.find(l => /^\d{1,2} [а-я]+ \d{4}/.test(l)) || '';
      const m = dl.match(/^(\d{1,2}) ([а-я]+) (\d{4})/);
      const d = m ? new Date(+m[3], M[m[2]], +m[1]) : null;
      if (!d || d.getTime() < cutoff) continue;
      const i0 = lines.indexOf(dl);
      const text = lines.slice(i0 + 1).filter(l => !/^(Писцовая|Планетная|Отзыв (не )?подтверждён)/.test(l)).join(' ').split('Больница №24')[0].trim();
      const iso = `${m[3]}-${String(M[m[2]] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      out.push({ id: '2gis-' + iso + '-' + h((lines[0] || '') + text), platform: '2ГИС', published: true, page: 'Карточка больницы',
        date: iso, time: '', rating, threshold: 4.5, low: rating < 4.5, author: lines[0] || '', text: text.slice(0, 20000),
        answered: /С уважением|Здравствуйте/.test(c.innerText), link: location.href });
    }
    return out;
  }

  async function DOCTU() {
    // открытая страница больницы на doctu.ru: все отзывы о больнице и её врачах, новые сверху
    const M = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 };
    const days = 14, cutoff = Date.now() - days * 864e5, out = [];
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    const short = s => { const p = s.trim().split(/\s+/); return p.length >= 3 ? p[0] + ' ' + p[1][0] + '.' + p[2][0] + '.' : s.trim(); };
    const all = [...document.querySelectorAll('.review-teaser')];
    for (const t of all) {
      const q = s => t.querySelector(s);
      const dt = ((q('.review-teaser__date') || {}).innerText || '').trim().toLowerCase();
      const m = dt.match(/(\d{1,2})\s+([а-я]+)\s+(\d{4})/);
      if (!m || M[m[2]] == null) continue;
      const d = new Date(+m[3], M[m[2]], +m[1]);
      if (d.getTime() < cutoff) continue;
      const iso = `${m[3]}-${String(M[m[2]] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      const rating = parseFloat(((q('.review-teaser__rating .rating') || {}).textContent || '').replace(',', '.'));
      const docEl = q('.review-teaser__doctor_name a') || q('a.review-teaser__doctor_name') || q('.review-teaser__doctor_name');
      const doctor = docEl ? (docEl.innerText || '').trim() : '';
      const href = docEl && docEl.href ? docEl.href : location.href.split('#')[0];
      const text = ((q('.review-teaser__desc') || {}).innerText || '').trim();
      const ans = q('.review-teaser__answer_answer');
      out.push({ id: 'doctu-' + iso + '-' + (doctor ? href.split('/').pop() : 'clinic-' + h(text)), platform: 'ДокТу', published: true,
        page: doctor ? 'Карточка врача: ' + short(doctor) : 'Карточка больницы', date: iso, time: '', rating, threshold: 4, low: rating < 4,
        author: ((q('.review-teaser__name') || {}).innerText || 'Пациент').trim(), text: text.slice(0, 20000),
        answered: !!(ans && ans.innerText.trim()), reply: ans ? ans.innerText.trim() : '', link: doctor ? href + '#feedback' : href });
    }
    return { items: out, seen: all.length };
  }


  async function GOOGLE() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    const ageDays = (s) => {
      s = String(s || '').toLowerCase();
      if (/минут|час|сегодня|только что/.test(s)) return 0;
      if (/вчера/.test(s)) return 1;
      let m = s.match(/(\d+)?\s*(день|дня|дней)\s+назад/); if (m) return +(m[1] || 1);
      m = s.match(/(\d+)?\s*(неделю|недели|недель)\s+назад/); if (m) return 7 * +(m[1] || 1);
      m = s.match(/(\d+)?\s*(месяц|месяца|месяцев)\s+назад/); if (m) return 30 * +(m[1] || 1);
      m = s.match(/(\d+)?\s*(год|года|лет)\s+назад/); if (m) return 365 * +(m[1] || 1);
      return 999;
    };
    const starRe = /(\d(?:[.,]\d)?)\s*(?:из|out of)\s*5/i;
    const docs = () => [document].concat([...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch (e) { return null; } }).filter(Boolean));
    const findStars = () => {
      const res = [];
      for (const d of docs()) for (const e of d.querySelectorAll('[aria-label]')) {
        const a = e.getAttribute('aria-label') || '';
        if (!starRe.test(a) || !/звезд|star|оценк|рейтинг/i.test(a)) continue;
        const rel = ((e.nextElementSibling || {}).textContent || '').trim();
        if (ageDays(rel) === 999) continue;
        res.push({ e, a, rel });
      }
      return res;
    };
    let stars = findStars();
    // окно отзывов открывается по ссылке не сразу — ждём до 20 секунд
    for (let i = 0; i < 27 && !stars.length; i++) { await sleep(750); stars = findStars(); }
    if (!stars.length) {
      const btn = [...document.querySelectorAll('a,button,[role="button"],[role="link"],span,div')]
        .find(e => e.children.length < 3 && /^(Посмотреть|Читать|Показать)( все)? отзывы$|^Отзывы( в Google)?$|^Отзывы о компании$/i.test((e.textContent || '').trim()));
      if (btn) { btn.click(); await sleep(6500); stars = findStars(); }
    }
    if (!stars.length) throw new Error('на странице Google не видно отзывов. Откройте их в окне «Войти» и нажмите «Проверить», пока окно открыто');
    const out = [];
    for (const { e, a, rel } of stars) {
      const age = ageDays(rel);
      if (age > 14) continue;
      const rating = parseFloat(a.match(starRe)[1].replace(',', '.'));
      let c = e;
      for (let i = 0; i < 10 && c; i++) { c = c.parentElement; if (c && /open_in_new|Владелец|Посмотреть весь отзыв/.test(c.innerText) && c.innerText.length > 40) break; }
      if (!c) continue;
      // длинный отзыв Google показывает началом с кнопкой «Ещё»: раскрываем, чтобы прочитать целиком
      const more = [...c.querySelectorAll('a,button,[role="button"],span')].filter(x => x.children.length === 0 && /^(Ещё|Читать (далее|полностью)|More|Read more)$/i.test((x.textContent || '').trim()));
      if (more.length) { more.forEach(x => { try { x.click(); } catch (er) {} }); await sleep(700); }
      const t = c.innerText;
      const author = (t.split('open_in_new')[0].trim().split('\n').pop() || '').trim();
      const text = (t.split(rel)[1] || '').split(/24 Московская больница|Владелец/)[0].replace('НОВЫЙ ФИЛИАЛ', '').replace(/Посмотреть весь отзыв/g, '').trim();
      const dt = new Date(Date.now() + 3 * 3600e3 - age * 864e5).toISOString().slice(0, 10);
      out.push({ id: 'google-' + h(author + text), platform: 'Google', published: true, page: 'Карточка больницы',
        date: dt, dateApprox: age > 1, time: '', rating, threshold: 4.5, low: rating < 4.5, author, text: text.slice(0, 20000),
        answered: /Владелец/.test(t), reply: /Владелец/.test(t) ? (t.split(/Ответ владельца|Владелец/).pop() || '').split('\n').slice(1).join('\n').replace(/Посмотреть весь отзыв|Ещё/g, '').trim() : '', link: location.href });
    }
    return { items: out, seen: stars.length };
  }



  async function NP() {
    const days = 14, cutoff = Date.now() - days * 864e5, out = [];
    if (!/sort=published/.test(location.search)) {
      const byDate = [...document.querySelectorAll('.listing-sort__link')].find(e => /по дате/.test(e.textContent));
      if (byDate) { byDate.click(); await new Promise(r => setTimeout(r, 3000)); }
    }
    const short = s => { const p = s.trim().split(/\s+/); return p.length >= 3 ? p[0] + ' ' + p[1][0] + '.' + p[2][0] + '.' : s.trim(); };
    for (const r of document.querySelectorAll('.review')) {
      const head = (r.querySelector('.review__header') || {}).innerText || '';
      const m = head.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!m) continue;
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      if (Date.parse(iso) < cutoff) continue;
      const rating = r.querySelectorAll('.review__rating .n-rating__star--active').length || null;
      const obj = r.querySelector('.review__object');
      const doc = obj ? [...obj.querySelectorAll('a[href*="/doctor-profile/"]')].map(a => a.textContent.trim()).find(Boolean) : '';
      const author = ((r.querySelector('.review__user') || {}).innerText || '').split('\n')[0].trim();
      const text = ((r.querySelector('.review__text') || {}).innerText || '').trim();
      out.push({ id: 'np-' + r.id.replace(/\D/g, ''), platform: 'НаПоправку', published: true,
        page: doc ? 'Страница врача: ' + short(doc) : 'Страница больницы', date: iso, time: '', rating, threshold: 4.5,
        low: rating != null && rating < 4.5, author, text: text.slice(0, 20000),
        answered: !!r.querySelector('.review-comment__wrapper--answer'), reply: ((r.querySelector('.review-comment__wrapper--answer') || {}).innerText || '').trim(), link: location.origin + location.pathname + '#' + r.id });
    }
    return { items: out, seen: document.querySelectorAll('.review').length };
  }


  /* ---------- свой источник: любой сайт с отзывами ---------- */
  // Общий сборщик: карточки отзывов по селектору, дата и оценка — по распространённым признакам.
  async function GENERIC(cfg, allDays) {
    const days = allDays || 14, cutoff = Date.now() - days * 864e5, out = [];
    const MON = { янв: 0, фев: 1, мар: 2, апр: 3, ма: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };
    function parseDate(t) {
      t = String(t || '').toLowerCase(); let m;
      if ((m = t.match(/(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
      if ((m = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/))) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
      if ((m = t.match(/(\d{1,2})\s+(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-я]*\.?(?:\s+(\d{4}))?/))) {
        const k = m[2].startsWith('ма') ? 'ма' : m[2]; const y = m[3] ? +m[3] : new Date().getFullYear(); return new Date(y, MON[k], +m[1]);
      }
      if (/сегодня|минут\S* назад|час\S* назад/.test(t)) return new Date();
      if (/вчера/.test(t)) return new Date(Date.now() - 864e5);
      if ((m = t.match(/(\d+)\s*(?:дн|день|дня|дней)\S*\s+назад/))) return new Date(Date.now() - m[1] * 864e5);
      if ((m = t.match(/(\d+)?\s*недел\S*\s+назад/))) return new Date(Date.now() - (m[1] || 1) * 7 * 864e5);
      return null;
    }
    function rating(c) {
      const a = c.querySelector('[itemprop="ratingValue"]');
      if (a) { const v = parseFloat((a.getAttribute('content') || a.textContent).replace(',', '.')); if (!isNaN(v)) return v; }
      const al = [...c.querySelectorAll('[aria-label],[title]')].map(x => x.getAttribute('aria-label') || x.getAttribute('title') || '').find(s => /\d([.,]\d)?\s*(из|out of|\/)\s*5/.test(s));
      if (al) return parseFloat(al.match(/(\d(?:[.,]\d)?)/)[1].replace(',', '.'));
      const st = c.querySelectorAll('[class*="star"][class*="active"],[class*="star"][class*="fill"],[class*="star"][class*="full"],[class*="star"][class*="checked"]');
      if (st.length && st.length <= 5) return st.length;
      const m = (c.innerText || '').match(/\b([1-5](?:[.,]\d)?)\s*(?:\/|из)\s*5\b/);
      return m ? parseFloat(m[1].replace(',', '.')) : null;
    }
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    for (const c of document.querySelectorAll(cfg.item)) {
      const tEl = cfg.text ? c.querySelector(cfg.text) : c;
      const text = ((tEl || c).innerText || '').trim();
      if (text.length < 5) continue;
      const d = parseDate(c.innerText);
      if (!d || d.getTime() < cutoff) continue;
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
      const r = rating(c);
      const aEl = c.querySelector('[itemprop="author"],[class*="author"],[class*="user"],[class*="name"]');
      const cid = (c.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      out.push({ id: cfg.prefix + '-' + (cid || iso + '-' + h(text)), platform: cfg.name, published: true, page: cfg.page || 'Страница',
        date: iso, time: '', rating: r, threshold: cfg.threshold, low: r != null && r < cfg.threshold,
        author: aEl ? (aEl.innerText || '').split('\n')[0].trim().slice(0, 80) : '', text: text.slice(0, 20000), answered: false,
        link: location.href.split('#')[0] + (cid ? '#' + cid : '') });
    }
    return out;
  }

  // Подсказка на странице сайта: «нажмите на текст любого отзыва» → программа сама находит остальные.
  function PICKER(ID, GEN) {
    if (window.__otvPick) return; window.__otvPick = true;
    const bar = document.createElement('div');
    Object.assign(bar.style, { position: 'fixed', left: '12px', right: '12px', top: '12px', zIndex: 2147483647, background: '#262130', color: '#efeaf6',
      border: '2px solid #ff9fcf', borderRadius: '12px', padding: '12px 14px', font: '15px/1.4 -apple-system,system-ui,sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,.35)' });
    const msg = document.createElement('span'); bar.append(msg);
    const btns = document.createElement('span'); btns.style.marginLeft = '12px'; bar.append(btns);
    function button(text, fn, primary) {
      const b = document.createElement('button'); b.textContent = text; b.type = 'button';
      Object.assign(b.style, { marginLeft: '8px', padding: '6px 12px', borderRadius: '9px', border: '1px solid #3d3550', cursor: 'pointer', font: 'inherit', fontWeight: '600',
        background: primary ? '#c3a6ff' : '#302a3c', color: primary ? '#1d1430' : '#efeaf6' });
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); }, true); btns.append(b);
    }
    function say(t, actions) { msg.textContent = t; btns.textContent = ''; (actions || []).forEach(a => button(a[0], a[1], a[2])); }
    document.documentElement.append(bar);
    let picking = true, last = null;
    say('Ответошная: если нужно, войдите, откройте страницу с отзывами и нажмите на текст любого отзыва.');
    const sel1 = e => {
      const cls = [...e.classList].filter(c => /^[A-Za-z_-][\w-]*$/.test(c) && !/\d{4,}|active|selected|hover|open|show|hidden|collapsed|expanded/i.test(c)).slice(0, 3);
      return e.tagName.toLowerCase() + cls.map(c => '.' + CSS.escape(c)).join('');
    };
    const dateRe = /(\d{4}-\d{2}-\d{2})|(\b\d{1,2}\.\d{1,2}\.\d{2,4}\b)|(\d{1,2}\s+(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек))|вчера|сегодня|назад/i;
    function analyze(el) {
      let fallback = null;
      for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const s = sel1(a);
        if (s.indexOf('.') < 0) continue;
        const all = document.querySelectorAll(s);
        if (all.length < 2 || all.length > 1000) continue;
        const withText = [...all].filter(x => (x.innerText || '').trim().length > 15).length;
        if (withText < 2) continue;
        if (!fallback) fallback = { el: a, sel: s };
        if (dateRe.test(a.innerText || '')) return { el: a, sel: s };
      }
      return fallback;
    }
    function relPath(container, el) {
      if (container === el) return '';
      const parts = []; for (let a = el; a && a !== container; a = a.parentElement) parts.unshift(sel1(a));
      return parts.join(' > ');
    }
    document.addEventListener('mouseover', e => {
      if (!picking || bar.contains(e.target)) return;
      if (last) last.style.outline = ''; last = e.target; last.style.outline = '2px solid #ff9fcf';
    }, true);
    document.addEventListener('click', async e => {
      if (!picking || bar.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      const found = analyze(e.target);
      if (!found) { say('Не нашла похожих отзывов рядом. Нажмите прямо на текст отзыва.'); return; }
      const cfg = { item: found.sel, text: relPath(found.el, e.target) };
      let items = [];
      try { items = await GEN(Object.assign({ prefix: 'x', name: '', threshold: 4.5 }, cfg), 3650); } catch (err) {}
      document.querySelectorAll(found.sel).forEach(x => { x.style.outline = '2px dashed #c3a6ff'; });
      const first = items[0];
      const total = document.querySelectorAll(found.sel).length;
      const info = items.length
        ? 'Нашла отзывов: ' + items.length + ' (с датой) из ' + total + '. Первый: ' + first.date + (first.rating != null ? ', оценка ' + first.rating : '') + ': «' + first.text.slice(0, 60) + '…»'
        : 'Нашла блоков: ' + total + ', но даты в них не видно. Попробуйте нажать на другой отзыв.';
      picking = false;
      say(info, [
        ['Сохранить источник', () => {
          try { window.__TAURI_INTERNALS__.invoke('source_result', { id: ID, payload: JSON.stringify({ kind: 'learned', cfg, count: items.length, url: location.href }) }); } catch (err) {}
          say('Сохранено. Можно закрыть это окно.');
        }, true],
        ['Выбрать другой', () => { document.querySelectorAll(found.sel).forEach(x => { x.style.outline = ''; }); picking = true; say('Нажмите на текст любого отзыва.'); }]
      ]);
    }, true);
  }


  /* ---------- почта сайта: чтение напрямую с почтового сервера (тот же служебный адрес, которым пользуется сама почта) ----------
     Каждое письмо: точное время получения, полный текст, отметка «отвечено» по папке «Отправленные».
     Смотрим все папки с письмами (кроме Отправленных, Черновиков, Исходящих), «Удаленные» отдельно: там дубли. */
  async function MAIL_API(known, opts) {
    opts = opts || {};
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    const diag = { api: 1, folders: [], scanned: 0, cand: 0, form: 0, read: 0, sent: 0, answered: 0, dup: 0, deleted: 0, complete: false };
    const pwdVisible = () => [...document.querySelectorAll('input[type=password]')].some(e => e.offsetParent && e.getBoundingClientRect().width > 0);
    const canary = () => { try { return decodeURIComponent((document.cookie.match(/(?:^|;\s*)X-OWA-CANARY=([^;]+)/) || [])[1] || ''); } catch (e) { return ''; } };
    for (let i = 0; i < 40 && !canary(); i++) { if (pwdVisible()) throw new Error('нужен вход в почту'); await sleep(500); }
    if (!canary()) { if (pwdVisible() || /\/auth\/|logon/i.test(location.pathname)) throw new Error('нужен вход в почту'); throw new Error('api: нет ключа сеанса почты'); }
    const mbox = decodeURIComponent((location.pathname.match(/\/owa\/([^/]+@[^/]+)\//) || [])[1] || '') || opts.mbox || 'GB24-press2@zdrav.mos.ru';
    const base = '/owa/' + mbox + '/';
    const HDR = { "__type": "JsonRequestHeaders:#Exchange", "RequestServerVersion": "Exchange2013",
      "TimeZoneContext": { "__type": "TimeZoneContext:#Exchange", "TimeZoneDefinition": { "__type": "TimeZoneDefinitionType:#Exchange", "Id": "Russian Standard Time" } } };
    const P = f => ({ "__type": "PropertyUri:#Exchange", "FieldURI": f });
    const XP = (tag, type) => ({ "__type": "ExtendedPropertyUri:#Exchange", "PropertyTag": tag, "PropertyType": type });
    const DF = id => ({ "__type": "DistinguishedFolderId:#Exchange", "Id": id });
    const FID = id => ({ "__type": "FolderId:#Exchange", "Id": id });
    const PG = (off, n) => ({ "__type": "IndexedPageView:#Exchange", "BasePoint": "Beginning", "Offset": off, "MaxEntriesReturned": n });
    const SORT = f => [{ "__type": "SortResults:#Exchange", "Order": "Descending", "Path": P(f) }];
    const call = async (action, body, own) => {
      let last = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        if (window.__otvStop) throw new Error('остановлено');
        let r;
        try {
          const hd = { 'Action': action, 'X-OWA-CANARY': canary(), 'Content-Type': 'application/json; charset=utf-8', 'X-Requested-With': 'XMLHttpRequest' };
          if (!own) hd['X-AnchorMailbox'] = mbox;
          r = await fetch((own ? '/owa/' : base) + 'service.svc?action=' + action, { method: 'POST', credentials: 'include', headers: hd,
            body: JSON.stringify({ "__type": action + "JsonRequest:#Exchange", "Header": HDR, "Body": body }) });
        } catch (e) { last = 'сеть: ' + (e && e.message || e); await sleep(1500 * (attempt + 1)); continue; }
        if (r.status === 440 || r.status === 401 || (r.redirected && /logon|\/auth\//i.test(r.url))) throw new Error('нужен вход в почту');
        const tx = await r.text();
        let j = null; try { j = JSON.parse(tx); } catch (e) {}
        const items = j && j.Body && j.Body.ResponseMessages && j.Body.ResponseMessages.Items;
        if (items) return items;
        if (!j && /type=["']?password|logon\.aspx/i.test(tx)) throw new Error('нужен вход в почту');
        last = action + ' ' + r.status + ' ' + String(j && j.Body && (j.Body.FaultMessage || j.Body.ResponseCode) || '').slice(0, 80);
        if (r.status < 500) break;
        await sleep(1500 * (attempt + 1));
      }
      throw new Error('api: ' + last);
    };
    // время по Москве (UTC+3 круглый год)
    const msk = s => { const d = new Date(s); if (isNaN(d)) return null; const m = new Date(d.getTime() + 3 * 3600e3).toISOString(); return { date: m.slice(0, 10), time: m.slice(11, 16), ts: d.getTime() }; };
    const todayMsk = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const since = /^\d{4}-\d{2}-\d{2}$/.test(opts.since || '') ? opts.since : new Date(Date.now() + 3 * 3600e3 - 7 * 864e5).toISOString().slice(0, 10);
    const sinceTs = Date.parse(since + 'T00:00:00+03:00');
    const idOf = cid => 'site-' + String(cid).slice(-24).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');

    /* 1. папки: системные определяем по их настоящим названиям в этой почте */
    const WK = ['inbox', 'sentitems', 'deleteditems', 'drafts', 'outbox', 'syncissues', 'junkemail'];
    const names = {};
    try {
      const g = await call('GetFolder', { "__type": "GetFolderRequest:#Exchange", "FolderShape": { "__type": "FolderResponseShape:#Exchange", "BaseShape": "IdOnly", "AdditionalProperties": [P("FolderDisplayName")] }, "FolderIds": WK.map(DF) });
      WK.forEach((k, i) => { const f = g[i] && g[i].Folders && g[i].Folders[0]; if (f && f.DisplayName) names[k] = f.DisplayName; });
    } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.wkErr = String(e.message).slice(0, 80); }
    let scanList = [{ fid: DF('inbox'), name: names.inbox || 'Входящие' }, { fid: DF('junkemail'), name: names.junkemail || 'Нежелательная почта' }];
    try {
      const ff = await call('FindFolder', { "__type": "FindFolderRequest:#Exchange", "FolderShape": { "__type": "FolderResponseShape:#Exchange", "BaseShape": "IdOnly",
        "AdditionalProperties": [P("FolderDisplayName"), P("TotalCount"), P("FolderClass"), P("ParentFolderId")] },
        "ParentFolderIds": [DF('msgfolderroot')], "Traversal": "Deep", "Paging": PG(0, 1000), "ReturnParentFolder": true, "ShapeName": "Folder" });
      const all = (ff[0] && ff[0].RootFolder && ff[0].RootFolder.Folders) || [];
      const pid = f => f.ParentFolderId && f.ParentFolderId.Id || '';
      const inboxF = all.find(f => f.DisplayName === names.inbox), root = inboxF ? pid(inboxF) : '';
      const sysNames = ['sentitems', 'deleteditems', 'drafts', 'outbox', 'syncissues', 'inbox', 'junkemail'].map(k => names[k]).filter(Boolean);
      const skip = new Set(all.filter(f => sysNames.indexOf(f.DisplayName) >= 0 && (!root || pid(f) === root)).map(f => f.FolderId.Id));
      for (let grew = true; grew;) { grew = false; for (const f of all) if (!skip.has(f.FolderId.Id) && skip.has(pid(f)) && !(inboxF && pid(f) === inboxF.FolderId.Id)) { skip.add(f.FolderId.Id); grew = true; } }
      // подпапки «Входящих» и свои папки (например «Форма обратной связи», «Архив»): письма могли переложить туда
      for (const f of all) {
        if (skip.has(f.FolderId.Id) || !(f.TotalCount > 0)) continue;
        if (f.FolderClass && !/^IPF\.Note/i.test(f.FolderClass)) continue;
        scanList.push({ fid: FID(f.FolderId.Id), name: f.DisplayName });
      }
    } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.ffErr = String(e.message).slice(0, 80); }

    /* 2. письма за период: список отсортирован от новых к старым, листаем до начала периода */
    const scan = async (fid, limitPages) => {
      const out = [];
      for (let off = 0, pg = 0; pg < (limitPages || 40); pg++) {
        const r = await call('FindItem', { "__type": "FindItemRequest:#Exchange", "ItemShape": { "__type": "ItemResponseShape:#Exchange", "BaseShape": "IdOnly",
          "AdditionalProperties": [P("Subject"), P("DateTimeReceived"), P("From"), P("ConversationId"), P("ItemClass"), XP("0x1081", "Integer")] },
          "ParentFolderIds": [fid], "Traversal": "Shallow", "Paging": PG(off, 100), "SortOrder": SORT("DateTimeReceived") });
        const rf = r[0] && r[0].RootFolder;
        if (!rf) throw new Error('api: FindItem ' + String(r[0] && (r[0].MessageText || r[0].ResponseCode) || '').slice(0, 80));
        const its = rf.Items || [];
        let older = false;
        for (const x of its) { const w = msk(x.DateTimeReceived); if (!w) continue; if (w.ts < sinceTs) { older = true; continue; } out.push(Object.assign(x, { _w: w })); }
        off += its.length;
        if (older || rf.IncludesLastItemInRange || !its.length) break;
      }
      return out;
    };
    const fromOf = x => { const m = x.From && x.From.Mailbox || {}; return { name: String(m.Name || ''), mail: String(m.EmailAddress || '').toLowerCase() }; };
    const isReply = x => /^\s*(re|fw|fwd|отв|пересл|ответ)\s*[:：]/i.test(String(x.Subject || ''));
    const headForm = x => /форма обратной связи/i.test(fromOf(x).name) || /\(Страница:/i.test(String(x.Subject || ''));
    const verb = x => { const e = (x.ExtendedProperty || []).find(p => p && p.ExtendedFieldURI && /0x1081/i.test(String(p.ExtendedFieldURI.PropertyTag))); return e ? Number(e.Value) : 0; };
    const active = [], removed = [];
    for (const f of scanList) {
      try {
        const got = await scan(f.fid);
        diag.folders.push(f.name + ':' + got.length);
        got.forEach(x => { x._folder = f.name; active.push(x); });
      } catch (e) {
        if (/нужен вход/.test(e.message)) throw e;
        if (f.fid.Id === 'inbox') throw e;                      // без «Входящих» читать нечего: пусть сработает запасной способ
        diag.folders.push(f.name + ':ошибка');
      }
    }
    try { (await scan(DF('deleteditems'), 5)).forEach(x => { x._folder = 'deleted'; removed.push(x); }); } catch (e) { diag.delErr = String(e.message).slice(0, 60); }
    diag.scanned = active.length;

    /* 3. полный текст: для писем с формы и для всех остальных писем за период (форма могла прийти от другого отправителя) */
    const seenIds = new Set();
    const cands = active.concat(removed).filter(x => {
      if (!x.ItemId || !x.ItemId.Id || seenIds.has(x.ItemId.Id)) return false; seenIds.add(x.ItemId.Id);
      return !isReply(x) && /^IPM\.Note/i.test(String(x.ItemClass || 'IPM.Note')) && !/^IPM\.Note\.(Rules|Microsoft)/i.test(String(x.ItemClass || ''));
    });
    diag.cand = cands.length;
    const bodies = {};
    for (let i = 0; i < cands.length; i += 10) {
      const part = cands.slice(i, i + 10);
      try {
        const g = await call('GetItem', { "__type": "GetItemRequest:#Exchange", "ItemShape": { "__type": "ItemResponseShape:#Exchange", "BaseShape": "IdOnly", "BodyType": "Text", "AdditionalProperties": [P("Body")] },
          "ItemIds": part.map(x => ({ "__type": "ItemId:#Exchange", "Id": x.ItemId.Id })) });
        part.forEach((x, k) => { const it = g[k] && g[k].Items && g[k].Items[0]; if (it && it.Body && typeof it.Body.Value === 'string') bodies[x.ItemId.Id] = it.Body.Value.replace(/\r\n?/g, '\n'); });
      } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.bodyErr = String(e.message).slice(0, 60); }
    }
    const LBL = 'Имя|ФИО|Email|E-mail|Эл\\. почта|Телефон|Тип обращения|Тема обращения|Сообщение|Текст сообщения|Текст обращения|Лендинг|Страница|Врач';
    const bodyForm = t => /(^|\n)\s*(Сообщение|Текст сообщения|Текст обращения)\s*:/i.test(t) && /(^|\n)\s*(Тип обращения|Имя|Лендинг|Врач)\s*:/i.test(t);
    const TY = { thanks: 'Благодарность', thank: 'Благодарность', gratitude: 'Благодарность', complaint: 'Жалоба', claim: 'Жалоба', question: 'Вопрос', review: 'Отзыв', feedback: 'Отзыв', suggestion: 'Предложение', proposal: 'Предложение' };
    const scrub = s => String(s || '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]').replace(/\+?\d[\d\s()-]{8,}\d/g, '[телефон]');
    const parse = (x) => {
      const t = bodies[x.ItemId.Id] || '';
      const subj = String(x.Subject || '').trim();
      const form = headForm(x) || bodyForm(t);
      if (!form) return null;
      const g = k => { const m = t.match(new RegExp('(?:^|\\n)\\s*(?:' + k + ')\\s*:[ \\t]*([^\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      let msg = '';
      const mm = t.match(new RegExp('(?:^|\\n)\\s*(?:Сообщение|Текст сообщения|Текст обращения|Комментарий|Отзыв)\\s*:[ \\t]*([\\s\\S]*?)(?=\\n\\s*(?:' + LBL + ')\\s*:|$)', 'i'));
      if (mm) msg = mm[1];
      else if (t) {   // другой шаблон письма: всё, кроме служебных строк
        const start = t.search(new RegExp('(^|\\n)\\s*(?:' + LBL + ')\\s*:', 'i'));
        msg = (start >= 0 ? t.slice(start) : t).split('\n').map(l => l.trim()).filter(l => l && !new RegExp('^(?:' + LBL + '|От|Кому|Тема|Отправлено)\\s*:', 'i').test(l) && !/^ВНЕШНЯЯ ПОЧТА/i.test(l)).join('\n');
      }
      msg = scrub(msg.replace(/\n{3,}/g, '\n\n').trim()).slice(0, 4000);
      const em = (g('Email|E-mail|Эл\\. почта').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [''])[0].toLowerCase();
      const rawType = g('Тип обращения|Тема обращения');
      const type = TY[rawType.toLowerCase()] || rawType || (subj.match(/^([А-Яа-яЁё]+)/) || [])[1] || '';
      const w = x._w;
      return { id: idOf(x.ConversationId && x.ConversationId.Id || x.ItemId.Id), date: w.date, time: w.time, ts: w.ts, subject: subj.slice(0, 200), type, typeRaw: rawType.slice(0, 40),
        landing: (g('Лендинг|Страница') || (subj.match(/\(Страница: ([^)]*)\)/) || [])[1] || '').slice(0, 300), name: g('Имя|ФИО').slice(0, 120), doctor: g('Врач').slice(0, 160),
        message: msg, email: em, emailHash: em ? h(em) : '', read: !!msg, api: true, folder: x._folder, verb: verb(x), itemId: x.ItemId.Id, cid: x.ConversationId && x.ConversationId.Id || '' };
    };
    const letters = [], gone = [];
    for (const x of cands) { const p = parse(x); if (!p) continue; (x._folder === 'deleted' ? gone : letters).push(p); }
    diag.form = letters.length; diag.read = letters.filter(l => l.read).length;

    /* 4. дубли: тот же человек прислал то же письмо повторно (или повтор удалён в «Удаленные») */
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
    const samePerson = (a, b) => (a.emailHash && a.emailHash === b.emailHash) || (norm(a.name).length >= 3 && norm(a.name) === norm(b.name));
    const stems = t => { const w = new Set(); norm(t).split(' ').forEach(x => { if (x.length > 3) w.add(x.slice(0, 6)); }); return w; };
    const cover = (a, b) => { const A = stems(a), B = stems(b), m = Math.min(A.size, B.size); if (m < 4) return 0; let n = 0; for (const k of A) if (B.has(k)) n++; return n / m; };
    // то же письмо: то же начало, или почти все слова короткого письма есть в длинном (письмо дополнили и отправили ещё раз)
    const sameText = (a, b) => { const x = norm(a.message), y = norm(b.message); if (!x || !y) return !x && !y; const k = Math.min(60, x.length, y.length); return x.slice(0, k) === y.slice(0, k) || x.indexOf(y.slice(0, 40)) >= 0 || y.indexOf(x.slice(0, 40)) >= 0 || cover(x, y) >= 0.6; };
    // длинное письмо почти слово в слово (с другого адреса или с опечаткой в имени): тоже повтор
    const twinText = (a, b) => { const x = norm(a.message), y = norm(b.message); return !!x && x.length >= 120 && (x === y || (Math.min(stems(x).size, stems(y).size) >= 12 && cover(x, y) >= 0.9)); };
    letters.sort((a, b) => a.ts - b.ts);
    const out = [];
    for (const l of letters) {
      const same = out.find(o => o.id === l.id);
      if (same) {
        if (same.ts === l.ts || (samePerson(same, l) && sameText(same, l))) continue;   // то же письмо в двух папках
        l.id = idOf(l.itemId);                                   // другое письмо в той же переписке: своё имя
      }
      const first = out.find(o => !o.dup && Math.abs(l.ts - o.ts) < 7 * 864e5 && ((samePerson(o, l) && sameText(o, l)) || twinText(o, l)));
      if (first) { l.dup = true; l.dupOf = first.id; diag.dup++; }
      out.push(l);
    }
    for (const l of gone) {
      if (out.some(o => o.id === l.id)) continue;
      const twin = out.find(o => !o.dup && Math.abs(l.ts - o.ts) < 7 * 864e5 && (samePerson(o, l) || twinText(o, l)));
      if (twin) { l.dup = true; l.dupOf = twin.id; diag.dup++; } else { l.deleted = true; diag.deleted++; }
      out.push(l);
    }

    /* 5. кому уже ответили: письма в «Отправленных» на адрес автора, отправленные после получения письма */
    const answered = [], replies = {};
    try {
      // ответ мог уйти из общего ящика сайта или из вашего личного: смотрим «Отправленные» обоих
      const sentList = [];
      for (const own of [false, true]) {
        try {
          const part0 = [];
          for (let off = 0, pg = 0; pg < 20; pg++) {
            const r = await call('FindItem', { "__type": "FindItemRequest:#Exchange", "ItemShape": { "__type": "ItemResponseShape:#Exchange", "BaseShape": "IdOnly", "AdditionalProperties": [P("DateTimeSent"), P("DisplayTo"), P("DisplayCc"), P("ConversationId")] },
              "ParentFolderIds": [DF('sentitems')], "Traversal": "Shallow", "Paging": PG(off, 100), "SortOrder": SORT("DateTimeSent") }, own);
            const rf = r[0] && r[0].RootFolder; if (!rf) throw new Error('api: Отправленные ' + String(r[0] && r[0].MessageText || '').slice(0, 60));
            const its = rf.Items || []; let older = false;
            for (const x of its) { const w = msk(x.DateTimeSent); if (!w) continue; if (w.ts < sinceTs - 864e5) { older = true; continue; }
              part0.push({ id: x.ItemId.Id, own, ts: w.ts, cid: x.ConversationId && x.ConversationId.Id || '', disp: (String(x.DisplayTo || '') + ' ' + String(x.DisplayCc || '')).toLowerCase().replace(/ё/g, 'е'), mails: new Set() }); }
            off += its.length; if (older || rf.IncludesLastItemInRange || !its.length) break;
          }
          for (let i = 0; i < part0.length; i += 20) {
            const part = part0.slice(i, i + 20);
            try {
              const g = await call('GetItem', { "__type": "GetItemRequest:#Exchange", "ItemShape": { "__type": "ItemResponseShape:#Exchange", "BaseShape": "IdOnly", "AdditionalProperties": [P("ToRecipients"), P("CcRecipients"), P("BccRecipients")] },
                "ItemIds": part.map(x => ({ "__type": "ItemId:#Exchange", "Id": x.id })) }, own);
              part.forEach((x, k) => { const it = g[k] && g[k].Items && g[k].Items[0]; if (!it) return; [].concat(it.ToRecipients || [], it.CcRecipients || [], it.BccRecipients || []).forEach(m => { if (m && m.EmailAddress) x.mails.add(String(m.EmailAddress).toLowerCase()); }); });
            } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.rcptErr = String(e.message).slice(0, 60); }
          }
          // одно и то же письмо в обоих ящиках не считаем дважды
          part0.forEach(x => { if (!sentList.some(y => y.cid && y.cid === x.cid && Math.abs(y.ts - x.ts) < 60e3)) sentList.push(x); });
          diag[own ? 'sentOwn' : 'sentBox'] = part0.length;
        } catch (e) { if (/нужен вход/.test(e.message) && !own) throw e; diag[own ? 'sentOwnErr' : 'sentErr'] = String(e.message).slice(0, 80); if (!own) throw e; }
      }
      sentList.forEach(x => { (x.disp.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).forEach(m => x.mails.add(m)); x.hashes = new Set([...x.mails].map(h)); });
      sentList.sort((a, b) => a.ts - b.ts);
      diag.sent = sentList.length;
      const used = new Set();
      const words = n => norm(n).split(' ').filter(w => w.length >= 3);
      // один ответ закрывает одно письмо: два письма одного человека и один ответ = второе остаётся «к ответу»
      const take = (l, eh, name) => {
        const ws = words(name);
        const ok = x => !used.has(x.id) && x.ts >= l.ts - 120e3;
        const s = (l.cid && sentList.find(x => ok(x) && x.cid === l.cid))                    // ответ в той же переписке
          || (eh && sentList.find(x => ok(x) && x.hashes.has(eh)))                            // на адрес автора
          || (ws.length >= 2 && sentList.find(x => ok(x) && ws.every(w => x.disp.indexOf(w) >= 0)));   // по имени автора
        if (s) { used.add(s.id); return s.id; }
        return false;
      };
      const replyOf = {};   // письмо → отправленный на него ответ
      out.filter(l => !l.dup).sort((a, b) => a.ts - b.ts).forEach(l => {
        const sid = take(l, l.emailHash, l.name);
        if (sid) replyOf[l.id] = sid;
        if (l.verb === 102 || l.verb === 103 || sid) { l.replied = true; answered.push(l.id); }
      });
      (opts.todo || []).forEach(x => { if (answered.indexOf(x.id) >= 0 || out.some(l => l.id === x.id)) return; const sid = take({ ts: Date.parse((x.date || since) + 'T00:00:00+03:00'), cid: x.cid || '' }, x.eh, x.name); if (sid) { replyOf[x.id] = sid; answered.push(x.id); } });
      // текст настоящего ответа из «Отправленных»: без цитаты исходного письма, телефоны и чужие адреса скрыты
      const ids = Object.keys(replyOf), cutQuote = t => String(t || '').replace(/\r\n?/g, '\n').split(/\n\s*(?:-{2,}\s*(?:Original|Исходное)|_{5,}|From:|От:|Отправлено:|Sent:|\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}.{0,60}(?:пишет|wrote)|.{0,80}(?:пишет|wrote):\s*$)/m)[0];
      for (let i = 0; i < ids.length; i += 10) {
        const part = ids.slice(i, i + 10);
        try {
          const ownOf = sid => (sentList.find(x => x.id === sid) || {}).own;
          const g = [];
          for (const own of [false, true]) {
            const ps = part.filter(id => !!ownOf(replyOf[id]) === own); if (!ps.length) continue;
            const gg = await call('GetItem', { "__type": "GetItemRequest:#Exchange", "ItemShape": { "__type": "ItemResponseShape:#Exchange", "BaseShape": "IdOnly", "BodyType": "Text", "AdditionalProperties": [P("Body")] },
              "ItemIds": ps.map(id => ({ "__type": "ItemId:#Exchange", "Id": replyOf[id] })) }, own);
            ps.forEach((id, k) => { g[part.indexOf(id)] = gg[k]; });
          }
          part.forEach((id, k) => { const it = g[k] && g[k].Items && g[k].Items[0]; if (!it || !it.Body || typeof it.Body.Value !== 'string') return;
            const t = cutQuote(it.Body.Value).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, m => /^gkb24@zdrav\.mos\.ru$/i.test(m) ? m : '[email]').replace(/\+?\d[\d\s()-]{8,}\d/g, '[телефон]').replace(/\n{3,}/g, '\n\n').trim();
            if (t.length >= 20) replies[id] = t.slice(0, 5000); });
        } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.replyErr = String(e.message).slice(0, 60); }
      }
      diag.replies = Object.keys(replies).length;
      diag.answered = answered.length;
    } catch (e) { if (/нужен вход/.test(e.message)) throw e; diag.sentErr = String(e.message).slice(0, 80); diag.sent = -1; }
    out.forEach(l => { delete l.email; delete l.ts; delete l.verb; delete l.itemId; delete l.cid; if (l.folder === 'deleted') l.folder = 'Удаленные'; });
    diag.complete = !diag.ffErr && !diag.wkErr && !diag.bodyErr && diag.folders.every(f => !/ошибка$/.test(f));
    diag.since = since; diag.today = todayMsk;
    return { items: out, seen: out.length, diag, answered, replies };
  }
  /* сначала сервер почты; если он не ответил, читаем письма с экрана, как раньше */
  async function MAIL_ANY(API, DOM, known, opts) {
    let err = '';
    try { const r = await API(known, opts); if (r && Array.isArray(r.items)) return r; err = 'пустой ответ'; }
    catch (e) { err = String(e && e.message || e); if (/нужен вход|остановлено/.test(err)) throw e; }
    const r = await DOM(known, opts);
    r.diag = Object.assign({}, r.diag, { apiErr: err.slice(0, 120) });
    return r;
  }

  /* ---------- почта сайта (owa.mos.ru): запасной способ, письма читаются с экрана ---------- */
  async function MAIL(known, opts) {
    opts = opts || {};
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pwd = [...document.querySelectorAll('input[type=password]')].some(e => e.offsetParent && e.getBoundingClientRect().width > 0);
    if (pwd && !document.querySelector('div[data-convid]')) throw new Error('нужен вход в почту');
    for (let i = 0; i < 40 && !document.querySelector('div[data-convid]'); i++) await sleep(500);
    if (!document.querySelector('div[data-convid]')) throw new Error('не открылся список писем');
    const h = s => { let x = 5381; for (const ch of s) x = ((x * 33) ^ ch.codePointAt(0)) >>> 0; return x.toString(36); };
    const now = new Date(Date.now() + 3 * 3600e3);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const iso = d => d.toISOString().slice(0, 10);
    // письма только за отчётный период (с его первого дня), старые давно отвечены
    const since = /^\d{4}-\d{2}-\d{2}$/.test(opts.since || '') ? new Date(opts.since + 'T00:00:00Z') : new Date(today.getTime() - 7 * 864e5);
    const WD = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };
    const list = [], diag = { rows: 0, form: 0, parsed: 0, noDate: 0, old: 0, opened: 0, read: 0 };
    // дата в строке письма: «09:15», «пн 12:30», «Пн 14.10», «14.10.2026», «вчера»
    const dateOf = t => {
      let m = t.match(/(?:^|\s)(\d{1,2}\.\d{1,2}\.\d{4})(?=\s|$)/);
      if (m) { const [dd, mm, yy] = m[1].split('.'); return { d: new Date(Date.UTC(+yy, +mm - 1, +dd)), time: '' }; }
      m = t.match(/(?:^|\s)(пн|вт|ср|чт|пт|сб|вс)\.?\s+(\d{1,2}:\d\d|\d{1,2}\.\d{1,2})(?=\s|$)/i);
      if (m) {
        if (/:/.test(m[2])) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - ((today.getUTCDay() - WD[m[1].toLowerCase()] + 7) % 7 || 7)); return { d, time: m[2].padStart(5, '0') }; }
        const [dd, mm] = m[2].split('.'); const d = new Date(Date.UTC(today.getUTCFullYear(), +mm - 1, +dd)); if (d > today) d.setUTCFullYear(d.getUTCFullYear() - 1); return { d, time: '' };
      }
      m = t.match(/(?:^|\s)вчера(?:\s+(\d{1,2}:\d\d))?(?=\s|$)/i);
      if (m) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - 1); return { d, time: (m[1] || '').padStart(m[1] ? 5 : 0, '0') }; }
      m = t.match(/(?:^|\s)(\d{1,2}:\d\d)(?=\s|$)/);
      if (m) return { d: today, time: m[1].padStart(5, '0') };
      m = t.match(/(?:^|\s)(\d{1,2})\.(\d{1,2})(?=\s|$)/);
      if (m) { const d = new Date(Date.UTC(today.getUTCFullYear(), +m[2] - 1, +m[1])); if (d > today) d.setUTCFullYear(d.getUTCFullYear() - 1); return { d, time: '' }; }
      return null;
    };
    // список писем OWA рисует только видимую часть: листаем его вниз, пока не дойдём до писем старше двух недель
    const listBox = () => {
      let e = document.querySelector('div[data-convid]');
      for (let i = 0; e && i < 15; i++, e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(cs.overflowY)) return e;
      }
      return null;
    };
    const seenCid = new Set(), inboxTexts = new Set();
    let oldest = today, folder = '';
    const rowsSig = () => [...document.querySelectorAll('div[data-convid]')].slice(0, 6).map(e => e.getAttribute('data-convid')).join('|');
    // папка в левой панели почты по названию
    const folderNode = name => {
      const all = [...document.querySelectorAll('[role="treeitem"], [title]')];
      return all.find(e => (e.getAttribute('title') || '').trim() === name) ||
        all.find(e => e.getAttribute('role') === 'treeitem' && (e.innerText || '').split('\n')[0].trim() === name) || null;
    };
    const clickEl = el => {
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      const rc = el.getBoundingClientRect();
      const ev = { bubbles: true, cancelable: true, view: window, button: 0, clientX: rc.left + Math.min(rc.width / 2, 60), clientY: rc.top + Math.min(rc.height / 2, 12) };
      const tgt = document.elementFromPoint(ev.clientX, ev.clientY) || el;
      for (const type of ['mousedown', 'mouseup', 'click']) (el.contains(tgt) ? tgt : el).dispatchEvent(new MouseEvent(type, ev));
    };
    const isSelected = node => { let e = node; for (let i = 0; e && i < 4; i++, e = e.parentElement) { if (e.getAttribute && (e.getAttribute('aria-selected') === 'true' || /(^|\s)(selected|_n_\w*selected)/i.test(String(e.className)))) return true; } return false; };
    const openFolder = async name => {
      const node = folderNode(name);
      if (!node) return false;
      if (isSelected(node)) { folder = name; return true; }
      const before = rowsSig();
      clickEl(node);
      for (let k = 0; k < 30; k++) { await sleep(400); const sig = rowsSig(); if (sig && sig !== before) break; }
      await sleep(600);
      folder = name;
      return true;
    };
    // первая по порядку дата в строке: дата письма стоит перед его текстом
    const rowDate = t => { const m = t.match(/(?:^|\s)(\d{1,2}:\d\d|(?:пн|вт|ср|чт|пт|сб|вс)\.?\s+(?:\d{1,2}:\d\d|\d{1,2}\.\d{1,2})|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{1,2}|вчера(?:\s+\d{1,2}:\d\d)?)(?=\s|$)/i); return m ? dateOf(' ' + m[1]) : null; };
    const parseRows = () => {
      for (const el of document.querySelectorAll('div[data-convid]')) {
        const cid = el.getAttribute('data-convid');
        if (!cid || seenCid.has(cid)) continue;
        seenCid.add(cid);
        diag.rows++;
        const t = el.innerText.replace(/\s+/g, ' ').trim();
        inboxTexts.add(t);
        let at = t.search(/Форма обратной связи/i);
        if (at < 0 && folder === 'Форма обратной связи') { const pm = t.search(/\S+\s*\(Страница:/); at = pm >= 0 ? pm : 0; }
        if (at < 0) continue;
        diag.form++;
        const rest = t.slice(at).replace(/^Форма обратной связи\s*/i, '');
        // тема: до «(Страница: …)» включительно, иначе до даты
        const sm = rest.match(/^(.+?\(Страница: [^)]*\))/) || rest.match(/^(.+?)(?=\s(?:\d{1,2}:\d\d|\d{1,2}\.\d{1,2}(?:\.\d{4})?|пн|вт|ср|чт|пт|сб|вс|вчера)(?:\s|$|\.))/i);
        const subj = (sm ? sm[1] : rest.split(' ').slice(0, 6).join(' ')).trim();
        const afterSubj = rest.slice(rest.indexOf(subj) >= 0 ? rest.indexOf(subj) + subj.length : 0).trim();
        // дата строки письма стоит сразу после темы; даты внутри текста письма не берём
        const head = afterSubj.match(/^(\d{1,2}:\d\d|(?:пн|вт|ср|чт|пт|сб|вс)\.?\s+(?:\d{1,2}:\d\d|\d{1,2}\.\d{1,2})|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{1,2}|вчера(?:\s+\d{1,2}:\d\d)?)(?=\s|$)/i);
        let dd = head ? dateOf(' ' + head[1]) : null;
        if (!dd) { const pre = t.slice(0, at); const hm = pre.match(/(\d{1,2}:\d\d|(?:пн|вт|ср|чт|пт|сб|вс)\.?\s+(?:\d{1,2}:\d\d|\d{1,2}\.\d{1,2})|\d{1,2}\.\d{1,2}\.\d{4})\s*$/i); if (hm) dd = dateOf(' ' + hm[1]); }
        if (!dd) { diag.noDate++; dd = { d: today, time: '', approx: true }; }      // дату не разобрали: не теряем письмо
        else if (dd.d < oldest) oldest = dd.d;                                       // до какой даты уже долистали
        diag.parsed++;
        const d = dd.d, time = dd.time;
        if (d < since) { diag.old++; continue; }
        list.push({ cid, folder, id: 'site-' + cid.slice(-24).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, ''), date: iso(d), time, subject: subj, dateApprox: !!dd.approx,
          type: (subj.match(/^(\S+)/) || [])[1] || '', landing: (subj.match(/\(Страница: ([^)]*)\)/) || [])[1] || '' });
      }
    };
    const scanFolder = async () => {
    oldest = today;
    parseRows();
    const box = listBox();
    if (box) {
      box.scrollTop = 0; await sleep(300);
      let still = 0;
      for (let i = 0; i < 80 && oldest.getTime() >= since.getTime() - 864e5 && still < 4 && !window.__otvStop; i++) {
        const before = box.scrollTop;
        box.scrollTop = before + Math.max(200, box.clientHeight * 0.8);
        await sleep(700);
        parseRows();
        diag.scrolls++;
        if (box.scrollTop === before) { still++; await sleep(800); parseRows(); } else still = 0;   // OWA подгружает следующую порцию
      }
      box.scrollTop = 0; await sleep(500);
    }
    diag.oldest = iso(oldest);
    };
    diag.scrolls = 0;
    const rowOf = cid => [...document.querySelectorAll('div[data-convid]')].find(e => e.getAttribute('data-convid') === cid);
    // текст открытого письма: панель чтения, а если её нет — ближайший к «Сообщение:» блок вне списка писем
    const docs = () => [document].concat([...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch (e) { return null; } }).filter(Boolean));
    const letterText = () => {
      const p = document.querySelector('[aria-label="Панель чтения"],[aria-label="Reading Pane"]');
      if (p && /Сообщение:/.test(p.innerText || '')) return p.innerText;
      for (const d of docs()) {
        if (!d.body) continue;
        const w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) {
          if (!/Сообщение:/.test(n.nodeValue)) continue;
          const e = n.parentElement; if (!e || e.closest('[data-convid]')) continue;
          let a = e; for (let i = 0; i < 8 && a && !/(Имя|Email|Тип обращения):/.test(a.innerText || ''); i++) a = a.parentElement;
          if (a) return a.innerText;
        }
      }
      return '';
    };
    const t0 = Date.now();
    const readFolder = async () => {
    for (const it of list) {
      if (it.folder !== folder || it.done) continue;
      it.done = true;
      if (known.indexOf(it.id) >= 0) continue;
      if (Date.now() - t0 > 150000 || window.__otvStop) break;  // остальные письма дочитаем при следующем сборе
      let row = rowOf(it.cid);
      if (!row && !document.querySelector('div[data-convid]') && history.length > 1) { history.back(); for (let k = 0; k < 20 && !(row = rowOf(it.cid)); k++) await sleep(400); }
      const lb = listBox();
      if (!row && lb) {
        lb.scrollTop = 0; await sleep(400);
        for (let k = 0; k < 80 && !(row = rowOf(it.cid)); k++) {
          const before = lb.scrollTop; lb.scrollTop = before + Math.max(200, lb.clientHeight * 0.8); await sleep(600);
          if (lb.scrollTop === before) { await sleep(800); if (lb.scrollTop === before && !(row = rowOf(it.cid))) break; }
        }
      }
      if (!row) { diag.notFound = (diag.notFound || 0) + 1; continue; }
      diag.opened++;
      const wasUnread = /Не прочитано/i.test(row.innerText + ' ' + (row.getAttribute('aria-label') || ''));
      const PANE = '[aria-label="Панель чтения"],[aria-label="Reading Pane"],[aria-label="Область чтения"],[role="main"] [aria-label*="Текст сообщения"],[aria-label="Текст сообщения"],[aria-label="Message body"]';
      const paneText = () => { for (const d of docs()) { const p = d.querySelector(PANE); if (p && (p.innerText || '').trim().length > 20) return p.innerText; } return ''; };
      const before = paneText();
      // настоящий щелчок: OWA слушает нажатие и отпускание кнопки, не только click
      try { row.scrollIntoView({ block: 'center' }); } catch (e) {}
      const rc = row.getBoundingClientRect();
      const ev = { bubbles: true, cancelable: true, view: window, button: 0, clientX: rc.left + Math.min(rc.width / 2, 200), clientY: rc.top + Math.min(rc.height / 2, 18) };
      const tgt = document.elementFromPoint(ev.clientX, ev.clientY) || row;
      for (const type of ['mousedown', 'mouseup', 'click']) (row.contains(tgt) ? tgt : row).dispatchEvent(new MouseEvent(type, ev));
      const MARK = /(Сообщение|Текст сообщения|Текст обращения|Комментарий|Отзыв|Вопрос|Имя|Тип обращения|Email|E-mail)\s*:/;
      let t = '';
      for (let k = 0; k < 38; k++) {
        await sleep(400);
        t = letterText();
        if (/Сообщение:/.test(t)) break;
        const pt = paneText();
        if (pt && pt !== before && MARK.test(pt)) { t = pt; break; }
      }
      if (!t) { const pt = paneText(); if (pt && pt !== before) t = pt; }
      if (t) diag.pane = (diag.pane || 0) + 1;
      const g = k => { const m = t.match(new RegExp('(?:^|\\n)\\s*(?:' + k + ')\\s*:\\s*([^\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const email = g('Email|E-mail|Эл\\. почта').toLowerCase();
      it.name = g('Имя|ФИО'); it.type = g('Тип обращения|Тема обращения') || it.type; it.doctor = g('Врач'); it.landing = g('Лендинг|Страница') || it.landing;
      let msg = '';
      const mm = t.match(/(?:Сообщение|Текст сообщения|Текст обращения|Комментарий|Отзыв|Вопрос)\s*:\s*([\s\S]*?)(?=\n\s*(?:Лендинг|Врач|Страница|Email|E-mail|Имя|Телефон|Тип обращения)\s*:|$)/i);
      if (mm) msg = mm[1];
      else if (t) msg = t.split('\n').map(l => l.trim()).filter(l => l && !/^(От|Кому|Копия|Отправлено|Тема|From|To|Cc|Sent|Subject|Имя|ФИО|Email|E-mail|Телефон|Тип обращения|Врач|Лендинг|Страница)\s*:/i.test(l) && !/^Форма обратной связи/i.test(l)).join('\n');
      it.message = msg.trim().replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]').replace(/\+?\d[\d\s()-]{8,}\d/g, '[телефон]').slice(0, 3000);
      it.emailHash = email ? h(email) : '';
      it.read = !!it.message;
      if (/Вы ответили на это сообщение|Вы ответили|You replied/i.test(t)) it.replied = true;     // ответ уже отправлен из почты
      if (it.read) diag.read++;
      if (wasUnread) {
        const r2 = rowOf(it.cid);
        if (r2) {
          r2.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
          await sleep(700);
          const mi = [...document.querySelectorAll('[role="menuitem"],button,span')].find(e => /^Пометить как непрочитанное$/.test((e.textContent || '').trim()));
          if (mi) { mi.click(); await sleep(400); } else document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
      }
    }
    { const lb = listBox(); if (lb) lb.scrollTop = 0; }
    };
    /* «Входящие» и папка «Форма обратной связи» (письма с сайта туда может раскладывать правило почты) */
    diag.folders = [];
    await openFolder('Входящие');
    diag.folders.push(folder || 'текущая');
    await scanFolder(); await readFolder();
    if (await openFolder('Форма обратной связи')) {
      diag.folders.push(folder);
      const before = list.length;
      await scanFolder(); await readFolder();
      diag.formFolder = list.length - before;
    }
    /* кому уже ответили: смотрим «Отправленные» за период. Совпадение по адресу почты (сравниваем отпечатки)
       или по имени и фамилии отправителя; письмо отправлено не раньше дня обращения */
    const answered = [];
    try {
      const firstCid = () => { const e = document.querySelector('div[data-convid]'); return e ? e.getAttribute('data-convid') : ''; };
      const inboxFirst = firstCid();
      // папка точно сменилась, только если на экране в основном строки, которых не было во «Входящих»
      const switched = () => { const rows = [...document.querySelectorAll('div[data-convid]')]; if (rows.length < 1) return false;
        const fresh = rows.filter(e => !inboxTexts.has(e.innerText.replace(/\s+/g, ' ').trim())).length; return /sentitems/i.test(location.hash) && fresh / rows.length >= 0.6; };
      let ok = false;
      if (await openFolder('Отправленные')) { const r0 = [...document.querySelectorAll('div[data-convid]')]; ok = r0.length > 0 && r0.filter(e => !inboxTexts.has(e.innerText.replace(/\s+/g, ' ').trim())).length / r0.length >= 0.6; }
      if (!ok) { location.hash = '#path=/mail/sentitems'; for (let k = 0; k < 30; k++) { await sleep(400); if (switched()) { ok = true; break; } } }
      if (ok) {
        const sent = [], sentSeen = new Set();
        const takeSent = () => {
          for (const el of document.querySelectorAll('div[data-convid]')) {
            const cid = el.getAttribute('data-convid'); if (!cid || sentSeen.has(cid)) continue; sentSeen.add(cid);
            const t = el.innerText.replace(/\s+/g, ' ').trim(), dd = rowDate(t);
            sent.push({ t: t.toLowerCase().replace(/ё/g, 'е'), d: dd ? dd.d : today, mails: (t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(x => h(x.toLowerCase())) });
          }
        };
        takeSent();
        const sb = listBox();
        if (sb) {
          let still = 0, old = today;
          for (let i = 0; i < 60 && still < 4 && !window.__otvStop; i++) {
            sent.forEach(x => { if (x.d < old) old = x.d; });
            if (old.getTime() < since.getTime() - 864e5) break;
            const before = sb.scrollTop; sb.scrollTop = before + Math.max(200, sb.clientHeight * 0.8); await sleep(700); takeSent();
            if (sb.scrollTop === before) { still++; await sleep(800); takeSent(); } else still = 0;
          }
          sb.scrollTop = 0;
        }
        diag.sent = sent.length;
        const words = n => String(n || '').toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z-]+/).filter(w => w.length >= 3);
        const repliedTo = (eh, name, dateIso) => {
          const d0 = dateIso ? new Date(dateIso + 'T00:00:00Z') : since, ws = words(name);
          return sent.some(x => x.d >= d0 && ((eh && x.mails.indexOf(eh) >= 0) || (ws.length >= 2 && ws.every(w => x.t.indexOf(w) >= 0))));
        };
        list.forEach(it => { if (it.replied || repliedTo(it.emailHash, it.name, it.date)) { it.replied = true; answered.push(it.id); } });
        (opts.todo || []).forEach(x => { if (answered.indexOf(x.id) < 0 && repliedTo(x.eh, x.name, x.date)) answered.push(x.id); });
      } else diag.sent = -1;
      if (!(await openFolder('Входящие'))) { location.hash = '#path=/mail/inbox'; for (let k = 0; k < 20; k++) { await sleep(300); if (firstCid() === inboxFirst) break; } }
    } catch (e) { diag.sentErr = String(e && e.message || e).slice(0, 80); try { await openFolder('Входящие'); } catch (x) {} }
    list.forEach(it => { if (it.replied && answered.indexOf(it.id) < 0) answered.push(it.id); });
    diag.answered = answered.length;
    list.forEach(x => { delete x.cid; delete x.done; delete x.folder; });
    return { items: list, seen: list.length, diag, answered };
  }

  // сразу окно отзывов профиля больницы (ссылка от сотрудницы, 13.10.2026)
  var NP_CABINET = "https://profile.napopravku.ru/reviews?paging[per_page]=20&per_page=20&answer=all";
  var GOOGLE_URL = "https://www.google.com/search?q=%D0%B3%D0%BA%D0%B1+24&hl=ru#mpd=~18183541514866455142/customers/reviews";
  var SOURCES = [
    { id: "pd", name: "ПроДокторов", cls: "pf-pd", url: "https://prodoctorov.ru/cabinet/lpu-rates/?lpu=21011", prefix: "https://prodoctorov.ru/cabinet/", wait: 2500, fn: PD },
    { id: "ya", name: "Яндекс", cls: "pf-ya", visible: true, timeout: 90000, url: "https://yandex.ru/sprav/1022361531/p/edit/reviews/", prefix: "https://yandex.ru/sprav/1022361531/", wait: 4000, fn: YA },
    { id: "gis", name: "2ГИС", cls: "pf-gis", url: "https://account.2gis.com/orgs/4504136498428595/reviews", prefix: "https://account.2gis.com/orgs/4504136498428595/", wait: 7000, fn: GIS },
    { id: "dt", name: "ДокТу", cls: "pf-dt", url: "https://doctu.ru/msk/clinic/gkb-24/reviews", prefix: "https://doctu.ru/", wait: 4000, fn: DOCTU, noLogin: true, login: "https://manager.doctu.ru/network/reviews" },
    { id: "go", name: "Google", cls: "pf-go", reuse: true, visible: true, url: GOOGLE_URL, prefix: "https://www.google.com/search", wait: 4000, fn: GOOGLE,
      hint: "Если Google просит войти, войдите в окне «Войти» в аккаунт больницы и нажмите «Проверить», не закрывая окно." },
    { id: "np", name: "НаПоправку", cls: "pf-np", url: "https://napopravku.ru/moskva/clinics/gorodskaja-klinicheskaja-bolnica-24/otzyvy/?sort=published", prefix: "https://napopravku.ru/moskva/clinics/gorodskaja-klinicheskaja-bolnica-24/", wait: 3000, fn: NP, login: NP_CABINET,
      hint: "" },
    { id: "mail", name: "Почта сайта", cls: "pf-site", kind: "mail", reuse: true, visible: true, timeout: 240000, url: "https://owa.mos.ru/owa/GB24-press2@zdrav.mos.ru/?offline=disabled#path=/mail", prefix: "https://owa.mos.ru/owa/", wait: 6000, fn: MAIL,
      hint: "" }
  ];

  /* ---------- связь со скрытыми окнами ---------- */
  var pending = {}, diag = {};
  listen("source-diag", function (ev) {
    var d = ev.payload || {}; try { diag[d.id] = JSON.parse(d.diag); } catch (e) { return; }
    render();
  });
  var learning = {};
  listen("source-result", function (ev) {
    var d = ev.payload || {}, p;
    try { p = JSON.parse(d.payload); } catch (e) { p = { ok: false, error: "непонятный ответ" }; }
    if (p && p.kind === "learned") { var l = learning[d.id]; if (l) l(p); return; }
    var f = pending[d.id]; if (f) { delete pending[d.id]; f(p); }
  });

  function collectOne(s, forceReuse) {
    var useReuse = !!s.reuse && (!autoRun || !!forceReuse);
    return collectOnce(s, useReuse).then(function (p) {
      // по расписанию почту читаем в скрытом окне; если там вход не подхватился, читаем из открытого окна почты
      if (!useReuse && s.reuse && p && !p.ok && (p.needLogin || /нужен вход/.test(String(p.error || "")))) return collectOnce(s, true);
      return p;
    });
  }
  function collectOnce(s, useReuse) {
    return new Promise(function (res) {
      var done = false;
      function fin(p) { if (done) return; done = true; clearTimeout(t); delete pending[s.id]; res(p); }
      var t = setTimeout(function () {
        invoke("source_close", { label: "src-" + s.id + "-c" }).catch(function () {});
        fin({ ok: false, error: "страница не ответила" });
      }, s.timeout || 60000);
      pending[s.id] = fin;
      invoke("source_collect", { id: s.id, url: s.url, script: s.kind === "mail" ? "(" + MAIL_ANY.toString() + ")(" + MAIL_API.toString() + "," + MAIL.toString() + "," + JSON.stringify((function () { var m = window.__otvAll("mail") || {}; return Object.keys(m).filter(function (k) { return m[k] && s0(m[k].text).trim(); }); })()) + "," + JSON.stringify(mailOpts()) + ")" : s.cfg ? "(async function(){ var r = await (" + GENERIC.toString() + ")(" + JSON.stringify(s.cfg) + "); return { items: r, seen: document.querySelectorAll(" + JSON.stringify(s.cfg.item) + ").length }; })()" : "(" + s.fn.toString() + ")()", prefix: s.prefix, waitMs: s.wait, show: !!s.show, reuse: useReuse, visible: !!s.visible })
        .catch(function (e) { fin({ ok: false, error: String(e) }); });
    });
  }

  /* ---------- запись в реестр и тревоги ---------- */
  var db = null, srcState = {};
  function nowIso() { return new Date().toISOString(); }
  // время письма (по Москве) как момент поступления
  function arrIso(d, t) { d = s0(d); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return nowIso(); var x = Date.parse(d + "T" + (/^\d{2}:\d{2}$/.test(s0(t)) ? s0(t) : "12:00") + ":00+03:00"); return isNaN(x) ? nowIso() : new Date(x).toISOString(); }
  function getDoc(coll, id) { return db.collection(coll).doc(id).get(); }

  // для проверок: занесение собранных отзывов в реестр
  window.__otvIngest = function (items) { return ingest(items); };
  function ingest(items) {
    var added = 0, alerts = 0;
    return items.reduce(function (pr, it) {
      return pr.then(function () {
        if (!it || !it.id || !/^[A-Za-z0-9_.:@+-]{1,200}$/.test(it.id)) return;
        return getDoc("registry", it.id).then(function (snap) {
          var base = {
            platform: it.platform, date: it.date, time: it.time || "", author: it.author || "", rating: it.rating == null ? null : it.rating,
            page: it.page || "", text: String(it.text || "").slice(0, 300), fullText: String(it.text || ""), link: it.link || "",
            answered: !!it.answered, updatedAt: nowIso()
          };
          if (String(it.reply || "").trim().length >= 10) base.reply = String(it.reply).trim().slice(0, 5000);   // настоящий ответ больницы с площадки
          if (it.dateApprox) base.dateApprox = true;
          if (snap.exists) {
            // площадка иногда отдаёт обрезанное начало: полный текст, прочитанный раньше, не заменяем его началом
            var was = String((snap.data() || {}).fullText || ""), nw = base.fullText.replace(/(\.{3,}|…|Ещё)\s*$/, "").replace(/\s+/g, " ").trim();
            if (was.length > base.fullText.length && nw.length >= 20 && was.replace(/\s+/g, " ").indexOf(nw.slice(0, Math.max(20, nw.length - 5))) === 0) { delete base.text; delete base.fullText; }
            // отзыв был на исправлении у пациента, теперь опубликован: в отчёт и к ответу как новый
            if (it.published !== false && (snap.data() || {}).report === "unpublished") { base.report = "pending"; base.arrivedAt = nowIso(); added++; }   // опубликован только сейчас: поступил сейчас
            return db.collection("registry").doc(it.id).update(base);
          }
          added++;
          return db.collection("registry").doc(it.id).set(Object.assign(base, {
            tone: "", report: it.published === false ? "unpublished" : "pending", reportRef: "", reason: "", source: "auto",
            arrivedAt: it.published === false ? "" : nowIso()   // неделя отчёта считается по дате поступления
          }));
        }).then(function () {
          if (!(it.low || strongNeg(it.text)) || it.published === false) return;
          return getDoc("alerts", it.id).then(function (a) {
            if (a.exists) return db.collection("alerts").doc(it.id).update({ answered: !!it.answered });
            alerts++;
            return db.collection("alerts").doc(it.id).set({
              platform: it.platform, page: it.page || "", date: it.date, rating: it.rating, threshold: it.threshold,
              author: it.author || "", text: String(it.text || ""), link: it.link || "", answered: !!it.answered,
              status: "new", detectedAt: nowIso(), note: ""
            });
          });
        });
      });
    }, Promise.resolve()).then(function () { return { added: added, alerts: alerts }; });
  }

  /* ---------- собранные отзывы → карточки ответов во вкладке «Отзывы» ----------
     Каждый новый отзыв без ответа больницы сразу появляется в «Позитиве» или «Негативе»
     с черновиком из «Базы ответов» (ваши прошлые согласованные ответы). Если на площадке
     ответ уже появился — карточка сама отмечается «Опубликовано». */
  var SIGN = "С уважением, администрация 24 Московской больницы";
  function normT(t) { return s0(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  var NEG_RE = /хамств|хамил|грубил|грубо |ужасн|отвратит|безобраз|не рекоменд|не совету|разочаров|кошмар|равнодуш|не помогл|обманул|грязн|не дозвон|нагруб|бардак|халатн|возмутит|позор/;
  var TH = { "ПроДокторов": 4, "Яндекс": 4, "ДокТу": 4 };
  // жалоба при высокой оценке («врачи хорошие, но персонал грубит») — тоже негатив
  function strongNeg(text) { return !!(window.__otvReports && window.__otvReports.strongNeg && window.__otvReports.strongNeg(s0(text))); }
  function toneOf(it) {
    var r = Number(it.rating);
    if (it.rating != null && it.rating !== "" && !isNaN(r)) return r < (TH[it.platform] || 4.5) || strongNeg(it.text) ? "negative" : "positive";
    return NEG_RE.test(normT(it.text)) || strongNeg(it.text) ? "negative" : "positive";
  }
  function shortName(full) {
    var p = s0(full).trim().split(/\s+/);
    if (p.length >= 3 && /^[А-ЯЁ]/.test(p[1])) return p[0] + " " + p[1][0] + "." + p[2][0] + ".";
    return s0(full).trim();
  }
  function pageLabel(it) {
    var pg = s0(it.page).trim();
    if (it.platform === "ПроДокторов") return /больниц/i.test(pg) ? "Страница больницы" : "Страница врача: " + shortName(pg);
    if (it.platform === "ДокТу") { pg = pg.replace(/^(Карточка врача:\s*)+/, ""); return pg && !/больниц|клиник/i.test(pg) ? "Карточка врача: " + shortName(pg) : "Карточка больницы"; }
    return pg || "Карточка больницы";
  }
  function isDoctorPage(label) { return /врача/i.test(label); }
  // обращаемся по имени, только если это настоящее имя («Пациент», «Гость», ники — просто «Здравствуйте!»)
  function greeting(author) {
    var n = window.__otvGen && window.__otvGen.nameOf ? window.__otvGen.nameOf(author) : "";
    return n ? "Здравствуйте, " + n + "!" : "Здравствуйте!";
  }
  var NAMED = /[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(вне|вичу|ичне|ьичу)\b|передад\S*[^.]*[А-ЯЁ][а-яё]+(у|е|ю)\b/;
  var NEG_ANS = /разобрат|gkb24@|напишите|свяжемся|дату (обращения|госпитализации)|сожалее/i;
  var usedKb = {};
  function pickDraft(it, label) {
    var tone = toneOf(it);
    if (window.__otvGen) {
      try {
        var g = window.__otvGen.answer({ platform: it.platform, page: label, author: s0(it.author), review: s0(it.text), rating: it.rating, tone: tone });
        if (g && g.text) return { text: g.text, tone: tone, fromKb: /^kb:/.test(g.key), key: g.key };
      } catch (e) {}
    }
    return pickDraftOld(it, label, tone);
  }
  function pickDraftOld(it, label, tone) {
    var docPage = isDoctorPage(label), len = s0(it.text).length;
    var bucket = len < 160 ? 0 : len < 450 ? 1 : 2;
    var kb = window.__otvAll("kb") || {}, cand = [];
    Object.keys(kb).forEach(function (k) {
      var e = kb[k]; if (!e || e.kind !== "review") return;
      var ans = s0(e.answer).trim(); if (!ans || NAMED.test(ans)) return;
      if ((NEG_ANS.test(ans) ? "negative" : "positive") !== tone) return;
      if (isDoctorPage(e.page) !== docPage) return;
      var sl = s0(e.situation).length, b = sl < 160 ? 0 : sl < 450 ? 1 : 2;
      var score = (e.platform === it.platform ? 2 : 0) + (b === bucket ? 2 : 0) - (usedKb[k] ? 5 : 0) + Math.random();
      cand.push({ k: k, ans: ans, score: score });
    });
    cand.sort(function (a, b) { return b.score - a.score; });
    var body;
    if (cand.length) {
      usedKb[cand[0].k] = 1;
      body = cand[0].ans.split("\n").filter(function (l) { return !/^Здравствуйте/.test(l.trim()) && l.trim() !== SIGN; }).join("\n").trim();
    } else if (tone === "negative") {
      body = "Спасибо за обратную связь. Пожалуйста, напишите нам на gkb24@zdrav.mos.ru и укажите дату обращения. Мы разберёмся в ситуации.";
    } else if (docPage) {
      body = "Спасибо за отзыв. Рады, что вы остались довольны лечением. Желаем здоровья и всего самого доброго.";
    } else {
      body = "Спасибо за высокую оценку работы наших сотрудников. Ценим ваше доверие и всегда готовы помочь. Желаем здоровья и всего самого доброго.";
    }
    var hello = tone === "negative" ? greeting(it.author).replace(/!$/, ".") : greeting(it.author);
    return { text: hello + "\n" + body + "\n" + SIGN, tone: tone, fromKb: cand.length > 0 };
  }
  function ruDate(iso) { var m = s0(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "." + m[2] + "." + m[1] : s0(iso); }
  var ANSWER_URL = { "Яндекс": "https://yandex.ru/sprav/1022361531/p/edit/reviews/", "2ГИС": "https://account.2gis.com/orgs/4504136498428595/reviews" };
  /* проекты ответов моделью: после сбора, по одному, в фоне; черновик меняется, только если вы его ещё не трогали */
  var modelQ = [], modelBusy = false;
  function modelDrafts(list) {
    if (!window.__otvModel || !window.__otvModel.ready()) return;
    modelQ = modelQ.concat(list);
    (function next() {
      if (modelBusy || !modelQ.length || !window.__otvModel.ready()) return;
      var x = modelQ.shift(); modelBusy = true;
      window.__otvModel.write(x.req).then(function (txt) {
        var cur = (window.__otvAll("answers") || {})[x.id];
        if (!txt || !cur || cur.status !== "pending" || s0(cur.answer) !== x.draft) return;
        return db.collection("answers").doc(x.id).update({ answer: txt, draft: txt, draftBy: "model" });
      }).catch(function () {}).then(function () { modelBusy = false; next(); });
    })();
  }
  function makeAnswers(items) {
    var all = window.__otvAll("answers") || {}, byText = {}, made = 0, closed = 0, n0 = Date.now(), fresh = [];
    // совпадение по тексту только для записей без номера площадки (перенесённые из онлайн-версии) и только в тот же день:
    // похожие начала отзывов («Хочу поблагодарить доктора…») не должны съедать новую карточку
    var NATIVE = /^(pdl?|ya|2gis|doctu|dt|np|go|gg|site)-/;
    Object.keys(all).forEach(function (id) { var a = all[id]; if (a && !NATIVE.test(id)) byText[s0(a.platform) + "|" + s0(a.date) + "|" + normT(a.review).slice(0, 60)] = id; });
    var cutoff = Date.now() - DAYS * 864e5;
    return items.reduce(function (p, it, i) {
      return p.then(function () {
        if (!it || !it.id || !/^[A-Za-z0-9_.:@+-]{1,200}$/.test(it.id) || it.published === false) return;
        if (Date.parse(it.date) < cutoff - 864e5) return;
        var num = it.platform === "ПроДокторов" ? s0(it.id).replace(/^pdl?-/, "") : "";
        var ex = all[it.id] ? it.id : num && all["pdl-" + num] ? "pdl-" + num : num && all["pd-" + num] ? "pd-" + num : byText[it.platform + "|" + ruDate(it.date) + "|" + normT(it.text).slice(0, 60)];
        if (ex && ex !== it.id && !/^pdl?-/.test(ex)) jlog("ответ: " + it.id + " совпал по тексту с записью " + ex);
        if (ex) {
          var a = all[ex];
          if (it.answered && a && a.kind !== "appeal" && (a.status === "pending" || a.status === "approved" || a.status === "fix")) {
            closed++;
            return db.collection("answers").doc(ex).update({ status: "published", publishedAt: nowIso(), publishedBy: "platform", decidedAt: nowIso() });
          }
          // ПроДокторов точно говорит, есть ли ответ: в программе «опубликовано», а на площадке ответа нет, значит, возвращаем в «к ответу»
          if (!it.answered && it.platform === "ПроДокторов" && a && a.kind !== "appeal" && a.status === "published" && Date.now() - Date.parse(s0(a.publishedAt) || 0) > 2 * 3600e3) {
            made++;
            jlog("ответ: " + ex + " отмечен опубликованным, а на ПроДокторов ответа нет: вернула в «Новые»");
            return db.collection("answers").doc(ex).update({ status: "pending", note: "На ПроДокторов ответа нет: проверьте и опубликуйте", publishRequested: "", publishError: "" });
          }
          return;
        }
        if (it.answered || all[it.id + "-appeal"]) return;
        var label = pageLabel(it), d = pickDraft(it, label);
        made++;
        fresh.push({ id: it.id, draft: d.text, req: { kind: "answer", platform: it.platform, page: label, author: s0(it.author), review: s0(it.text), rating: it.rating, tone: d.tone } });
        if (d.tone === "negative") {
          getDoc("alerts", it.id).then(function (a) {
            if (a.exists) return;
            return db.collection("alerts").doc(it.id).set({ platform: it.platform, page: it.page || "", date: it.date, rating: it.rating == null ? null : it.rating,
              threshold: TH[it.platform] || 4.5, author: it.author || "", text: s0(it.text), link: it.link || "", answered: false, status: "new", detectedAt: nowIso(), note: "" });
          }).catch(function () {});
        }
        return db.collection("answers").doc(it.id).set({
          platform: it.platform, page: label, date: ruDate(it.date), author: s0(it.author), review: s0(it.text),
          answer: d.text, draft: d.text, status: "pending", edited: false,
          note: "",
          link: ANSWER_URL[it.platform] || s0(it.link), rating: it.rating == null ? null : it.rating, threshold: it.threshold == null ? null : it.threshold,
          low: !!it.low, tone: d.tone, n: n0 + i, week: "", source: "app", createdAt: nowIso()
        });
      });
    }, Promise.resolve()).then(function () { modelDrafts(fresh); return { made: made, closed: closed }; });
  }

  /* ---------- публикация ответов прямо из программы ----------
     «Опубликовать» на карточке ставит отметку publishRequested; программа открывает отзыв
     в кабинете (где вы уже вошли), вписывает согласованный текст без изменений, отправляет
     и проверяет, что ответ появился. Не получилось — на карточке будет причина и «Опубликую сама ↗». */
  async function PUB_PD(text, rateId, rateType) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // отзыв о враче — /rates/rate/N/, о больнице — /rates/ratelpu/N/
    const state = () => fetch('/api/cabinet/rates/' + (rateType || 'rate') + '/' + rateId + '/', { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null);
    let st = await state();
    if (st && st.answer_moderation_status) return { already: true };
    // поле ответа: подпись «Ответ на отзыв...» стоит в <label for>, а не в placeholder
    const labelOf = t => { const l = t.id && document.querySelector('label[for="' + t.id + '"]'); return (l ? l.textContent : '') + ' ' + (t.placeholder || '') + ' ' + (t.getAttribute('aria-label') || ''); };
    let ta = null;
    for (let i = 0; i < 30 && !ta; i++) {
      const vis = [...document.querySelectorAll('textarea')].filter(t => t.offsetParent || t.getClientRects().length);
      ta = vis.find(t => /ответ/i.test(labelOf(t))) || (vis.length === 1 ? vis[0] : null);
      if (!ta) await sleep(500);
    }
    if (!ta) throw new Error('не нашла поле ответа на странице отзыва');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    ta.focus(); setter.call(ta, text); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400);
    if (ta.value !== text) throw new Error('текст в поле не совпал с согласованным');
    const btn = [...document.querySelectorAll('button, input[type=submit]')].find(b => /^Ответить$/i.test((b.textContent || b.value || '').trim()) && (b.offsetParent || b.getClientRects().length));
    if (!btn) throw new Error('не нашла кнопку «Ответить»');
    if (btn.disabled) { ta.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' })); await sleep(300); }
    if (btn.disabled) throw new Error('кнопка «Ответить» неактивна');
    btn.click();
    for (let i = 0; i < 20; i++) { await sleep(700); st = await state(); if (st && st.answer_moderation_status) return { ok: true }; }
    throw new Error('ответ отправлен, но площадка его не подтвердила. Проверьте в кабинете');
  }
  /* общий способ для Яндекса, 2ГИС и Google: карточка отзыва по автору и тексту → поле ответа → отправка */
  async function PUB_CARD(text, author, review, cfg) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const head = norm(review).slice(0, 60), who = norm(author);
    if ([...document.querySelectorAll('input[type=password]')].some(e => e.offsetParent)) throw new Error('нужен вход в кабинет. «Источники» → «Войти»');
    const docs = () => [document].concat([...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch (e) { return null; } }).filter(Boolean));
    if (cfg.open) {
      for (const d of docs()) { const b = [...d.querySelectorAll('a,button,[role=button],span')].find(e => e.children.length < 3 && cfg.open.test((e.textContent || '').trim())); if (b) { b.click(); break; } }
      await sleep(5000);
    }
    let card = null;
    for (let i = 0; i < 30 && !card; i++) {
      const found = [];
      for (const d of docs()) for (const e of d.querySelectorAll(cfg.card)) {
        const t = norm(e.innerText);
        if (head.length >= 10 ? t.includes(head) : true) { if (!who || t.includes(who)) found.push(e); }
      }
      // самый вложенный подходящий блок
      const leaf = found.filter(e => !found.some(o => o !== e && e.contains(o)));
      if (leaf.length > 1) throw new Error('нашлось несколько похожих отзывов. Опубликуйте вручную');
      card = leaf[0] || null;
      if (!card) await sleep(700);
    }
    if (!card) throw new Error('не нашла этот отзыв на странице');
    const replyBtn = el => [...el.querySelectorAll('button,[role=button],a,span')].find(e => e.children.length < 3 && /^Ответить$/i.test((e.textContent || '').trim()));
    for (let i = 0; i < 6 && card.parentElement && !card.querySelector('textarea') && !replyBtn(card); i++) card = card.parentElement;
    if (cfg.answered && cfg.answered.test(card.innerText)) return { already: true };
    let ta = card.querySelector('textarea');
    if (!ta) {
      const b = replyBtn(card);
      if (b) { b.click(); for (let i = 0; i < 10 && !(ta = card.querySelector('textarea')); i++) await sleep(400); }
    }
    if (!ta) throw new Error('не нашла поле ответа');
    const win = ta.ownerDocument.defaultView;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
    ta.focus(); setter.call(ta, text); ta.dispatchEvent(new win.Event('input', { bubbles: true })); ta.dispatchEvent(new win.Event('change', { bubbles: true }));
    await sleep(500);
    if (ta.value !== text) throw new Error('текст в поле не совпал с согласованным');
    const box = ta.closest(cfg.box || 'form') || card;
    const send = [...box.querySelectorAll('button,[role=button]')].filter(b => b.offsetParent && !b.disabled && !/отмена|удалить|пожаловаться|благодарим/i.test(b.textContent || ''))
      .find(b => cfg.send.test((b.textContent || b.getAttribute('aria-label') || '').trim()) || (cfg.sendIcon && !(b.textContent || '').trim()));
    if (!send) throw new Error('не нашла кнопку отправки');
    send.click();
    const mark = norm(text).slice(0, 40);
    for (let i = 0; i < 20; i++) { await sleep(800); if (!card.isConnected || (norm(card.innerText).includes(mark) && !card.querySelector('textarea'))) return { ok: true }; }
    throw new Error('ответ отправлен, но на странице не появился. Проверьте вручную');
  }
  async function PUB_DOCTU(text, surname, review) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const SIGNED = /администрация 24 Московской больницы/;
    const head = norm(review).replace(/[.…\s]+$/, '').slice(0, 40), sur = norm(surname);
    let row = null;
    for (let i = 0; i < 30 && !row; i++) {
      const rows = [...document.querySelectorAll('tr.table-row')].filter(x => x.querySelector('legend a'));
      const m = rows.filter(x => (!sur || norm(x.querySelector('legend a').textContent).includes(sur)) && norm((x.querySelector('.commentTextElipsis') || x).innerText).includes(head));
      if (m.length > 1) throw new Error('нашлось несколько похожих отзывов. Опубликуйте вручную');
      row = m[0] || null;
      if (!row) await sleep(700);
    }
    if (!row) throw new Error('не нашла этот отзыв в кабинете ДокТу');
    if (SIGNED.test(row.textContent)) return { already: true };
    const btn = [...row.querySelectorAll('button')].find(b => /^Ответить$/.test((b.textContent || '').trim()));
    if (!btn) throw new Error('нет кнопки «Ответить»');
    btn.click();
    let ta = null;
    for (let i = 0; i < 15 && !ta; i++) { ta = row.querySelector('textarea') || [...document.querySelectorAll('.modal textarea')].find(t => t.offsetParent) || null; if (!ta) await sleep(400); }
    if (!ta) throw new Error('не открылось поле ответа');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    ta.focus(); setter.call(ta, text); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400);
    if (ta.value !== text) throw new Error('текст в поле не совпал с согласованным');
    const scope = ta.closest('.modal') || row;
    const send = [...scope.querySelectorAll('button')].find(b => /^Отправить$/.test((b.textContent || '').trim()) && !b.disabled);
    if (!send) throw new Error('не нашла кнопку «Отправить»');
    send.click();
    const mark = norm(text).slice(0, 40);
    for (let i = 0; i < 20; i++) { await sleep(800); if (SIGNED.test(row.textContent) || norm(row.innerText).includes(mark)) return { ok: true }; }
    throw new Error('ответ отправлен, но в кабинете не появился. Проверьте');
  }
  var PUBF = {
    "ПроДокторов": function (r) {
      var m = /^pdl?-(\d+)/.exec(r.id), link = s0(r.link);
      if (!m) return null;
      if (!/^https:\/\/prodoctorov\.ru\/cabinet\/lpu-rates\//.test(link)) return { error: "нет ссылки на отзыв в кабинете" };
      var t = /\/lpu-rates\/(rate|ratelpu)\//.exec(link);
      return { url: link, prefix: "https://prodoctorov.ru/cabinet/", script: "(" + PUB_PD.toString() + ")(" + [s0(r.answer), m[1], t ? t[1] : "rate"].map(function (x) { return JSON.stringify(x); }).join(",") + ")" };
    },
    "Яндекс": function (r) {
      return { url: "https://yandex.ru/sprav/1022361531/p/edit/reviews/", prefix: "https://yandex.ru/sprav/1022361531/",
        script: "(" + PUB_CARD.toString() + ")(" + [r.answer, r.author, r.review].map(function (x) { return JSON.stringify(s0(x)); }).join(",") +
          ", { card: '.Review', box: '.Review-BusinessResponse', send: /^(Отправить|Опубликовать)$/i, sendIcon: true })" };
    },
    "2ГИС": function (r) {
      return { url: "https://account.2gis.com/orgs/4504136498428595/reviews", prefix: "https://account.2gis.com/orgs/4504136498428595/",
        script: "(" + PUB_CARD.toString() + ")(" + [r.answer, r.author, r.review].map(function (x) { return JSON.stringify(s0(x)); }).join(",") +
          ", { card: 'div', send: /^(Отправить|Опубликовать|Ответить)$/i, answered: /С уважением,? администрация/ })" };
    },
    "ДокТу": function (r) {
      var m = /([А-ЯЁA-Z][^\s,.:]+)\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.?\s*$/.exec(s0(r.page).replace(/^(Карточка врача:\s*)+/, "")) || /врача:\s*(?!Карточка)([А-ЯЁA-Z][^\s,.:]+)/.exec(s0(r.page));
      return { url: "https://manager.doctu.ru/network/reviews", prefix: "https://manager.doctu.ru/",
        script: "(" + PUB_DOCTU.toString() + ")(" + [r.answer, m ? m[1] : "", r.review].map(function (x) { return JSON.stringify(s0(x)); }).join(",") + ")" };
    },
    "НаПоправку": function (r) {
      return { url: NP_CABINET, prefix: "https://profile.napopravku.ru/",
        script: "(" + PUB_CARD.toString() + ")(" + [r.answer, r.author, r.review].map(function (x) { return JSON.stringify(s0(x)); }).join(",") +
          ", { card: 'div', send: /^(Отправить|Опубликовать|Ответить|Сохранить)$/i, answered: /администрация 24 Московской больницы/ })" };
    },
    "Google": function (r) {
      return { url: GOOGLE_URL, prefix: "https://www.google.com/search", visible: true,
        script: "(" + PUB_CARD.toString() + ")(" + [r.answer, r.author, r.review].map(function (x) { return JSON.stringify(s0(x)); }).join(",") +
          ", { card: 'div', send: /^(Ответить|Отправить|Опубликовать)$/i, answered: /Владелец/ })" };
    }
  };
  function publishOne(r) {
    var mk = PUBF[s0(r.platform)], job = mk ? mk(r) : null;
    if (!job) return Promise.resolve({ ok: false, error: "эту площадку программа пока не публикует" });
    if (job.error) return Promise.resolve({ ok: false, error: job.error });
    var key = "pub" + ({ "ПроДокторов": "pd", "Яндекс": "ya", "2ГИС": "gis", "ДокТу": "dt", "НаПоправку": "np" }[s0(r.platform)] || "go");
    return new Promise(function (res) {
      var done = false;
      function fin(p) { if (done) return; done = true; clearTimeout(t); delete pending[key]; invoke("source_close", { label: "src-" + key + "-c" }).catch(function () {}); res(p); }
      var t = setTimeout(function () { fin({ ok: false, error: "площадка не ответила за 2 минуты" }); }, 120000);
      pending[key] = fin;
      invoke("source_collect", { id: key, url: job.url, script: job.script, prefix: job.prefix, waitMs: 3000, show: false, reuse: false, visible: true })
        .catch(function (e) { fin({ ok: false, error: String(e) }); });
    });
  }
  var pubBusy = false, pubAgain = false, pubTimer = null;
  function schedulePub() { clearTimeout(pubTimer); pubTimer = setTimeout(runPub, 500); }
  window.__otvPubNow = schedulePub;
  // для отчёта: какие источники читаются (для проверки полноты). Источник, который ни разу не запускали, не считаем
  window.__otvSrcHealth = function () {
    return SOURCES.filter(function (x) { var t = srcState[x.id]; return t && (t.at || t.okAt); }).map(function (x) {
      var t = srcState[x.id]; return { name: x.name, ok: !!t.ok, okAt: t.okAt || (t.ok ? t.at : ""), needLogin: !!t.needLogin, down: !!t.down };
    });
  };
  function runPub() {
    if (!db) return;
    if (pubBusy) { pubAgain = true; return; }
    var all = window.__otvAll("answers") || {};
    var todo = Object.keys(all).map(function (id) { return Object.assign({ id: id }, all[id]); })
      .filter(function (r) { return r.status === "approved" && r.kind !== "appeal" && s0(r.publishRequested) && PUBF[s0(r.platform)] && s0(r.answer).trim(); });
    if (!todo.length) return;
    pubBusy = true;
    var okN = 0, bad = [];
    window.__otvBar.show("Публикую ответы: " + todo.length + "…", "", []);
    todo.reduce(function (p, r) {
      return p.then(function () {
        return publishOne(r).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; }).then(function (res) {
          var ref = db.collection("answers").doc(r.id);
          jlog("публикация " + r.platform + " " + r.id + ": " + (res.ok && res.items && (res.items.ok || res.items.already) ? (res.items.already ? "ответ уже был" : "опубликовано") : "НЕ вышло: " + (res.needLogin ? "нужен вход" : (res.error || (res.items && res.items.error) || "?")) + (res.url ? " · " + String(res.url).split("?")[0] : "")));
          if (res.ok && res.items && (res.items.ok || res.items.already)) {
            okN++;
            var up = { status: "published", publishedAt: nowIso(), publishedBy: "app", publishRequested: "", publishError: "" };
            if (res.items.already) up.note = (s0(r.note) ? s0(r.note) + " · " : "") + "ответ уже был на площадке";
            return ref.update(up).then(function () { return db.collection("registry").doc(r.id).update({ answered: true, updatedAt: nowIso() }).catch(function () {}); });
          }
          var why = res.needLogin ? "нужен вход в кабинет. «Источники» → «Войти»" : (res.error || (res.items && res.items.error) || "не получилось");
          bad.push(r.platform);
          return ref.update({ publishRequested: "", publishError: why });
        }).catch(function (e) { jlog("публикация " + r.platform + ": ошибка записи " + (e && e.message || e)); });
      });
    }, Promise.resolve()).catch(function (e) { jlog("публикация прервана: " + (e && e.message || e)); }).then(function () {
      pubBusy = false;
      window.__otvBar.show("Опубликовано " + okN + " из " + todo.length + (bad.length ? ". Не вышло: " + bad.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", ") + ": причина на карточке" : ""), bad.length ? "" : "ok", [["Закрыть", window.__otvBar.hide]]);
      if (pubAgain) { pubAgain = false; schedulePub(); }
    });
  }
  window.addEventListener("otv-write", function (ev) { var d = ev.detail || {}; if (d.name === "answers") schedulePub(); });

  /* разовая правка уже готовых проектов: без «Здравствуйте, Пациент!», без отметок «на доп. проверку»,
     у негатива с ПроДокторов — обычный проект ответа */
  function fixGreeting(text, edited) {
    var t = s0(text), m = /^Здравствуйте,\s*([^!.\n]{1,60})([!.])/.exec(t);
    if (!m || !window.__otvGen) return t;
    var bad = edited ? window.__otvGen.isGeneric(m[1]) : !window.__otvGen.nameOf(m[1]);
    return bad ? t.replace(m[0], "Здравствуйте" + m[2]) : t;
  }
  function tidyDrafts() {
    if (!db || !window.__otvGen) return Promise.resolve();
    var jobs = [], alertsNew = [];
    var all = window.__otvAll("answers") || {};
    Object.keys(all).forEach(function (id) {
      var a = all[id]; if (!a || a.status === "published" || a.status === "skip" || a.kind === "appeal") return;
      var up = {}, ans = s0(a.answer), f = fixGreeting(ans, !!a.edited);
      if (f !== ans) { up.answer = f; if (s0(a.draft) === ans) up.draft = f; }
      if (/доп\.? ?проверк|^Черновик из базы/i.test(s0(a.note))) up.note = "";
      if (/^Карточка врача:\s*Карточка врача:/.test(s0(a.page))) up.page = s0(a.page).replace(/^(Карточка врача:\s*)+/, "Карточка врача: ");
      // публикация не прошла из-за ошибок, исправленных в 0.2.23: отправляем ещё раз сами
      if (a.status === "approved" && /не нашла поле ответа на странице отзыва|не нашла этот отзыв в кабинете ДокТу/.test(s0(a.publishError))) {
        up.publishRequested = nowIso(); up.publishError = "";
      }
      if (a.platform === "ПроДокторов" && !ans.trim() && a.status === "pending") {
        var it = { platform: a.platform, author: a.author, text: a.review, rating: a.rating };
        var d = pickDraft(it, s0(a.page));
        if (d && d.text) { up.answer = d.text; up.draft = d.text; }
      }
      // благодарность с жалобой, которую раньше приняли за позитив: проект ответа на жалобу и тревога в «Негативе»
      if (a.status === "pending" && !a.edited && a.kind !== "question" && s0(a.tone) !== "negative" && strongNeg(a.review)) {
        var it2 = { platform: a.platform, author: a.author, text: a.review, rating: a.rating };
        var d2 = pickDraft(it2, s0(a.page));
        if (d2 && d2.text && d2.tone === "negative") { up.answer = d2.text; up.draft = d2.text; up.tone = "negative"; }
        if (!(window.__otvAll("alerts") || {})[id]) alertsNew.push([id, a]);
      }
      if (Object.keys(up).length) jobs.push(["answers", id, up]);
    });
    alertsNew.forEach(function (x) {
      var a = x[1], m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s0(a.date));
      jobs.push(["alerts", x[0], { platform: a.platform, page: a.page || "", date: m ? m[3] + "-" + m[2] + "-" + m[1] : s0(a.date), rating: a.rating == null ? null : a.rating,
        threshold: TH[a.platform] || 4.5, author: a.author || "", text: s0(a.review), link: a.link || "", answered: false, status: "new", detectedAt: nowIso(), note: "" }, true]);
    });
    var mail = window.__otvAll("mail") || {}, alAll = window.__otvAll("alerts") || {}, regAll = window.__otvAll("registry") || {}, since = mailSince();
    Object.keys(mail).forEach(function (id) {
      var m = mail[id]; if (!m) return;
      // письмо за период, которого нет в реестре (из него строится отчёт): заводим
      if (!regAll[id] && s0(m.date) >= since && !m.dup && !m.gone) {
        var k1 = s0(m.kind) || letterKind(s0(m.type), m.text);
        jobs.push(["registry", id, { platform: "Сайт", date: s0(m.date), time: s0(m.time), author: s0(m.name), rating: null, page: s0(m.page), text: s0(m.text).slice(0, 300),
          fullText: s0(m.text), link: "", answered: !!m.answered, tone: k1 === "complaint" ? "negative" : k1 === "thanks" ? "positive" : "", report: "pending", reportRef: "", reason: "", source: "auto", arrivedAt: arrIso(m.date, m.time), updatedAt: nowIso() }, true]);
      }
      if (m.status === "done") return;
      // письма раньше отчётного периода: давно отвечены, убираем из «к ответу»
      if (s0(m.date) && s0(m.date) < since) {
        jobs.push(["mail", id, { status: "done", note: "" }]);
        if (alAll[id] && alAll[id].status !== "done") jobs.push(["alerts", id, { status: "done", statusAt: nowIso() }]);
        return;
      }
      // заново по смыслу текста: жалоба, благодарность или вопрос
      if (!m.manual && s0(m.text).trim()) {
        var ty = s0(m.type) || (s0(m.subject).match(/^(\S+)/) || [])[1] || "";
        var k = letterKind(ty, m.text);
        if (k !== m.kind) {
          jobs.push(["mail", id, { kind: k }]);
          jobs.push(["registry", id, { tone: k === "complaint" ? "negative" : k === "thanks" ? "positive" : "", report: "pending", reportRef: "", reason: "" }]);
          if (k === "complaint" && !alAll[id]) jobs.push(["alerts", id, { platform: "Сайт", page: s0(m.page), date: s0(m.date), rating: null, threshold: null, author: s0(m.name),
            text: s0(m.text).slice(0, 1500), link: "", answered: false, status: "new", detectedAt: nowIso(), note: "" }, true]);
          if (k !== "complaint" && alAll[id] && alAll[id].status !== "done") jobs.push(["alerts", id, { status: "done", statusAt: nowIso() }]);
        }
      }
      var up = {};
      ["draft", "answer"].forEach(function (k) { var v = s0(m[k]); if (v) { var f = fixGreeting(v, false); if (f !== v) up[k] = f; } });
      if (Object.keys(up).length) jobs.push(["mail", id, up]);
    });
    if (jobs.length) jlog("правка проектов: " + jobs.length);
    return jobs.reduce(function (p, j) { return p.then(function () { var ref = db.collection(j[0]).doc(j[1]); return (j[3] ? ref.set(j[2]) : ref.update(j[2])).catch(function () {}); }); }, Promise.resolve());
  }

  var customs = [];
  function customToSource(c) {
    var origin = ""; try { origin = new URL(c.url).origin + "/"; } catch (e) {}
    return { id: c.id, name: c.name, cls: "pf-site", url: c.url, prefix: origin, wait: 5000, custom: true,
      cfg: Object.assign({}, c.cfg, { prefix: c.id, name: c.name, threshold: c.threshold, page: c.page || "Страница" }) };
  }
  function applyCustoms() {
    SOURCES = SOURCES.filter(function (s) { return !s.custom; }).concat(customs.map(customToSource));
    customs.forEach(function (c) { invoke("source_allow", { url: c.url }).catch(function () {}); });
  }
  function saveCustoms() {
    return db.collection("registry_meta").doc("custom_sources").set({ list: customs, updatedAt: nowIso() });
  }
  var addOpen = false;
  function addSource(name, url, threshold) {
    var u; try { u = new URL(url); } catch (e) { return Promise.reject("адрес не похож на ссылку"); }
    if (u.protocol !== "https:") return Promise.reject("нужна ссылка, которая начинается с https://");
    var id = "c" + Date.now().toString(36);
    learning[id] = function (p) {
      delete learning[id];
      customs.push({ id: id, name: name, url: p.url || url, threshold: threshold, cfg: p.cfg, addedAt: nowIso() });
      applyCustoms();
      saveCustoms().then(function () {
        addOpen = false; render();
        window.__otvBar.show("Источник «" + name + "» добавлен: на странице нашлось отзывов с датой: " + p.count + ". Теперь он собирается вместе со всеми.", "ok", [["Закрыть", window.__otvBar.hide]]);
        setTimeout(function () { invoke("source_close", { label: "src-" + id }).catch(function () {}); }, 1500);
      });
    };
    return invoke("source_allow", { url: url }).then(function () {
      return invoke("source_open", { id: id, url: url, title: "Покажите отзыв: " + name,
        script: "(" + PICKER.toString() + ")(" + JSON.stringify(id) + ", " + GENERIC.toString() + ")" });
    });
  }


  function mailSince() {
    var st = window.__otvReports && window.__otvReports.state && window.__otvReports.state();
    // неделя по поступлению: читаем почту и за прошлую неделю, чтобы письмо, не попавшее в её отчёт, не потерялось
    if (st && /^\d{4}-\d{2}-\d{2}$/.test(s0(st.start))) return new Date(Date.parse(st.start + "T12:00:00+03:00") - 7 * 864e5).toISOString().slice(0, 10);
    var d = new Date(Date.now() - 7 * 864e5); return d.toISOString().slice(0, 10);
  }
  function mailOpts() {
    var since = mailSince(), m = window.__otvAll("mail") || {}, todo = [];
    Object.keys(m).forEach(function (id) { var x = m[id]; if (x && (x.status || "todo") === "todo" && s0(x.date) >= since) todo.push({ id: id, name: s0(x.name), eh: s0(x.emailHash), date: s0(x.date) }); });
    return { since: since, todo: todo };
  }
  /* что это за письмо, по смыслу текста; выбор пациента в форме (тип обращения) учитываем, но не верим вслепую */
  function letterKind(type, text) {
    var ty = s0(type).toLowerCase(), t = " " + s0(text).toLowerCase().replace(/ё/g, "е") + " ";
    var cnt = function (re) { var m = t.match(re); return m ? m.length : 0; };
    var thx = cnt(/благодар|спасибо|признател|низкий поклон|золот\S* рук|профессионал|внимательн|чутк|заботлив|отзывчив|молодц|умниц|доброжелательн|компетентн|от всей души|рекоменду|на высоте|спасли|вылечил|выходил[аи]?\b|поставил[аи]? на ноги/g);
    var neg = cnt(/жалоб|возмущ|безобраз|(^|[^а-я])(хам|нахам)|груб\S*|хамств|ужасн|отвратит|кошмар|не помогл|не помогают|халатн|(^|[^е])равнодуш|безразлич|игнорир|бардак|грязн|не дозвон|не могу дозвон|не отвечают|никто не (подош|объясн|отвеча|приш|помог)|отказал|отказыва|не принял|не приняли|не принимают|недовол|разберитесь|требую|прошу разобраться|прошу принять меры|вымога|потеряли|не лечат|не оказал|бросили|оставили без|кричал|унижа|наплева|позор|некомпетент|не обезбол|издевал|обман/g);
    var q = cnt(/\?|подскажите|можно ли|как (записаться|попасть|получить|узнать|оформить)|сколько стоит|стоимост|нужно ли|возможно ли|интересует|хотел\S* бы узнать|прошу (сообщить|разъяснить|подсказать|записать|предоставить|выдать)|куда обратиться|когда (можно|будет)/g);
    if (strongNeg(text)) neg++;
    // хоть одна жалоба в тексте: это жалоба (благодарность с жалобой тоже идёт как жалоба)
    if (neg >= 1 || /жалоб|complain|claim/.test(ty)) return "complaint";
    if (/благодар|отзыв|thank|gratitud|review|feedback/.test(ty)) thx += 1; else if (/вопрос|question/.test(ty)) q += 0.5;
    if (thx >= 1 && thx >= q) return "thanks";
    if (q >= 1) return "question";
    if (thx >= 1) return "thanks";
    return "other";
  }
  function mailKind(type, text) { return letterKind(type, text); }
  function oldMailKind(type, text) {
    var ty = s0(type).toLowerCase(), x = (ty + " " + s0(text)).toLowerCase();
    if (/жалоб|возмущ|безобраз|хамств|не помогл|ужасн|отвратит|требую|разберитесь|недовол|грубо|халатн/.test(x) || strongNeg(text)) return "complaint";
    if (/благодар|спасибо|отзыв/.test(ty) || /благодар|спасибо|признател|золотые руки|профессионал|внимательн|рекоменду/.test(x)) return "thanks";
    if (/\?|подскажите|запис|госпитализ|можно ли|прошу|как получить|справк|выписк/.test(x)) return "question";
    return "other";
  }
  function s0(v) { return v == null ? "" : String(v); }
  function normTx(t) { return s0(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  function toneOfKind(k) { return k === "complaint" ? "negative" : k === "thanks" ? "positive" : ""; }
  function inTable(r) { return !!(r && (r.report === "positive" || r.report === "negative") && r.reportRef); }
  function seqJobs(jobs) {
    return jobs.reduce(function (p, j) { return p.then(function () { var ref = db.collection(j[0]).doc(j[1]); return (j[3] ? ref.set(j[2]) : ref.update(j[2])).catch(function () {}); }); }, Promise.resolve());
  }
  /* письма с формы сайта → «Почта сайта» (к ответу) и реестр (из него строится отчёт).
     mdiag.complete: письма прочитаны прямо с сервера почты полностью, тогда список за период точный */
  // настоящий ответ на письмо (текст из «Отправленных»): в письмо и в реестр, откуда его берёт отчёт
  function saveReplies(replies) {
    return Object.keys(replies || {}).reduce(function (p, id) {
      if (!/^[A-Za-z0-9_.:@+-]{1,200}$/.test(id)) return p;
      return p.then(function () {
        return Promise.all(["mail", "registry"].map(function (c) {
          return getDoc(c, id).then(function (d) { if (d.exists && s0((d.data() || {}).reply) !== replies[id]) return db.collection(c).doc(id).update({ reply: replies[id], replyAt: nowIso() }); });
        }));
      });
    }, Promise.resolve());
  }
  window.__otvSaveReplies = saveReplies;   // для проверок
  function ingestMail(items, answeredIds, mdiag) {
    var added = 0, alerts = 0, unread = 0, replied = 0, fixed = 0, dups = 0, closed = 0, wrongRows = 0, wrongRefs = [];
    answeredIds = answeredIds || [];
    var since = mailSince();
    var full = !!(mdiag && mdiag.api && mdiag.complete);
    var live = items.filter(function (it) { return it && !it.dup && s0(it.date) >= since; });
    var regNow = window.__otvAll("registry") || {}, inTableCache = {};
    Object.keys(regNow).forEach(function (id) { if (inTable(regNow[id])) inTableCache[id] = 1; });
    return items.reduce(function (pr, it) {
      return pr.then(function () {
        if (!it || !/^site-[A-Za-z0-9_-]{4,40}$/.test(s0(it.id))) { if (it && it.id) jlog("почта: письмо с непонятным именем пропущено: " + String(it.id).slice(0, 50)); return; }
        if (s0(it.date) < since) return;                          // письма раньше отчётного периода не берём
        var isAns = !!it.replied || answeredIds.indexOf(it.id) >= 0;
        var page = it.doctor ? "Врач: " + it.doctor : "Страница: " + s0(it.landing);
        /* то же письмо пришло повторно: карточку закрываем, в отчёт второй раз не вносим */
        if (it.dup) {
          return getDoc("mail", it.id).then(function (snap) {
            if (!snap.exists) return;
            var cur = snap.data() || {}, jobs = [];
            if (cur.status !== "done" || !cur.dup) jobs.push(["mail", it.id, { status: "done", dup: true, dupOf: s0(it.dupOf), note: "Повтор письма: то же письмо пришло ещё раз", doneAt: nowIso() }]);
            return getDoc("registry", it.id).then(function (rs) {
              var r = rs.exists ? rs.data() : null;
              // повтор, который уже стоит в таблице, не трогаем: какой из двух оставить, решает сверка отчёта
              if (r && r.report !== "excluded" && !inTable(r)) {
                jobs.push(["registry", it.id, { report: "excluded", reason: "Повтор письма", lastRef: s0(r.reportRef), updatedAt: nowIso() }]);
              }
              return getDoc("alerts", it.id);
            }).then(function (a) {
              if (a.exists && (a.data() || {}).status !== "done") jobs.push(["alerts", it.id, { status: "done", statusAt: nowIso(), note: "Повтор письма" }]);
              if (jobs.length) { dups++; jlog("почта: повтор письма " + it.id + " (первое: " + s0(it.dupOf) + ")"); }
              return seqJobs(jobs);
            });
          });
        }
        return getDoc("mail", it.id).then(function (snap) {
          if (snap.exists) {
            var cur = snap.data() || {}, mu = {}, ru = {}, jobs = [], textChanged = false;
            // точная дата и время письма
            if (!it.dateApprox && /^\d{4}-\d{2}-\d{2}$/.test(s0(it.date)) && (s0(cur.date) !== s0(it.date) || (it.api && it.time && s0(cur.time) !== s0(it.time)))) {
              mu.date = it.date; mu.time = it.time || s0(cur.time);
              ru.date = it.date; ru.time = mu.time;
              if (s0(cur.date) !== s0(it.date)) {
                if (cur.status === "done" && !cur.answered && !cur.manual && !s0(cur.note) && !isAns) mu.status = "todo";
                ru.report = "pending"; ru.reportRef = ""; ru.reason = "";
                jlog("почта: дата письма " + it.id + " исправлена " + s0(cur.date) + " → " + it.date);
              }
            }
            // текст письма с сервера почты точный: если раньше прочитался чужой или неполный текст, заменяем
            var nt = s0(it.message);
            if (nt && (it.api || !s0(cur.text)) && normTx(nt) !== normTx(cur.text)) {
              var a0 = normTx(cur.text), b0 = normTx(nt);
              // тот же текст, только неполный или с другими пробелами: строка в отчёте верная
              var sameLetter = !!a0 && (b0.indexOf(a0.slice(0, 40)) >= 0 || a0.indexOf(b0.slice(0, 40)) >= 0);
              textChanged = !sameLetter; fixed++;
              var k2 = letterKind(it.type, nt);
              mu.text = nt; mu.kind = k2; mu.page = page; mu.type = it.type || s0(cur.type); mu.subject = it.subject || s0(cur.subject);
              if (it.name) mu.name = it.name;
              if (it.emailHash) mu.emailHash = it.emailHash;
              if (/не прочитался/.test(s0(cur.note))) mu.note = "";
              if (s0(cur.draft) && (cur.status || "todo") === "todo") mu.draft = "";
              ru.text = nt.slice(0, 300); ru.fullText = nt; ru.author = it.name || s0(cur.name); ru.page = page; ru.tone = toneOfKind(k2);
              if (textChanged) { ru.report = "pending"; ru.reportRef = ""; ru.reason = ""; ru.decision = null; ru.suggest = null; }
              jlog("почта: текст письма " + it.id + " от " + it.date + (!a0 ? " дочитан" : sameLetter ? " дополнен по почте" : " был чужой, исправлен по почте"));
            } else if (it.api && it.name && s0(cur.name) !== it.name) { mu.name = it.name; ru.author = it.name; }
            if (it.api && it.emailHash && !s0(cur.emailHash)) mu.emailHash = it.emailHash;
            // письмо удалили в почте: карточку закрываем, в отчёте оно остаётся
            if (it.deleted && (cur.status || "todo") === "todo" && !mu.status) { mu.status = "done"; mu.note = "Письмо удалено в почте"; mu.doneAt = nowIso(); closed++; }
            if (it.api && !!cur.deleted !== !!it.deleted) {
              mu.deleted = !!it.deleted;
              if (!inTableCache[it.id]) { ru.report = "pending"; ru.reason = ""; }
            }
            if (cur.gone) { mu.gone = false; if (cur.status === "done" && /Письма нет в почте/.test(s0(cur.note)) && !isAns && !mu.status) { mu.status = "todo"; mu.note = ""; } }
            if (cur.dup && !it.dup) { mu.dup = false; mu.dupOf = ""; if (cur.status === "done" && /Повтор письма/.test(s0(cur.note)) && !isAns) { mu.status = "todo"; mu.note = ""; } }
            var kind = mu.kind || s0(cur.kind) || letterKind(it.type, nt || cur.text);
            if (Object.keys(mu).length) jobs.push(["mail", it.id, mu]);
            return getDoc("registry", it.id).then(function (rs) {
              if (rs.exists) {
                var r = rs.data() || {};
                if (textChanged && s0(cur.text) && inTable(r)) { wrongRows++; wrongRefs.push(s0(r.reportRef)); ru.lastRef = s0(r.reportRef); jlog("почта: у письма " + it.id + " в таблице стоял другой текст (" + s0(r.reportRef) + "), вношу верный"); }
                if (r.report === "excluded" && /Повтор письма|Письма нет в почте/.test(s0(r.reason)) && !it.dup) { ru.report = "pending"; ru.reason = ""; }
                if (Object.keys(ru).length) { ru.updatedAt = nowIso(); jobs.push(["registry", it.id, ru]); }
              } else {
                // письмо есть, а в реестре (откуда строится отчёт) его нет: заводим
                var tx = nt || s0(cur.text);
                jlog("почта: письмо " + it.id + " от " + (mu.date || s0(cur.date)) + " не было в реестре, добавила");
                jobs.push(["registry", it.id, { platform: "Сайт", date: mu.date || s0(cur.date) || it.date, time: mu.time || s0(cur.time), author: mu.name || s0(cur.name) || it.name || "", rating: null,
                  page: mu.page || s0(cur.page) || page, text: tx.slice(0, 300), fullText: tx, link: "", answered: !!cur.answered || isAns,
                  tone: toneOfKind(kind), report: "pending", reportRef: "", reason: "", source: "auto", arrivedAt: arrIso(mu.date || s0(cur.date) || it.date, mu.time || s0(cur.time)), updatedAt: nowIso() }, true]);
              }
              return getDoc("alerts", it.id);
            }).then(function (a) {
              if (mu.kind === "complaint" && !a.exists) {
                if (!isAns) alerts++;
                jobs.push(["alerts", it.id, { platform: "Сайт", page: page, date: mu.date || s0(cur.date), rating: null, threshold: null, author: mu.name || s0(cur.name), text: nt.slice(0, 1500), link: "",
                  answered: isAns, markAnswered: isAns, status: isAns ? "done" : "new", detectedAt: nowIso(), note: isAns ? "Ответ уже отправлен из почты" : "" }, true]);
              } else if (mu.kind && mu.kind !== "complaint" && a.exists && (a.data() || {}).status !== "done") jobs.push(["alerts", it.id, { status: "done", statusAt: nowIso() }]);
              return seqJobs(jobs);
            });
          }
          added++; if (!it.read) unread++; if (isAns) replied++;
          var kind = letterKind(it.type, it.message);
          var st0 = isAns || it.deleted ? "done" : "todo";
          var note0 = isAns ? "Ответ уже отправлен из почты" : it.deleted ? "Письмо удалено в почте" : it.read ? "" : "Текст письма не прочитался, откройте его в почте";
          jlog("почта: новое письмо " + it.id + " от " + it.date + " " + s0(it.time) + ", " + kind + (isAns ? ", уже отвечено" : ""));
          return db.collection("mail").doc(it.id).set({
            date: it.date, time: it.time || "", subject: it.subject || "", type: it.type || "", name: it.name || "", page: page, text: it.message || "",
            emailHash: it.emailHash || "", kind: kind, status: st0, answered: isAns, manual: false, draft: "", deleted: !!it.deleted,
            note: note0, source: "app", createdAt: nowIso()
          }).then(function () {
            return db.collection("registry").doc(it.id).set({ platform: "Сайт", date: it.date, time: it.time || "", author: it.name || "", rating: null,
              page: page, text: s0(it.message).slice(0, 300), fullText: s0(it.message), link: "", answered: isAns, tone: toneOfKind(kind),
              report: "pending", reportRef: "", reason: "", source: "auto", arrivedAt: arrIso(it.date, it.time), updatedAt: nowIso() });
          }).then(function () {
            if (kind !== "complaint") return;
            return getDoc("alerts", it.id).then(function (a) {
              if (a.exists) return;
              if (!isAns) alerts++;
              return db.collection("alerts").doc(it.id).set({ platform: "Сайт", page: page, date: it.date, rating: null, threshold: null,
                author: it.name || "", text: s0(it.message).slice(0, 1500), link: "", answered: isAns, markAnswered: isAns,
                status: isAns ? "done" : "new", detectedAt: nowIso(), note: isAns ? "Ответ уже отправлен из почты" : "" });
            });
          });
        });
      });
    }, Promise.resolve()).then(function () {
      // уже известные письма, на которые ответили из почты: убираем из «к ответу»
      var mail = window.__otvAll("mail") || {}, al = window.__otvAll("alerts") || {}, jobs = [];
      answeredIds.forEach(function (id) {
        var m = mail[id];
        if (m && (m.status || "todo") === "todo") { replied++; jobs.push(["mail", id, { status: "done", answered: true, note: "Ответ уже отправлен из почты", doneAt: nowIso() }]); jobs.push(["registry", id, { answered: true }]); }
        if (al[id] && al[id].status !== "done") jobs.push(["alerts", id, { markAnswered: true, answered: true, status: "done", statusAt: nowIso(), note: "Ответ уже отправлен из почты" }]);
      });
      // почта прочитана с сервера полностью: письма в программе за период, которых в почте за период нет
      // (дату раньше разобрали неверно, или это было не письмо с формы), из «к ответу» и из отчёта убираем
      if (full) {
        var ids = {}; items.forEach(function (it) { if (it && it.id) ids[it.id] = 1; });
        var reg = window.__otvAll("registry") || {}, today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
        Object.keys(mail).forEach(function (id) {
          var m = mail[id];
          if (!m || ids[id] || !/^site-/.test(id) || s0(m.date) < since || s0(m.date) > today) return;
          var r = reg[id];
          if ((m.status || "todo") === "todo") { closed++; jobs.push(["mail", id, { status: "done", gone: true, note: "Письма нет в почте за этот период", doneAt: nowIso() }]); }
          else if (!m.gone) jobs.push(["mail", id, { gone: true }]);
          var changed = (m.status || "todo") === "todo";
          if (r && r.report !== "excluded" && r.source !== "manual") {
            changed = true;
            if (inTable(r)) { wrongRows++; wrongRefs.push(s0(r.reportRef)); }
            jobs.push(["registry", id, { report: "excluded", reason: "Письма нет в почте за отчётный период", lastRef: s0(r.reportRef), updatedAt: nowIso() }]);
          }
          if (al[id] && al[id].status !== "done") jobs.push(["alerts", id, { status: "done", statusAt: nowIso(), note: "Письма нет в почте за этот период" }]);
          if (changed) jlog("почта: письма " + id + " (" + s0(m.date) + ") в почте за период нет, убрала из «к ответу» и из отчёта" + (r && inTable(r) ? "; в таблице лишняя строка " + s0(r.reportRef) : ""));
        });
      }
      return seqJobs(jobs);
    }).then(function () {
      return { added: added, alerts: alerts, unread: unread, replied: replied, total: live.length, fixed: fixed, dups: dups, closed: closed, wrongRows: wrongRows, wrongRefs: wrongRefs, full: full };
    });
  }

  function saveState() {
    return db.collection("registry_meta").doc("sources").set({ updatedAt: nowIso(), sources: srcState }).catch(function () {});
  }

  var running = false, stopping = false;
  /* источник не открылся — спрашиваем сразу: войти или пропустить */
  var asks = [], asking = null, askedSummary = null;
  function askNext() {
    asking = asks.shift() || null;
    if (!asking) { if (askedSummary) { var m = askedSummary; askedSummary = null; window.__otvBar.show(m, "ok", [["Закрыть", window.__otvBar.hide]]); } else window.__otvBar.hide(); return; }
    var s = asking.s;
    window.__otvBar.show(s.name + (asking.login ? ": нужен вход." : ": не открылось.") + " Входим или пропускаем?", "", [
      ["Войти", function () { loginThenCollect(s); }],
      ["Пропустить", askNext]]);
  }
  function ask(s, login) {
    if (asks.some(function (a) { return a.s.id === s.id; }) || (asking && asking.s.id === s.id)) return;
    asks.push({ s: s, login: login });
    if (!asking) askNext();
  }
  function stopAll() {
    if (!running || stopping) return;
    stopping = true; render();
    Object.keys(pending).forEach(function (id) {
      invoke("source_stop", { id: id }).catch(function () {});
      var f = pending[id]; if (f) f({ ok: false, stopped: true });
    });
  }
  var recheck = [];
  var autoRun = false, autoTimer = null;
  function scheduleAuto() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      var d = new Date(), wd = d.getDay(), hr = d.getHours();
      if (wd >= 1 && wd <= 5 && hr >= 8 && hr < 20 && !running && db) { jlog("сбор по расписанию"); collect(SOURCES, { auto: true }); }
      scheduleAuto();
    }, (autoTimer ? 30 : 1) * 60 * 1000);
  }   // сбор по расписанию: без всплывающих вопросов, только строка «Не прочитано» под кнопкой
  function collect(list, opts) {
    autoRun = !!(opts && opts.auto);
    if (running) { list.forEach(function (s) { if (recheck.indexOf(s) < 0) recheck.push(s); }); return Promise.resolve(); }
    running = true; render();
    var t0 = Date.now();
    var req = db.collection("requests").doc("collect");
    return req.get().then(function (r) {
      var prev = r.exists ? r.data() : {};
      return req.set(Object.assign({}, prev, { state: "running", requestedAt: nowIso(), message: "Собираю отзывы из кабинетов…" }));
    }).then(function () {
      return Promise.all(list.map(function (s) {
        srcState[s.id] = Object.assign({}, srcState[s.id], { busy: true }); render();
        return collectOne(s).then(function (p) {
          if (p.stopped) { srcState[s.id] = Object.assign({}, srcState[s.id], { busy: false }); render(); return { s: s, items: [], mail: [], stopped: true }; }
          var st = { at: nowIso(), busy: false, okAt: (srcState[s.id] || {}).okAt || "" };
          if (p.ok && Array.isArray(p.items)) { st.ok = true; st.okAt = st.at; st.count = p.items.length; st.seen = p.seen == null ? null : p.seen; st.error = ""; st.needLogin = false; }
          else { st.ok = false; st.count = 0; st.down = /сбой у площадки/.test(String(p.error || "")); st.needLogin = !st.down && (!!p.needLogin || /нужен вход/.test(String(p.error || ""))); st.error = st.needLogin ? "нужен вход" : (p.error || "не удалось прочитать"); }
          srcState[s.id] = st; render();
          jlog("сбор " + s.name + ": " + (st.ok ? "ок, " + st.count + (p.diag ? " · " + JSON.stringify(p.diag) : "") : (st.needLogin ? "нужен вход" : "не вышло: " + st.error) + (p.url ? " · " + String(p.url).split(/[?#]/)[0] : "")));
          if (!st.ok && !st.down && !stopping && !autoRun) ask(s, st.needLogin);
          return { s: s, items: st.ok && s.kind !== "mail" ? p.items : [], mail: st.ok && s.kind === "mail" ? p.items : [], answered: st.ok && s.kind === "mail" ? (p.answered || []) : [], replies: st.ok && s.kind === "mail" ? (p.replies || {}) : {}, mdiag: st.ok && s.kind === "mail" ? p.diag : null };
        });
      }));
    }).then(function (results) {
      jlog("сбор закончен за " + Math.round((Date.now() - t0) / 1000) + " с");
      var all = [], mails = [], answeredMail = [], mdiag = null, replies = {};
      results.forEach(function (r) { all = all.concat(r.items); mails = mails.concat(r.mail || []); answeredMail = answeredMail.concat(r.answered || []); Object.assign(replies, r.replies || {}); if (r.mdiag) mdiag = r.mdiag; });
      return ingest(all).then(function (sum) { return ingestMail(mails, answeredMail, mdiag).then(function (m) { return saveReplies(replies).then(function () { return m; }); }).then(function (m) { sum.added += m.added; sum.alerts += m.alerts; sum.mail = m; return sum; }); })
        .then(function (sum) { return makeAnswers(all).then(function (a) { sum.toAnswer = a.made; sum.closedA = a.closed; return sum; }, function () { return sum; }); }).then(function (sum) {
        var secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
        var badR = results.filter(function (r) { return !r.stopped && !srcState[r.s.id].ok; });
        var bad = badR.map(function (r) { return r.s.name + (srcState[r.s.id].down ? " (сбой у самой площадки)" : ""); });
        var needIn = badR.some(function (r) { return !srcState[r.s.id].down; });
        var msg = (stopping ? "Сбор остановлен: " : "Собрано: ") + "отзывов за " + DAYS + " дней " + all.length + ", новых " + sum.added +
                  (sum.toAnswer ? ", к ответу " + sum.toAnswer : "") + (sum.alerts ? ", тревог " + sum.alerts : "") + " · " + secs + " с" +
                  (sum.mail && results.some(function (r) { return r.s.kind === "mail" && srcState[r.s.id] && srcState[r.s.id].ok; }) ? "\nПочта сайта за период: писем " + sum.mail.total + ", новых " + sum.mail.added + (sum.mail.replied ? ", уже отвечено из почты " + sum.mail.replied : "") +
                    (sum.mail.fixed ? ", сверено и исправлено " + sum.mail.fixed : "") + (sum.mail.dups ? ", повторов " + sum.mail.dups : "") +
                    (sum.mail.full ? "" : ". Почта прочитана с экрана, не с сервера: проверьте письма в почте") : "") +
                  (sum.mail && sum.mail.wrongRows ? "\n⚠ В отчёте лишние строки из почты (повтор или чужой текст), удалите их: " + sum.mail.wrongRefs.join("; ") : "") +
                  (bad.length ? "\n⚠ Не вышло: " + bad.join(", ") + (needIn ? ". Нажмите «Войти» у источника" : "") : "") +
                  (sum.mail && sum.mail.unread ? "\n⚠ Почта: текст " + sum.mail.unread + " писем не прочитался, они в карточках с темой" : "");
        return req.get().then(function (r) {
          var prev = r.exists ? r.data() : {};
          return req.set(Object.assign({}, prev, { state: "done", finishedAt: nowIso(), message: msg, lastFinishedAt: nowIso(), lastMessage: msg }));
        }).then(function () {
          saveState();
          if (!stopping) window.dispatchEvent(new CustomEvent("otv-collected", { detail: { bad: bad, added: sum.added } }));
          if (asking || asks.length) askedSummary = msg.split("\n")[0];
          else if (!autoRun) window.__otvBar.show(msg.split("\n")[0], "ok", [["Закрыть", window.__otvBar.hide]]);
        });
      });
    }).catch(function (e) {
      jlog("сбор не прошёл: " + (e && (e.message || e.code) || e));
      window.__otvBar.show("Сбор не прошёл: " + (e && (e.message || e.code) || e), "err", [["Закрыть", window.__otvBar.hide]]);
    }).then(function () {
      running = false; stopping = false; render();
      if (recheck.length) { var again = recheck; recheck = []; return collect(again); }
    });
  }

  /* ---------- вкладка «Источники» ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + " в " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function openSourcesTab() { var b = document.querySelector('nav#tabs [data-tab="sources"]'); if (b) b.click(); }

  /* под «Собрать отзывы» всегда видно, какие площадки сейчас не читаются, и кнопка входа рядом */
  function renderWarn() {
    var last = document.getElementById("colLast"); if (!last) return;
    var w = document.getElementById("srcWarn");
    if (!w) { w = el("div", "src-warn"); w.id = "srcWarn"; last.after(w); }
    w.textContent = "";
    var badS = SOURCES.filter(function (s) { var st = srcState[s.id]; return st && !st.busy && st.at && !st.ok; });
    if (!badS.length) { w.hidden = true; return; }
    w.hidden = false;
    w.append(el("span", "src-warn-t", "Не прочитано: " + badS.map(function (s) { var st = srcState[s.id]; return s.name + (st.needLogin ? " (нужен вход)" : st.down ? " (сбой у самой площадки, прочитаю, когда заработает)" : ""); }).join(", ")));
    badS.forEach(function (s) {
      if (srcState[s.id].down) return;
      var b = el("button", "btn", "Войти: " + s.name); b.type = "button";
      b.addEventListener("click", function () { loginThenCollect(s); });
      w.append(b);
    });
  }
  // окно входа; как только в нём открылся кабинет, площадка перечитывается сама
  var waitLogin = {};
  function loginThenCollect(s) {
    waitLogin[s.id] = Date.now();
    invoke("source_open", { id: s.id, url: s.login || s.url, title: "Вход: " + s.name }).catch(function (e) { window.__otvBar.show("Не открылось: " + e, "err"); });
    window.__otvBar.show(s.name + ": войдите в открывшемся окне. Как только кабинет откроется, программа сама прочитает его.", "", [["Готово", function () { delete waitLogin[s.id]; window.__otvBar.hide(); afterLogin(s); }]]);
  }
  listen("source-nav", function (ev) {
    var d = ev.payload || {}, s = SOURCES.filter(function (x) { return x.id === d.id; })[0];
    if (!s || !waitLogin[s.id] || !d.finished) return;
    var u = String(d.url || "");
    if (u.indexOf(s.prefix) !== 0 || /\/auth\/|logon|login|passport|signin/i.test(u)) return;
    delete waitLogin[s.id];
    setTimeout(function () { window.__otvBar.hide(); afterLogin(s); }, 2500);
  });
  function afterLogin(s) {
    return collect([s]).then(function () { if (asking && asking.s.id === s.id) askNext(); });
  }
  function render() {
    renderWarn();
    var box = document.getElementById("srcBox"); if (!box) return;
    box.textContent = "";
    SOURCES.forEach(function (s) {
      var st = srcState[s.id] || {};
      var card = el("div", "card");
      var head = el("div", "head");
      head.append(el("span", "badge " + s.cls, s.name));
      var line = st.busy ? "читаю…" : st.ok ? st.count + " за " + DAYS + " дн. · " + fmt(st.at) : st.at ? fmt(st.at) : "";
      if (line) head.append(el("span", "meta", line));
      var bad = !st.busy && !st.ok && (st.needLogin || st.error);
      var stt = el("span", "status " + (st.ok ? "st-approved" : bad ? "st-fix" : "st-pending"),
                   st.ok ? "Работает" : st.needLogin ? "Нужен вход" : st.down ? "Сбой у площадки" : st.error ? "Не вышло" : "Не проверен");
      var dg = diag[s.id];
      var tip = [st.error && !st.needLogin ? st.error : "", dg ? "Окно входа: " + String(dg.url || "").slice(0, 90) + (dg.text != null && dg.text < 20 ? " (пустая страница)" : "") + (dg.errs && dg.errs.length ? " · " + dg.errs.join("; ").slice(0, 200) : "") : ""].filter(Boolean).join("\n");
      if (tip) stt.title = tip;
      head.append(stt);
      card.append(head);
      var a = el("div", "actions");
      var login = el("button", "btn", s.open ? "Открыть" : "Войти"); login.type = "button";
      login.addEventListener("click", function () { invoke("source_open", { id: s.id, url: s.login || s.url, title: "Вход: " + s.name }).catch(function (e) { window.__otvBar.show("Не открылось: " + e, "err"); }); });
      var check = el("button", "btn", "Проверить"); check.type = "button"; check.disabled = running;
      // окно входа закрываем, кроме Google и почты: они читаются прямо из открытого окна
      check.addEventListener("click", function () { if (!s.reuse) invoke("source_close", { label: "src-" + s.id }).catch(function () {}); collect([s]); });
      a.append(login, check);
      if (s.custom) {
        var del = el("button", "btn", "Удалить"); del.type = "button";
        del.addEventListener("click", function () {
          if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Точно удалить?"; setTimeout(function () { del.dataset.armed = ""; del.textContent = "Удалить"; }, 5000); return; }
          customs = customs.filter(function (c) { return c.id !== s.id; }); applyCustoms(); saveCustoms().then(render);
        });
        a.append(del);
      }
      card.append(a);
      box.append(card);
    });
    // добавить свой источник
    var addCard = el("div", "card");
    if (!addOpen) {
      var addBtn = el("button", "btn", "+ Добавить источник"); addBtn.type = "button";
      addBtn.addEventListener("click", function () { addOpen = true; render(); });
      addCard.append(addBtn);
    } else {
      addCard.append(el("h3", "", "Новый источник"));
      var f = el("div", "src-form");
      var ln = el("label", "", "Название"); var iName = el("input"); iName.type = "text"; iName.placeholder = "Например, Zoon"; ln.append(iName);
      var lu = el("label", "", "Адрес страницы с отзывами"); var iUrl = el("input"); iUrl.type = "url"; iUrl.placeholder = "https://…"; lu.append(iUrl);
      var lt = el("label", "", "Тревога, если оценка ниже"); var iThr = el("select");
      ["4.5", "4", "3"].forEach(function (v) { var o = el("option", "", v.replace(".", ",")); o.value = v; iThr.append(o); }); lt.append(iThr);
      f.append(ln, lu, lt); addCard.append(f);
      var msg = el("p", "meta", "");
      var acts = el("div", "actions");
      var go = el("button", "btn primary", "Открыть и показать отзыв"); go.type = "button";
      go.addEventListener("click", function () {
        var n = iName.value.trim(), u = iUrl.value.trim();
        if (!n) { msg.textContent = "Укажите название."; iName.focus(); return; }
        go.disabled = true; msg.textContent = "Открываю страницу… Если сайт попросит, войдите, затем нажмите на текст любого отзыва.";
        addSource(n, u, parseFloat(iThr.value)).catch(function (e) { msg.textContent = "Не получилось: " + e; }).then(function () { go.disabled = false; });
      });
      var cancel = el("button", "btn ghost", "Отмена"); cancel.type = "button";
      cancel.addEventListener("click", function () { addOpen = false; render(); });
      acts.append(go, cancel); addCard.append(acts, msg);
      setTimeout(function () { iName.focus(); }, 0);
    }
    box.append(addCard);
    // журнал работы — для разбора, если что-то не собирается или не публикуется (без текстов отзывов)
    var jl = el("button", "link", "Сохранить журнал работы в «Загрузки»"); jl.type = "button";
    jl.addEventListener("click", function () {
      Promise.all([invoke("log_read"), window.claude.use("downloads")]).then(function (r) {
        var d = new Date(), p2 = function (x) { return (x < 10 ? "0" : "") + x; };
        return r[1].save({ filename: "Ответошная · журнал " + d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + ".txt", data: new Blob([r[0] || "(пусто)"], { type: "text/plain" }) });
      }).then(function () { jl.textContent = "Журнал сохранён в «Загрузки»"; }, function (e) { jl.textContent = "Не сохранился: " + (e && e.message || e); });
    });
    var jp = el("p", "meta"); jp.append(jl); box.append(jp);
  }

  // «Собрать отзывы» в программе собирает сама, без Claude; «Остановить сбор» прерывает сбор.
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("#collectBtn2, #stopBtn") : null;
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (b.id === "stopBtn") stopAll(); else collect(SOURCES);
  }, true);
  // «Ответить» у жалобы из почты открывает почту сайта в окне программы
  window.__otvOpenMail = function () {
    var m = SOURCES.filter(function (x) { return x.id === "mail"; })[0];
    return invoke("source_open", { id: "mail", url: m.login || m.url, title: "Почта сайта" }).catch(function (e) { window.__otvBar.show("Не открылось: " + e, "err"); });
  };

  document.addEventListener("DOMContentLoaded", function () {
    invoke("app_info").then(function (i) {
      if (!i.test) return;
      SOURCES.push({ id: "test", name: "Проверка", cls: "pf-go", show: true, url: "https://registry.npmjs.org/left-pad", prefix: "https://registry.npmjs.org/", wait: 300,
        fn: async function () { return [{ id: "test-" + document.title.length, platform: "Проверка", published: true, page: "Тест", date: new Date().toISOString().slice(0, 10), time: "", rating: 3, threshold: 4.5, low: true, author: "", text: document.title, answered: false, link: location.href }]; } });
      render();
    }).catch(function () {});
    window.claude.use("db").then(function (d) {
      db = d;
      return db.collection("registry_meta").doc("custom_sources").get();
    }).then(function (cs) {
      if (cs && cs.exists) { customs = (cs.data() || {}).list || []; applyCustoms(); }
      return db.collection("registry_meta").doc("sources").get();
    }).then(function (snap) {
      if (snap && snap.exists) { srcState = (snap.data() || {}).sources || {}; Object.keys(srcState).forEach(function (k) { srcState[k].busy = false; }); }
      render();
      jlog("запуск программы");
      scheduleAuto();
      // проекты в порядок, затем публикуем то, что вы уже отправили на публикацию
      return tidyDrafts().then(function () { schedulePub(); });
    }).catch(function () { render(); });
  });
})();
