/* Чиптюн-движок: только короткие сигналы, привязанные к видимым событиям.
   Никакого фонового шума — как в настоящей игрушке. */
const Sound = (() => {
  let ctx = null, master = null, on = true, unlocked = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    unlocked = true;
  }
  function note(freq, dur, type, vol, delay, slideTo) {
    if (!on || !ctx || !unlocked) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol == null ? 0.8 : vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(dur, vol, delay) {
    if (!on || !ctx || !unlocked) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol == null ? 0.35 : vol;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(ctx.currentTime + (delay || 0));
  }
  const N = { C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047, D6:1175, E6:1319, G6:1568,
              C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494, Cs5:554, Fs5:740, Gs4:415, As4:466 };

  const cues = {
    blip:    () => note(N.E6, .045, 'square', .5),
    move:    () => note(N.A5, .035, 'square', .35),
    confirm: () => { note(N.E5,.06,'square',.6); note(N.A5,.09,'square',.6,.06); },
    cancel:  () => { note(N.A4,.06,'square',.5); note(N.E4,.10,'square',.5,.05); },
    eat:     () => { for(let i=0;i<4;i++) note(320+i*40,.05,'square',.5,i*.09); noise(.05,.16,.36); },
    happy:   () => { [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>note(f,.09,'square',.6,i*.07)); },
    sad:     () => { note(N.E5,.14,'triangle',.6,0,N.C4); },
    clean:   () => { noise(.16,.3); note(N.G5,.07,'square',.4,.14); note(N.C6,.1,'square',.4,.2); },
    heal:    () => { [N.G4,N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>note(f,.1,'triangle',.6,i*.06)); },
    call:    () => { note(N.A5,.09,'square',.55); note(N.A5,.09,'square',.55,.16); },
    poop:    () => { note(220,.16,'sawtooth',.35,0,110); noise(.1,.14,.1); },
    sick:    () => { note(N.Fs5,.16,'sawtooth',.4,0,N.Cs5); note(N.Fs5,.16,'sawtooth',.4,.22,N.Cs5); },
    coin:    () => { note(N.B5,.05,'square',.5); note(N.E6,.13,'square',.5,.05); },
    hatch:   () => { noise(.1,.3); [N.C5,N.E5,N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>note(f,.12,'square',.65,i*.08)); },
    evolve:  () => { [N.C5,N.D5,N.E5,N.G5,N.A5,N.C6,N.E6,N.G6].forEach((f,i)=>note(f,.11,'square',.62,i*.075));
                     [N.C4,N.G4,N.C5].forEach((f,i)=>note(f,.5,'triangle',.3,i*.16)); },
    win:     () => { [N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>note(f,.11,'square',.65,i*.09)); note(N.C6,.4,'triangle',.35,.4); },
    lose:    () => { [N.E5,N.D5,N.C5,N.G4].forEach((f,i)=>note(f,.14,'square',.5,i*.11)); },
    death:   () => { [N.A4,N.G4,N.F4,N.E4,N.D4,N.C4].forEach((f,i)=>note(f,.34,'triangle',.55,i*.3));
                     note(N.C4,1.4,'sine',.35,1.9); },
    sleep:   () => { note(N.G4,.3,'sine',.35,0,N.C4); },
    error:   () => { note(160,.14,'sawtooth',.4); note(140,.16,'sawtooth',.4,.14); }
  };

  return {
    unlock,
    play(name) { try { if (cues[name]) cues[name](); } catch (e) {} },
    set(v) { on = !!v; if (on) unlock(); },
    get() { return on; }
  };
})();
