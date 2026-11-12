/* ============================================================
   Пиксельный рендер. Логический экран 128×112, всё рисуется
   кодом: шрифт 5×7, комната, питомец из «ДНК», частицы.
   ============================================================ */
const Pixel = (() => {
  const W = 128, H = 112;

  /* ---------- шрифт 5×7 (MSB слева) ---------- */
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
    '9':[14,17,17,15,1,2,12],' ':[0,0,0,0,0,0,0],'!':[4,4,4,4,4,0,4],
    '?':[14,17,1,2,4,0,4],'.':[0,0,0,0,0,0,4],',':[0,0,0,0,0,4,8],
    ':':[0,4,0,0,0,4,0],'-':[0,0,0,31,0,0,0],'+':[0,4,4,31,4,4,0],
    '/':[1,1,2,4,8,16,16],"'":[4,4,0,0,0,0,0],'(':[2,4,8,8,8,4,2],')':[8,4,2,2,2,4,8],
    '<':[2,4,8,16,8,4,2],'>':[8,4,2,1,2,4,8],'=':[0,0,31,0,31,0,0],
    '*':[4,21,14,31,14,21,4],'%':[17,2,4,8,16,17,0],'#':[10,31,10,10,10,31,10],
    '♥':[10,31,31,31,14,4,0],'♡':[10,21,17,17,10,4,0],'°':[6,9,9,6,0,0,0],
    '^':[4,14,21,4,4,4,4],'_':[0,0,0,0,0,0,31]
  };
  const TR = {'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'ZH','З':'Z','И':'I','Й':'Y',
    'К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H',
    'Ц':'C','Ч':'CH','Ш':'SH','Щ':'SCH','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'YU','Я':'YA'};
  function translit(s) {
    return String(s || '').toUpperCase().split('').map(c => TR[c] !== undefined ? TR[c] : c).join('');
  }
  function textW(s, sc) { sc = sc || 1; return String(s).length * 6 * sc - sc; }
  function text(g, s, x, y, col, sc) {
    sc = sc || 1; s = translit(s);
    g.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const gl = F[s[i]] || F['?'];
      for (let r = 0; r < 7; r++) {
        const bits = gl[r];
        for (let c = 0; c < 5; c++) if (bits & (1 << (4 - c))) g.fillRect(x + i * 6 * sc + c * sc, y + r * sc, sc, sc);
      }
    }
  }
  function textC(g, s, cx, y, col, sc) { text(g, s, Math.round(cx - textW(s, sc) / 2), y, col, sc); }

  /* ---------- примитивы ---------- */
  const R = (g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
  function E(g,cx,cy,rx,ry,c){
    cx=Math.round(cx);cy=Math.round(cy);rx=Math.max(.5,rx);ry=Math.max(.5,ry);g.fillStyle=c;
    for(let y=-Math.round(ry);y<=Math.round(ry);y++){
      const k=1-(y*y)/(ry*ry); if(k<0)continue;
      const w=Math.round(rx*Math.sqrt(k));
      g.fillRect(cx-w,cy+y,w*2+1,1);
    }
  }
  function TRI(g,x,y,w,h,c,dir){ // dir: 1 вверх, -1 вниз
    g.fillStyle=c;
    for(let i=0;i<h;i++){
      const ww=Math.max(1,Math.round(w*(dir>0?(i+1)/h:1-i/h)));
      g.fillRect(Math.round(x+(w-ww)/2),Math.round(y+i),ww,1);
    }
  }
  function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function shade(h,a){const[r,g,b]=hex2rgb(h);const f=v=>Math.max(0,Math.min(255,Math.round(v+a)));
    return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  function mix(h1,h2,t){const a=hex2rgb(h1),b=hex2rgb(h2);
    return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');}
  function gray(h){const[r,g,b]=hex2rgb(h);const v=Math.round(r*.3+g*.59+b*.11);
    const m=Math.round(v*.72+58);return '#'+[m,m,m+6].map(x=>Math.min(255,x).toString(16).padStart(2,'0')).join('');}

  /* ---------- темы экрана ---------- */
  const THEMES = {
    color:  { lcd:'#dff3c4', ink:'#2c3a1c', wall:'#f3d9e8', wall2:'#e8c6dc', floor:'#c99a6e', floor2:'#b3855c',
              sky:['#ffd39b','#9fd8ff','#ffb0d0','#1b2350'], accent:'#ff3d8b', mono:false },
    classic:{ lcd:'#c7d9a8', ink:'#20301a', wall:'#b6c99a', wall2:'#a8bd8c', floor:'#8fa478', floor2:'#7d9268',
              sky:['#b6c99a','#c7d9a8','#a8bd8c','#6d8259'], accent:'#20301a', mono:true },
    neon:   { lcd:'#120a24', ink:'#b6ff3d', wall:'#241246', wall2:'#2e1856', floor:'#3a1c66', floor2:'#2c1450',
              sky:['#ff3d8b','#35e0ff','#8b5cf6','#0a0620'], accent:'#35e0ff', mono:false },
    space:  { lcd:'#0b0a1e', ink:'#d8e6ff', wall:'#171436', wall2:'#1e1a44', floor:'#2a2358', floor2:'#221c4a',
              sky:['#4a2a92','#1b2350','#8b5cf6','#05030f'], accent:'#ffb020', mono:false }
  };
  function theme(id){ return THEMES[id] || THEMES.color; }
  function monoPal(p, T){
    if(!T.mono) return p;
    return { body:T.lcd, shade:mix(T.lcd,T.ink,.34), belly:mix(T.lcd,T.ink,.12),
             accent:T.ink, eye:T.ink, out:T.ink };
  }

  /* ---------- комната ---------- */
  function drawRoom(g, T, hour, o) {
    o = o || {};
    R(g,0,0,W,H,T.lcd);
    R(g,0,8,W,80,T.wall);
    // обои
    g.fillStyle = T.wall2;
    for (let y = 12; y < 86; y += 10) for (let x = ((y/10)%2?4:9); x < W; x += 12) g.fillRect(x,y,2,2);
    if (o.space) { // космические обои
      R(g,0,8,W,80,'#141033');
      for (let i=0;i<44;i++){ const x=(i*37)%126+1, y=(i*53)%74+10;
        g.fillStyle = i%5===0?'#ffd88a':'#8ea2d8'; g.fillRect(x,y,1,1); }
      E(g,104,26,9,9,'#3a2a72'); E(g,101,23,3,3,'#5a44a0');
    }
    // пол
    R(g,0,88,W,24,T.floor);
    g.fillStyle=T.floor2; for(let x=0;x<W;x+=16) g.fillRect(x,88,1,24);
    R(g,0,88,W,1,shade(T.floor,-40));
    R(g,0,86,W,2,shade(T.wall2,-26));
    // окно
    if(!o.space){
      const skyIdx = hour<6?3 : hour<9?0 : hour<18?1 : hour<21?2 : 3;
      const sky = T.sky[skyIdx];
      R(g,90,16,30,26,shade(T.wall2,-50));
      R(g,92,18,26,22,sky);
      if(skyIdx===3){ g.fillStyle='#fff';
        [[96,22],[104,26],[112,21],[100,33],[114,34],[108,20]].forEach(p=>g.fillRect(p[0],p[1],1,1));
        E(g,112,24,4,4,'#fff8d0'); E(g,110,23,3,3,sky);
      } else if(skyIdx===1){ E(g,112,23,4,4,'#fff3a8');
        E(g,99,26,4,2,'#ffffff'); E(g,103,25,3,2,'#ffffff'); }
      else { E(g,105,30,5,5,'#ffd06a'); }
      R(g,104,18,2,22,shade(T.wall2,-50)); R(g,92,28,26,2,shade(T.wall2,-50));
    }
    // картинка на стене
    R(g,12,20,20,16,shade(T.wall2,-46)); R(g,14,22,16,12,mix(T.lcd,T.accent,.18));
    TRI(g,16,26,7,6,shade(T.accent,-30),1); TRI(g,22,24,7,8,T.accent,1);
    R(g,14,32,16,2,shade(T.accent,-50));
    // мяч, если куплен
    if(o.ball){ E(g,18,84,4,4,T.accent); R(g,14,83,9,1,shade(T.accent,60)); }
    // ночное затемнение
    if(o.dark){ g.fillStyle='rgba(6,4,20,.62)'; g.fillRect(0,0,W,H);
      E(g,64,52,44,34,'rgba(120,140,255,.06)'); }
  }

  /* ---------- яйцо ---------- */
  function drawEgg(g,x,y,s,pal,crack,T){
    const p = monoPal(pal,T);
    const rx=13*s, ry=17*s;
    E(g,x,y,rx+1,ry+1,p.out||shade(p.body,-70));
    E(g,x,y,rx,ry,p.body);
    E(g,x-rx*.3,y-ry*.35,rx*.34,ry*.28,shade(p.body,42));
    g.fillStyle=p.shade;
    [[-.4,-.1],[.35,.15],[-.1,.5],[.2,-.5]].forEach(o=>E(g,x+rx*o[0],y+ry*o[1],2*s,1.6*s,p.shade));
    if(crack>0){
      g.fillStyle=p.out||shade(p.body,-80);
      const n=Math.min(5,crack);
      for(let i=0;i<n;i++){
        const yy=y-ry*.5+i*(ry*.32);
        for(let k=0;k<7;k++) g.fillRect(Math.round(x-6*s+k*2*s),Math.round(yy+(k%2?1:-1)*s),Math.max(1,Math.round(2*s)),Math.max(1,Math.round(s)));
      }
    }
  }

  /* ---------- питомец ---------- */
  function drawPet(g, o) {
    const T = o.theme || THEMES.color;
    let p = monoPal(o.pal, T);
    if (o.dna.gray) p = { body:gray(p.body), shade:gray(p.shade), belly:gray(p.belly), accent:p.accent, eye:p.eye, out:gray(p.out||shade(p.body,-70)) };
    if (o.dna.messy) p = Object.assign({}, p, { body:mix(p.body,'#6b5a3a',.3), shade:mix(p.shade,'#4a3c22',.3) });
    const out = p.out || shade(p.body,-72);
    const s = o.scale, x = Math.round(o.x), y = Math.round(o.y);
    const rx = 18*s, ry = 16*s;
    const legH = Math.max(2, 4*s);
    const bodyY = y - legH - ry;
    const dir = o.flip ? -1 : 1;

    if (o.ghost) {
      const gy = y - 16 - (o.ghostRise||0);
      g.globalAlpha = .82;
      E(g,x,gy,rx*.9,ry*.95,'#ffffff');
      for(let i=0;i<5;i++) E(g,x-rx*.7+i*(rx*.35), gy+ry*.85+Math.sin((o.t||0)*4+i)*1.5, rx*.19, 3*s, '#ffffff');
      g.globalAlpha = 1;
      R(g,x-6*s,gy-3*s,3*s,1.5*s,'#6a6a8a'); R(g,x+3*s,gy-3*s,3*s,1.5*s,'#6a6a8a');
      R(g,x-5*s,gy-4.5*s,1.5*s,4.5*s,'#6a6a8a'); R(g,x+4*s,gy-4.5*s,1.5*s,4.5*s,'#6a6a8a');
      E(g,x,gy+4*s,2.4*s,2*s,'#8a8ab0');
      return;
    }

    // тень
    g.globalAlpha=.2; E(g,x,y+1,rx*.82,2.6*s,'#000'); g.globalAlpha=1;

    // хвост
    if (o.dna.tail === 'cat') {
      for(let i=0;i<7;i++){
        const tx = x - dir*(rx*.9 + i*2.1*s);
        const ty = bodyY + ry*.35 - Math.sin(i*.42 + (o.t||0)*3)*5*s;
        E(g,tx,ty,Math.max(1,2.1*s-i*.16*s),Math.max(1,2.1*s-i*.16*s), i>4?p.shade:out);
      }
    } else if (o.dna.tail === 'puff') {
      E(g,x-dir*rx*1.02,bodyY+ry*.4,4*s,4*s,out); E(g,x-dir*rx*1.02,bodyY+ry*.4,3*s,3*s,p.belly);
    } else if (o.dna.tail === 'spike') {
      for(let i=0;i<4;i++) TRI(g,x-dir*(rx*.85+i*3*s)-2*s,bodyY+ry*.2-i*1.5*s,4*s,5*s,p.accent,1);
    }

    // крылья
    if (o.dna.wings) {
      const flap = Math.sin((o.t||0)*5)*3*s;
      [-1,1].forEach(sd=>{
        const wx = x + sd*rx*.86;
        TRI(g,wx-5*s,bodyY-ry*.55+flap,10*s,12*s,out,1);
        TRI(g,wx-3.6*s,bodyY-ry*.42+flap,7.2*s,9*s,mix(p.accent,p.body,.35),1);
      });
    }

    // лапы
    const step = o.walk ? Math.sin((o.t||0)*11) : 0;
    [-1,1].forEach((sd,i)=>{
      const off = o.walk ? (i?step:-step)*1.6*s : 0;
      R(g,x+sd*rx*.44-2.6*s, y-legH-off, 5.2*s, legH+off, out);
      R(g,x+sd*rx*.44-1.8*s, y-legH-off+1, 3.6*s, legH-1+off, p.shade);
    });

    // тело
    E(g,x,bodyY,rx+1,ry+1,out);
    E(g,x,bodyY,rx,ry,p.body);
    E(g,x-rx*.34,bodyY-ry*.42,rx*.36,ry*.26,shade(p.body,34));

    // узор / живот
    if (o.dna.pattern === 'belly') E(g,x,bodyY+ry*.34,rx*.6,ry*.52,p.belly);
    if (o.dna.pattern === 'spots') [[-.45,-.2],[.4,.1],[-.05,.5]].forEach(q=>E(g,x+rx*q[0],bodyY+ry*q[1],2.6*s,2.2*s,p.shade));
    if (o.dna.pattern === 'stripes') for(let i=-1;i<2;i++) R(g,x-rx*.62,bodyY+i*5*s-1,rx*1.24,1.8*s,p.shade);
    if (o.dna.pattern === 'tux') { E(g,x,bodyY+ry*.3,rx*.66,ry*.6,p.belly); E(g,x,bodyY-ry*.55,rx*.72,ry*.34,p.shade); }

    // шипы «плохого» взрослого
    if (o.dna.spikes) for(let i=-2;i<=2;i++) TRI(g,x+i*5*s-2*s,bodyY-ry-3*s,4*s,5*s,shade(p.accent,-20),1);

    // уши / рога
    const earY = bodyY - ry;
    if (o.dna.ears === 'cat') {
      [-1,1].forEach(sd=>{ TRI(g,x+sd*rx*.52-4*s,earY-7*s,8*s,9*s,out,1);
                            TRI(g,x+sd*rx*.52-2.4*s,earY-5*s,4.8*s,6*s,p.accent,1); });
    } else if (o.dna.ears === 'long') {
      const wig = Math.sin((o.t||0)*2.4)*1.4*s;
      [-1,1].forEach(sd=>{ E(g,x+sd*rx*.42+wig*sd,earY-8*s,3.2*s,9*s,out);
                            E(g,x+sd*rx*.42+wig*sd,earY-8*s,2.1*s,7.4*s,p.belly); });
    } else if (o.dna.ears === 'horn') {
      [-1,1].forEach(sd=>{ TRI(g,x+sd*rx*.46-2.4*s,earY-7*s,4.8*s,8*s,p.accent,1); });
      TRI(g,x-2*s,earY-9*s,4*s,7*s,shade(p.accent,40),1);
    } else if (o.dna.ears === 'tuft') {
      for(let i=-1;i<2;i++) R(g,x+i*3*s,earY-4*s-Math.abs(i)*-1,1.6*s,5*s,p.shade);
    }

    // руки
    [-1,1].forEach(sd=>E(g,x+sd*rx*.94,bodyY+ry*.24,2.6*s,3.4*s,out));

    // морда
    const ex = rx*.38, ey = bodyY - ry*.12;
    const ew = Math.max(1, Math.round(2.2*s)), eh = Math.max(1, Math.round(3.2*s));
    const eyes = o.eyes || 'open';
    if (eyes === 'closed' || eyes === 'sleep') {
      [-1,1].forEach(sd=>R(g,x+sd*ex-ew,ey+eh*.3,ew*2,Math.max(1,s),p.eye));
    } else if (eyes === 'happy') {
      [-1,1].forEach(sd=>{ for(let k=0;k<3;k++) R(g,x+sd*ex-ew+k*ew,ey+ (k===1?-eh*.4:0),ew,Math.max(1,s),p.eye); });
    } else if (eyes === 'sad') {
      [-1,1].forEach(sd=>{ R(g,x+sd*ex-ew,ey,ew*2,eh,p.eye); R(g,x+sd*ex-ew*1.4,ey-eh*.6,ew*2.6,Math.max(1,s),p.eye); });
    } else if (eyes === 'x') {
      [-1,1].forEach(sd=>{ for(let k=-1;k<2;k++){ R(g,x+sd*ex+k*ew*.8,ey+k*eh*.4,ew*.8,eh*.4,p.eye);
                                                   R(g,x+sd*ex+k*ew*.8,ey-k*eh*.4,ew*.8,eh*.4,p.eye);} });
    } else {
      [-1,1].forEach(sd=>{ R(g,x+sd*ex-ew,ey,ew*2,eh,p.eye);
        if(s>.6) R(g,x+sd*ex-ew,ey,Math.max(1,s),Math.max(1,s),'#ffffff'); });
    }
    // клюв (пингвин)
    if (o.dna.beak) {
      TRI(g,x-2.6*s,bodyY+ry*.16,5.2*s,3.4*s,'#ffb020',-1);
    } else {
      const mo = o.mouth || 0;
      if (mo > .05) E(g,x,bodyY+ry*.36,2.6*s,(1.4+mo*2.6)*s,shade(p.accent,-60));
      else if (eyes === 'sad') { for(let k=0;k<3;k++) R(g,x-2*s+k*2*s,bodyY+ry*.4+(k===1?-s:0),2*s,Math.max(1,s),p.eye); }
      else R(g,x-1.6*s,bodyY+ry*.38,3.2*s,Math.max(1,s),p.eye);
    }
    if (o.blush) [-1,1].forEach(sd=>E(g,x+sd*rx*.66,bodyY+ry*.2,2.2*s,1.5*s,mix(p.accent,p.body,.25)));

    // корона «хорошего» взрослого
    if (o.dna.crown) {
      const cy2 = earY - (o.dna.ears==='long'?16*s:8*s);
      R(g,x-6*s,cy2,12*s,3*s,'#ffb020');
      [-1,0,1].forEach(k=>TRI(g,x+k*4.6*s-1.8*s,cy2-4*s,3.6*s,4*s,'#ffd88a',1));
      R(g,x-1*s,cy2+1,2*s,1.4*s,'#ff3d8b');
    }
    if (o.dna.cane) { R(g,x+rx*1.05,bodyY,1.6*s,ry+legH,'#8a6a4a'); R(g,x+rx*.85,bodyY,4*s,1.6*s,'#8a6a4a'); }
    if (o.sick) { const bx=x+rx*.9, by=bodyY-ry*1.1;
      E(g,bx,by,5,5,'#f7efe2'); R(g,bx-3,by-2,2,2,'#2c3a1c'); R(g,bx+1,by-2,2,2,'#2c3a1c');
      R(g,bx-2,by+2,4,1,'#2c3a1c'); }
  }

  /* ---------- предметы ---------- */
  function drawPoop(g,x,y,t,T){
    const c1 = T.mono?T.ink:'#8a5a34', c2 = T.mono?mix(T.lcd,T.ink,.5):'#a8703f';
    E(g,x,y,6,3,c1); E(g,x,y-3,4.6,2.6,c2); E(g,x,y-6,3,2.2,c1); E(g,x-1,y-8,1.6,1.4,c2);
    const f=Math.sin(t*7)*2;
    R(g,x-8+f,y-11,1,1,T.ink); R(g,x+7-f,y-13,1,1,T.ink);
  }
  function drawBowl(g,x,y,kind,T){
    const c=T.mono?T.ink:'#e8e2d4', f=T.mono?mix(T.lcd,T.ink,.4):(kind==='meal'?'#fff6e0':'#ff8ab8');
    E(g,x,y,10,4,c); R(g,x-10,y-3,20,3,c); E(g,x,y-3,8,3,f);
    if(kind==='snack'){ R(g,x-1,y-9,2,5,'#ffd88a'); E(g,x,y-10,1.4,1.8,'#ffb020'); }
    else { [[-4,-4],[0,-5],[4,-4]].forEach(p=>E(g,x+p[0],y+p[1],2,1.6,'#ffffff')); }
  }
  function drawHeart(g,x,y,c,sc){ sc=sc||1;
    const m=[0b01010,0b11111,0b11111,0b01110,0b00100];
    g.fillStyle=c; for(let r=0;r<5;r++) for(let k=0;k<5;k++) if(m[r]&(1<<(4-k))) g.fillRect(x+k*sc,y+r*sc,sc,sc);
  }
  function drawStar(g,x,y,c,sc){ sc=sc||1;
    const m=[0b00100,0b10101,0b01110,0b11111,0b01110,0b10101,0b00100];
    g.fillStyle=c; for(let r=0;r<7;r++) for(let k=0;k<5;k++) if(m[r]&(1<<(4-k))) g.fillRect(x+k*sc,y+r*sc,sc,sc);
  }
  function drawBomb(g,x,y){ E(g,x,y,4,4,'#2b2340'); R(g,x-1,y-6,2,3,'#8a6a4a'); R(g,x+1,y-8,2,2,'#ffb020'); }
  function drawTomb(g,x,y,T){
    const c=T.mono?mix(T.lcd,T.ink,.4):'#9a93b8', d=T.mono?T.ink:'#6d6690';
    E(g,x,y-22,13,13,d); R(g,x-13,y-22,26,24,d);
    E(g,x,y-22,11,11,c); R(g,x-11,y-22,22,23,c);
    R(g,x-16,y+1,32,4,d); R(g,x-15,y+1,30,2,c);
    textC(g,'RIP',x,y-26,d,1);
    R(g,x-1,y-18,2,10,d); R(g,x-4,y-15,8,2,d);
  }

  return { W,H,text,textC,textW,translit,R,E,TRI,shade,mix,gray,theme,THEMES,
           drawRoom,drawEgg,drawPet,drawPoop,drawBowl,drawHeart,drawStar,drawBomb,drawTomb };
})();
