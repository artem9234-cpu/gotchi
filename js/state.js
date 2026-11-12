/* ============================================================
   Модель игры: виды, стадии, симуляция реального времени,
   ошибки ухода, эволюция, смерть, магазин, награды, сохранение.
   ============================================================ */
const SPECIES = {
  cat: { id:'cat', name:'Котопикс', tag:'ласковый', locked:false,
    desc:'Мурчит, когда доволен, и дерёт обои, когда скучно. Ест часто, играет ещё чаще.',
    pal:{body:'#ffb3d1',shade:'#e8779f',belly:'#fff0f6',accent:'#ff3d8b',eye:'#2b1030',out:'#8c3a5c'},
    dna:{ears:'cat',tail:'cat',pattern:'belly',wings:false},
    traits:{appetite:1.0,play:1.18,stamina:.92}, ideal:22, life:210 },
  dragon: { id:'dragon', name:'Дракоша', tag:'упрямый', locked:false,
    desc:'Медленно взрослеет, зато живёт дольше всех. Обжорство переносит плохо — держи вес.',
    pal:{body:'#7ee6a8',shade:'#3fae74',belly:'#e6fff0',accent:'#b6ff3d',eye:'#123020',out:'#1f6b45'},
    dna:{ears:'horn',tail:'spike',pattern:'belly',wings:true},
    traits:{appetite:1.22,play:.9,stamina:1.2}, ideal:30, life:250 },
  penguin: { id:'penguin', name:'Пингвинчик', tag:'спокойный', locked:false,
    desc:'Не капризничает по пустякам, но быстро грустит в одиночестве. Идеален для первого раза.',
    pal:{body:'#8fc7ff',shade:'#4a7fc4',belly:'#f2f8ff',accent:'#35e0ff',eye:'#141a30',out:'#2b4a7a'},
    dna:{ears:'tuft',tail:'none',pattern:'tux',beak:true,wings:false},
    traits:{appetite:.92,play:.95,stamina:1.1}, ideal:26, life:225 },
  bunny: { id:'bunny', name:'Зайка-Пиксель', tag:'шустрый', locked:false,
    desc:'Энергия через край: быстрее всех голодает и быстрее всех восстанавливается в играх.',
    pal:{body:'#fff0c9',shade:'#e0c489',belly:'#fffaf0',accent:'#ffb020',eye:'#3a2a10',out:'#9c7c3a'},
    dna:{ears:'long',tail:'puff',pattern:'spots',wings:false},
    traits:{appetite:1.15,play:1.3,stamina:.85}, ideal:18, life:195 },
  alien: { id:'alien', name:'Готч-НЛО', tag:'секретный', locked:true,
    desc:'Открывается, если довести питомца до взрослого с оценкой ухода 80+. Живёт по своим правилам.',
    pal:{body:'#c9a6ff',shade:'#8b5cf6',belly:'#f0e6ff',accent:'#35e0ff',eye:'#1a0f30',out:'#4a2a92'},
    dna:{ears:'horn',tail:'none',pattern:'spots',wings:true},
    traits:{appetite:.8,play:1.1,stamina:1.35}, ideal:24, life:280 }
};

const STAGES = ['baby','child','teen','adult','senior'];
const STAGE_RU = { egg:'яйцо', baby:'малыш', child:'ребёнок', teen:'подросток', adult:'взрослый', senior:'старейшина' };
const STAGE_AT = { baby:0, child:8, teen:24, adult:60, senior:144 };   // в игровых часах
const STAGE_SCALE = { baby:.5, child:.68, teen:.85, adult:1, senior:.96 };

const SHOP = [
  { id:'apple',   ico:'🍎', name:'Яблоко',        price:15,  kind:'food',  desc:'+2 сытости, всего +1 г веса.' },
  { id:'cake',    ico:'🍰', name:'Торт',          price:30,  kind:'food',  desc:'+2 радости, но +5 г. Осторожно с весом.' },
  { id:'vitamin', ico:'💊', name:'Витамины',      price:45,  kind:'food',  desc:'Лечит болезнь и даёт +25 здоровья.' },
  { id:'ball',    ico:'⚽', name:'Мяч',           price:120, kind:'perm',  desc:'Открывает аркаду «Лови сердечки».' },
  { id:'classic', ico:'🟩', name:'Экран «Классик»',price:90, kind:'theme', desc:'Монохромный ЖК-экран, как в 1996-м.' },
  { id:'neon',    ico:'🌈', name:'Экран «Неон»',  price:160, kind:'theme', desc:'Тёмный экран с кислотной графикой.' },
  { id:'space',   ico:'🚀', name:'Обои «Космос»', price:220, kind:'theme', desc:'Комната превращается в звёздный отсек.' }
];

const AWARDS = [
  { id:'hatch',   ico:'🥚', name:'Первый вдох',    desc:'Вылупить питомца' },
  { id:'child',   ico:'🐣', name:'Первый рост',    desc:'Довести до стадии «ребёнок»' },
  { id:'adult',   ico:'👑', name:'Полный рост',    desc:'Довести до взрослого' },
  { id:'senior',  ico:'🎩', name:'Долгожитель',    desc:'Дожить до старейшины' },
  { id:'gamer',   ico:'🎮', name:'Игроман',        desc:'10 побед в мини-играх' },
  { id:'clean',   ico:'🧹', name:'Чистюля',        desc:'Убрать 25 кучек' },
  { id:'doctor',  ico:'🩺', name:'Доктор',         desc:'Вылечить 5 болезней' },
  { id:'perfect', ico:'💯', name:'Идеальные сутки',desc:'24 игровых часа без ошибок' },
  { id:'rich',    ico:'💰', name:'Копилка',        desc:'Накопить 300 готчи' },
  { id:'dynasty', ico:'🌳', name:'Династия',       desc:'Сменить 3 поколения' },
  { id:'secret',  ico:'🛸', name:'Контакт',        desc:'Открыть секретный вид' }
];

const SAVE_KEY = 'gotchi.save.v1';

const Game = {
  s: null,
  events: [],

  /* ---------- новая жизнь ---------- */
  fresh() {
    return {
      v: 1, born: false, dead: false,
      species: 'cat', name: 'Пиксель', stage: 'egg', quality: 'good',
      age: 0, birthHour: 8, lastTick: Date.now(), created: Date.now(),
      hunger: 4, happy: 4, energy: 100, health: 100, weight: 10, discipline: 20,
      poops: [], pendingPoop: [], sick: false, sickDose: 0,
      sleeping: false, lightOn: true,
      call: null, mistakes: 0, perfectHours: 0,
      tH:0, tP:0, tPo:0, tS:0, tC:0, tL:0,
      coins: 60, gen: 1,
      items: { apple:1, cake:0, vitamin:1 },
      owned: { ball:false, classic:false, neon:false, space:false },
      theme: 'color',
      stats: { meals:0, snacks:0, games:0, wins:0, cleans:0, cures:0, scolds:0, pets:0 },
      awards: [], graveyard: [], unlocked: { alien:false },
      speed: 1, sound: true, deathCause: '', lifespan: 210
    };
  },

  load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (raw) { try { this.s = Object.assign(this.fresh(), JSON.parse(raw)); } catch (e) { this.s = this.fresh(); } }
    else this.s = this.fresh();
    // защита от битых полей
    const f = this.fresh();
    for (const k in f) if (this.s[k] === undefined || this.s[k] === null) this.s[k] = f[k];
    this.s.poops = Array.isArray(this.s.poops) ? this.s.poops : [];
    this.s.pendingPoop = Array.isArray(this.s.pendingPoop) ? this.s.pendingPoop : [];
    this.events = [];
    return this.s;
  },
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) {}
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.CloudStorage && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      try { tg.CloudStorage.setItem(SAVE_KEY, JSON.stringify(this.s), () => {}); } catch (e) {}
    }
  },
  cloudLoad(cb) {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.CloudStorage || !(tg.initDataUnsafe && tg.initDataUnsafe.user)) return cb(false);
    try {
      tg.CloudStorage.getItem(SAVE_KEY, (err, val) => {
        if (err || !val) return cb(false);
        try {
          const cloud = JSON.parse(val);
          const local = this.s;
          // берём более свежую жизнь
          if (!local.born || (cloud.lastTick || 0) > (local.lastTick || 0)) {
            this.s = Object.assign(this.fresh(), cloud);
            try { localStorage.setItem(SAVE_KEY, val); } catch (e) {}
            return cb(true);
          }
        } catch (e) {}
        cb(false);
      });
    } catch (e) { cb(false); }
  },

  /* ---------- служебное ---------- */
  sp() { return SPECIES[this.s.species] || SPECIES.cat; },
  hourOfDay() { return (this.s.birthHour + this.s.age) % 24; },
  ageDays() { return this.s.age / 24; },
  hourMs() { return 60000 / Math.max(.25, this.s.speed); },
  careScore() {
    const s = this.s;
    return Math.max(0, Math.min(100, Math.round(100 - s.mistakes * 5.5 + s.discipline * .18 + s.stats.wins * .6)));
  },
  overweight() { return this.s.weight > this.sp().ideal * 1.55; },
  emit(type, data) { this.events.push(Object.assign({ type }, data || {})); if (this.events.length > 40) this.events.shift(); },
  award(id) {
    if (this.s.awards.indexOf(id) >= 0) return;
    this.s.awards.push(id); this.s.coins += 25;
    this.emit('award', { id });
  },
  addCoins(n) { this.s.coins = Math.max(0, this.s.coins + n); if (this.s.coins >= 300) this.award('rich'); },

  /* ---------- рождение ---------- */
  hatch(species, name) {
    const keep = { coins:this.s.coins, gen:this.s.gen, awards:this.s.awards.slice(),
                   graveyard:this.s.graveyard.slice(), unlocked:Object.assign({},this.s.unlocked),
                   owned:Object.assign({},this.s.owned), items:Object.assign({},this.s.items),
                   theme:this.s.theme, speed:this.s.speed, sound:this.s.sound, stats:Object.assign({},this.s.stats) };
    this.s = Object.assign(this.fresh(), keep);
    this.s.species = species; this.s.name = (name || 'Пиксель').slice(0, 12);
    this.s.born = true; this.s.stage = 'baby'; this.s.weight = Math.round(this.sp().ideal * .4);
    this.s.lifespan = this.sp().life;
    this.s.lastTick = Date.now(); this.s.created = Date.now();
    this.award('hatch');
    this.emit('hatched', {});
    this.save();
  },

  /* ---------- симуляция ---------- */
  tick(now) {
    const s = this.s;
    if (!s.born || s.dead) { s.lastTick = now; return 0; }
    const hm = this.hourMs();
    let elapsed = now - s.lastTick;
    if (elapsed < hm) return 0;
    let steps = Math.floor(elapsed / hm);
    s.lastTick += steps * hm;
    if (steps > 4000) { steps = 4000; }
    const before = { age:s.age, stage:s.stage, mistakes:s.mistakes, sick:s.sick, poops:s.poops.length };
    for (let i = 0; i < steps && !s.dead; i++) this.hour();
    if (steps >= 4) this.emit('away', {
      hours: steps, ageFrom: before.age, ageTo: s.age,
      evolved: s.stage !== before.stage, stage: s.stage,
      mistakes: s.mistakes - before.mistakes,
      gotSick: !before.sick && s.sick,
      poops: s.poops.length - before.poops,
      died: s.dead
    });
    return steps;
  },

  hour() {
    const s = this.s, sp = this.sp();
    s.age++;
    const h = this.hourOfDay();
    const night = (h >= 21 || h < 8);
    const tired = s.energy < 12;

    /* --- сон и свет --- */
    if ((night || tired) && !s.lightOn && !s.sleeping) { s.sleeping = true; this.emit('sleep'); }
    if (s.sleeping && (s.lightOn || (!night && s.energy >= 99))) {
      if (s.lightOn) { s.tL++; }
      s.sleeping = false; this.emit('wake');
    }
    if (night && s.lightOn && !s.sleeping) { s.tL++; if (s.tL >= 2) { s.tL = 0; this.mistake('свет мешал спать'); } }
    else s.tL = 0;

    const awake = !s.sleeping;
    const k = awake ? 1 : .34;

    /* --- базовые потребности --- */
    s.hunger = Math.max(0, s.hunger - .22 * sp.traits.appetite * k);
    s.happy  = Math.max(0, s.happy  - .18 / sp.traits.play * k);
    s.energy = Math.max(0, Math.min(100, s.energy + (s.sleeping ? 14 * sp.traits.stamina : -2.6 / sp.traits.stamina)));
    s.weight = Math.max(3, s.weight - .05);

    /* --- туалет --- */
    for (let i = s.pendingPoop.length - 1; i >= 0; i--) {
      if (s.age >= s.pendingPoop[i]) {
        s.pendingPoop.splice(i, 1);
        if (s.poops.length < 4) { s.poops.push({ x: 22 + s.poops.length * 24 + Math.floor(Math.random()*6), at: s.age }); this.emit('poop'); }
      }
    }
    if (s.poops.length) { s.tPo++; if (s.tPo >= 3) { s.tPo = 0; this.mistake('грязно'); } } else s.tPo = 0;

    /* --- болезнь --- */
    if (!s.sick) {
      const ow = Math.max(0, s.weight / sp.ideal - 1.35);
      let risk = .004 + .022 * (s.poops.length / 4) + .05 * ow
               + (s.hunger <= 0 ? .022 : 0) + (s.happy <= 0 ? .016 : 0)
               + (s.stage === 'senior' ? .012 : 0);
      if (Math.random() < risk) { s.sick = true; s.sickDose = s.health < 55 ? 2 : 1; this.emit('sick'); }
    }
    if (s.sick) { s.tS++; if (s.tS >= 3) { s.tS = 0; this.mistake('болезнь без лечения'); } } else s.tS = 0;

    /* --- здоровье --- */
    let dh = 0;
    if (s.sick) dh -= 2.4;
    if (s.hunger <= 0) dh -= 1.6;
    if (s.happy <= 0) dh -= .6;
    if (s.poops.length >= 3) dh -= 1.0;
    if (this.overweight()) dh -= .5;
    if (dh === 0) dh = 1.5;
    s.health = Math.max(0, Math.min(100, s.health + dh));

    /* --- ошибки ухода по голоду/радости --- */
    if (s.hunger <= 0) { s.tH++; if (s.tH >= 2) { s.tH = 0; this.mistake('голод'); } } else s.tH = 0;
    if (s.happy <= 0)  { s.tP++; if (s.tP >= 2) { s.tP = 0; this.mistake('скука'); } } else s.tP = 0;

    /* --- зов --- */
    if (!s.call && awake) {
      const need = s.hunger < 1 || s.happy < 1 || s.sick || s.poops.length > 0 || (night && s.lightOn);
      if (need) { s.call = { fake:false, at:s.age }; this.emit('call'); }
      else if (s.age > STAGE_AT.child && Math.random() < .05) { s.call = { fake:true, at:s.age }; this.emit('call'); }
    }
    if (s.call) { s.tC++; if (s.tC >= 2) { s.tC = 0; this.mistake('зов без ответа'); s.call = null; } } else s.tC = 0;

    /* --- идеальные часы --- */
    if (s.hunger > 1.2 && s.happy > 1.2 && !s.sick && s.poops.length === 0) {
      s.perfectHours++; this.addCoins(1);
      if (s.perfectHours >= 24) this.award('perfect');
    } else s.perfectHours = 0;

    /* --- эволюция --- */
    this.checkStage();

    /* --- смерть --- */
    if (s.health <= 0) {
      this.die(s.sick ? 'болезнь' : (s.hunger <= 0 ? 'голод' : 'истощение'));
      return;
    }
    const life = s.lifespan + Math.round((this.careScore() - 50) * .8);
    if (s.age >= life) this.die('старость');
  },

  mistake(reason) {
    this.s.mistakes++;
    this.s.happy = Math.max(0, this.s.happy - .25);
    this.emit('mistake', { reason });
  },

  checkStage() {
    const s = this.s;
    let target = 'baby';
    for (const st of STAGES) if (s.age >= STAGE_AT[st]) target = st;
    if (target !== s.stage) {
      s.stage = target;
      const cs = this.careScore();
      s.quality = cs >= 55 ? 'good' : 'bad';
      this.addCoins(40);
      if (target === 'child') this.award('child');
      if (target === 'adult') {
        this.award('adult');
        if (cs >= 80 && !s.unlocked.alien) { s.unlocked.alien = true; this.award('secret'); this.emit('unlock', { id:'alien' }); }
      }
      if (target === 'senior') this.award('senior');
      this.emit('evolve', { stage: target, quality: s.quality });
    }
  },

  die(cause) {
    const s = this.s;
    if (s.dead) return;
    s.dead = true; s.deathCause = cause; s.sleeping = false; s.call = null;
    s.graveyard.unshift({
      name: s.name, species: s.species, stage: s.stage, quality: s.quality,
      days: +(this.ageDays()).toFixed(1), cause, gen: s.gen,
      care: this.careScore(), date: Date.now()
    });
    if (s.graveyard.length > 14) s.graveyard.length = 14;
    if (s.gen + 1 >= 3) this.award('dynasty');
    this.emit('death', { cause });
    this.save();
  },

  nextGen() {
    const s = this.s;
    const keep = { coins:s.coins, gen:s.gen + 1, awards:s.awards.slice(), graveyard:s.graveyard.slice(),
      unlocked:Object.assign({},s.unlocked), owned:Object.assign({},s.owned), items:Object.assign({},s.items),
      theme:s.theme, speed:s.speed, sound:s.sound, stats:Object.assign({},s.stats) };
    this.s = Object.assign(this.fresh(), keep);
    this.save();
  },

  /* ---------- действия игрока ---------- */
  feed(kind) {
    const s = this.s;
    if (s.sleeping) return { ok:false, msg:'Питомец спит — сначала выключи свет.' };
    if (s.hunger >= 3.9 && kind === 'meal') return { ok:false, msg:'Он наелся. Кормить дальше — верный путь к лишнему весу.' };
    if (kind === 'meal') {
      s.hunger = Math.min(4, s.hunger + 1.5); s.weight += 2; s.stats.meals++;
      s.pendingPoop.push(s.age + 2 + Math.floor(Math.random() * 3));
    } else if (kind === 'snack') {
      s.happy = Math.min(4, s.happy + .95); s.hunger = Math.min(4, s.hunger + .35); s.weight += 4; s.stats.snacks++;
      s.pendingPoop.push(s.age + 1 + Math.floor(Math.random() * 3));
    } else if (kind === 'apple') {
      if (!s.items.apple) return { ok:false, msg:'Яблок нет. Загляни в магазин.' };
      s.items.apple--; s.hunger = Math.min(4, s.hunger + 2); s.weight += 1; s.stats.meals++;
      s.pendingPoop.push(s.age + 3);
    } else if (kind === 'cake') {
      if (!s.items.cake) return { ok:false, msg:'Торта нет. Загляни в магазин.' };
      s.items.cake--; s.happy = Math.min(4, s.happy + 2); s.weight += 5; s.stats.snacks++;
      s.pendingPoop.push(s.age + 2);
    }
    if (s.call && !s.call.fake && (s.hunger >= 1.5)) s.call = null;
    this.addCoins(2);
    this.emit('eat', { kind });
    return { ok:true };
  },

  clean() {
    const s = this.s;
    if (!s.poops.length) return { ok:false, msg:'И так чисто. Убирать нечего.' };
    const n = s.poops.length;
    s.poops = []; s.tPo = 0;
    s.happy = Math.min(4, s.happy + .18 * n);
    s.stats.cleans += n; this.addCoins(3 * n);
    if (s.stats.cleans >= 25) this.award('clean');
    if (s.call && !s.call.fake && s.hunger >= 1 && s.happy >= 1 && !s.sick) s.call = null;
    this.emit('clean', { n });
    return { ok:true, n };
  },

  medicine() {
    const s = this.s;
    if (!s.sick) {
      if (s.health < 100) { s.health = Math.min(100, s.health + 6); this.emit('heal'); return { ok:true, msg:'Не болен, но профилактика не помешает.' }; }
      return { ok:false, msg:'Питомец здоров. Лекарство без нужды только вредит.' };
    }
    s.sickDose--;
    s.health = Math.min(100, s.health + 14);
    if (s.sickDose <= 0) {
      s.sick = false; s.tS = 0; s.stats.cures++;
      if (s.stats.cures >= 5) this.award('doctor');
      if (s.call && !s.call.fake) s.call = null;
      this.addCoins(8); this.emit('heal');
      return { ok:true, msg:'Вылечен!' };
    }
    this.emit('heal');
    return { ok:true, msg:'Стало легче, но нужна ещё одна доза.' };
  },

  vitamin() {
    const s = this.s;
    if (!s.items.vitamin) return { ok:false, msg:'Витаминов нет.' };
    s.items.vitamin--; s.sick = false; s.sickDose = 0; s.tS = 0;
    s.health = Math.min(100, s.health + 25); s.stats.cures++;
    if (s.stats.cures >= 5) this.award('doctor');
    this.emit('heal');
    return { ok:true, msg:'Витамины подействовали мгновенно.' };
  },

  toggleLight() {
    const s = this.s;
    s.lightOn = !s.lightOn;
    const h = this.hourOfDay();
    if (!s.lightOn && (h >= 21 || h < 8 || s.energy < 12)) { s.sleeping = true; this.emit('sleep'); }
    else if (s.lightOn && s.sleeping) { s.sleeping = false; this.mistake('разбудили'); this.emit('wake'); }
    else this.emit('light', { on: s.lightOn });
    return { ok:true, on: s.lightOn };
  },

  scold() {
    const s = this.s;
    s.stats.scolds++;
    if (s.call && s.call.fake) {
      s.discipline = Math.min(100, s.discipline + 14);
      s.call = null; s.tC = 0; this.addCoins(6);
      this.emit('scold', { right:true });
      return { ok:true, right:true, msg:'Верно: он капризничал. Дисциплина выросла.' };
    }
    s.discipline = Math.max(0, s.discipline - 6);
    s.happy = Math.max(0, s.happy - .8);
    this.mistake('несправедливая ругань');
    this.emit('scold', { right:false });
    return { ok:true, right:false, msg:'Зря отругал: у него была настоящая нужда.' };
  },

  praise() {
    const s = this.s;
    if (s.call && s.call.fake) return { ok:false, msg:'Он капризничает — хвалить нельзя, надо отругать.' };
    if (s.hunger < 1 || s.happy < 1 || s.sick) return { ok:false, msg:'Сначала закрой его потребности.' };
    s.discipline = Math.min(100, s.discipline + 5);
    s.happy = Math.min(4, s.happy + .25);
    this.addCoins(2); this.emit('praise');
    return { ok:true, msg:'Похвала принята. Дисциплина +5.' };
  },

  pet() {
    const s = this.s;
    if (s.sleeping) return { ok:false, msg:'Тсс… он спит.' };
    s.stats.pets++;
    s.happy = Math.min(4, s.happy + .12);
    if (s.call && !s.call.fake) { s.call = null; s.tC = 0; }
    this.emit('pet');
    return { ok:true };
  },

  finishGame(score, max, kind) {
    const s = this.s;
    const win = score >= Math.ceil(max * .6);
    s.stats.games++;
    s.happy = Math.min(4, s.happy + (win ? 1.7 : .5) + score * .05);
    s.weight = Math.max(3, s.weight - (kind === 'catch' ? score * .45 : 3));
    s.energy = Math.max(0, s.energy - (kind === 'catch' ? 12 : 8));
    this.addCoins(score * (kind === 'catch' ? 4 : 5) + (win ? 18 : 0));
    if (win) { s.stats.wins++; if (s.stats.wins >= 10) this.award('gamer'); }
    if (s.call && !s.call.fake && s.happy >= 1.5) s.call = null;
    this.emit(win ? 'win' : 'lose', { score, max });
    return win;
  },

  buy(id) {
    const s = this.s, it = SHOP.find(x => x.id === id);
    if (!it) return { ok:false, msg:'Нет такого товара.' };
    if (it.kind !== 'food' && s.owned[id]) return { ok:false, msg:'Уже куплено.' };
    if (s.coins < it.price) return { ok:false, msg:'Не хватает готчи. Играй и ухаживай — они капают сами.' };
    s.coins -= it.price;
    if (it.kind === 'food') s.items[id] = (s.items[id] || 0) + 1;
    else { s.owned[id] = true; if (it.kind === 'theme') s.theme = id; }
    this.emit('buy', { id });
    return { ok:true, msg: it.name + ' — куплено!' };
  },

  /* ---------- ДНК для рендера ---------- */
  dna() {
    const s = this.s, sp = this.sp();
    const d = Object.assign({}, sp.dna);
    if (s.stage === 'teen' && s.quality === 'bad') { d.spikes = true; }
    if (s.stage === 'adult') {
      if (s.quality === 'good') { d.crown = true; d.wings = d.wings || sp.id === 'alien'; }
      else { d.spikes = true; d.messy = true; d.crown = false; }
    }
    if (s.stage === 'senior') { d.gray = true; d.cane = true; d.crown = false; d.spikes = false; }
    return d;
  },
  pal() { return this.sp().pal; }
};
