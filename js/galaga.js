/* ============================================================
   GALAGA — полный аркадный клон для «Балбесов двор»
   Самодостаточный модуль: свой DOM, CSS, звук, спрайты, RAF-хост.
   Логическое поле 224×288 (нативное разрешение автомата).
   Работает и внутри тамагочи, и отдельной страницей (galaga.html).
   ============================================================ */
const Galaga = (() => {
'use strict';

const W = 224, H = 288, TOP = 26, BOT = 264, PY = 248;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = n => (Math.random() * n) | 0;

/* ============================ ПАЛИТРА ============================ */
const PAL = {
  w:'#ffffff', r:'#ff3b30', b:'#2f6bff', y:'#ffd400', g:'#37e05a',
  p:'#a24bff', c:'#35e0ff', o:'#ff8a1f', k:'#0a0a16', m:'#ff3d8b',
  s:'#9aa0c8', d:'#1b2a6b', e:'#0f7a34'
};

/* ============================ СПРАЙТЫ ============================ */
const SPR = {
  fighter: [
    '.......ww.......','.......ww.......','......wwww......','......wrrw......',
    '.....wwrrww.....','.....wwwwww.....','....wwwbbwww....','...wwwwbbwwww...',
    '..wwwwwbbwwwww..','.wwwwwwbbwwwwww.','.ww.wwwwwwww.ww.','.w...ww..ww...w.',
    '.....w....w.....','................'
  ],
  zakoA: [
    '..y..........y..','...y........y...','...bb......bb...','....bb....bb....',
    '...bbbbbbbbbb...','..bbbbybbybbbb..','..bbbbbbbbbbbb..','...bbbbbbbbbb...',
    '....bb.bb.bb....','.....b..b..b....','................','................'
  ],
  zakoB: [
    '................','..y..........y..','..bb........bb..','...bb......bb...',
    '...bbbbbbbbbb...','..bbbbybbybbbb..','..bbbbbbbbbbbb..','...bbbbbbbbbb...',
    '....bb.bb.bb....','.....b..b..b....','................','................'
  ],
  goeiA: [
    '..w..........w..','..ww........ww..','..www......www..','...wwrrrrrrww...',
    '...wrrrrrrrrw...','..wwrryrryrrww..','..wwrrrrrrrrww..','...wrrrrrrrrw...',
    '....rr.rr.rr....','.....r..r..r....','................','................'
  ],
  goeiB: [
    '................','...w........w...','..www......www..','...wwrrrrrrww...',
    '...wrrrrrrrrw...','..wwrryrryrrww..','..wwrrrrrrrrww..','...wrrrrrrrrw...',
    '....rr.rr.rr....','.....r..r..r....','................','................'
  ],
  bossA: [
    '....gg....gg....','...gggg..gggg...','..gggggggggggg..','..ggyggggggygg..',
    '..gggggggggggg..','...pppppppppp...','..pppppppppppp..','.pppwppppppwppp.',
    '.pppppppppppppp.','..pppppppppppp..','...pp.pp.pp.pp..','....p..p..p.....',
    '................','................'
  ],
  bossB: [
    '................','....gg....gg....','...gggg..gggg...','..gggggggggggg..',
    '..ggyggggggygg..','..gggggggggggg..','...pppppppppp...','..pppppppppppp..',
    '.pppwppppppwppp.','.pppppppppppppp.','..pppppppppppp..','...pp.pp.pp.pp..',
    '....p..p..p.....','................'
  ],
  scorpA: [
    '..o..........o..','..oo........oo..','...oo......oo...','...oooooooooo...',
    '..ooorroorrooo..','..oooooooooooo..','...oooooooooo...','....oo.oo.oo....',
    '.....o..o..o....','................','................','................'
  ],
  midoriA: [
    '.......gg.......','......gggg......','.....gggggg.....','....ggyggygg....',
    '...gggggggggg...','..gggggggggggg..','...gggggggggg...','....gg.gg.gg....',
    '.....g..g..g....','................','................','................'
  ],
  boscoA: [
    '....ss....ss....','...ssss..ssss...','..ssssssssssss..','..ssrsssssrsss..',
    '..ssssssssssss..','...rrrrrrrrrr...','..rrrrrrrrrrrr..','...rr.rr.rr.....',
    '....r..r..r.....','................','................','................'
  ]
};
const spriteCache = {};
function sprite(key, remap) {
  const ck = key + (remap ? JSON.stringify(remap) : '');
  if (spriteCache[ck]) return spriteCache[ck];
  const rows = SPR[key]; if (!rows) return null;
  const c = document.createElement('canvas');
  c.width = 16; c.height = rows.length;
  const x = c.getContext('2d');
  for (let r = 0; r < rows.length; r++) for (let q = 0; q < 16; q++) {
    const ch = rows[r][q]; if (ch === '.' || !ch) continue;
    const col = (remap && remap[ch]) || PAL[ch]; if (!col) continue;
    x.fillStyle = col; x.fillRect(q, r, 1, 1);
  }
  spriteCache[ck] = c; return c;
}
const HURT = { g:'c', p:'b', y:'w' };

/* ============================ ШРИФТ 5×7 ============================ */
const F = {
  'A':[14,17,17,31,17,17,17],'B':[30,17,17,30,17,17,30],'C':[14,17,16,16,16,17,14],
  'D':[30,17,17,17,17,17,30],'E':[31,16,16,30,16,16,31],'F':[31,16,16,30,16,16,16],
  'G':[14,17,16,23,17,17,15],'H':[17,17,17,31,17,17,17],'I':[14,4,4,4,4,4,14],
  'J':[7,2,2,2,2,18,12],'K':[17,18,20,24,20,18,17],'L':[16,16,16,16,16,16,31],
  'M':[17,27,21,21,17,17,17],'N':[17,25,21,19,17,17,17],'O':[14,17,17,17,17,17,14],
  'P':[30,17,17,30,16,16,16],'Q':[14,17,17,17,21,18,13],'R':[30,17,17,30,20,18,17],
  'S':[15,16,16,14,1,1,30],'T':[31,4,4,4,4,4,4],'U':[17,17,17,17,17,17,14],
  'V':[17,17,17,17,17,10,4],'W':[17,17,17,21,21,27,17],'X':[17,17,10,4,10,17,17],
  'Y':[17,17,10,4,4,4,4],'Z':[31,1,2,4,8,16,31],
  '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],
  '3':[31,2,4,2,1,17,14],'4':[2,6,10,18,31,2,2],'5':[31,16,30,1,1,17,14],
  '6':[6,8,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],
  '9':[14,17,17,15,1,2,12],' ':[0,0,0,0,0,0,0],'-':[0,0,0,31,0,0,0],
  '.':[0,0,0,0,0,0,4],':':[0,4,0,0,0,4,0],'%':[17,2,4,8,16,17,0],
  '!':[4,4,4,4,4,0,4],'?':[14,17,1,2,4,0,4],'/':[1,1,2,4,8,16,16],
  '(':[2,4,8,8,8,4,2],')':[8,4,2,2,2,4,8],'<':[2,4,8,16,8,4,2],'>':[8,4,2,1,2,4,8],
  '*':[4,21,14,31,14,21,4],'+':[0,4,4,31,4,4,0],'=':[0,0,31,0,31,0,0],
  "'":[4,4,0,0,0,0,0],',':[0,0,0,0,0,4,8],'#':[10,31,10,10,10,31,10]
};
function txt(g, s, x, y, col, sc) {
  sc = sc || 1; s = String(s).toUpperCase(); g.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const gl = F[s[i]] || F['?'];
    for (let r = 0; r < 7; r++) { const b = gl[r];
      for (let c = 0; c < 5; c++) if (b & (1 << (4 - c))) g.fillRect(x + i*6*sc + c*sc, y + r*sc, sc, sc); }
  }
}
const tw = (s, sc) => String(s).length * 6 * (sc||1) - (sc||1);
function txtC(g, s, cx, y, col, sc) { txt(g, s, Math.round(cx - tw(s, sc)/2), y, col, sc); }

/* ============================ ЗВУК ============================ */
const Snd = (() => {
  let ctx = null, master = null, on = true, beamOsc = null, beamGain = null, beamLfo = null;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = .13; master.connect(ctx.destination); }
    catch (e) { ctx = null; }
  }
  function tone(f, d, type, v, delay, slide) {
    if (!on || !ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d);
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(.001, v == null ? .8 : v), t0 + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + .02);
  }
  function noise(d, v, delay, freq) {
    if (!on || !ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * d));
    const b = ctx.createBuffer(1, n, ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random()*2-1) * (1 - i/n);
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = .8;
    const g = ctx.createGain(); g.gain.value = v == null ? .4 : v;
    s.connect(f); f.connect(g); g.connect(master); s.start(ctx.currentTime + (delay || 0));
  }
  const N = { C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,B4:494,C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,C6:1047,E6:1319,G6:1568 };
  const cues = {
    shoot:  () => tone(1250, .05, 'square', .35, 0, 700),
    hit:    () => { noise(.16, .35, 0, 1800); tone(520, .14, 'square', .3, 0, 120); },
    bigboom:() => { noise(.42, .55, 0, 700); tone(220, .4, 'sawtooth', .35, 0, 50); },
    dive:   () => { tone(880,.07,'square',.28); tone(660,.07,'square',.28,.08); tone(880,.07,'square',.28,.16); },
    capture:() => { [N.G5,N.F5,N.E5,N.D5,N.C5].forEach((f,i)=>tone(f,.16,'triangle',.5,i*.13)); noise(.5,.2,.1,400); },
    rescue: () => { [N.C5,N.E5,N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>tone(f,.12,'square',.55,i*.08)); tone(N.C6,.5,'triangle',.3,.5); },
    extra:  () => { [N.C6,N.E6,N.G6,N.C6].forEach((f,i)=>tone(f,.1,'square',.5,i*.09)); },
    stage:  () => { [N.G4,N.C5,N.E5].forEach((f,i)=>tone(f,.13,'square',.45,i*.11)); },
    clear:  () => { [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>tone(f,.12,'square',.5,i*.1)); },
    perfect:() => { [N.C5,N.E5,N.G5,N.C6,N.E6,N.G6,N.C6].forEach((f,i)=>tone(f,.13,'square',.55,i*.09)); },
    over:   () => { [N.A4,N.G4,N.F4,N.E4,N.D4,N.C4].forEach((f,i)=>tone(f,.3,'triangle',.5,i*.26)); },
    ui:     () => tone(1000, .04, 'square', .3),
    pause:  () => { tone(600,.07,'square',.3); tone(400,.09,'square',.3,.07); }
  };
  function beamOn() {
    if (!on || !ctx || beamOsc) return;
    try {
      beamOsc = ctx.createOscillator(); beamGain = ctx.createGain();
      beamLfo = ctx.createOscillator(); const lg = ctx.createGain();
      beamOsc.type = 'sawtooth'; beamOsc.frequency.value = 110;
      beamLfo.type = 'sine'; beamLfo.frequency.value = 11; lg.gain.value = 45;
      beamLfo.connect(lg); lg.connect(beamOsc.frequency);
      beamGain.gain.value = .0001;
      beamGain.gain.exponentialRampToValueAtTime(.22, ctx.currentTime + .25);
      beamOsc.connect(beamGain); beamGain.connect(master);
      beamOsc.start(); beamLfo.start();
    } catch (e) { beamOsc = null; }
  }
  function beamOff() {
    if (!beamOsc) return;
    try {
      beamGain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .18);
      beamOsc.stop(ctx.currentTime + .22); beamLfo.stop(ctx.currentTime + .22);
    } catch (e) {}
    beamOsc = null; beamGain = null; beamLfo = null;
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); },
    set(v) { on = !!v; if (!on) beamOff(); else this.unlock(); },
    get() { return on; },
    play(n) { try { if (cues[n]) cues[n](); } catch (e) {} },
    beamOn, beamOff,
    suspend() { beamOff(); if (ctx && ctx.state === 'running') ctx.suspend().catch(()=>{}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); }
  };
})();

/* ============================ СОСТОЯНИЕ ============================ */
let root = null, cv = null, g = null, wrap = null, elScore = null, elStage = null, elPet = null;
let active = false, ownLoop = false, rafId = 0, lastT = 0;
let opts = {}, paused = false, phase = 'title', phaseT = 0;
let score = 0, hi = 0, lives = 3, stage = 1, shots = 0, hits = 0;
let nextExtra = 20000, extraStep = 70000;
let sessionBest = 0, gotDual = false, gotPerfect = false, lastResult = null;
let player = null, bullets = [], ebullets = [], enemies = [], parts = [], stars = [], texts = [];
let formT = 0, diveTimer = 0, launchQueue = [], launchT = 0, beamHolder = null, captive = null;
let chalHits = 0, chalTotal = 0, chalDone = 0, isChallenge = false, shake = 0, flash = 0;
let input = { left:false, right:false, fire:false, auto:true, dragX:null, dragging:false };
let keys = {}, fireLatch = false, titleT = 0;

/* ============================ ТИПЫ ВРАГОВ ============================ */
const KIND = {
  zako:  { a:'zakoA', b:'zakoB', hp:1, form:50,  dive:100,  h:12 },
  goei:  { a:'goeiA', b:'goeiB', hp:1, form:80,  dive:160,  h:12 },
  boss:  { a:'bossA', b:'bossB', hp:2, form:150, dive:400,  h:14 },
  scorp: { a:'scorpA',b:'scorpA',hp:1, form:100, dive:200,  h:12 },
  midori:{ a:'midoriA',b:'midoriA',hp:1,form:120, dive:240, h:12 },
  bosco: { a:'boscoA',b:'boscoA',hp:1, form:150, dive:300,  h:12 }
};

/* ============================ ТРАЕКТОРИИ ============================ */
function spline(pts, t) {
  const n = pts.length - 1;
  const s = clamp(t, 0, .99999) * n;
  const i = Math.floor(s), u = s - i, u2 = u*u, u3 = u2*u;
  const p0 = pts[Math.max(0,i-1)], p1 = pts[i], p2 = pts[Math.min(n,i+1)], p3 = pts[Math.min(n,i+2)];
  const f = (a,b,c,d) => .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);
  return { x:f(p0.x,p1.x,p2.x,p3.x), y:f(p0.y,p1.y,p2.y,p3.y) };
}
const ENTRY = [
  [{x:-24,y:44},{x:36,y:62},{x:78,y:108},{x:62,y:150},{x:30,y:122},{x:52,y:80},{x:110,y:58},{x:150,y:92}],
  [{x:248,y:44},{x:188,y:62},{x:146,y:108},{x:162,y:150},{x:194,y:122},{x:172,y:80},{x:114,y:58},{x:74,y:92}],
  [{x:-24,y:250},{x:38,y:232},{x:80,y:192},{x:70,y:150},{x:40,y:172},{x:62,y:202},{x:112,y:172},{x:142,y:120}],
  [{x:248,y:250},{x:186,y:232},{x:144,y:192},{x:154,y:150},{x:184,y:172},{x:162,y:202},{x:112,y:172},{x:82,y:120}],
  [{x:112,y:-26},{x:112,y:40},{x:68,y:82},{x:112,y:124},{x:156,y:82},{x:112,y:40},{x:112,y:92},{x:112,y:132}],
  [{x:-24,y:118},{x:40,y:98},{x:90,y:132},{x:140,y:98},{x:190,y:132},{x:150,y:162},{x:100,y:142},{x:80,y:110}]
];
const CHAL = [
  [{x:-24,y:60},{x:60,y:80},{x:112,y:140},{x:164,y:80},{x:248,y:60}],
  [{x:248,y:60},{x:164,y:80},{x:112,y:140},{x:60,y:80},{x:-24,y:60}],
  [{x:112,y:-26},{x:60,y:70},{x:112,y:130},{x:164,y:70},{x:112,y:-26}],
  [{x:-24,y:200},{x:70,y:170},{x:112,y:110},{x:154,y:170},{x:248,y:200}],
  [{x:-24,y:120},{x:56,y:60},{x:112,y:120},{x:168,y:180},{x:248,y:120}]
];
function slotPos(col, row) {
  const spread = 15 + Math.sin(formT * .9) * 1.7;
  const sway = Math.sin(formT * .45) * 7;
  return { x: 112 + (col - 4.5) * spread + sway, y: 46 + row * 16 + Math.sin(formT * .7 + row) * 1.2 };
}
function divePath(e) {
  const px = player && player.alive ? player.x : 112;
  const side = e.x < 112 ? -1 : 1;
  return [
    {x:e.x,y:e.y},
    {x:e.x + side*28, y:e.y+20},
    {x:e.x + side*8,  y:e.y+58},
    {x:clamp(px + side*36, 14, 210), y:168},
    {x:clamp(px, 14, 210), y:214},
    {x:clamp(px - side*18, 8, 216), y:248},
    {x:clamp(px - side*44, -24, 248), y:H+28}
  ];
}

/* ============================ ЖИЗНЕННЫЙ ЦИКЛ ИГРЫ ============================ */
function resetSession() {
  score = 0; lives = 3 + (opts.extraLife ? 1 : 0); stage = 1;
  shots = 0; hits = 0; nextExtra = 20000; extraStep = 70000;
  sessionBest = 0; gotDual = false; gotPerfect = false; lastResult = null;
  hi = Math.max(hi, opts.hiScore || 0);
  startStage();
}
function startStage() {
  bullets = []; ebullets = []; enemies = []; parts = []; texts = [];
  beamHolder = null; captive = null; Snd.beamOff();
  formT = 0; diveTimer = 1.4; launchQueue = []; launchT = .35;
  chalHits = 0; chalDone = 0; isChallenge = stage >= 3 && (stage - 3) % 4 === 0;
  const dual = player && player.dual;
  player = { x:112, y:PY, dual:!!dual, alive:true, inv:1.2, cool:0, spin:0 };
  if (isChallenge) { buildChallenge(); phase = 'chalintro'; phaseT = 0; chalTotal = 40; }
  else { buildStage(); phase = 'ready'; phaseT = 0; }
  Snd.play('stage');
  if (elStage) elStage.textContent = 'РАУНД ' + stage + (isChallenge ? ' · БОНУС' : '');
}
function buildStage() {
  const layout = [
    { row:0, cols:[3,4,5,6], kind:'boss' },
    { row:1, cols:[1,2,3,4,5,6,7,8], kind:'goei' },
    { row:2, cols:[1,2,3,4,5,6,7,8], kind:'goei' },
    { row:3, cols:[0,1,2,3,4,5,6,7,8,9], kind:'zako' },
    { row:4, cols:[0,1,2,3,4,5,6,7,8,9], kind:'zako' }
  ];
  const specials = ['scorp','midori','bosco'];
  let id = 0;
  layout.forEach(L => L.cols.forEach(c => {
    let kind = L.kind;
    if (stage >= 4 && L.kind === 'goei' && (c + L.row) % 4 === 0) kind = specials[(stage + c) % 3];
    const sp = slotPos(c, L.row);
    enemies.push({
      id:id++, kind, col:c, row:L.row, hp:KIND[kind].hp, x:sp.x, y:sp.y,
      st:'wait', t:0, dur:1, path:null, ang:0, flap:Math.random()*6,
      fireT:rnd(.4,2.2), escorts:0, hasCaptive:false, beamT:0, bx:0, by:0, escortOf:null
    });
  }));
  // очереди входа: 8 групп по 5
  const order = enemies.slice();
  for (let i = 0; i < order.length; i += 5) {
    launchQueue.push({ list:order.slice(i, i+5), pattern:(i/5) % ENTRY.length, dir:(i/5)%2 });
  }
}
function buildChallenge() {
  let id = 0;
  const kinds = ['zako','goei','zako','goei','boss','scorp','midori','bosco'];
  for (let grp = 0; grp < 8; grp++) {
    const list = [];
    for (let k = 0; k < 5; k++) {
      const kind = kinds[(grp + k) % kinds.length];
      const e = {
        id:id++, kind, col:0, row:0, hp:1, x:-40, y:-40, st:'chalwait', t:0,
        dur:3.4, path:CHAL[grp % CHAL.length], ang:0, flap:Math.random()*6,
        fireT:99, escorts:0, hasCaptive:false, beamT:0, escortOf:null
      };
      enemies.push(e); list.push(e);
    }
    launchQueue.push({ list, pattern:-1, dir:grp%2, delay:grp * 2.1 });
  }
}
function launchGroups(dt) {
  if (!launchQueue.length) return;
  launchT -= dt;
  if (launchT > 0) return;
  const grp = launchQueue.shift();
  if (grp.pattern === -1) {
    grp.list.forEach((e, i) => { e.st = 'chal'; e.t = -i * .16; e.dur = 3.4; });
    launchT = 2.1;
  } else {
    const path = ENTRY[grp.pattern];
    grp.list.forEach((e, i) => { e.st = 'entry'; e.t = -i * .13; e.dur = 2.5; e.path = path; });
    launchT = 1.15;
  }
}

/* ============================ ОБНОВЛЕНИЕ ============================ */
function update(dt) {
  formT += dt; titleT += dt;
  if (shake > 0) shake -= dt;
  if (flash > 0) flash -= dt;
  updateStars(dt);
  updateParts(dt);
  updateTexts(dt);

  if (phase === 'title') { demoUpdate(dt); return; }
  if (phase === 'ready') { phaseT += dt; if (phaseT > 1.5) { phase = 'play'; phaseT = 0; } return; }
  if (phase === 'chalintro') { phaseT += dt; if (phaseT > 1.6) { phase = 'play'; phaseT = 0; } return; }
  if (phase === 'clear') { phaseT += dt; if (phaseT > 1.9) { stage++; startStage(); } return; }
  if (phase === 'chalresult') { phaseT += dt; if (phaseT > 3.0) { stage++; startStage(); } return; }
  if (phase === 'over') { phaseT += dt; return; }
  if (phase !== 'play') return;

  launchGroups(dt);
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  if (!isChallenge) scheduleDives(dt);
  collisions();

  if (isChallenge) {
    const left = enemies.filter(e => e.st !== 'dead').length;
    if (!launchQueue.length && left === 0) {
      const perfect = chalHits >= chalTotal;
      if (perfect) { addScore(10000); gotPerfect = true; Snd.play('perfect'); }
      else Snd.play('clear');
      lastChalPerfect = perfect;
      phase = 'chalresult'; phaseT = 0;
    }
  } else {
    const left = enemies.filter(e => e.st !== 'dead').length;
    if (!launchQueue.length && left === 0) { Snd.play('clear'); phase = 'clear'; phaseT = 0; }
  }
}
let lastChalPerfect = false;

function updateStars(dt) {
  for (const s of stars) {
    s.y += s.v * dt;
    if (s.y > H) { s.y = -2; s.x = rnd(0, W); }
    s.blink -= dt;
    if (s.blink <= 0) { s.on = !s.on; s.blink = rnd(.2, 1.4); }
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav||0) * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function updateTexts(dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]; t.life -= dt; t.y -= 12 * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
}
function boom(x, y, col, n, big) {
  for (let i = 0; i < (n||14); i++) {
    const a = rnd(0, Math.PI*2), sp = rnd(20, big?110:70);
    parts.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rnd(.25,.6), max:.6, c:col, s:big?2:1, grav:30 });
  }
  parts.push({ x, y, vx:0, vy:0, life:.18, max:.18, c:'#ffffff', s:big?9:6, ring:true });
}
function popText(x, y, s, col) { texts.push({ x, y, s:String(s), c:col||PAL.y, life:.9 }); }

function updatePlayer(dt) {
  const p = player; if (!p) return;
  if (p.inv > 0) p.inv -= dt;
  if (p.cool > 0) p.cool -= dt;
  if (!p.alive) {
    p.spin += dt;
    if (p.spin > 1.5) {
      if (lives < 0) { gameOver(); return; }
      p.alive = true; p.x = 112; p.inv = 1.6; p.spin = 0; p.dual = false;
    }
    return;
  }
  const sp = 112;
  if (input.dragging && input.dragX != null) {
    const d = input.dragX - p.x;
    p.x += clamp(d, -sp*2.4*dt, sp*2.4*dt);
  } else {
    if (input.left) p.x -= sp * dt;
    if (input.right) p.x += sp * dt;
  }
  const half = p.dual ? 15 : 8;
  p.x = clamp(p.x, 10 + half, W - 10 - half);
  const wantFire = input.fire || (input.dragging && input.auto) || (input.auto && input.fireHeld);
  if (wantFire && p.cool <= 0) fire();
}
function fire() {
  const p = player; if (!p || !p.alive) return;
  const max = p.dual ? 4 : 2;
  if (bullets.length >= max) return;
  p.cool = .13;
  if (p.dual) { bullets.push({x:p.x-8,y:p.y-8,v:-330}); bullets.push({x:p.x+8,y:p.y-8,v:-330}); }
  else bullets.push({x:p.x,y:p.y-8,v:-330});
  shots += p.dual ? 2 : 1;
  Snd.play('shoot');
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.y += b.v * dt;
    if (b.y < TOP - 8) bullets.splice(i, 1);
  }
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > BOT + 8 || b.x < -8 || b.x > W + 8) ebullets.splice(i, 1);
  }
}
function enemyFire(e) {
  if (isChallenge || !player || !player.alive) return;
  const sp = 96 + Math.min(70, stage * 6);
  const dx = (player.x - e.x), dy = (player.y - e.y);
  const L = Math.max(1, Math.hypot(dx, dy));
  const spread = rnd(-.16, .16);
  const ax = dx/L, ay = dy/L;
  const cx = ax*Math.cos(spread) - ay*Math.sin(spread);
  const cy = ax*Math.sin(spread) + ay*Math.cos(spread);
  ebullets.push({ x:e.x, y:e.y+6, vx:cx*sp, vy:Math.max(30, cy*sp) });
}
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.st === 'dead') continue;
    e.flap += dt * 7;
    if (e.st === 'wait' || e.st === 'chalwait') continue;

    if (e.st === 'entry' || e.st === 'dive' || e.st === 'return' || e.st === 'chal') {
      e.t += dt / e.dur;
      const t = e.t;
      if (t < 0) { continue; }
      if (t >= 1) {
        if (e.st === 'entry') { e.st = 'toSlot'; e.t = 0; e.fx = e.x; e.fy = e.y; }
        else if (e.st === 'dive') {
          if (e.escortOf) { e.st = 'return'; e.t = 0; e.path = [{x:e.col*20+20,y:-26},{x:e.col*20+20,y:30},{x:slotPos(e.col,e.row).x,y:slotPos(e.col,e.row).y}]; e.dur = 1.1; }
          else { e.st = 'return'; e.t = 0; const sp = slotPos(e.col,e.row); e.path = [{x:sp.x,y:-26},{x:sp.x,y:26},{x:sp.x,y:sp.y}]; e.dur = 1.0; }
        }
        else if (e.st === 'return') { e.st = 'form'; e.escorts = 0; e.escortOf = null; }
        else if (e.st === 'chal') { e.st = 'dead'; chalDone++; }
        continue;
      }
      const p = spline(e.path, t), q = spline(e.path, Math.min(.999, t + .012));
      e.x = p.x; e.y = p.y;
      const raw = Math.atan2(q.y - p.y, q.x - p.x) - Math.PI/2;
      e.ang = Math.round(raw / (Math.PI/4)) * (Math.PI/4);
      if (e.st === 'dive' && !isChallenge) {
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > TOP && e.y < 210) { enemyFire(e); e.fireT = rnd(.5, 1.4); }
      }
      continue;
    }
    if (e.st === 'toSlot') {
      e.t += dt / .45;
      const sp = slotPos(e.col, e.row), u = clamp(e.t, 0, 1);
      e.x = e.fx + (sp.x - e.fx) * u; e.y = e.fy + (sp.y - e.fy) * u;
      e.ang *= (1 - u);
      if (u >= 1) { e.st = 'form'; e.ang = 0; }
      continue;
    }
    if (e.st === 'form') {
      const sp = slotPos(e.col, e.row);
      e.x = sp.x; e.y = sp.y; e.ang = 0;
      continue;
    }
    if (e.st === 'tractor') {
      e.t += dt / 1.0;
      const u = clamp(e.t, 0, 1);
      e.x = e.fx + (e.bx - e.fx) * u; e.y = e.fy + (e.by - e.fy) * u;
      e.ang *= (1 - u);
      if (u >= 1) { e.st = 'beam'; e.beamT = 0; beamHolder = e; Snd.beamOn(); }
      continue;
    }
    if (e.st === 'beam') {
      e.beamT += dt;
      const total = 2.6;
      if (e.beamT > total) {
        Snd.beamOff(); beamHolder = null;
        e.st = 'return'; e.t = 0;
        const sp = slotPos(e.col, e.row);
        e.path = [{x:e.x,y:e.y},{x:e.x,y:40},{x:sp.x,y:sp.y}]; e.dur = 1.2;
        continue;
      }
      const grow = clamp(e.beamT / .5, 0, 1) * clamp((total - e.beamT) / .4, 0, 1);
      e.beamGrow = grow;
      if (grow > .7 && player && player.alive && !player.dual && player.inv <= 0) {
        if (Math.abs(player.x - e.x) < 17 && player.y > e.y + 20) capturePlayer(e);
      }
      continue;
    }
  }
}
function scheduleDives(dt) {
  diveTimer -= dt;
  if (diveTimer > 0) return;
  const maxDivers = Math.min(6, 2 + Math.floor(stage / 2));
  const diving = enemies.filter(e => e.st === 'dive' || e.st === 'tractor' || e.st === 'beam').length;
  if (diving >= maxDivers) { diveTimer = .4; return; }
  const ready = enemies.filter(e => e.st === 'form');
  if (!ready.length) { diveTimer = .5; return; }

  // Босс с захваченным кораблём или свободный босс — приоритет
  const bosses = ready.filter(e => e.kind === 'boss');
  const canTractor = bosses.length && player && player.alive && !player.dual && !captive && !beamHolder && Math.random() < .34;
  if (canTractor) {
    const b = bosses[ri(bosses.length)];
    b.st = 'tractor'; b.t = 0; b.fx = b.x; b.fy = b.y;
    b.bx = clamp(rnd(56, 168), 40, 184); b.by = 104;
    Snd.play('dive');
    diveTimer = Math.max(.7, 2.4 - stage * .1);
    return;
  }
  const withCaptive = ready.find(e => e.hasCaptive);
  const lead = withCaptive || (bosses.length && Math.random() < .4 ? bosses[ri(bosses.length)] : ready[ri(ready.length)]);
  lead.st = 'dive'; lead.t = 0; lead.dur = Math.max(1.5, 2.6 - stage * .07);
  lead.path = divePath(lead); lead.fireT = rnd(.2, .7); lead.escorts = 0;
  Snd.play('dive');
  if (lead.kind === 'boss' && !lead.hasCaptive) {
    const esc = ready.filter(e => e !== lead && e.kind !== 'boss' && Math.abs(e.col - lead.col) <= 2 && e.row <= lead.row + 2).slice(0, 2);
    esc.forEach((e, i) => {
      e.st = 'dive'; e.t = -(i+1) * .12; e.dur = lead.dur;
      e.path = lead.path.map(p => ({ x:p.x + (i? 16 : -16), y:p.y + 12 }));
      e.fireT = rnd(.4, 1.2); e.escortOf = lead; lead.escorts++;
    });
  }
  diveTimer = Math.max(.5, 2.2 - stage * .12) * rnd(.7, 1.3);
}
function capturePlayer(e) {
  Snd.beamOff(); beamHolder = null;
  player.alive = false; player.spin = 0; player.captured = true;
  captive = { x:player.x, y:player.y, t:0, holder:e };
  e.hasCaptive = true; e.st = 'return'; e.t = 0;
  const sp = slotPos(e.col, e.row);
  e.path = [{x:e.x,y:e.y},{x:e.x,y:50},{x:sp.x,y:sp.y}]; e.dur = 1.4;
  lives--; Snd.play('capture'); shake = .5;
  popText(player.x, player.y - 20, 'CAPTURED!', PAL.c);
  if (elScore) syncHud();
}
function rescueCaptive(e) {
  gotDual = true;
  addScore(1000); popText(e.x, e.y, '1000', PAL.c);
  Snd.play('rescue'); flash = .25;
  if (player) { player.dual = true; player.alive = true; player.inv = 1.4; player.captured = false; }
  captive = null;
  boom(e.x, e.y - 14, PAL.c, 20, true);
  popText(112, 150, 'DUAL FIGHTER!', PAL.g);
}
function killEnemy(e, byBullet) {
  const K = KIND[e.kind];
  const inForm = e.st === 'form' || e.st === 'toSlot';
  let pts = inForm ? K.form : K.dive;
  if (e.kind === 'boss' && !inForm) pts = e.escorts >= 2 ? 1600 : e.escorts === 1 ? 800 : 400;
  if (isChallenge) { chalHits++; pts = K.dive; }
  addScore(pts);
  popText(e.x, e.y - 8, pts, e.kind === 'boss' ? PAL.c : PAL.y);
  boom(e.x, e.y, e.kind === 'boss' ? PAL.g : (e.kind === 'goei' ? PAL.r : PAL.b), e.kind === 'boss' ? 22 : 14, e.kind === 'boss');
  Snd.play('hit');
  if (e.hasCaptive) {
    if (!inForm && !isChallenge) rescueCaptive(e);
    else { boom(e.x, e.y - 15, PAL.r, 16); captive = null; popText(e.x, e.y - 24, 'LOST', PAL.r); }
  }
  e.st = 'dead';
  if (byBullet) hits++;
  if (beamHolder === e) { Snd.beamOff(); beamHolder = null; }
  enemies.filter(x => x.escortOf === e).forEach(x => { x.escortOf = null; });
}
function addScore(n) {
  score += n;
  if (score > sessionBest) sessionBest = score;
  if (score > hi) hi = score;
  while (score >= nextExtra) {
    lives++; Snd.play('extra'); popText(112, 180, 'EXTRA LIFE', PAL.g);
    nextExtra += extraStep;
  }
  syncHud();
}
function playerHit() {
  const p = player; if (!p || !p.alive || p.inv > 0) return;
  if (p.dual) {
    p.dual = false; p.inv = 1.4; boom(p.x + 8, p.y, PAL.w, 16);
    Snd.play('hit'); shake = .3; popText(p.x, p.y - 20, 'WINGMAN LOST', PAL.o);
    return;
  }
  p.alive = false; p.spin = 0; lives--;
  boom(p.x, p.y, PAL.w, 30, true); Snd.play('bigboom'); shake = .6; flash = .2;
  ebullets = [];
  syncHud();
}
function collisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; let gone = false;
    for (const e of enemies) {
      if (e.st === 'dead' || e.st === 'wait' || e.st === 'chalwait' || e.t < 0) continue;
      const hh = KIND[e.kind].h / 2 + 2;
      if (Math.abs(b.x - e.x) < 9 && Math.abs(b.y - e.y) < hh) {
        bullets.splice(i, 1); gone = true;
        e.hp--;
        if (e.hp <= 0) killEnemy(e, true);
        else { Snd.play('hit'); boom(e.x, e.y, PAL.c, 6); e.hurt = true; }
        break;
      }
    }
    if (gone) continue;
  }
  if (!player || !player.alive || isChallenge) return;
  const half = player.dual ? 15 : 7;
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    if (Math.abs(b.x - player.x) < half + 2 && Math.abs(b.y - player.y) < 8) {
      ebullets.splice(i, 1); playerHit(); return;
    }
  }
  for (const e of enemies) {
    if (e.st !== 'dive' && e.st !== 'entry' && e.st !== 'return') continue;
    if (e.t < 0) continue;
    if (Math.abs(e.x - player.x) < half + 7 && Math.abs(e.y - player.y) < 11) {
      killEnemy(e, false); playerHit(); return;
    }
  }
}
function gameOver() {
  phase = 'over'; phaseT = 0; Snd.beamOff(); Snd.play('over');
  lastResult = buildResult();
  if (opts.onGameOver) { try { opts.onGameOver(lastResult); } catch (e) {} }
}
function buildResult() {
  return {
    score: sessionBest || score, stage, shots, hits,
    ratio: shots ? Math.round(hits / shots * 100) : 0,
    won: (sessionBest || score) >= 10000 || stage >= 4,
    dual: gotDual, perfect: gotPerfect
  };
}
function syncHud() {
  if (elScore) elScore.textContent = String(score).padStart(6, '0');
}

/* ============================ ДЕМО НА ТАЙТЛЕ ============================ */
let demo = [];
function demoInit() {
  demo = [];
  for (let i = 0; i < 12; i++) {
    demo.push({ kind:['zako','goei','boss'][i%3], t:-i*.18, dur:3.2, path:ENTRY[i%ENTRY.length], x:-40, y:-40, ang:0, flap:i, hp:2 });
  }
}
function demoUpdate(dt) {
  for (const e of demo) {
    e.flap += dt*7; e.t += dt/e.dur;
    if (e.t > 1.25) { e.t = -rnd(0,.6); e.path = ENTRY[ri(ENTRY.length)]; }
    if (e.t < 0) continue;
    const p = spline(e.path, Math.min(.999, e.t)), q = spline(e.path, Math.min(.999, e.t+.012));
    e.x = p.x; e.y = p.y;
    e.ang = Math.round((Math.atan2(q.y-p.y,q.x-p.x)-Math.PI/2)/(Math.PI/4))*(Math.PI/4);
  }
}

/* ============================ РЕНДЕР ============================ */
function render() {
  const sx = shake > 0 ? Math.round(rnd(-2,2)) : 0;
  const sy = shake > 0 ? Math.round(rnd(-2,2)) : 0;
  g.setTransform(1,0,0,1,0,0);
  g.fillStyle = '#000308'; g.fillRect(0,0,W,H);
  g.save(); g.translate(sx, sy);

  // звёзды
  for (const s of stars) {
    if (!s.on) continue;
    g.fillStyle = s.c; g.fillRect(s.x|0, s.y|0, 1, 1);
  }

  if (phase === 'title') { drawEnemies(demo); drawTitle(); g.restore(); blitFx(); return; }

  // луч захвата
  if (beamHolder && beamHolder.st === 'beam') drawBeam(beamHolder);

  drawEnemies(enemies);

  // захваченный корабль над боссом
  for (const e of enemies) {
    if (e.hasCaptive && e.st !== 'dead') {
      const s = sprite('fighter', { w:'#ff8a1f', r:'#ff3b30', b:'#ffd400' });
      if (s) g.drawImage(s, Math.round(e.x-8), Math.round(e.y-22));
    }
  }
  if (captive && player && !player.alive && player.captured) {
    captive.t += .016;
    const e = captive.holder;
    const u = clamp(captive.t/1.2, 0, 1);
    const cx = captive.x + (e.x - captive.x)*u, cy = captive.y + (e.y-22 - captive.y)*u;
    g.save(); g.translate(cx, cy); g.rotate(u*Math.PI*4);
    const s = sprite('fighter'); if (s) g.drawImage(s, -8, -7);
    g.restore();
  }

  // игрок
  if (player && player.alive && (player.inv <= 0 || Math.floor(player.inv*14)%2===0)) {
    const s = sprite('fighter');
    if (player.dual) { g.drawImage(s, Math.round(player.x-16), Math.round(player.y-7)); g.drawImage(s, Math.round(player.x), Math.round(player.y-7)); }
    else g.drawImage(s, Math.round(player.x-8), Math.round(player.y-7));
  }

  // пули
  g.fillStyle = PAL.c;
  for (const b of bullets) g.fillRect(Math.round(b.x)-1, Math.round(b.y)-4, 2, 7);
  for (const b of ebullets) {
    g.fillStyle = PAL.y; g.fillRect(Math.round(b.x)-1, Math.round(b.y)-3, 2, 6);
    g.fillStyle = PAL.r; g.fillRect(Math.round(b.x)-2, Math.round(b.y)-1, 4, 2);
  }

  drawParts();
  for (const t of texts) txtC(g, t.s, t.x, t.y, t.c, 1);

  drawHud();

  if (phase === 'ready') {
    txtC(g, 'STAGE ' + stage, 112, 140, PAL.c, 2);
    txtC(g, 'READY', 112, 164, PAL.w, 1);
  } else if (phase === 'chalintro') {
    txtC(g, 'CHALLENGING STAGE', 112, 138, PAL.y, 1);
    txtC(g, 'SHOOT ALL 40', 112, 154, PAL.w, 1);
    txtC(g, 'PERFECT = 10000', 112, 170, PAL.g, 1);
  } else if (phase === 'clear') {
    txtC(g, 'STAGE CLEAR', 112, 142, PAL.g, 2);
    txtC(g, 'BONUS ' + (stage*100), 112, 166, PAL.y, 1);
  } else if (phase === 'chalresult') {
    txtC(g, 'NUMBER OF HITS', 112, 128, PAL.w, 1);
    txtC(g, String(chalHits), 112, 144, PAL.c, 2);
    if (lastChalPerfect) { txtC(g, 'PERFECT !!', 112, 168, PAL.y, 2); txtC(g, 'SPECIAL BONUS 10000', 112, 190, PAL.g, 1); }
    else txtC(g, 'BONUS ' + (chalHits*100), 112, 170, PAL.y, 1);
  } else if (phase === 'over') {
    drawResults();
  }

  if (paused) {
    g.fillStyle = 'rgba(0,4,12,.78)'; g.fillRect(0,0,W,H);
    txtC(g, 'PAUSED', 112, 128, PAL.c, 2);
    txtC(g, 'P - CONTINUE', 112, 154, PAL.w, 1);
    txtC(g, 'ESC - EXIT TO PET', 112, 170, PAL.s, 1);
  }
  g.restore();
  blitFx();
}
function blitFx() {
  if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (flash*1.6).toFixed(2) + ')'; g.fillRect(0,0,W,H); }
}
function drawEnemies(list) {
  for (const e of list) {
    if (e.st === 'dead' || e.st === 'wait' || e.st === 'chalwait' || e.t < 0) continue;
    const K = KIND[e.kind];
    const fr = Math.floor(e.flap) % 2;
    const key = fr ? K.b : K.a;
    const remap = (e.kind === 'boss' && (e.hurt || e.hp === 1)) ? HURT : null;
    const s = sprite(key, remap); if (!s) continue;
    g.save(); g.translate(Math.round(e.x), Math.round(e.y));
    if (e.ang) g.rotate(e.ang);
    g.drawImage(s, -8, -(s.height>>1));
    g.restore();
  }
}
function drawBeam(e) {
  const grow = e.beamGrow || 0; if (grow <= .02) return;
  const topY = e.y + 8, botY = PY + 12;
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const u = i / steps;
    const y = topY + (botY - topY) * u;
    const hw = (4 + 26 * u) * grow;
    const ph = (e.beamT * 5 + i * .5) % 2;
    g.fillStyle = ph < 1 ? 'rgba(53,224,255,.55)' : 'rgba(47,107,255,.42)';
    g.fillRect(Math.round(e.x - hw), Math.round(y), Math.round(hw*2), Math.max(2, ((botY-topY)/steps)|0));
  }
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.fillRect(Math.round(e.x-2), Math.round(topY), 4, Math.round((botY-topY)*grow));
}
function drawParts() {
  for (const p of parts) {
    const a = clamp(p.life/p.max, 0, 1);
    g.globalAlpha = a;
    if (p.ring) {
      g.strokeStyle = p.c; g.lineWidth = 1;
      g.beginPath(); g.arc(p.x, p.y, p.s*(1.6-a), 0, 6.283); g.stroke();
    } else { g.fillStyle = p.c; g.fillRect(p.x|0, p.y|0, p.s, p.s); }
    g.globalAlpha = 1;
  }
}
function drawHud() {
  g.fillStyle = '#000308'; g.fillRect(0,0,W,TOP-2); g.fillRect(0,BOT+2,W,H-BOT);
  txt(g, '1UP', 6, 4, PAL.r, 1);
  txt(g, String(score).padStart(6,'0'), 6, 14, PAL.w, 1);
  txtC(g, 'HIGH SCORE', 112, 4, PAL.r, 1);
  txtC(g, String(hi).padStart(6,'0'), 112, 14, PAL.y, 1);
  txt(g, 'STAGE', 176, 4, PAL.c, 1);
  txt(g, String(stage).padStart(2,'0'), 190, 14, PAL.w, 1);
  // жизни
  const s = sprite('fighter');
  for (let i = 0; i < Math.min(6, Math.max(0, lives)); i++) if (s) g.drawImage(s, 4 + i*17, BOT + 6);
  // флаги раундов
  let bx = W - 8;
  const badges = [];
  let n = stage;
  [50,30,20,10,5,1].forEach(v => { while (n >= v) { badges.push(v); n -= v; } });
  badges.slice(0, 8).reverse().forEach(v => {
    bx -= 9;
    const col = v >= 30 ? PAL.m : v >= 10 ? PAL.y : PAL.c;
    g.fillStyle = col; g.fillRect(bx, BOT+8, 7, 5);
    g.fillStyle = PAL.s; g.fillRect(bx, BOT+13, 1, 5);
  });
  if (isChallenge) txtC(g, 'BONUS ROUND  ' + chalHits + '/' + chalTotal, 112, BOT + 8, PAL.y, 1);
}
function drawTitle() {
  g.fillStyle = 'rgba(0,3,10,.55)'; g.fillRect(0,0,W,H);
  txtC(g, 'GALAGA', 112, 40, PAL.y, 4);
  txtC(g, 'BALBESOV ARCADE', 112, 74, PAL.c, 1);
  txtC(g, '- SCORE TABLE -', 112, 100, PAL.w, 1);
  const rows = [['zakoA','BEE','50 / 100'],['goeiA','BUTTERFLY','80 / 160'],['bossA','BOSS','150 / 400-1600']];
  rows.forEach((r, i) => {
    const y = 116 + i*20, s = sprite(r[0]);
    if (s) g.drawImage(s, 24, y - 6);
    txt(g, r[1], 46, y, PAL.w, 1);
    txt(g, r[2], 120, y, PAL.y, 1);
  });
  txtC(g, 'CAPTURED FIGHTER = DUAL SHIP', 112, 182, PAL.g, 1);
  if (Math.floor(titleT*2)%2===0) txtC(g, 'PUSH FIRE TO START', 112, 206, PAL.w, 1);
  txtC(g, 'HIGH SCORE ' + String(hi).padStart(6,'0'), 112, 228, PAL.y, 1);
  txtC(g, 'ARROWS MOVE   SPACE FIRE', 112, 246, PAL.s, 1);
  txtC(g, 'P PAUSE   ESC EXIT', 112, 258, PAL.s, 1);
}
function drawResults() {
  g.fillStyle = 'rgba(0,3,10,.86)'; g.fillRect(0, 40, W, 200);
  txtC(g, 'GAME OVER', 112, 52, PAL.r, 2);
  txtC(g, '- RESULTS -', 112, 80, PAL.w, 1);
  const r = lastResult || buildResult();
  txt(g, 'SHOTS FIRED', 24, 100, PAL.s, 1);   txt(g, String(r.shots), 160, 100, PAL.w, 1);
  txt(g, 'NUMBER OF HITS', 24, 116, PAL.s, 1); txt(g, String(r.hits), 160, 116, PAL.w, 1);
  txt(g, 'HIT-MISS RATIO', 24, 132, PAL.s, 1); txt(g, r.ratio + ' %', 160, 132, PAL.y, 1);
  txt(g, 'BEST SCORE', 24, 152, PAL.s, 1);     txt(g, String(r.score), 150, 152, PAL.c, 1);
  txt(g, 'STAGE REACHED', 24, 168, PAL.s, 1);  txt(g, String(r.stage), 168, 168, PAL.c, 1);
  if (r.dual) txtC(g, '* DUAL FIGHTER RESCUED *', 112, 188, PAL.g, 1);
  if (r.perfect) txtC(g, '* PERFECT CHALLENGE *', 112, 200, PAL.y, 1);
  if (Math.floor(phaseT*2)%2===0) txtC(g, 'FIRE - PLAY AGAIN', 112, 216, PAL.w, 1);
  txtC(g, 'ESC - BACK TO PET', 112, 230, PAL.s, 1);
}

/* ============================ DOM / CSS ============================ */
const CSS = `
.gal-root{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;
  background:radial-gradient(120% 90% at 50% 0%,#0b1030 0%,#04060f 55%,#000 100%);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace;color:#dff3ff;
  -webkit-user-select:none;user-select:none;touch-action:none;overscroll-behavior:none}
.gal-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.gal-root::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:5;opacity:.14;
  background:repeating-linear-gradient(180deg,rgba(0,0,0,.7) 0 1px,transparent 1px 3px)}
.gal-top{position:relative;z-index:6;display:flex;align-items:center;gap:8px;
  padding:calc(8px + env(safe-area-inset-top)) 10px 8px;
  background:linear-gradient(180deg,rgba(8,12,32,.96),rgba(8,12,32,.55));
  border-bottom:1px solid rgba(53,224,255,.28)}
.gal-pet{width:32px;height:32px;border-radius:9px;image-rendering:pixelated;flex:0 0 auto;
  background:#120a24;border:1px solid rgba(162,75,255,.5);box-shadow:0 0 12px rgba(162,75,255,.35)}
.gal-ttl{flex:1;min-width:0;line-height:1.15}
.gal-ttl b{display:block;font-size:13px;letter-spacing:.22em;color:#ffd400;
  text-shadow:0 0 10px rgba(255,212,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gal-ttl small{display:block;font-size:10px;color:#7fd8ff;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gal-score{font-size:15px;font-weight:800;color:#fff;letter-spacing:.1em;
  padding:4px 9px;border-radius:9px;background:rgba(53,224,255,.12);border:1px solid rgba(53,224,255,.35);
  text-shadow:0 0 8px rgba(53,224,255,.7)}
.gal-btn{width:34px;height:34px;flex:0 0 auto;border-radius:10px;border:1px solid rgba(53,224,255,.32);
  background:rgba(53,224,255,.1);color:#dff3ff;font-size:15px;display:grid;place-items:center;cursor:pointer;transition:.14s}
.gal-btn:hover{background:rgba(53,224,255,.24)}
.gal-btn:active{transform:scale(.92)}
.gal-btn.off{opacity:.45}
.gal-btn.exit{border-color:rgba(255,61,139,.45);background:rgba(255,61,139,.14);color:#ffd0e6}
.gal-stage{position:relative;z-index:6;text-align:center;font-size:10px;letter-spacing:.18em;
  color:#ffd400;padding:5px 0 3px;text-shadow:0 0 8px rgba(255,212,0,.5)}
.gal-mid{position:relative;z-index:6;flex:1;min-height:0;display:grid;place-items:center;padding:4px 6px}
.gal-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;
  border-radius:8px;background:#000;box-shadow:0 0 0 2px rgba(53,224,255,.25),0 0 44px rgba(47,107,255,.35),inset 0 0 40px rgba(0,0,0,.8)}
.gal-pad{position:relative;z-index:6;display:flex;align-items:center;justify-content:center;gap:10px;
  padding:8px 12px calc(12px + env(safe-area-inset-bottom))}
.gal-key{min-width:74px;height:56px;border-radius:16px;border:1px solid rgba(53,224,255,.35);
  background:linear-gradient(180deg,rgba(53,224,255,.18),rgba(47,107,255,.14));color:#eaf9ff;
  font-size:22px;font-weight:800;display:grid;place-items:center;cursor:pointer;transition:.08s;
  box-shadow:0 4px 0 rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)}
.gal-key:active,.gal-key.down{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.5)}
.gal-key.fire{min-width:112px;background:linear-gradient(180deg,rgba(255,61,139,.3),rgba(255,138,31,.2));
  border-color:rgba(255,61,139,.55);color:#fff;font-size:15px;letter-spacing:.14em}
.gal-auto{height:56px;padding:0 12px;border-radius:16px;border:1px solid rgba(55,224,90,.4);
  background:rgba(55,224,90,.14);color:#c9ffd8;font-size:10px;font-weight:800;letter-spacing:.1em;cursor:pointer}
.gal-auto.off{opacity:.45;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#9aa0c8}
.gal-hint{position:relative;z-index:6;text-align:center;font-size:10px;color:#6f7fa8;padding:0 0 8px;letter-spacing:.06em}
@media(max-width:520px){.gal-key{min-width:64px;height:52px}.gal-key.fire{min-width:92px}.gal-ttl b{font-size:11px;letter-spacing:.14em}}
@media(min-width:900px){.gal-hint{font-size:11px}}
`;
function buildDom() {
  if (root) return;
  const st = document.createElement('style'); st.id = 'gal-css'; st.textContent = CSS;
  document.head.appendChild(st);
  root = document.createElement('div');
  root.className = 'gal-root';
  root.innerHTML =
    '<div class="gal-top">' +
      '<canvas class="gal-pet" id="galPet" width="40" height="40"></canvas>' +
      '<div class="gal-ttl"><b>GALAGA</b><small id="galSub">БАЛБЕСОВ ДВОР</small></div>' +
      '<div class="gal-score" id="galScore">000000</div>' +
      '<button class="gal-btn" id="galSound" title="Звук">🔊</button>' +
      '<button class="gal-btn" id="galPause" title="Пауза">⏸</button>' +
      '<button class="gal-btn exit" id="galExit" title="Выйти к питомцу">✕</button>' +
    '</div>' +
    '<div class="gal-stage" id="galStage">РАУНД 1</div>' +
    '<div class="gal-mid" id="galMid"><canvas class="gal-cv" id="galCv" width="224" height="288"></canvas></div>' +
    '<div class="gal-pad">' +
      '<button class="gal-key" id="galL">◀</button>' +
      '<button class="gal-key fire" id="galF">ОГОНЬ</button>' +
      '<button class="gal-key" id="galR">▶</button>' +
      '<button class="gal-auto" id="galA">АВТО<br>ОГОНЬ</button>' +
    '</div>' +
    '<div class="gal-hint">← → или A/D — движение · ПРОБЕЛ — огонь · P — пауза · ESC — выход · тяни пальцем по экрану</div>';
  document.body.appendChild(root);
  cv = root.querySelector('#galCv'); g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  wrap = root.querySelector('#galMid');
  elScore = root.querySelector('#galScore'); elStage = root.querySelector('#galStage');
  elPet = root.querySelector('#galPet');
  const sub = root.querySelector('#galSub');
  sub.textContent = opts.petName ? ('ПИЛОТ: ' + String(opts.petName).toUpperCase()) : 'БАЛБЕСОВ ДВОР';
  drawPetBadge();
  bindDom();
  fit();
}
function drawPetBadge() {
  const c = elPet, x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#120a24'; x.fillRect(0,0,40,40);
  if (opts.petPortrait) {
    const im = new Image();
    im.onload = () => { try { x.clearRect(0,0,40,40); x.drawImage(im,0,0,40,40); } catch(e){} };
    im.src = opts.petPortrait;
  } else {
    const s = sprite('fighter'); if (s) x.drawImage(s, 12, 13);
  }
}
function bindDom() {
  const hold = (el, on, off) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); Snd.unlock(); on(); });
    ['pointerup','pointercancel','pointerleave'].forEach(ev => el.addEventListener(ev, () => { el.classList.remove('down'); off(); }));
  };
  hold(root.querySelector('#galL'), () => input.left = true, () => input.left = false);
  hold(root.querySelector('#galR'), () => input.right = true, () => input.right = false);
  hold(root.querySelector('#galF'), () => { input.fire = true; primary(); }, () => input.fire = false);
  const a = root.querySelector('#galA');
  a.classList.toggle('off', !input.auto);
  a.addEventListener('click', () => { input.auto = !input.auto; a.classList.toggle('off', !input.auto); Snd.play('ui'); });
  root.querySelector('#galSound').addEventListener('click', e => {
    Snd.set(!Snd.get()); e.currentTarget.classList.toggle('off', !Snd.get());
    e.currentTarget.textContent = Snd.get() ? '🔊' : '🔇';
    if (opts.onSound) { try { opts.onSound(Snd.get()); } catch (err) {} }
  });
  root.querySelector('#galPause').addEventListener('click', () => togglePause());
  root.querySelector('#galExit').addEventListener('click', () => requestExit());
  // перетаскивание по полю
  const toX = e => {
    const r = cv.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width * W, 0, W);
  };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); Snd.unlock();
    if (phase === 'title' || phase === 'over') { primary(); return; }
    input.dragging = true; input.dragX = toX(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener('pointermove', e => { if (input.dragging) { e.preventDefault(); input.dragX = toX(e); } });
  ['pointerup','pointercancel'].forEach(ev => cv.addEventListener(ev, () => { input.dragging = false; input.dragX = null; }));
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
}
function fit() {
  if (!wrap || !cv) return;
  const r = wrap.getBoundingClientRect();
  const aw = Math.max(80, r.width - 8), ah = Math.max(80, r.height - 8);
  const sc = Math.min(aw / W, ah / H);
  cv.style.width = Math.floor(W * sc) + 'px';
  cv.style.height = Math.floor(H * sc) + 'px';
}
function primary() {
  if (phase === 'title') { resetSession(); Snd.play('ui'); return; }
  if (phase === 'over' && phaseT > .6) { resetSession(); Snd.play('ui'); return; }
  if (paused) { togglePause(); return; }
}
function togglePause() {
  if (phase === 'title' || phase === 'over') return;
  paused = !paused; Snd.play('pause');
  if (paused) Snd.beamOff();
}
function onKey(e) {
  if (!active) return;
  const k = e.key.toLowerCase();
  if (['arrowleft','arrowright','arrowup','arrowdown',' ','a','d','w','ф','в','ц','p','з','escape','enter'].indexOf(k) >= 0) e.preventDefault();
  if (e.type === 'keydown') {
    if (keys[k]) return; keys[k] = true;
    if (k === 'arrowleft' || k === 'a' || k === 'ф') input.left = true;
    if (k === 'arrowright' || k === 'd' || k === 'в') input.right = true;
    if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'ц' || k === 'enter') { input.fire = true; primary(); }
    if (k === 'p' || k === 'з') togglePause();
    if (k === 'escape') requestExit();
  } else {
    keys[k] = false;
    if (k === 'arrowleft' || k === 'a' || k === 'ф') input.left = false;
    if (k === 'arrowright' || k === 'd' || k === 'в') input.right = false;
    if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'ц' || k === 'enter') input.fire = false;
  }
}

/* ============================ ПУБЛИЧНОЕ API ============================ */
function makeStars() {
  stars = [];
  const cols = ['#ffffff','#35e0ff','#ffd400','#ff3b30','#37e05a','#a24bff'];
  for (let i = 0; i < 70; i++) stars.push({ x:rnd(0,W), y:rnd(0,H), v:rnd(14,52), c:cols[ri(cols.length)], on:true, blink:rnd(.1,1.4) });
}
function open(o) {
  opts = o || {};
  if (active) return;
  active = true; paused = false; phase = 'title'; phaseT = 0; titleT = 0;
  hi = Math.max(opts.hiScore || 0, 0);
  score = 0; lives = 3; stage = 1; shots = 0; hits = 0;
  sessionBest = 0; gotDual = false; gotPerfect = false; lastResult = null;
  bullets = []; ebullets = []; enemies = []; parts = []; texts = [];
  player = null; captive = null; beamHolder = null;
  input = { left:false, right:false, fire:false, auto:true, dragX:null, dragging:false };
  keys = {};
  makeStars(); demoInit();
  Snd.set(opts.sound !== false);
  buildDom();
  root.style.display = 'flex';
  const sb = root.querySelector('#galSound');
  sb.classList.toggle('off', !Snd.get()); sb.textContent = Snd.get() ? '🔊' : '🔇';
  syncHud(); if (elStage) elStage.textContent = 'НАЖМИ ОГОНЬ';
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  Snd.unlock(); fit();
  if (ownLoop) { lastT = 0; rafId = requestAnimationFrame(tick); }
}
function close() {
  if (!active) return;
  active = false; paused = false;
  Snd.beamOff();
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('keyup', onKey);
  if (ownLoop) { cancelAnimationFrame(rafId); rafId = 0; }
  if (root) root.style.display = 'none';
  const r = lastResult || buildResult();
  if (opts.onExit) { try { opts.onExit(r); } catch (e) {} }
}
function requestExit() { Snd.play('ui'); close(); }
function frame(now, dt) {
  if (!active) return;
  if (!paused) update(Math.min(.05, dt));
  render();
}
function tick(now) {
  if (!active || !ownLoop) return;
  rafId = requestAnimationFrame(tick);
  if (!lastT) lastT = now;
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  frame(now, dt);
}
function standalone(o) {
  ownLoop = true;
  open(Object.assign({ petName:'', hiScore: Number(localStorage.getItem('galaga_hi') || 0) }, o || {}, {
    onExit: r => {
      try { localStorage.setItem('galaga_hi', String(Math.max(r.score, Number(localStorage.getItem('galaga_hi')||0)))); } catch(e){}
      active = false;
      setTimeout(() => { ownLoop = true; open(Object.assign({}, opts, { hiScore: Number(localStorage.getItem('galaga_hi')||0) })); }, 60);
    }
  }));
}
function pause(v) {
  if (!active) return;
  if (v && !paused && phase !== 'title' && phase !== 'over') togglePause();
  if (v) Snd.suspend(); else Snd.resume();
}

return {
  open, close, frame, requestExit, pause, standalone,
  get active() { return active; },
  get score() { return score; },
  get hi() { return hi; }
};
})();
if (typeof window !== 'undefined') window.Galaga = Galaga;
