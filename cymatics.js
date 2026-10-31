/* M1ndseye eye screensaver: rune game.
   Level 1: a geometric rune drifts down (one every 5-8 s) with its parts (stars, nested squares, triangles,
   hexagon lattices, frame arcs) floating apart. Tap it and the parts snap together; a struck
   crystal tone rings out with a long reverb, and rings of light ripple outward like a pond.
   Level 2 (after 25 hits): waves of half-runes fall. Exactly two halves in each wave complete the same rune
   (they also pulse in sync, a quiet hint). Tap both and they lock together with a chord.
   Every rune is built from straight lines, generated from simple sacred-geometry primitives with a seeded
   random generator, so each rune (and its note) is always the same.
   Test hooks: ?level=2 starts at the harmony round; ?debug exposes window.__cym. */
(function () {
  var cv = document.getElementById("cymatics");
  if (!cv) return;
  var g = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size(); addEventListener("resize", size);

  /* ---------- geometry primitives (unit circle, straight segments only) ---------- */
  var TAU = Math.PI * 2;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pt(r, a) { return [Math.cos(a) * r, Math.sin(a) * r]; }
  function star(n, k, r, rot) {            /* polygon (k=1) or star polygon {n/k} */
    var s = [];
    for (var i = 0; i < n; i++) { var a = pt(r, rot + i * TAU / n), b = pt(r, rot + ((i + k) % n) * TAU / n); s.push(a[0], a[1], b[0], b[1]); }
    return s;
  }
  function spokes(n, r0, r1, rot) {
    var s = []; for (var i = 0; i < n; i++) { var a = rot + i * TAU / n, p = pt(r0, a), q = pt(r1, a); s.push(p[0], p[1], q[0], q[1]); }
    return s;
  }
  function lattice(r, rot) {               /* hexagon with every diagonal: a Metatron-style lattice */
    var s = [], v = []; for (var i = 0; i < 6; i++) v.push(pt(r, rot + i * TAU / 6));
    for (i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) s.push(v[i][0], v[i][1], v[j][0], v[j][1]);
    return s;
  }
  function arc(r, a0, a1, steps) {         /* a ring section, as a polyline */
    var s = []; for (var i = 0; i < steps; i++) { var p = pt(r, a0 + (a1 - a0) * i / steps), q = pt(r, a0 + (a1 - a0) * (i + 1) / steps); s.push(p[0], p[1], q[0], q[1]); }
    return s;
  }
  function petal(rb, rt, wmax, a, vein) {  /* faceted almond petal: straight facets, full belly, pointed tip */
    var L = [], Rr = [], ca = Math.cos(a), sa = Math.sin(a), steps = 5, s = [], i;
    for (i = 0; i <= steps; i++) {
      var u = i / steps, r = rb + (rt - rb) * u, d = wmax * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85);
      L.push([ca * r - sa * d, sa * r + ca * d]); Rr.push([ca * r + sa * d, sa * r - ca * d]);
    }
    for (i = 0; i < steps; i++) s.push(L[i][0], L[i][1], L[i + 1][0], L[i + 1][1], Rr[i][0], Rr[i][1], Rr[i + 1][0], Rr[i + 1][1]);
    if (vein) { var v0 = pt(rb + (rt - rb) * 0.15, a), v1 = pt(rb + (rt - rb) * 0.7, a); s.push(v0[0], v0[1], v1[0], v1[1]); }
    return s;
  }
  function lotus() {   /* top view: 8 broad outer petals, 8 petals between them, 8 small inner petals, seed-pod center */
    var parts = [], i, k, s, up = -TAU / 4, step = TAU / 8;
    for (k = 0; k < 4; k++) {                /* outer petals, broken into four shards of two */
      s = []; for (i = 0; i < 2; i++) s = s.concat(petal(.22, .96, .2, up + (k * 2 + i) * step, true)); parts.push(s);
    }
    for (k = 0; k < 2; k++) {                /* second layer, offset half a step */
      s = []; for (i = 0; i < 4; i++) s = s.concat(petal(.2, .74, .17, up + step / 2 + (k * 4 + i) * step, false)); parts.push(s);
    }
    s = []; for (i = 0; i < 8; i++) s = s.concat(petal(.14, .44, .09, up + i * step, false)); parts.push(s);
    parts.push(star(8, 1, .13, up + step / 2));
    parts.push(spokes(8, .04, .09, up + step / 2));
    return parts;
  }
  function circ(x, y, r, steps) {          /* a circle as a smooth polyline */
    var s = [], n = steps || 28;
    for (var i = 0; i < n; i++) { var a0 = i * TAU / n, a1 = (i + 1) * TAU / n; s.push(x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r); }
    return s;
  }
  function seedOfLife(r, rot) {              /* 7 overlapping circles in a bounding ring; returns 4 shards */
    var a = circ(0, 0, r), b = [], c = [], i;
    for (i = 0; i < 6; i++) { var p = pt(r, rot + i * TAU / 6); (i % 2 ? b : c).push.apply(i % 2 ? b : c, circ(p[0], p[1], r)); }
    return [a, b, c, circ(0, 0, r * 2, 40)];
  }
  function hexLattice(Rt, div) {             /* hexagram (two triangles) filled with a triangular grid; returns shards */
    var up = star(3, 1, Rt, -TAU / 4), dn = star(3, 1, Rt, TAU / 4);
    var L = Rt * Math.sqrt(3), h = L / div * Math.sqrt(3) / 2, inr = Rt / 2;   /* inradius of each triangle */
    var V = []; for (var i = 0; i < 6; i++) V.push(pt(Rt, -TAU / 4 + i * TAU / 6));
    function inTri(x, y, flip) { /* inside an equilateral triangle centred at 0 with inradius inr */
      for (var k = 0; k < 3; k++) { var a = (flip ? TAU / 4 : -TAU / 4) + TAU / 2 + k * TAU / 3; if (x * Math.cos(a) + y * Math.sin(a) > inr + 1e-6) return false; }
      return true;
    }
    function inside(x, y) { return inTri(x, y, false) || inTri(x, y, true); }
    var groups = [[], [], []];
    for (var d = 0; d < 3; d++) {            /* grid lines in three directions, clipped to the star */
      var ang = d * TAU / 6, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      for (var k = -div; k <= div; k++) {
        var off = k * h, run = null, steps = 120;
        for (var j = 0; j <= steps; j++) {
          var tt = -Rt + 2 * Rt * j / steps, x = nx * off + ux * tt, y = ny * off + uy * tt, inn = inside(x * 0.999, y * 0.999);
          if (inn && !run) run = [x, y];
          if ((!inn || j === steps) && run) { var ex = inn ? x : nx * off + ux * (tt - 2 * Rt / steps), ey = inn ? y : ny * off + uy * (tt - 2 * Rt / steps);
            if (Math.hypot(ex - run[0], ey - run[1]) > 0.02) groups[d].push(run[0], run[1], ex, ey); run = null; }
        }
      }
    }
    return [up, dn].concat(groups);
  }
  function metatron(d) {                     /* Metatron's Cube: 13 circles joined by hexagon + star lines */
    var C = [[0, 0]], i, j, s;
    for (i = 0; i < 6; i++) C.push(pt(d, -TAU / 4 + i * TAU / 6));
    for (i = 0; i < 6; i++) C.push(pt(2 * d, -TAU / 4 + i * TAU / 6));
    var circles1 = [], circles2 = [];
    for (i = 0; i < 13; i++) (i < 7 ? circles1 : circles2).push.apply(i < 7 ? circles1 : circles2, circ(C[i][0], C[i][1], d / 2, 20));
    var hexes = [], stars = [], spokesS = [];
    for (i = 0; i < 6; i++) {
      var o = C[7 + i], o2 = C[7 + (i + 1) % 6], o3 = C[7 + (i + 2) % 6], n1 = C[1 + i], n2 = C[1 + (i + 1) % 6], n3 = C[1 + (i + 2) % 6];
      hexes.push(o[0], o[1], o2[0], o2[1], n1[0], n1[1], n2[0], n2[1]);          /* outer + inner hexagons */
      stars.push(o[0], o[1], o3[0], o3[1], n1[0], n1[1], n3[0], n3[1]);          /* big + small hexagrams */
      spokesS.push(o[0], o[1], 0, 0);                                            /* the cube's axes */
      spokesS.push(o[0], o[1], n2[0], n2[1]); spokesS.push(o[0], o[1], C[1 + (i + 5) % 6][0], C[1 + (i + 5) % 6][1]);
    }
    return [circles1, circles2, hexes, stars, spokesS];
  }
  function splitRing(fn, parts, off) {     /* break a ring-like feature into separate drifting arcs */
    var out = [], gap = 0.06;
    for (var i = 0; i < parts; i++) out.push(fn(off + i * TAU / parts + gap, off + (i + 1) * TAU / parts - gap));
    return out;
  }

  /* ---------- rune recipes, simplest to busiest; each gets the next note up a D major pentatonic ---------- */
  var RECIPES = [
    function (R) { return [star(3, 1, .62, -TAU / 4), star(3, 1, .62, TAU / 4)].concat(splitRing(function (a, b) { return arc(.86, a, b, 10); }, 3, R() * TAU)); },
    function (R) { return [star(4, 1, .6, 0), star(4, 1, .6, TAU / 8)].concat(seedOfLife(.15, -TAU / 4), splitRing(function (a, b) { return arc(.88, a, b, 8); }, 4, TAU / 8)); },   /* squares around the Seed of Life */
    function (R) { return [star(5, 2, .66, -TAU / 4), star(5, 1, .66, -TAU / 4), star(5, 1, .25, TAU / 4), spokes(5, .7, .9, -TAU / 4)].concat(splitRing(function (a, b) { return arc(.9, a, b, 8); }, 5, -TAU / 4)); },
    function (R) { return [lattice(.62, 0), star(6, 2, .3, TAU / 12), star(6, 1, .72, TAU / 12)].concat(splitRing(function (a, b) { return arc(.84, a, b, 10); }, 3, TAU / 12), [spokes(6, .72, .84, 0)]); },
    function (R) { return [star(8, 3, .7, 0), star(4, 1, .4, TAU / 8), star(4, 1, .4, 0)].concat(splitRing(function (a, b) { return arc(.86, a, b, 6); }, 4, 0)); },
    function (R) { return [star(7, 3, .68, -TAU / 4), star(7, 1, .68, -TAU / 4), star(7, 2, .34, TAU / 4)].concat(splitRing(function (a, b) { return arc(.88, a, b, 7); }, 7, -TAU / 4)); },
    function (R) { return lotus(); },   /* geometric lotus blossom */
    function (R) { return hexLattice(.88, 3).concat(hexLattice(.44, 3)); },   /* hexagram grid with a smaller gridded hexagram inside */
    function (R) { return [star(4, 1, .74, TAU / 8), star(4, 1, .52, 0), spokes(4, 0, .52, TAU / 8), spokes(4, .56, .74, 0), star(8, 1, .2, 0)].concat(splitRing(function (a, b) { return arc(.88, a, b, 6); }, 4, TAU / 8)); },
    function (R) { return [star(12, 5, .7, 0), star(12, 1, .7, 0), star(6, 1, .28, 0)].concat(splitRing(function (a, b) { return arc(.86, a, b, 9); }, 4, TAU / 24), [spokes(12, .74, .86, 0)]); },
    function (R) { return metatron(.3).concat(splitRing(function (a, b) { return arc(.86, a, b, 8); }, 3, TAU / 12)); },   /* Metatron's Cube */
    function (R) { return [lattice(.66, TAU / 12), star(3, 1, .4, -TAU / 4), star(3, 1, .4, TAU / 4), star(6, 1, .2, 0)].concat([star(12, 1, .8, 0), spokes(6, .66, .8, TAU / 12)], splitRing(function (a, b) { return arc(.94, a, b, 8); }, 3, TAU / 6)); }
  ];
  var NOTES = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26, 739.99, 880, 987.77];
  var PALETTES = [["90,170,255", "215,235,255"], ["255,170,70", "255,236,200"]];   /* AI sapphire, OI amber */
  var LEVEL2_AT = 25, cache = {};

  function rune(idx) {
    if (cache[idx]) return cache[idx];
    var parts = RECIPES[idx](rng(idx * 7919 + 13)).map(function (segs) {
      var cx = 0, cy = 0, n = segs.length / 2;
      for (var i = 0; i < segs.length; i += 2) { cx += segs[i]; cy += segs[i + 1]; }
      return { s: Float32Array.from(segs), cx: cx / n, cy: cy / n };
    });
    return (cache[idx] = parts);
  }

  /* ---------- state ---------- */
  var pats = [], bursts = [], count = 0, spawnIn = 0.8, sel = null;
  var level = /level=2/.test(location.search) ? 2 : 1;
  if (level === 2) count = LEVEL2_AT;
  var scoreEl = document.querySelector(".cym-score b"), bannerEl = document.querySelector(".cym-banner");
  function setScore() { if (scoreEl) { scoreEl.textContent = count; scoreEl.parentNode.classList.add("on"); } }
  if (level === 2) setScore();
  if (/debug/.test(location.search)) window.__cym = { pats: function () { return pats; }, make: function (a, b, c, d, e) { return make(a, b, c, d, e); } };

  function make(idx, x, y, R, opts) {
    var parts = rune(idx), N = parts.length;
    var p = {
      idx: idx, parts: parts, N: N, R: R, x: x, y: y, cx: x, cy: y,
      vy: H * (opts.slow ? 0.032 : 0.04 + Math.random() * 0.02), sway: Math.random() * 6.28,
      rot: opts.rot != null ? opts.rot : Math.random() * 6.28, vr: opts.vr != null ? opts.vr : (Math.random() - 0.5) * 0.1,
      state: 0, t: 0, half: !!opts.half, pair: opts.pair || 0, wave: opts.wave || 0, sub: null,
      pal: PALETTES[opts.pal != null ? opts.pal : (Math.random() < 0.6 ? 0 : 1)],
      phase: opts.phase != null ? opts.phase : Math.random() * 6.28,
      ox: new Float32Array(N), oy: new Float32Array(N), orr: new Float32Array(N), sp: new Float32Array(N), dl: new Float32Array(N),
      tax: new Float32Array(N), tsp: new Float32Array(N), t0: new Float32Array(N), fph: new Float32Array(N)
    };
    if (opts.half) { p.sub = new Uint8Array(N); for (var q = 0; q < N; q++) p.sub[q] = (q + opts.side) % 2 === 0 ? 1 : 0; }
    for (var i = 0; i < N; i++) {   /* drift apart: each part pushed outward from where it belongs, turned, spinning slowly */
      var pc = parts[i], d = Math.hypot(pc.cx, pc.cy), a = d > 0.05 ? Math.atan2(pc.cy, pc.cx) : Math.random() * TAU;
      a += (Math.random() - 0.5) * 1.2;
      var push = 0.35 + Math.random() * 0.6;
      p.ox[i] = Math.cos(a) * push; p.oy[i] = Math.sin(a) * push;
      p.orr[i] = (Math.random() - 0.5) * 1.6; p.sp[i] = (Math.random() - 0.5) * 0.5;
      p.dl[i] = Math.random() * 0.22;
      /* 3D tumble: each shard flips about its own axis at its own rate, like broken glass falling */
      p.tax[i] = Math.random() * TAU; p.tsp[i] = (0.6 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1);
      p.t0[i] = Math.random() * TAU; p.fph[i] = Math.random() * TAU;
    }
    return p;
  }

  function radius() { return Math.max(36, Math.min(85, Math.min(W, H) * (0.095 + Math.random() * 0.03))); }   /* half size */
  function spawnOne() {
    var R = radius();
    pats.push(make(Math.floor(Math.random() * RECIPES.length), R * 1.3 + Math.random() * (W - 2.6 * R), -R * 1.6, R, {}));
  }

  var pairId = 0;
  function spawnWave() {
    var n = W > 700 ? 5 : 4, R = Math.max(32, Math.min(65, W / n * 0.25, H * 0.07));
    var m = Math.floor(Math.random() * RECIPES.length), id = ++pairId, i;
    var rot = Math.random() * 6.28, vr = (Math.random() - 0.5) * 0.08, pal = Math.random() < 0.5 ? 0 : 1, ph = Math.random() * 6.28;
    var pool = []; for (i = 0; i < RECIPES.length; i++) if (i !== m) pool.push(i);
    var slots = []; for (i = 0; i < n; i++) slots.push(i);
    slots.sort(function () { return Math.random() - 0.5; });
    var lane = W / n;
    function at(s) { return lane * (s + 0.5) + (Math.random() - 0.5) * lane * 0.2; }
    function y0(k) { return -R * (1.2 + k * 0.9 + Math.random() * 0.5); }
    pats.push(make(m, at(slots[0]), y0(0), R, { half: 1, side: 0, rot: rot, vr: vr, pair: id, wave: id, slow: 1, pal: pal, phase: ph }));
    pats.push(make(m, at(slots[1]), y0(1), R, { half: 1, side: 1, rot: rot, vr: vr, pair: id, wave: id, slow: 1, pal: pal, phase: ph }));
    for (i = 2; i < n; i++) {
      var o = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      pats.push(make(o, at(slots[i]), y0(i), R, { half: 1, side: Math.random() < 0.5 ? 0 : 1, vr: vr, pair: -1, wave: id, slow: 1, pal: pal }));
    }
  }

  function showBanner() {
    if (!bannerEl) return;
    bannerEl.classList.add("on");
    setTimeout(function () { bannerEl.classList.remove("on"); }, 4200);
  }
  function tone(idx, x, gain) { if (window.M1Sound) M1Sound.tone(NOTES[idx], (x / W) * 1.6 - 0.8, gain); }

  /* ---------- tap ---------- */
  cv.addEventListener("pointerdown", function (e) {
    var best = null, bd = 1e9;
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i]; if (p.state !== 0 && p.state !== 5) continue;
      var d = Math.hypot(e.clientX - p.cx, e.clientY - p.cy);
      if (d < Math.max(44, p.R * (p.half ? 1.1 : 1.4)) && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    e.cymHit = true;                 /* tapping a rune doesn't pop up the exit/volume controls */
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {}

    if (!best.half) {
      best.state = 1; best.t = 0; count++; setScore();
      bursts.push({ x: best.cx, y: best.cy, t: -0.5, R: best.R, pal: best.pal });   /* light rings release as it locks */
      var bi = best.idx, bx = best.cx;
      setTimeout(function () { tone(bi, bx, 1); }, 380);                            /* ring the crystal at the snap */
      if (count === LEVEL2_AT && level === 1) { level = 2; spawnIn = 4.5; showBanner(); }
      return;
    }
    if (best.state === 5) { best.state = 0; sel = null; return; }   /* tap again to let go */
    if (!sel) { sel = best; best.state = 5; best.t = 0; tone(best.idx, best.cx, 0.35); return; }
    var a = sel, b = best; sel = null;
    if (a.pair > 0 && a.pair === b.pair) {
      var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
      [a, b].forEach(function (h) { h.state = 4; h.t = 0; h.fx = h.cx; h.fy = h.cy; h.tx = mx; h.ty = my; h.fr = h.rot; });
      a.mate = b; b.mate = a; b.lead = true;
      count++; setScore();
      for (var f = 0; f < pats.length; f++) {      /* harmony found: the other pieces of this wave fade away */
        var o = pats[f];
        if (o !== a && o !== b && o.half && o.wave === a.wave && (o.state === 0 || o.state === 5 || o.state === 6)) { o.state = 7; o.t = 0; if (sel === o) sel = null; }
      }
      bursts.push({ x: mx, y: my, t: -0.55, R: a.R * 1.2, pal: a.pal });
      var q = a.idx;
      setTimeout(function () { tone(q, mx, 1); }, 450);
      setTimeout(function () { if (window.M1Sound) M1Sound.tone(NOTES[q] * 1.5, (mx / W) * 1.6 - 0.8, 0.55); }, 540);
    } else {
      tone(b.idx, b.cx, 0.3);
      [a, b].forEach(function (h) { h.state = 6; h.t = 0; });
    }
  });

  /* ---------- frame ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var time = now / 1000;
    g.clearRect(0, 0, W, H);

    spawnIn -= dt;
    if (spawnIn <= 0) {
      if (level === 1) { spawnOne(); spawnIn = 5 + Math.random() * 3; }
      else {
        var live = 0; for (var z = 0; z < pats.length; z++) if (pats[z].half && pats[z].state !== 3) live++;
        if (live < 2) { spawnWave(); spawnIn = 8; } else spawnIn = 0.5;
      }
    }
    for (var r = bursts.length - 1; r >= 0; r--) { bursts[r].t += dt; if (bursts[r].t > 3.2) bursts.splice(r, 1); }

    g.globalCompositeOperation = "lighter";
    g.lineCap = "round"; g.lineJoin = "round";
    for (r = 0; r < bursts.length; r++) drawBurst(bursts[r]);
    for (var i = pats.length - 1; i >= 0; i--) {
      var p = pats[i];
      p.t += dt;
      if (p.state === 4) {                          /* halves flying together */
        var e = Math.min(1, p.t / 0.6), k = 1 - Math.pow(1 - e, 3);
        p.cx = p.fx + (p.tx - p.fx) * k; p.cy = p.fy + (p.ty - p.fy) * k;
        if (p.mate && !p.lead) p.rot = p.fr + angDiff(p.mate.fr, p.fr) * k;
        if (e >= 1) {
          if (p.lead) {
            var full = make(p.idx, p.cx, p.cy, p.R, { rot: p.rot, vr: p.vr, slow: 1, pal: PALETTES.indexOf(p.pal) });
            full.state = 2; full.t = 0; full.fixed = true; full.x = p.cx; full.y = p.cy;
            pats.push(full);
          }
          pats.splice(i, 1); continue;
        }
      } else {
        p.y += p.vy * dt * (p.state >= 2 ? 0.3 : 1);
        p.sway += dt * 0.5; p.rot += p.vr * dt;
        p.cx = p.fixed ? p.x : p.x + Math.sin(p.sway) * p.R * 0.1; p.cy = p.y;
        if (p.state === 6) p.cx += Math.sin(p.t * 60) * 4 * Math.max(0, 1 - p.t / 0.5);
        if (p.state === 6 && p.t > 0.5) { p.state = 0; p.t = 0; }
        if (p.state === 1 && p.t > 0.75) { p.state = 2; p.t = 0; }
        if (p.state === 2 && p.t > 1.8) { p.state = 3; p.t = 0; }
        if ((p.state === 3 && p.t > 1.6) || (p.state === 7 && p.t > 1.1) || p.cy - p.R * 1.8 > H) { if (sel === p) sel = null; pats.splice(i, 1); continue; }
      }
      drawRune(p, time);
    }
    for (i = 0; i < pats.length; i++) if (pats[i].state === 5) halo(pats[i], time);
    g.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  }
  function angDiff(a, b) { var d = (a - b) % 6.283; if (d > 3.1416) d -= 6.283; if (d < -3.1416) d += 6.283; return d; }

  /* how far each part is from its place: 1 = drifted apart, 0 = locked into the rune */
  function apart(p, i) {
    var st = p.state, t = p.t;
    if (st === 0 || st === 5 || st === 6 || st === 7) return p.half ? 0.12 : 1;
    if (st === 1) { var e = Math.max(0, Math.min(1, (t - p.dl[i]) / 0.42)); return Math.pow(1 - e, 4) - 0.06 * Math.sin(e * Math.PI) ; } /* snap with a tiny overshoot */
    if (st === 4) return 0.12 * Math.pow(1 - Math.min(1, t / 0.5), 3);
    return 0;
  }

  function wrap(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }

  function drawRune(p, time) {
    var R = p.R, st = p.state, t = p.t, sub = p.sub, cx = p.cx, cy = p.cy;
    var bright = st === 7 ? 0.75 * Math.max(0, 1 - t / 1.1) : st === 0 || st === 6 ? 0.75 : st === 5 ? 0.95 : st === 1 ? 0.75 + 0.25 * Math.min(1, t / 0.5)
      : st === 2 || st === 4 ? 1 : Math.max(0, 1 - t / 1.6);
    if (p.half && (st === 0 || st === 5)) bright *= 0.82 + 0.18 * Math.sin(time * 2.2 + p.phase);   /* pairs pulse in sync */
    var grow = st === 3 ? 1 + t * 0.18 : 1;
    var c = Math.cos(p.rot), sn = Math.sin(p.rot);
    var col = st === 5 ? "255,170,80" : p.pal[0], core = st === 5 ? "255,240,220" : p.pal[1];
    if (st === 2 || st === 4 || (st === 1 && t > 0.35)) {      /* inner light once it's whole */
      var ga = (st === 1 ? (t - 0.35) / 0.4 : 1) * 0.3 * bright;
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
      gr.addColorStop(0, "rgba(" + core + "," + ga.toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + col + ",0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, TAU); g.fill();
    }
    for (var i = 0; i < p.N; i++) {
      if (sub && !sub[i]) continue;
      var pc = p.parts[i], k = apart(p, i), s = pc.s, kk = Math.max(0, Math.min(1, k));
      var moving = (st === 0 || st === 5 || st === 6 || st === 7) && !reduce;
      var spin = moving ? p.sp[i] * time : 0;
      var la = (p.orr[i] + spin) * k, lc = Math.cos(la), ls = Math.sin(la);
      /* tumble: flip about a tilted axis, with perspective; flattens back to face-on as the rune snaps together */
      var th = wrap(p.t0[i] + (moving ? p.tsp[i] * time : 0)) * kk, ct = Math.cos(th), st3 = Math.sin(th);
      var ac = Math.cos(p.tax[i]), as = Math.sin(p.tax[i]);
      var bob = moving ? 0.06 * Math.sin(time * 0.7 + p.fph[i]) : 0;
      var offx = p.ox[i] * k, offy = (p.oy[i] + bob) * k;
      var path = new Path2D();
      for (var j = 0; j < s.length; j += 2) {
        var lx = s[j] - pc.cx, ly = s[j + 1] - pc.cy;
        var u = lx * ac + ly * as, v = -lx * as + ly * ac;               /* into the tilt axis frame */
        var z = u * st3, pers = 1 / (1 + z * 0.9);                         /* depth -> perspective */
        u = u * ct * pers; v = v * pers;
        lx = u * ac - v * as; ly = u * as + v * ac;
        var rx = lx * lc - ly * ls, ry = lx * ls + ly * lc;
        var x = (rx + pc.cx + offx) * grow, y = (ry + pc.cy + offy) * grow;
        var X = cx + (x * c - y * sn) * R, Y = cy + (x * sn + y * c) * R;
        if (j % 4 === 0) path.moveTo(X, Y); else path.lineTo(X, Y);
      }
      /* neon tube: wide soft glow, intense colored edges, pale hot center. 0.25 when broken -> 1.5 when whole */
      var w = 0.25 + 1.25 * (1 - kk);
      g.strokeStyle = "rgba(" + col + "," + (0.07 * bright).toFixed(3) + ")"; g.lineWidth = w * 2 + 10; g.stroke(path);
      g.strokeStyle = "rgba(" + col + "," + (0.16 * bright).toFixed(3) + ")"; g.lineWidth = w * 2 + 4.5; g.stroke(path);
      g.strokeStyle = "rgba(" + col + "," + (0.95 * bright).toFixed(3) + ")"; g.lineWidth = w + 0.6; g.stroke(path);
      g.strokeStyle = "rgba(" + core + "," + (0.9 * bright).toFixed(3) + ")"; g.lineWidth = Math.max(0.2, w * 0.4); g.stroke(path);
    }
  }

  function halo(p, time) {           /* soft amber ring around a selected half */
    var a = 0.25 + 0.12 * Math.sin(time * 5);
    g.lineWidth = 1.5; g.strokeStyle = "rgba(255,190,120," + a.toFixed(3) + ")";
    g.beginPath(); g.arc(p.cx, p.cy, p.R * 1.02, 0, TAU); g.stroke();
  }

  /* pond ripples of light: rings leave one after another, fast at first then slowing as they spread and fade */
  function drawBurst(q) {
    if (q.t <= 0) return;
    if (q.t < 0.35) {                /* flash as the parts lock */
      var fl = 1 - q.t / 0.35, gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.R);
      gr.addColorStop(0, "rgba(" + q.pal[1] + "," + (0.4 * fl).toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + q.pal[0] + ",0)");
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.R, 0, TAU); g.fill();
    }
    for (var k = 0; k < 6; k++) {
      var tk = q.t - k * 0.32; if (tk <= 0) continue;
      var life = tk / 2.6; if (life >= 1) continue;
      var rad = q.R * (0.9 + 3.2 * (1 - Math.pow(1 - life, 2.2)));   /* decelerating, like a pond */
      var a = Math.pow(1 - life, 1.8) * (1 - k * 0.12);
      var col = k % 2 ? "255,170,90" : q.pal[0];
      g.beginPath(); g.arc(q.x, q.y, rad, 0, TAU);
      g.strokeStyle = "rgba(" + col + "," + (0.12 * a).toFixed(3) + ")"; g.lineWidth = 10; g.stroke();
      g.strokeStyle = "rgba(" + col + "," + (0.35 * a).toFixed(3) + ")"; g.lineWidth = 3.5; g.stroke();
      g.strokeStyle = "rgba(235,248,255," + (0.75 * a).toFixed(3) + ")"; g.lineWidth = 1.1; g.stroke();
    }
  }

  requestAnimationFrame(frame);
})();
