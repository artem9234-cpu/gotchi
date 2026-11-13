/* ============================================================
   TELEGRAM MINI APP BRIDGE
   Мост между игрой и Telegram: тема, вибро, viewport,
   облачное сохранение с чанками (лимит 4096 символов на ключ),
   дебаунс записи, шаринг результата в чат.
   Подключается ПОСЛЕ state.js и ДО app.js.
   ============================================================ */
const TMA = (() => {
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
  const inTelegram = !!(tg && user && tg.initData);
  const canCloud = !!(inTelegram && tg.CloudStorage);

  const BASE = 'gotchi.save.v1';
  const META = BASE + '.meta';
  const CHUNK = 3400;                 // запас под лимит 4096 + кириллица
  const APP_URL = 'https://artem9234-cpu.github.io/gotchi/';
  const BOT = 'Our_Saviour_Bot';
  const DIRECT = 'https://t.me/' + BOT + '/gotchi';

  let pending = null, timer = null, busy = false, again = false;
  let status = canCloud ? 'idle' : 'local';

  /* ---------- низкоуровневые обёртки CloudStorage ---------- */
  function cSet(key, val) {
    return new Promise(res => {
      try { tg.CloudStorage.setItem(key, val, (err, ok) => res(!err && ok !== false)); }
      catch (e) { res(false); }
    });
  }
  function cGet(keys) {
    return new Promise(res => {
      if (!keys.length) return res({});
      try {
        if (typeof tg.CloudStorage.getItems === 'function') {
          tg.CloudStorage.getItems(keys, (err, vals) => res(err ? {} : (vals || {})));
        } else {
          const out = {}; let i = 0;
          const step = () => {
            if (i >= keys.length) return res(out);
            const k = keys[i++];
            try { tg.CloudStorage.getItem(k, (e, v) => { if (!e && v != null) out[k] = v; step(); }); }
            catch (e) { step(); }
          };
          step();
        }
      } catch (e) { res({}); }
    });
  }
  function cKeys() {
    return new Promise(res => {
      try { tg.CloudStorage.getKeys((err, keys) => res(err ? [] : (keys || []))); }
      catch (e) { res([]); }
    });
  }
  function cRemove(keys) {
    return new Promise(res => {
      if (!keys.length) return res(true);
      try {
        if (typeof tg.CloudStorage.removeItems === 'function') {
          tg.CloudStorage.removeItems(keys, () => res(true));
        } else {
          let i = 0;
          const step = () => {
            if (i >= keys.length) return res(true);
            try { tg.CloudStorage.removeItem(keys[i++], () => step()); } catch (e) { step(); }
          };
          step();
        }
      } catch (e) { res(false); }
    });
  }

  /* ---------- запись ---------- */
  async function flush() {
    if (!canCloud || !pending) return;
    if (busy) { again = true; return; }
    busy = true;
    const obj = pending; pending = null;
    setStatus('saving');
    let ok = true;
    try {
      const str = JSON.stringify(obj);
      const parts = [];
      for (let i = 0; i < str.length; i += CHUNK) parts.push(str.slice(i, i + CHUNK));
      const before = await cKeys();
      for (let i = 0; i < parts.length; i++) {
        const r = await cSet(BASE + '#' + i, parts[i]);
        if (!r) { ok = false; break; }
      }
      if (ok) ok = await cSet(META, JSON.stringify({ n: parts.length, t: Date.now(), v: 1 }));
      if (ok) {
        const stale = before.filter(k => k.indexOf(BASE + '#') === 0)
                            .filter(k => parseInt(k.split('#')[1], 10) >= parts.length);
        await cRemove(stale);
        // сносим легаси-ключ однокусочной версии
        if (before.indexOf(BASE) >= 0) await cRemove([BASE]);
      }
    } catch (e) { ok = false; }
    busy = false;
    setStatus(ok ? 'synced' : 'error');
    if (again || pending) { again = false; flush(); }
  }

  function queueSave(obj) {
    if (!canCloud) { setStatus('local'); return; }
    pending = obj;
    clearTimeout(timer);
    timer = setTimeout(flush, 2500);
  }
  function flushNow() { clearTimeout(timer); flush(); }

  /* ---------- чтение ---------- */
  async function load() {
    if (!canCloud) return null;
    try {
      const keys = await cKeys();
      if (keys.indexOf(META) >= 0) {
        const m = await cGet([META]);
        let meta = null;
        try { meta = JSON.parse(m[META]); } catch (e) { return null; }
        if (!meta || !meta.n) return null;
        const want = [];
        for (let i = 0; i < meta.n; i++) want.push(BASE + '#' + i);
        const vals = await cGet(want);
        let s = '';
        for (const k of want) { if (vals[k] == null) return null; s += vals[k]; }
        return JSON.parse(s);
      }
      if (keys.indexOf(BASE) >= 0) {                 // миграция со старой версии
        const v = await cGet([BASE]);
        return JSON.parse(v[BASE]);
      }
    } catch (e) {}
    return null;
  }

  /* ---------- индикатор синхронизации ---------- */
  function setStatus(s) {
    status = s;
    const el = document.getElementById('syncDot');
    if (!el) return;
    el.dataset.state = s;
    el.title = ({
      local:  'Сохранение только на этом устройстве',
      idle:   'Облако Telegram подключено',
      saving: 'Сохраняю в облако…',
      synced: 'Сохранено в облако Telegram',
      error:  'Облако недоступно — сохранено локально'
    })[s] || s;
  }

  /* ---------- вибро ---------- */
  function haptic(kind) {
    if (!inTelegram || !tg.HapticFeedback) return;
    try { tg.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {}
  }
  function notify(type) {
    if (!inTelegram || !tg.HapticFeedback) return;
    try { tg.HapticFeedback.notificationOccurred(type); } catch (e) {}
  }
  function select() {
    if (!inTelegram || !tg.HapticFeedback) return;
    try { tg.HapticFeedback.selectionChanged(); } catch (e) {}
  }

  /* ---------- viewport / тема ---------- */
  function applyViewport() {
    const h = (tg && tg.viewportStableHeight) ? tg.viewportStableHeight : window.innerHeight;
    document.documentElement.style.setProperty('--tma-vh', h + 'px');
  }
  function applyTheme() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#150f28');
    try {
      if (tg.setHeaderColor) tg.setHeaderColor('#150f28');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0c0817');
      if (tg.setBottomBarColor) tg.setBottomBarColor('#0c0817');
    } catch (e) {}
  }

  /* ---------- шаринг ---------- */
  function shareText() {
    const g = window.Game;
    if (!g || !g.s || !g.s.born) {
      return '🥚 Балбесов двор — карманный питомец прямо в Telegram. Заводи, корми, играй, не дай загнуться.';
    }
    const s = g.s;
    const STAGE = { egg:'яйцо', baby:'малыш', child:'ребёнок', teen:'подросток', adult:'взрослый', senior:'старейшина' };
    if (s.dead) {
      return '🪦 ' + s.name + ' прожил ' + g.ageDays().toFixed(1) + ' суток в Балбесовом дворе.\n' +
             'Поколение ' + s.gen + ' · уход ' + g.careScore() + '/100 · причина: ' + s.deathCause + '\n' +
             'Сможешь лучше?';
    }
    return '🐣 ' + s.name + ' — ' + (STAGE[s.stage] || s.stage) + ' в Балбесовом дворе!\n' +
           '📅 ' + g.ageDays().toFixed(1) + ' суток · ⚖️ ' + Math.round(s.weight) + ' г\n' +
           '💚 уход ' + g.careScore() + '/100 · 🏆 наград ' + s.awards.length + '/' + AWARDS.length + ' · 🪙 ' + s.coins + '\n' +
           '🚀 рекорд Галаги: ' + (s.galagaHi || 0).toLocaleString('ru-RU') + '\n' +
           'Заведи своего питомца:';
  }
  function share() {
    const text = shareText() + '\n' + DIRECT;
    haptic('medium');
    if (inTelegram && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(DIRECT) + '&text=' + encodeURIComponent(shareText()));
      return;
    }
    if (navigator.share) {
      navigator.share({ title: 'Балбесов двор', text: shareText(), url: APP_URL }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Ссылка скопирована')).catch(() => toast('Скопируй: ' + DIRECT));
    } else {
      toast(DIRECT);
    }
  }
  function toast(m) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = m; el.className = 'toast on good';
    setTimeout(() => el.className = 'toast', 2400);
  }

  /* ---------- подтверждение закрытия ---------- */
  let closing = null;
  function syncClosing() {
    if (!inTelegram) return;
    const g = window.Game;
    const want = !!(g && g.s && g.s.born && !g.s.dead);
    if (want === closing) return;
    closing = want;
    try {
      if (want && tg.enableClosingConfirmation) tg.enableClosingConfirmation();
      if (!want && tg.disableClosingConfirmation) tg.disableClosingConfirmation();
    } catch (e) {}
  }

  /* ---------- адаптер к модели игры ---------- */
  function attach(Game) {
    if (!Game || Game.__tma) return;
    Game.__tma = true;

    Game.save = function () {
      try { localStorage.setItem(BASE, JSON.stringify(this.s)); } catch (e) {}
      queueSave(this.s);
      syncClosing();
    };

    Game.cloudLoad = function (cb) {
      if (!canCloud) { setStatus('local'); return cb(false); }
      setStatus('saving');
      load().then(cloud => {
        if (!cloud) { setStatus('idle'); return cb(false); }
        const local = this.s;
        if (!local.born || (cloud.lastTick || 0) > (local.lastTick || 0)) {
          this.s = Object.assign(this.fresh(), cloud);
          try { localStorage.setItem(BASE, JSON.stringify(this.s)); } catch (e) {}
          setStatus('synced');
          syncClosing();
          return cb(true);
        }
        setStatus('synced');
        cb(false);
      }).catch(() => { setStatus('error'); cb(false); });
    };
  }

  /* ---------- инициализация ---------- */
  function init() {
    document.body.classList.toggle('tma', inTelegram);
    applyViewport();

    if (inTelegram) {
      try {
        tg.ready();
        tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7') && tg.lockOrientation) {
          try { tg.lockOrientation(); } catch (e) {}
        }
      } catch (e) {}
      applyTheme();
      try {
        tg.onEvent('viewportChanged', applyViewport);
        tg.onEvent('themeChanged', applyTheme);
      } catch (e) {}
    }

    const btn = document.getElementById('btnShare');
    if (btn) btn.addEventListener('click', share);

    const pill = document.getElementById('coinPill');
    if (pill) pill.addEventListener('click', () => {
      select();
      toast(canCloud
        ? (status === 'error' ? 'Облако недоступно, прогресс сохранён на устройстве' : 'Прогресс синхронизируется с Telegram Cloud')
        : 'Открой через Telegram — включится облачное сохранение');
    });

    setStatus(canCloud ? 'idle' : 'local');
    if (window.Game) attach(window.Game);

    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });
    window.addEventListener('resize', applyViewport);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    tg, inTelegram, canCloud, user, APP_URL, DIRECT,
    attach, haptic, notify, select, share, flushNow, setStatus,
    get status() { return status; }
  };
})();
