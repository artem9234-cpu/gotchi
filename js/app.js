/* ============================================================
   UI: экраны-состояния, ввод (A/B/C + тач + клавиатура),
   единственный RAF-цикл, частицы, интеграция с Telegram.
   ============================================================ */
(() => {
'use strict';

const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* ---------- канвас ---------- */
const view = $('lcd'), vctx = view.getContext('2d');
const buf = document.createElement('canvas'); buf.width = Pixel.W; buf.height = Pixel.H;
const g = buf.getContext('2d');
g.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;

function fitCanvas() {
  const box = $('lcdBox');
  if (!box) return;
  const r = box.getBoundingClientRect();
  const cssW = r.width || box.clientWidth || 0;
  if (cssW < 8) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(128, Math.round(cssW * dpr));
  const h = Math.max(112, Math.round(w * Pixel.H / Pixel.W));
  if (view.width !== w || view.height !== h) {
    view.width = w; view.height = h;
    vctx.imageSmoothingEnabled = false;
    try { render(); } catch (e) {}   // сразу перерисовываем: resize очищает канвас
  }
}
if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($('lcdBox'));
window.addEventListener('resize', fitCanvas);

function showFatal(msg) {
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    el.style.cssText = 'position:fixed;left:8px;right:8px;top:70px;z-index:999;padding:10px 12px;' +
      'border-radius:12px;background:#2b0f18;border:1px solid #ff4d5e;color:#ffd7dc;' +
      'font:12px/1.45 monospace;white-space:pre-wrap;max-height:38vh;overflow:auto';
    document.body.appendChild(el);
  }
  el.textContent = '⚠️ ' + msg;
}
window.addEventListener('error', function (e) {
  showFatal((e.message || 'error') + '\n' + (e.filename || '') + ':' + (e.lineno || 0));
});
window.addEventListener('unhandledrejection', function (e) {
  showFatal('promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

/* ---------- анимационная модель ---------- */
const A = {
  t: 0, x: 64, tx: 64, y: 88, flip: false, walk: false,
  blink: 0, nextBlink: 2, mouth: 0, blush: 0, hop: 0, hopV: 0,
  eat: 0, eatKind: 'meal', sweep: -1, flash: 0, shake: 0,
  ghostRise: 0, evolveT: 0, hatchShake: 0, cracks: 0, born: 0,
  parts: [], lr: null, catch: null, msg: '', msgT: 0
};
function part(type, x, y, opt) {
  A.parts.push(Object.assign({ type, x, y, vx: 0, vy: -14, life: 1, max: 1, c: '#ff3d8b', sc: 1 }, opt || {}));
  if (A.parts.length > 90) A.parts.shift();
}
function burst(type, x, y, n, opt) { for (let i = 0; i < n; i++) part(type, x + (Math.random()*16-8), y + (Math.random()*10-5), Object.assign({ vx:(Math.random()*2-1)*22, vy:-18-Math.random()*24, life:.9+Math.random()*.5, max:1.4 }, opt||{})); }
function say(m, t) { A.msg = m; A.msgT = t || 2.2; }

/* ---------- режимы ---------- */
let mode = 'idle', menuIdx = -1, sub = null, subIdx = 0, cutscene = 0;
const ICONS = [
  { id:'feed',  label:'Еда',    svg:'<path d="M3 11h14a7 7 0 01-14 0z" fill="currentColor"/><path d="M6 8c0-2 1.5-3 1.5-4.5M10 7.5c0-2 1.5-3 1.5-4.5M14 8c0-2 1.5-3 1.5-4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
  { id:'light', label:'Свет',   svg:'<path d="M10 2a5.5 5.5 0 00-3 10v2h6v-2a5.5 5.5 0 00-3-10z" fill="currentColor"/><path d="M8 16h4M8.5 18h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
  { id:'play',  label:'Игра',   svg:'<rect x="2" y="6" width="16" height="9" rx="4" fill="currentColor"/><path d="M5.5 10.5h3M7 9v3" stroke="#1d1636" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="10" r="1.2" fill="#1d1636"/><circle cx="15.4" cy="12" r="1.2" fill="#1d1636"/>' },
  { id:'med',   label:'Лекарство', svg:'<rect x="3" y="7" width="14" height="7" rx="3.5" fill="currentColor" transform="rotate(-40 10 10)"/><path d="M7.2 12.8l5.6-5.6" stroke="#1d1636" stroke-width="1.5"/>' },
  { id:'wc',    label:'Туалет', svg:'<path d="M5 4h7v6a3.5 3.5 0 01-7 0z" fill="currentColor"/><path d="M8.5 13v3M6 17h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M13 6h3v4" stroke="currentColor" stroke-width="1.5" fill="none"/>' },
  { id:'stat',  label:'Статус', svg:'<rect x="3" y="11" width="3.4" height="6" fill="currentColor"/><rect x="8.3" y="7" width="3.4" height="10" fill="currentColor"/><rect x="13.6" y="3" width="3.4" height="14" fill="currentColor"/>' },
  { id:'disc',  label:'Воспитание', svg:'<path d="M4 8v4l8 4V4z" fill="currentColor"/><path d="M14 7a5 5 0 010 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>' },
  { id:'shop',  label:'Магазин', svg:'<path d="M4 7h12l-1 10H5z" fill="currentColor"/><path d="M7 7a3 3 0 016 0" stroke="currentColor" stroke-width="1.7" fill="none"/>' }
];

function buildRail() {
  const top = $('railTop'), bot = $('railBottom');
  top.innerHTML = ''; bot.innerHTML = '';
  ICONS.forEach((ic, i) => {
    const b = document.createElement('button');
    b.className = 'mi'; b.dataset.i = i; b.title = ic.label;
    b.innerHTML = '<svg viewBox="0 0 20 20">' + ic.svg + '</svg><small>' + ic.label + '</small>';
    b.addEventListener('click', () => { Sound.unlock(); pickIcon(i); });
    (i < 4 ? top : bot).appendChild(b);
  });
}
function syncRail() {
  const s = Game.s;
  document.querySelectorAll('.mi').forEach(b => {
    const i = +b.dataset.i, ic = ICONS[i];
    b.classList.toggle('on', menuIdx === i);
    let alert = false;
    if (ic.id === 'feed' && s.hunger < 1) alert = true;
    if (ic.id === 'play' && s.happy < 1) alert = true;
    if (ic.id === 'med' && s.sick) alert = true;
    if (ic.id === 'wc' && s.poops.length) alert = true;
    if (ic.id === 'light' && s.sleeping && s.lightOn) alert = true;
    if (ic.id === 'disc' && s.call && s.call.fake) alert = true;
    b.classList.toggle('alert', alert);
    b.disabled = !s.born || s.dead;
  });
  $('callLamp').classList.toggle('on', !!(s.call && !s.dead));
}

/* ---------- ввод ---------- */
function haptic(kind) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {} }
function notifyHaptic(t) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(t); } catch (e) {} }

function press(k) {
  Sound.unlock();
  const btn = $('key' + k); if (btn) { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 110); }
  haptic('light');
  const s = Game.s;
  if (!s.born) return;
  if (s.dead) { if (k === 'B') showMemorial(); return; }

  if (mode === 'hatch') { if (k === 'B') tapEgg(); else { Sound.play('blip'); A.hatchShake = .35; } return; }
  if (mode === 'evolve') { if (k === 'B' && cutscene > 1.4) endEvolve(); return; }
  if (mode === 'lr') { if (k === 'A') lrGuess(-1); else if (k === 'C') lrGuess(1); else if (k === 'B' && A.lr.done) exitGame(); return; }
  if (mode === 'catch') {
    if (k === 'A') A.catch.dir = -1; else if (k === 'C') A.catch.dir = 1;
    else if (k === 'B') { if (A.catch.done) exitGame(); else A.catch.paused = !A.catch.paused; }
    return;
  }
  if (mode === 'sub') {
    if (k === 'A') { subIdx = (subIdx + 1) % sub.items.length; Sound.play('move'); }
    else if (k === 'C') { closeSub(); }
    else if (k === 'B') { const it = sub.items[subIdx]; closeSub(); it.run(); }
    return;
  }
  if (k === 'A') { menuIdx = (menuIdx + 1) % ICONS.length; Sound.play('move'); syncRail(); }
  else if (k === 'C') { if (menuIdx >= 0) { menuIdx = -1; Sound.play('cancel'); syncRail(); } else { Sound.play('blip'); doPet(); } }
  else if (k === 'B') { if (menuIdx < 0) { menuIdx = 0; Sound.play('blip'); syncRail(); } else pickIcon(menuIdx); }
}
function pickIcon(i) {
  const s = Game.s;
  if (!s.born || s.dead) return;
  if (mode === 'lr' || mode === 'catch' || mode === 'evolve' || mode === 'hatch') return;
  menuIdx = i; syncRail(); Sound.play('confirm');
  const id = ICONS[i].id;
  if (id === 'feed') openSub('ЧЕМ КОРМИТЬ?', [
    { label:'ОБЕД', hint:'+1.5 сытости, +2 г', run: () => act(() => Game.feed('meal'), 'eat') },
    { label:'СЛАДКОЕ', hint:'+1 радость, +4 г', run: () => act(() => Game.feed('snack'), 'eat') },
    { label:'ЯБЛОКО x' + (s.items.apple||0), hint:'+2 сытости, +1 г', run: () => act(() => Game.feed('apple'), 'eat') },
    { label:'ТОРТ x' + (s.items.cake||0), hint:'+2 радости, +5 г', run: () => act(() => Game.feed('cake'), 'eat') }
  ]);
  else if (id === 'light') { const r = Game.toggleLight(); toast(r.on ? 'Свет включён' : 'Свет выключен — питомец засыпает'); Game.save(); }
  else if (id === 'play') {
    if (s.sleeping) return toast('Он спит. Разбудить — ошибка ухода.', 'bad');
    if (s.energy < 12) return toast('Слишком устал. Пусть поспит.', 'bad');
    const items = [{ label:'ЛЕВО-ПРАВО', hint:'классика, 5 раундов', run: startLR }];
    if (s.owned.ball) items.push({ label:'ЛОВИ СЕРДЕЧКИ', hint:'аркада, 30 секунд', run: startCatch });
    else items.push({ label:'АРКАДА 🔒', hint:'купи мяч в магазине', run: () => { openPanel('shop'); toast('Мяч открывает вторую игру'); } });
    openSub('ВО ЧТО ИГРАЕМ?', items);
  }
  else if (id === 'med') openSub('ЛЕЧЕНИЕ', [
    { label:'МИКСТУРА', hint:s.sick ? ('доз осталось: ' + s.sickDose) : 'профилактика', run: () => act(Game.medicine, 'heal') },
    { label:'ВИТАМИНЫ x' + (s.items.vitamin||0), hint:'лечит сразу, +25 HP', run: () => act(Game.vitamin, 'heal') }
  ]);
  else if (id === 'wc') act(Game.clean, 'clean');
  else if (id === 'stat') { openPanel('status'); menuIdx = -1; syncRail(); }
  else if (id === 'disc') openSub('ВОСПИТАНИЕ', [
    { label:'РУГАТЬ', hint:'если капризничает', run: () => act(Game.scold, 'scold') },
    { label:'ХВАЛИТЬ', hint:'если ведёт себя хорошо', run: () => act(Game.praise, 'praise') }
  ]);
  else if (id === 'shop') { openPanel('shop'); menuIdx = -1; syncRail(); }
}
function openSub(title, items) { sub = { title, items }; subIdx = 0; mode = 'sub'; }
function closeSub() { sub = null; mode = 'idle'; Sound.play('cancel'); }
function act(fn, cue) {
  const r = fn.call(Game);
  if (!r || r.ok === false) { Sound.play('error'); toast((r && r.msg) || 'Сейчас нельзя', 'bad'); notifyHaptic('warning'); return; }
  if (cue) Sound.play(cue === 'scold' ? (r.right ? 'confirm' : 'sad') : cue);
  if (r.msg) toast(r.msg, r.right === false ? 'bad' : 'good');
  notifyHaptic('success');
  Game.save(); syncRail(); refreshHUD(true);
}
function doPet() {
  const r = Game.pet();
  if (!r.ok) { toast(r.msg); return; }
  Sound.play('happy'); A.blush = 1.4; A.hopV = -46;
  burst('heart', A.x, A.y - 34, 4, { c:'#ff3d8b' });
  Game.save();
}

/* ---------- мини-игра «Лево-Право» ---------- */
function startLR() {
  mode = 'lr'; menuIdx = -1; syncRail();
  A.lr = { round:0, total:5, score:0, phase:'ask', timer:0, guess:0, actual:0, done:false };
  say('УГАДАЙ!', 1.4); Sound.play('confirm');
}
function lrGuess(d) {
  const L = A.lr; if (!L || L.phase !== 'ask' || L.done) return;
  L.guess = d; L.actual = Math.random() < .5 ? -1 : 1; L.phase = 'reveal'; L.timer = 0;
  A.flip = L.actual < 0;
  if (L.guess === L.actual) { L.score++; Sound.play('happy'); burst('star', A.x, A.y-32, 5, { c:'#b6ff3d' }); A.hopV = -40; }
  else { Sound.play('sad'); A.shake = .3; }
}
function updateLR(dt) {
  const L = A.lr; if (!L) return;
  L.timer += dt;
  if (L.phase === 'reveal' && L.timer > 1.05) {
    L.round++;
    if (L.round >= L.total) {
      L.done = true; L.phase = 'end';
      const win = Game.finishGame(L.score, L.total, 'lr');
      Sound.play(win ? 'win' : 'lose');
      say(win ? 'ПОБЕДА!' : 'НЕ ВЫШЛО', 3);
      if (win) burst('heart', A.x, A.y-30, 10, { c:'#ff3d8b' });
      Game.save(); refreshHUD(true);
    } else { L.phase = 'ask'; L.timer = 0; A.flip = false; Sound.play('blip'); }
  }
}
function exitGame() { mode = 'idle'; A.lr = null; A.catch = null; A.flip = false; Sound.play('cancel'); syncRail(); }

/* ---------- аркада «Лови сердечки» ---------- */
function startCatch() {
  mode = 'catch'; menuIdx = -1; syncRail();
  A.catch = { t:30, score:0, lives:3, items:[], spawn:0, dir:0, done:false, paused:false, x:64 };
  Sound.play('confirm'); say('ЛОВИ!', 1.2);
}
function updateCatch(dt) {
  const C = A.catch; if (!C || C.done || C.paused) return;
  C.t -= dt; C.spawn -= dt;
  if (C.dir) { C.x = clamp(C.x + C.dir * 78 * dt, 26, 102); A.x = C.x; A.walk = true; A.flip = C.dir < 0; }
  else A.walk = false;
  if (C.spawn <= 0) {
    C.spawn = .52 + Math.random() * .38;
    C.items.push({ x: 14 + Math.random() * 100, y: 6, v: 30 + Math.random() * 26, bomb: Math.random() < .22 });
  }
  for (let i = C.items.length - 1; i >= 0; i--) {
    const it = C.items[i]; it.y += it.v * dt;
    if (it.y > 72 && it.y < 92 && Math.abs(it.x - C.x) < 17) {
      C.items.splice(i, 1);
      if (it.bomb) { C.lives--; Sound.play('error'); A.shake = .35; burst('star', it.x, it.y, 5, { c:'#ff4d5e' }); }
      else { C.score++; Sound.play('coin'); burst('heart', it.x, it.y, 3, { c:'#ff3d8b' }); }
    } else if (it.y > 108) C.items.splice(i, 1);
  }
  if (C.t <= 0 || C.lives <= 0) {
    C.done = true; A.walk = false;
    const win = Game.finishGame(C.score, 12, 'catch');
    Sound.play(win ? 'win' : 'lose');
    say(win ? 'ОТЛИЧНО!' : 'КОНЕЦ', 3);
    Game.save(); refreshHUD(true);
  }
}

/* ---------- яйцо ---------- */
function tapEgg() {
  A.cracks++; A.hatchShake = .5; Sound.play('blip'); haptic('medium');
  burst('star', 64, 60, 3, { c:'#ffb020' });
  if (A.cracks >= 5) {
    mode = 'evolve'; cutscene = 0; A.born = 1;
    Sound.play('hatch'); notifyHaptic('success');
    burst('star', 64, 60, 22, { c:'#b6ff3d' });
    burst('heart', 64, 60, 8, { c:'#ff3d8b' });
  }
}
function endEvolve() { mode = 'idle'; cutscene = 0; A.evolveT = 0; syncRail(); refreshHUD(true); }

/* ---------- обработка событий симуляции ---------- */
function drainEvents() {
  while (Game.events.length) {
    const e = Game.events.shift();
    switch (e.type) {
      case 'poop': Sound.play('poop'); break;
      case 'sick': Sound.play('sick'); toast('Питомец заболел! Нужна микстура.', 'bad'); notifyHaptic('error'); break;
      case 'call': Sound.play('call'); break;
      case 'sleep': Sound.play('sleep'); break;
      case 'mistake': toast('Ошибка ухода: ' + e.reason, 'bad'); break;
      case 'evolve':
        mode = 'evolve'; cutscene = 0; A.evolveT = 1; Sound.play('evolve'); notifyHaptic('success');
        burst('star', 64, 56, 26, { c:'#ffb020' });
        toast('Эволюция! Теперь это ' + STAGE_RU[e.stage] + (e.quality === 'good' ? ' (отличный уход)' : ' (плохой уход)'), 'good');
        break;
      case 'award': { const a = AWARDS.find(x => x.id === e.id); if (a) { toast('🏆 Награда: ' + a.name + ' (+25 готчи)', 'good'); Sound.play('coin'); } break; }
      case 'unlock': toast('🛸 Открыт секретный вид: Готч-НЛО!', 'good'); break;
      case 'death': Sound.play('death'); notifyHaptic('error'); setTimeout(showMemorial, 900); break;
      case 'away': showAway(e); break;
      case 'eat': A.eat = 1.5; A.eatKind = (e.kind === 'snack' || e.kind === 'cake') ? 'snack' : 'meal'; break;
      case 'clean': A.sweep = 0; break;
      case 'heal': burst('star', A.x, A.y - 30, 8, { c:'#46e08a' }); break;
      case 'scold': if (e.right) burst('star', A.x, A.y-30, 4, { c:'#ffb020' }); else { A.shake = .4; burst('heart', A.x, A.y-30, 3, { c:'#4a7fc4' }); } break;
      case 'praise': A.blush = 1.5; burst('heart', A.x, A.y-32, 4, { c:'#ff3d8b' }); break;
      case 'win': A.hopV = -60; break;
      case 'buy': Sound.play('coin'); break;
    }
    syncRail();
  }
}

/* ---------- обновление анимации ---------- */
function updateAnim(dt) {
  const s = Game.s;
  A.t += dt;
  if (A.msgT > 0) A.msgT -= dt;
  if (A.blush > 0) A.blush -= dt;
  if (A.shake > 0) A.shake -= dt;
  if (A.flash > 0) A.flash -= dt;
  if (A.hatchShake > 0) A.hatchShake -= dt;
  if (A.eat > 0) { A.eat -= dt; A.mouth = Math.abs(Math.sin(A.t * 14)) * .9; } else A.mouth = 0;
  if (A.sweep >= 0) { A.sweep += dt * 1.6; if (A.sweep > 1) A.sweep = -1; }
  if (mode === 'evolve') { cutscene += dt; if (cutscene > 3.4) endEvolve(); }
  if (mode === 'lr') updateLR(dt);
  if (mode === 'catch') updateCatch(dt);

  // гравитация прыжка
  A.hopV += 210 * dt; A.hop += A.hopV * dt;
  if (A.hop > 0) { A.hop = 0; A.hopV = 0; }

  // моргание
  A.nextBlink -= dt;
  if (A.nextBlink <= 0) { A.blink = .13; A.nextBlink = 2 + Math.random() * 3.5; }
  if (A.blink > 0) A.blink -= dt;

  // блуждание
  if (mode === 'idle' && s.born && !s.dead && !s.sleeping && !s.sick) {
    if (Math.abs(A.x - A.tx) < 1.5) {
      if (Math.random() < dt * .35) A.tx = 40 + Math.random() * 52;
      A.walk = false;
    } else {
      const d = Math.sign(A.tx - A.x);
      A.x += d * 15 * dt; A.flip = d < 0; A.walk = true;
    }
    if (s.happy > 3 && Math.random() < dt * .5) A.hopV = -34;
  } else if (mode !== 'catch') { A.walk = false; }
  if (mode === 'catch' && A.catch) A.x = A.catch.x;
  if (s.dead) A.ghostRise = Math.min(20, A.ghostRise + dt * 5);

  // частицы
  for (let i = A.parts.length - 1; i >= 0; i--) {
    const p = A.parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt;
    if (p.life <= 0) A.parts.splice(i, 1);
  }
  // Zzz
  if (s.sleeping && Math.random() < dt * 1.4) part('z', A.x + 12, A.y - 40, { vx: 7, vy: -12, life: 1.8, max: 1.8, c: '#ffffff' });
}

/* ---------- отрисовка ---------- */
function render() {
  const s = Game.s, T = Pixel.theme(s.theme);
  const hour = Game.hourOfDay();
  const shakeX = A.shake > 0 ? Math.round(Math.sin(A.t * 60) * 2) : 0;

  g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,Pixel.W,Pixel.H);
  g.save(); g.translate(shakeX, 0);

  if (mode === 'hatch') {
    Pixel.drawRoom(g, T, 12, { space: s.owned.space && s.theme === 'space' });
    const wob = Math.sin(A.t * 9) * (A.hatchShake > 0 ? 3 : 1.2);
    Pixel.drawEgg(g, 64 + wob, 59, 1.7, Game.pal(), A.cracks, T);
    Pixel.textC(g, 'НАЖМИ B', 64, 96, T.ink, 1);
    Pixel.textC(g, A.cracks + '/5', 64, 104, T.ink, 1);
    Pixel.textC(g, 'BALBESOV DVOR', 64, 2, T.ink, 1);
  }
  else if (mode === 'evolve') {
    const fl = Math.sin(cutscene * 22) > 0;
    Pixel.R(g, 0, 0, Pixel.W, Pixel.H, fl ? '#ffffff' : T.lcd);
    if (cutscene > .9) {
      Pixel.drawRoom(g, T, hour, { space: s.theme === 'space', ball: s.owned.ball });
      const pop = clamp((cutscene - .9) / .5, 0, 1);
      Pixel.drawPet(g, { x:64, y:88, scale: STAGE_SCALE[s.stage] * (.6 + .4 * pop), dna: Game.dna(), pal: Game.pal(),
        theme:T, t:A.t, eyes:'happy', blush:true, flip:false, walk:false, mouth:.2 });
      Pixel.textC(g, A.born ? 'РОДИЛСЯ!' : 'ЭВОЛЮЦИЯ!', 64, 4, T.ink, 1);
      Pixel.textC(g, Pixel.translit(s.name), 64, 14, T.ink, 1);
      Pixel.textC(g, STAGE_RU[s.stage].toUpperCase(), 64, 100, T.ink, 1);
    }
  }
  else if (s.dead) {
    Pixel.drawRoom(g, T, 22, { dark:true, space: s.theme === 'space' });
    Pixel.drawTomb(g, 64, 86, T);
    Pixel.drawPet(g, { x:64, y:70, scale:.8, dna:Game.dna(), pal:Game.pal(), theme:T, t:A.t, ghost:true, ghostRise:A.ghostRise });
    Pixel.textC(g, 'R.I.P.', 64, 4, T.ink, 1);
    Pixel.textC(g, Pixel.translit(s.name), 64, 14, T.ink, 1);
    Pixel.textC(g, 'B - ПОМЯНУТЬ', 64, 102, T.ink, 1);
  }
  else {
    Pixel.drawRoom(g, T, hour, { dark: s.sleeping || !s.lightOn, space: s.theme === 'space', ball: s.owned.ball });
    // кучки
    s.poops.forEach(p => Pixel.drawPoop(g, p.x, 86, A.t, T));
    // еда
    if (A.eat > 0) Pixel.drawBowl(g, clamp(A.x + (A.flip ? -22 : 22), 14, 114), 86, A.eatKind, T);
    // уборка
    if (A.sweep >= 0) {
      const bx = A.sweep * 140 - 10;
      Pixel.R(g, bx, 74, 3, 16, '#8a6a4a'); Pixel.R(g, bx - 5, 86, 13, 5, '#ffb020');
    }
    // аркадные предметы
    if (mode === 'catch' && A.catch) A.catch.items.forEach(it => it.bomb ? Pixel.drawBomb(g, it.x, it.y) : Pixel.drawHeart(g, it.x - 2, it.y - 2, '#ff3d8b', 1));

    // питомец
    let eyes = 'open';
    if (s.sleeping) eyes = 'sleep';
    else if (A.blink > 0) eyes = 'closed';
    else if (s.sick) eyes = 'sad';
    else if (s.happy < 1 || s.hunger < .6) eyes = 'sad';
    else if (s.happy > 3 || A.blush > 0) eyes = 'happy';
    const sickWob = s.sick ? Math.sin(A.t * 3) * 1.5 : 0;
    Pixel.drawPet(g, {
      x: A.x + sickWob, y: A.y + A.hop, scale: STAGE_SCALE[s.stage],
      dna: Game.dna(), pal: Game.pal(), theme: T, t: A.t,
      eyes, mouth: A.mouth, blush: A.blush > 0 || s.happy > 3.4,
      flip: A.flip, walk: A.walk, sick: s.sick
    });

    // пузырь зова
    if (s.call) {
      const bx = clamp(A.x + 20, 12, 112), by = A.y - 52 + Math.sin(A.t * 4) * 1.5;
      Pixel.E(g, bx, by, 8, 7, '#f7efe2'); Pixel.E(g, bx, by, 7, 6, '#f7efe2');
      Pixel.R(g, bx - 3, by + 5, 3, 3, '#f7efe2');
      Pixel.textC(g, '!', bx, by - 3, s.sick ? '#ff4d5e' : '#2c3a1c', 1);
    }

    // верхняя строка
    Pixel.R(g, 0, 0, Pixel.W, 10, Pixel.mix(T.lcd, T.ink, .1));
    Pixel.text(g, Pixel.translit(s.name).slice(0, 9), 2, 2, T.ink, 1);
    const hh = String(hour).padStart(2, '0');
    Pixel.text(g, hh + ':00', 96, 2, T.ink, 1);

    // нижняя строка / контекст
    Pixel.R(g, 0, 94, Pixel.W, 18, Pixel.mix(T.lcd, T.ink, .1));
    if (mode === 'sub' && sub) {
      Pixel.textC(g, sub.title, 64, 96, T.ink, 1);
      const it = sub.items[subIdx];
      Pixel.textC(g, '> ' + it.label, 64, 104, T.ink, 1);
    } else if (mode === 'lr' && A.lr) {
      const L = A.lr;
      Pixel.text(g, 'СЧЁТ ' + L.score + '/' + L.total, 2, 96, T.ink, 1);
      if (L.done) Pixel.textC(g, 'B - ВЫХОД', 64, 104, T.ink, 1);
      else if (L.phase === 'ask') Pixel.textC(g, 'A: <   C: >', 64, 104, T.ink, 1);
      else Pixel.textC(g, L.guess === L.actual ? 'УГАДАЛ!' : 'МИМО', 64, 104, T.ink, 1);
      if (L.phase !== 'ask' && !L.done) {
        Pixel.textC(g, L.actual < 0 ? '<<<' : '>>>', 64, 26, T.accent, 2);
      }
    } else if (mode === 'catch' && A.catch) {
      const C = A.catch;
      Pixel.text(g, '♥' + C.score, 2, 96, T.ink, 1);
      Pixel.text(g, 'HP' + C.lives, 44, 96, T.ink, 1);
      Pixel.text(g, Math.max(0, Math.ceil(C.t)) + 'C', 96, 96, T.ink, 1);
      Pixel.textC(g, C.done ? 'B - ВЫХОД' : (C.paused ? 'ПАУЗА' : 'A/C - ДВИЖЕНИЕ'), 64, 104, T.ink, 1);
    } else {
      let st = 'ВСЁ ХОРОШО';
      if (s.sleeping) st = 'СПИТ';
      else if (s.sick) st = 'БОЛЕН!';
      else if (s.hunger < 1) st = 'ГОЛОДЕН!';
      else if (s.happy < 1) st = 'СКУЧНО!';
      else if (s.poops.length) st = 'ГРЯЗНО!';
      else if (Game.overweight()) st = 'ПЕРЕКОРМ';
      else if (s.energy < 20) st = 'УСТАЛ';
      Pixel.textC(g, st, 64, 96, T.ink, 1);
      const hearts = '♥'.repeat(Math.round(s.hunger)) + '♡'.repeat(4 - Math.round(s.hunger));
      Pixel.text(g, hearts, 2, 104, T.ink, 1);
      const hap = '♥'.repeat(Math.round(s.happy)) + '♡'.repeat(4 - Math.round(s.happy));
      Pixel.text(g, hap, 100, 104, T.ink, 1);
      Pixel.textC(g, STAGE_RU[s.stage].toUpperCase(), 64, 104, T.ink, 1);
    }
  }

  // частицы поверх
  A.parts.forEach(p => {
    const a = clamp(p.life / p.max, 0, 1);
    g.globalAlpha = a;
    if (p.type === 'heart') Pixel.drawHeart(g, Math.round(p.x), Math.round(p.y), p.c, 1);
    else if (p.type === 'star') Pixel.drawStar(g, Math.round(p.x), Math.round(p.y), p.c, 1);
    else if (p.type === 'z') Pixel.text(g, 'Z', Math.round(p.x), Math.round(p.y), p.c, 1);
    else Pixel.R(g, p.x, p.y, 2, 2, p.c);
    g.globalAlpha = 1;
  });
  if (A.msgT > 0) {
    const w = Pixel.textW(A.msg, 2) + 8;
    Pixel.R(g, 64 - w/2, 40, w, 18, 'rgba(20,12,40,.86)');
    Pixel.textC(g, A.msg, 64, 45, '#b6ff3d', 2);
  }
  g.restore();

  vctx.clearRect(0, 0, view.width, view.height);
  vctx.drawImage(buf, 0, 0, view.width, view.height);
}

/* ---------- HUD ---------- */
let hudT = 0;
function hearts(el, v) {
  const n = Math.round(clamp(v, 0, 4));
  let h = '';
  for (let i = 0; i < 4; i++) h += '<i class="' + (i < n ? 'f' : '') + '">♥</i>';
  el.innerHTML = h;
}
function refreshHUD(force) {
  const s = Game.s;
  hearts($('hHunger'), s.hunger); hearts($('hHappy'), s.happy);
  $('bEnergy').style.width = clamp(s.energy, 0, 100) + '%';
  $('bHealth').style.width = clamp(s.health, 0, 100) + '%';
  $('mStage').textContent = STAGE_RU[s.stage] || '—';
  $('mAge').textContent = Game.ageDays().toFixed(1) + ' д';
  $('mWeight').textContent = Math.round(s.weight) + ' г' + (Game.overweight() ? ' ⚠' : '');
  $('mDisc').textContent = 'дисц. ' + Math.round(s.discipline) + '%';
  $('coinVal').textContent = s.coins;
  $('petTitle').textContent = s.born ? (s.name + ' · ' + STAGE_RU[s.stage]) : 'инкубатор';
  $('genNum').textContent = s.gen;
  const hint = mode === 'lr' ? 'A — влево · C — вправо · B — выход'
    : mode === 'catch' ? 'A/C — движение · B — пауза · удерживай для бега'
    : mode === 'sub' ? 'A — листать · B — выбрать · C — назад'
    : mode === 'hatch' ? 'Жми B, чтобы помочь вылупиться'
    : 'A — листать меню · B — подтвердить · C — отмена / погладить';
  $('padHint').textContent = hint;
  if (force) { renderPanel(); }
}

/* ---------- панель ---------- */
let tab = 'status';
function openPanel(t) { tab = t || tab; renderPanel(); $('panel').classList.add('open'); document.body.classList.add('panel-open'); syncTabs(); }
function closePanel() { $('panel').classList.remove('open'); document.body.classList.remove('panel-open'); }
function syncTabs() { document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); }

function renderPanel() {
  const s = Game.s, el = $('panelBody');
  if (!el) return;
  if (tab === 'status') {
    const cs = Game.careScore(), sp = Game.sp();
    const need = [];
    if (s.hunger < 1.5) need.push('покормить');
    if (s.happy < 1.5) need.push('поиграть');
    if (s.poops.length) need.push('убрать (' + s.poops.length + ')');
    if (s.sick) need.push('вылечить');
    if (s.sleeping && s.lightOn) need.push('выключить свет');
    if (s.call && s.call.fake) need.push('отругать за каприз');
    el.innerHTML =
      card('Питомец', kv('Имя', s.name) + kv('Вид', sp.name) + kv('Стадия', STAGE_RU[s.stage]) +
        kv('Ветка', s.quality === 'good' ? 'хороший уход 👑' : 'плохой уход 🥀') +
        kv('Возраст', Game.ageDays().toFixed(2) + ' дн (' + s.age + ' ч)') +
        kv('Вес', Math.round(s.weight) + ' г / норма ' + sp.ideal + ' г') +
        kv('Время суток', String(Game.hourOfDay()).padStart(2,'0') + ':00 ' + (s.sleeping ? '· спит' : '· бодрствует'))) +
      card('Оценка ухода', '<div class="meter"><i style="width:' + cs + '%;background:linear-gradient(90deg,#ff4d5e,#ffb020,#46e08a)"></i></div>' +
        '<p class="note"><b style="color:#f7efe2">' + cs + '/100</b> · ошибок ухода: ' + s.mistakes +
        ' · дисциплина: ' + Math.round(s.discipline) + '%<br>Оценка определяет ветку эволюции и продолжительность жизни.</p>') +
      card('Сейчас нужно', need.length ? '<p class="note" style="color:#ffb020">' + need.join(' · ') + '</p>' : '<p class="note" style="color:#46e08a">Всё в порядке. Можно просто погладить — кнопка C.</p>') +
      card('Расходники', kv('🍎 Яблоко', s.items.apple || 0) + kv('🍰 Торт', s.items.cake || 0) + kv('💊 Витамины', s.items.vitamin || 0)) +
      card('Летопись', kv('Кормлений', s.stats.meals) + kv('Сладостей', s.stats.snacks) + kv('Игр / побед', s.stats.games + ' / ' + s.stats.wins) +
        kv('Уборок', s.stats.cleans) + kv('Вылечено', s.stats.cures) + kv('Поколение', s.gen));
  }
  else if (tab === 'shop') {
    el.innerHTML = '<div class="card"><h4>Баланс</h4><div class="kv"><span>Готчи</span><b style="color:#ffb020">' + s.coins + '</b></div>' +
      '<p class="note">Капают за уход, победы в играх, эволюции и каждый идеальный час.</p></div>' +
      SHOP.map(it => {
        const owned = it.kind !== 'food' && s.owned[it.id];
        const cnt = it.kind === 'food' ? (s.items[it.id] || 0) : 0;
        return '<div class="shop-item"><div class="shop-ico">' + it.ico + '</div><div class="shop-txt"><b>' + it.name +
          (cnt ? ' <span style="color:#b6ff3d">×' + cnt + '</span>' : '') + '</b><small>' + it.desc + '</small></div>' +
          '<button class="buy' + (owned ? ' owned' : '') + '" data-buy="' + it.id + '"' +
          ((owned || s.coins < it.price) ? ' disabled' : '') + '>' + (owned ? 'есть' : it.price + ' ⬤') + '</button></div>';
      }).join('');
    el.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const r = Game.buy(b.dataset.buy);
      toast(r.msg, r.ok ? 'good' : 'bad'); Sound.play(r.ok ? 'coin' : 'error');
      Game.save(); renderPanel(); refreshHUD();
    }));
  }
  else if (tab === 'tree') {
    if (!s.graveyard.length) el.innerHTML = '<div class="card"><h4>Родословная</h4><p class="note">Пока пусто. Здесь появятся все прожитые жизни — с возрастом, причиной и оценкой ухода.</p></div>';
    else {
      el.innerHTML = '<div class="card"><h4>Прожитые жизни</h4></div>' + s.graveyard.map((d, i) =>
        '<div class="tree-row"><canvas width="44" height="44" data-grave="' + i + '"></canvas><div><b>' + d.name +
        ' <span style="color:#7b6da0;font-weight:600">· пок. ' + d.gen + '</span></b><small>' +
        (SPECIES[d.species] ? SPECIES[d.species].name : d.species) + ' · ' + STAGE_RU[d.stage] + '<br>' +
        d.days + ' дн · ' + d.cause + ' · уход ' + d.care + '/100</small></div></div>').join('');
      el.querySelectorAll('[data-grave]').forEach(c => {
        const d = s.graveyard[+c.dataset.grave], cc = c.getContext('2d');
        cc.imageSmoothingEnabled = false;
        const T = Pixel.theme('classic');
        Pixel.R(cc, 0, 0, 44, 44, '#1a1430');
        const sp = SPECIES[d.species] || SPECIES.cat;
        const dna = Object.assign({}, sp.dna); if (d.stage === 'senior') dna.gray = true;
        Pixel.drawPet(cc, { x:22, y:40, scale:.62, dna, pal:sp.pal, theme:Pixel.theme('color'), t:0, eyes:'closed' });
      });
    }
  }
  else if (tab === 'awards') {
    el.innerHTML = '<div class="card"><h4>Награды ' + s.awards.length + '/' + AWARDS.length + '</h4>' +
      '<p class="note">Каждая награда даёт +25 готчи.</p></div>' +
      AWARDS.map(a => '<div class="award' + (s.awards.indexOf(a.id) >= 0 ? ' got' : '') + '"><div class="ai">' +
        (s.awards.indexOf(a.id) >= 0 ? a.ico : '🔒') + '</div><div><b>' + a.name + '</b><small>' + a.desc + '</small></div></div>').join('');
  }
  else if (tab === 'setup') {
    const themes = [['color','Цветной',true],['classic','Классик',s.owned.classic],['neon','Неон',s.owned.neon],['space','Космос',s.owned.space]];
    el.innerHTML =
      card('Темп жизни', '<p class="note">1 игровой час = реальные ' + Math.round(60 / s.speed) + ' сек. Влияет на скорость роста и старения.</p>' +
        '<div class="seg">' + [[.5,'×0.5'],[1,'×1'],[3,'×3'],[10,'×10 демо']].map(x =>
          '<button data-speed="' + x[0] + '" class="' + (s.speed === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>') +
      card('Экран', '<div class="seg">' + themes.map(t =>
        '<button data-theme="' + t[0] + '" class="' + (s.theme === t[0] ? 'on' : '') + '"' + (t[2] ? '' : ' disabled') + '>' + t[1] + (t[2] ? '' : ' 🔒') + '</button>').join('') + '</div>') +
      card('Звук и отклик',
        '<div class="switch"><span>Чиптюн-сигналы</span><button class="tgl' + (s.sound ? ' on' : '') + '" id="tglSound"></button></div>' +
        '<p class="note">Короткие бипы на каждое видимое событие. Фоновой музыки нет — как в оригинале.</p>') +
      card('Сохранение', '<p class="note">Автосохранение каждые 5 секунд, при каждом действии и при сворачивании. ' +
        (tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? 'Синхронизация с Telegram Cloud включена.' : 'Открой внутри Telegram — включится облачная синхронизация.') + '</p>') +
      card('Опасная зона', '<p class="note">Полный сброс удалит все поколения, награды и готчи.</p><button class="danger" id="btnReset">Сбросить всё</button>');
    el.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
      Game.s.lastTick = Date.now(); Game.s.speed = +b.dataset.speed; Game.save(); renderPanel(); Sound.play('confirm');
    }));
    el.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return; Game.s.theme = b.dataset.theme; Game.save(); renderPanel(); Sound.play('confirm');
    }));
    const ts = $('tglSound'); if (ts) ts.addEventListener('click', () => { setSound(!Game.s.sound); renderPanel(); });
    const br = $('btnReset'); if (br) br.addEventListener('click', () => {
      if (!confirm('Стереть весь прогресс, все поколения и награды?')) return;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      if (tg && tg.CloudStorage) { try { tg.CloudStorage.removeItem(SAVE_KEY, () => {}); } catch (e) {} }
      Game.s = Game.fresh(); Game.save(); location.reload();
    });
  }
  syncTabs();
}
function card(t, b) { return '<div class="card"><h4>' + t + '</h4>' + b + '</div>'; }
function kv(k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; }

/* ---------- инкубатор ---------- */
let selSpecies = 'cat';
const previews = [];
function buildHatchery() {
  const grid = $('speciesGrid'); grid.innerHTML = ''; previews.length = 0;
  Object.keys(SPECIES).forEach(key => {
    const sp = SPECIES[key];
    const locked = sp.locked && !Game.s.unlocked[key];
    const card = document.createElement('button');
    card.className = 'sp-card' + (key === selSpecies ? ' on' : '') + (locked ? ' locked' : '');
    card.innerHTML = '<canvas width="72" height="72"></canvas><b>' + sp.name + '</b><small>' + sp.tag + '</small>' + (locked ? '<span class="lock">🔒</span>' : '');
    card.addEventListener('click', () => {
      if (locked) { Sound.play('error'); toast('Открой секрет: доведи питомца до взрослого с уходом 80+'); return; }
      selSpecies = key; Sound.play('move'); haptic('light');
      document.querySelectorAll('.sp-card').forEach(c => c.classList.remove('on'));
      card.classList.add('on'); renderSpeciesInfo();
    });
    grid.appendChild(card);
    const c = card.querySelector('canvas'), cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    previews.push({ cc, sp, locked, seed: Math.random() * 6 });
  });
  renderSpeciesInfo();
}
function renderSpeciesInfo() {
  const sp = SPECIES[selSpecies];
  const tr = [['Аппетит', sp.traits.appetite], ['Игривость', sp.traits.play], ['Выносливость', sp.traits.stamina]];
  $('speciesInfo').innerHTML = '<h3>' + sp.name + ' <span style="color:#7b6da0;font-weight:600;font-size:13px">· ' + sp.tag + '</span></h3><p>' + sp.desc + '</p>' +
    tr.map(t => '<div class="trait"><span>' + t[0] + '</span><span class="tbar"><i style="width:' + clamp(t[1] / 1.4 * 100, 8, 100) + '%"></i></span><em>' + t[1].toFixed(2) + '</em></div>').join('') +
    '<p class="note">Норма веса: ' + sp.ideal + ' г · базовая продолжительность жизни: ' + (sp.life / 24).toFixed(1) + ' игровых суток</p>';
}
function renderPreviews(t) {
  previews.forEach((p, i) => {
    const cc = p.cc;
    Pixel.R(cc, 0, 0, 72, 72, 'rgba(0,0,0,0)');
    cc.clearRect(0, 0, 72, 72);
    const bob = Math.sin(t * 2 + p.seed) * 1.4;
    const dna = Object.assign({}, p.sp.dna, { crown: true });
    Pixel.drawPet(cc, { x: 36, y: 62 + bob, scale: .82, dna, pal: p.sp.pal, theme: Pixel.theme('color'),
      t: t + p.seed, eyes: (Math.sin(t * .7 + p.seed) > .96 ? 'closed' : 'happy'), blush: true, flip: false, walk: false });
  });
}

/* ---------- мемориал / отчёт ---------- */
function showMemorial() {
  const s = Game.s;
  $('memName').textContent = s.name;
  $('memDates').textContent = 'поколение ' + s.gen + ' · ' + (SPECIES[s.species] ? SPECIES[s.species].name : '');
  $('memCause').textContent = 'Причина: ' + s.deathCause;
  $('memStats').innerHTML =
    '<div><b>' + Game.ageDays().toFixed(1) + '</b><small>суток</small></div>' +
    '<div><b>' + Game.careScore() + '</b><small>уход</small></div>' +
    '<div><b>' + s.stats.games + '</b><small>игр</small></div>' +
    '<div><b>' + s.mistakes + '</b><small>ошибок</small></div>';
  const q = s.deathCause === 'старость'
    ? 'Прожил полную жизнь и уснул навсегда. Так и должно быть.'
    : 'Питомец не дожил до старости. Ошибки ухода копятся тихо — следи за зовом и лечи вовремя.';
  $('memQuote').textContent = q;
  $('memorial').hidden = false;
  const c = $('memCanvas'), cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  const T = Pixel.theme('classic');
  Pixel.drawRoom(cc, T, 22, { dark: true });
  Pixel.drawTomb(cc, 64, 86, T);
  Pixel.drawPet(cc, { x: 64, y: 62, scale: .8, dna: Game.dna(), pal: Game.pal(), theme: T, t: 0, ghost: true, ghostRise: 8 });
  Pixel.textC(cc, 'R.I.P.', 64, 6, T.ink, 1);
  Pixel.textC(cc, Pixel.translit(s.name), 64, 16, T.ink, 1);
}
function showAway(e) {
  const rows = [];
  rows.push('Прошло <b>' + e.hours + '</b> игровых часов (' + (e.hours / 24).toFixed(1) + ' суток).');
  if (e.evolved) rows.push('Питомец вырос до стадии <b>' + STAGE_RU[e.stage] + '</b>.');
  if (e.gotSick) rows.push('⚠️ Заболел — нужна микстура.');
  if (e.poops > 0) rows.push('Появилось кучек: <b>' + e.poops + '</b>.');
  if (e.mistakes > 0) rows.push('Ошибок ухода накопилось: <b style="color:#ff4d5e">' + e.mistakes + '</b>.');
  if (e.died) rows.push('<b style="color:#ff4d5e">Питомец не дожил до твоего возвращения.</b>');
  if (rows.length === 1) rows.push('Ничего страшного не случилось.');
  $('awayBody').innerHTML = rows.map(r => '<p style="margin:6px 0">' + r + '</p>').join('');
  $('away').hidden = false;
}

/* ---------- тосты ---------- */
let toastT = null;
function toast(msg, kind) {
  const el = $('toast');
  el.textContent = msg; el.className = 'toast on' + (kind ? ' ' + kind : '');
  clearTimeout(toastT); toastT = setTimeout(() => el.className = 'toast', 2600);
}

/* ---------- звук ---------- */
function setSound(v) {
  Game.s.sound = !!v; Sound.set(!!v);
  $('btnSound').classList.toggle('off', !v);
  if (v) Sound.play('confirm');
  Game.save();
}

/* ---------- цикл ---------- */
let raf = 0, last = 0, saveT = 0, running = false;
function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!last) last = now;
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  Game.tick(Date.now());
  drainEvents();
  updateAnim(dt);
  render();
  if (document.body.classList.contains('phase-hatchery')) renderPreviews(A.t);
  hudT += dt; if (hudT > .25) { hudT = 0; refreshHUD(); syncRail(); }
  saveT += dt; if (saveT > 5) { saveT = 0; Game.save(); }
}
function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }

/* ---------- запуск ---------- */
function boot() {
  Game.load();
  buildRail();
  Sound.set(Game.s.sound);
  $('btnSound').classList.toggle('off', !Game.s.sound);

  if (tg) {
    try {
      tg.ready(); tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#150f28');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0c0817');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (tg.BackButton) {
        tg.BackButton.onClick(() => {
          if (!$('memorial').hidden) return;
          if (document.body.classList.contains('panel-open')) { closePanel(); tg.BackButton.hide(); return; }
          if (mode === 'sub') { closeSub(); return; }
          if (mode === 'lr' || mode === 'catch') { exitGame(); return; }
          if (menuIdx >= 0) { menuIdx = -1; syncRail(); return; }
          tg.BackButton.hide();
        });
      }
    } catch (e) {}
  }

  Game.cloudLoad(() => {
    Game.s.lastTick = Game.s.lastTick || Date.now();
    if (Game.s.born && !Game.s.dead) { Game.tick(Date.now()); }
    enterPhase();
    drainEvents();
    refreshHUD(true); syncRail(); fitCanvas(); start();
  });

  /* --- инкубатор --- */
  const nameInput = $('petName');
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) nameInput.value = (tg.initDataUnsafe.user.first_name || '').slice(0, 12);
  $('btnHatch').addEventListener('click', () => {
    Sound.unlock();
    const nm = (nameInput.value || '').trim() || 'Пиксель';
    Game.hatch(selSpecies, nm);
    document.body.classList.remove('phase-hatchery');
    mode = 'hatch'; A.cracks = 0; A.born = 0;
    Sound.play('confirm'); notifyHaptic('success');
    fitCanvas(); refreshHUD(true); syncRail();
    toast('Яйцо готово. Жми B пять раз, чтобы помочь малышу.', 'good');
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') $('btnHatch').click(); });

  /* --- кнопки --- */
  ['A','B','C'].forEach(k => $('key' + k).addEventListener('click', () => press(k)));
  $('btnSound').addEventListener('click', () => { Sound.unlock(); setSound(!Game.s.sound); renderPanel(); });
  $('btnPanel').addEventListener('click', () => {
    if (document.body.classList.contains('panel-open')) closePanel(); else openPanel();
    if (tg && tg.BackButton) { if (document.body.classList.contains('panel-open')) tg.BackButton.show(); else tg.BackButton.hide(); }
  });
  $('panelClose').addEventListener('click', closePanel);
  $('panelGrip').addEventListener('click', closePanel);
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; Sound.play('move'); renderPanel(); }));
  $('awayOk').addEventListener('click', () => { $('away').hidden = true; Sound.play('confirm'); });
  $('btnNewGen').addEventListener('click', () => {
    $('memorial').hidden = true;
    Game.nextGen();
    A.ghostRise = 0; A.parts.length = 0; A.cracks = 0;
    selSpecies = 'cat'; mode = 'idle'; menuIdx = -1;
    document.body.classList.add('phase-hatchery');
    buildHatchery(); refreshHUD(true); syncRail();
    Sound.play('confirm');
  });

  /* --- тач по экрану --- */
  let touchDir = 0;
  const lt = $('lcdTouch');
  function touchAt(ev, down) {
    const r = lt.getBoundingClientRect();
    const p = (ev.touches && ev.touches[0]) || ev;
    const rx = (p.clientX - r.left) / r.width;
    if (mode === 'catch' && A.catch && !A.catch.done) { A.catch.dir = rx < .5 ? -1 : 1; return; }
    if (!down) return;
    if (mode === 'hatch') { tapEgg(); return; }
    if (mode === 'lr') { lrGuess(rx < .5 ? -1 : 1); return; }
    if (mode === 'evolve') { if (cutscene > 1.4) endEvolve(); return; }
    if (Game.s.dead) { showMemorial(); return; }
    if (mode === 'sub') { press('B'); return; }
    doPet();
  }
  lt.addEventListener('pointerdown', e => { Sound.unlock(); e.preventDefault(); touchAt(e, true); });
  lt.addEventListener('pointermove', e => { if (mode === 'catch' && e.buttons) touchAt(e, false); });
  lt.addEventListener('pointerup', () => { if (A.catch) A.catch.dir = 0; });
  lt.addEventListener('pointercancel', () => { if (A.catch) A.catch.dir = 0; });
  lt.addEventListener('pointerleave', () => { if (A.catch) A.catch.dir = 0; });

  /* --- клавиатура --- */
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || k === 'ф') { e.preventDefault(); press('A'); }
    else if (k === 'arrowright' || k === 'd' || k === 'в') { e.preventDefault(); press('C'); }
    else if (k === 'enter' || k === ' ' || k === 's' || k === 'ы' || k === 'arrowdown') { e.preventDefault(); press('B'); }
    else if (k === 'escape' || k === 'backspace') { e.preventDefault(); if (document.body.classList.contains('panel-open')) closePanel(); else press('C'); }
    else if (k >= '1' && k <= '8') { Sound.unlock(); pickIcon(+k - 1); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if ((k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') && A.catch) A.catch.dir = 0;
  });

  /* --- жизненный цикл вкладки --- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Game.save(); stop(); }
    else { Game.tick(Date.now()); drainEvents(); start(); }
  });
  window.addEventListener('pagehide', () => Game.save());
  window.addEventListener('beforeunload', () => Game.save());
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
}

function enterPhase() {
  const s = Game.s;
  if (!s.born) { document.body.classList.add('phase-hatchery'); buildHatchery(); mode = 'idle'; }
  else {
    document.body.classList.remove('phase-hatchery');
    mode = s.dead ? 'idle' : 'idle';
    if (s.dead) setTimeout(showMemorial, 500);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
