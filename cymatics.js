/* M1ndseye eye screensaver: rune game.
   Level 1: geometric runes cross the screen from every side with its parts (stars, nested squares, triangles,
   hexagon lattices, frame arcs) floating apart. Tap it and the parts snap together; a struck
   crystal tone rings out with a long reverb, and rings of light ripple outward like a pond.
   Level 2 (hits 76-100): waves of half-runes fall. Exactly two halves in each wave complete the same rune
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
  function hexAt(x, y, r, rot) {
    var s = []; for (var i = 0; i < 6; i++) { var a = rot + i * TAU / 6, b = rot + (i + 1) * TAU / 6; s.push(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r); }
    return s;
  }
  function cubeFlower() {                    /* six cube cells around nested hexagons, a dashed star and a seed point */
    var up = -TAU / 4, parts = [], i, k;
    for (i = 0; i < 6; i++) {                /* each cell: hexagon, smaller hexagon, isometric cube lines */
      var c = pt(.6, up + i * TAU / 6), s = hexAt(c[0], c[1], .27, up).concat(hexAt(c[0], c[1], .15, up));
      for (k = 0; k < 3; k++) { var v = pt(.15, up + k * TAU / 3); s.push(c[0], c[1], c[0] + v[0], c[1] + v[1]); }
      parts.push(s);
    }
    parts.push(hexAt(0, 0, .46, up).concat(hexAt(0, 0, .38, up)));
    var d = [], st = star(6, 2, .33, up);       /* dashed hexagram + dashed spokes */
    for (i = 0; i < st.length; i += 4) for (k = 0; k < 6; k++) {
      var t0 = k / 6, t1 = t0 + 0.5 / 6;
      d.push(st[i] + (st[i + 2] - st[i]) * t0, st[i + 1] + (st[i + 3] - st[i + 1]) * t0, st[i] + (st[i + 2] - st[i]) * t1, st[i + 1] + (st[i + 3] - st[i + 1]) * t1);
    }
    for (i = 0; i < 6; i++) for (k = 0; k < 4; k++) { var a0 = pt(.1 + k * .07, up + TAU / 12 + i * TAU / 6), a1 = pt(.13 + k * .07, up + TAU / 12 + i * TAU / 6); d.push(a0[0], a0[1], a1[0], a1[1]); }
    parts.push(d);
    var core = circ(0, 0, .085, 20).concat(circ(0, 0, .012, 6));
    for (i = 0; i < 6; i++) { var q = pt(.38, up + i * TAU / 6); core = core.concat(circ(q[0], q[1], .015, 6)); }
    parts.push(core);
    return parts;
  }
  function starOutline(n, ro, ri, rot) {    /* concave star outline: tips on ro, inner corners on ri */
    var s = [], v = [];
    for (var i = 0; i < n * 2; i++) v.push(pt(i % 2 ? ri : ro, rot + i * TAU / (n * 2)));
    for (i = 0; i < v.length; i++) { var a = v[i], b = v[(i + 1) % v.length]; s.push(a[0], a[1], b[0], b[1]); }
    return s;
  }
  function dashed(segs, n) {                 /* turn each segment into n dashes */
    var d = [];
    for (var i = 0; i < segs.length; i += 4) for (var k = 0; k < n; k++) {
      var t0 = k / n, t1 = t0 + 0.55 / n;
      d.push(segs[i] + (segs[i + 2] - segs[i]) * t0, segs[i + 1] + (segs[i + 3] - segs[i + 1]) * t0, segs[i] + (segs[i + 2] - segs[i]) * t1, segs[i + 1] + (segs[i + 3] - segs[i + 1]) * t1);
    }
    return d;
  }
  function pentaStar() {                     /* circle, pentagon, beveled double pentagram, dashed decagram, node dots */
    var up = -TAU / 4, parts = [], i;
    var outer = starOutline(5, .9, .36, up), inner = starOutline(5, .52, .21, up), bevel = [];
    for (i = 0; i < 10; i++) { var a = pt(i % 2 ? .36 : .9, up + i * TAU / 10), b = pt(i % 2 ? .21 : .52, up + i * TAU / 10); bevel.push(a[0], a[1], b[0], b[1]); }
    parts.push(outer);
    parts.push(inner.concat(bevel));
    parts.push(star(5, 1, .9, up));
    parts.push(dashed(star(5, 1, .62, up + TAU / 10), 6));   /* dashed inner pentagon through the nodes */
    var dots = []; for (i = 0; i < 5; i++) { var q = pt(.62, up + TAU / 10 + i * TAU / 5); dots = dots.concat(circ(q[0], q[1], .025, 6)); }
    parts.push(dots);
    return parts.concat(splitRing(function (a, b) { return arc(.97, a, b, 12); }, 5, up + TAU / 10));
  }
  function splitRing(fn, parts, off) {     /* break a ring-like feature into separate drifting arcs */
    var out = [], gap = 0.06;
    for (var i = 0; i < parts; i++) out.push(fn(off + i * TAU / parts + gap, off + (i + 1) * TAU / parts - gap));
    return out;
  }

  /* ---------- rune recipes, simplest to busiest; each gets the next note up a D major pentatonic ---------- */
  var RECIPES = [
    function (R) { return pentaStar(); },   /* beveled pentagram construction */
    function (R) { return [star(4, 1, .6, 0), star(4, 1, .6, TAU / 8)].concat(seedOfLife(.15, -TAU / 4), splitRing(function (a, b) { return arc(.88, a, b, 8); }, 4, TAU / 8)); },   /* squares around the Seed of Life */
    function (R) { return cubeFlower(); },   /* hexagon flower of cubes */
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
  var LEVEL2_AT = 75, CONVERGE_AT = 100, cache = {};

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
  var nArg = /[?&]n=(\d+)/.exec(location.search); if (nArg) count = +nArg[1];   /* test hook: start at a given count */
  if (level === 2 || nArg) setScore();
  if (/debug/.test(location.search)) window.__cym = { converge: null, pats: function () { return pats; }, make: function (a, b, c, d, e) { return make(a, b, c, d, e); } };

  function make(idx, x, y, R, opts) {
    var parts = rune(idx), N = parts.length;
    var p = {
      idx: idx, parts: parts, N: N, R: R, x: x, y: y, cx: x, cy: y,
      vy: H * (opts.slow ? 0.0368 : 0.046 + Math.random() * 0.023), sway: Math.random() * 6.28,
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
  var ANGLES_AT = 0, RUSH_AT = 50, lastDir = null;   /* every rune comes in from the sides from the start */
  function edgeDist(a, m) {          /* distance from the screen centre to just past the edge, along angle a */
    var ca = Math.abs(Math.cos(a)) || 1e-6, sa = Math.abs(Math.sin(a)) || 1e-6;
    return Math.min((W / 2 + m) / ca, (H / 2 + m) / sa);
  }
  function spawnOne() {
    var R = radius(), p = make(Math.floor(Math.random() * RECIPES.length), 0, -R * 1.6, R, {}), i, k, best, bestScore;
    var live = pats.filter(function (q) { return q.state === 0 && !q.half; });
    if (count < ANGLES_AT) {         /* falling: pick a column well clear of runes still near the top */
      best = null; bestScore = -1;
      for (k = 0; k < 14; k++) {
        var x = R * 1.3 + Math.random() * (W - 2.6 * R), near = 1e9;
        for (i = 0; i < live.length; i++) if (live[i].cy < H * 0.45) near = Math.min(near, Math.abs(live[i].x - x));
        if (near > bestScore) { bestScore = near; best = x; }
      }
      p.x = p.sx = p.cx = best;
    } else {                         /* hits 25-75: enter from a side that no live rune came from */
      best = 0; bestScore = -1;
      for (k = 0; k < 16; k++) {
        var a = Math.random() * TAU, gap = 9;
        for (i = 0; i < live.length; i++) if (live[i].dir != null) gap = Math.min(gap, Math.abs(Math.atan2(Math.sin(a - live[i].dir), Math.cos(a - live[i].dir))));
        if (lastDir !== null) gap = Math.min(gap, Math.abs(Math.atan2(Math.sin(a - lastDir), Math.cos(a - lastDir))));
        if (gap > bestScore) { bestScore = gap; best = a; }
      }
      a = best; lastDir = a; p.dir = a;
      var Rs = edgeDist(a, R * 1.3), cx0 = W / 2, cy0 = H / 2;
      p.x = p.sx = cx0 + Math.cos(a) * Rs; p.y = cy0 + Math.sin(a) * Rs; p.cx = p.x; p.cy = p.y;
      var tx = cx0 + (Math.random() - 0.5) * W * 0.5, ty = cy0 + (Math.random() - 0.5) * H * 0.4, d = Math.hypot(tx - p.x, ty - p.y) || 1;
      var sp = Math.hypot(W, H) * (0.06 + Math.random() * 0.025) * 1.25;   /* 25% faster */
      p.vx = (tx - p.x) / d * sp; p.vy = (ty - p.y) / d * sp; p.travel = true;
    }
    pats.push(p);
  }

  var pairId = 0;
  function spawnWave() {
    var n = W > 700 ? 5 : 4, R = Math.max(32, Math.min(65, W / n * 0.25, H * 0.07));
    var m = Math.floor(Math.random() * RECIPES.length), id = ++pairId, i;
    var rot = Math.random() * 6.28, vr = (Math.random() - 0.5) * 0.08, pal = Math.random() < 0.5 ? 0 : 1, ph = Math.random() * 6.28;
    var pool = []; for (i = 0; i < RECIPES.length; i++) if (i !== m) pool.push(i);
    /* every half enters from a different direction around the screen and crosses through the middle;
       the matching pair comes from (roughly) opposite sides, so they meet from different angles */
    var base = Math.random() * TAU, cx0 = W / 2, cy0 = H / 2, Rs = Math.hypot(W, H) / 2 + R * 1.6;
    var speed = Math.hypot(W, H) * 0.068;
    var order = [0], half = Math.floor(n / 2); order.push(half); for (i = 1; i < n; i++) if (i !== half) order.push(i);
    function launch(p, slot) {
      var a = base + slot * TAU / n + (Math.random() - 0.5) * (TAU / n) * 0.5;
      var Re = edgeDist(a, R * 1.3);
      p.x = p.sx = cx0 + Math.cos(a) * Re; p.y = cy0 + Math.sin(a) * Re; p.cx = p.x; p.cy = p.y;
      var tx = cx0 + (Math.random() - 0.5) * W * 0.5, ty = cy0 + (Math.random() - 0.5) * H * 0.4, d = Math.hypot(tx - p.x, ty - p.y) || 1;
      p.vx = (tx - p.x) / d * speed; p.vy = (ty - p.y) / d * speed; p.travel = true;
      pats.push(p);
    }
    launch(make(m, 0, 0, R, { half: 1, side: 0, rot: rot, vr: vr, pair: id, wave: id, slow: 1, pal: pal, phase: ph }), order[0]);
    launch(make(m, 0, 0, R, { half: 1, side: 1, rot: rot, vr: vr, pair: id, wave: id, slow: 1, pal: pal, phase: ph }), order[1]);
    for (i = 2; i < n; i++) {
      var o = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      launch(make(o, 0, 0, R, { half: 1, side: Math.random() < 0.5 ? 0 : 1, vr: vr, pair: -1, wave: id, slow: 1, pal: pal }), order[i]);
    }
  }

  function showBanner() {
    if (!bannerEl) return;
    bannerEl.classList.add("on");
    setTimeout(function () { bannerEl.classList.remove("on"); }, 4200);
  }
  /* ---------- Convergence (100 harmonics): the eye wakes, all twelve runes ring it as one mandala ---------- */
  var converged = false, conv = null, convEl = document.querySelector(".cym-conv"), cardBlob = null;
  function eyeBox() {
    var el = document.querySelector(".eye-stage"), r = el ? el.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, hw: r.width / 2 };
  }
  function ringGeom() {
    var eb = eyeBox(), lim = Math.min(W, H) / 2 - 10;
    var Rr = Math.min(lim * 0.86, Math.max(eb.hw * 1.12, Math.min(W, H) * 0.38)), rr = Math.min(Rr * 0.17, lim - Rr);
    return { x: eb.x, y: eb.y, Rr: Rr, r: Math.max(18, rr) };
  }
  function converge() {
    if (converged) return;
    converged = true;
    for (var i = 0; i < pats.length; i++) if (pats[i].state === 0 || pats[i].state === 5 || pats[i].state === 6) { pats[i].state = 7; pats[i].t = 0; }
    sel = null;
    var G0 = ringGeom();
    conv = { t: 0, rot: 0, lines: 0, chord: false, G: G0, runes: [] };
    for (i = 0; i < 12; i++) {
      var a = -TAU / 4 + i * TAU / 12, far = Math.hypot(W, H) * 0.7;
      var p = make(i, G0.x + Math.cos(a) * far, G0.y + Math.sin(a) * far, G0.r, { rot: a + TAU / 4, vr: 0.05, pal: i % 2 });
      p.conv = true; p.ang = a; p.state = 8; p.t = -0.15 * i; p.sx0 = p.x; p.sy0 = p.y;
      conv.runes.push(p); pats.push(p);
    }
    document.body.classList.add("converging");
    makeCard();
  }
  function endConvergence() {
    if (!conv) return;
    conv.runes.forEach(function (p) { p.state = 3; p.t = 0; p.T = 0.3; p.conv = false; p.fixed = true; p.x = p.cx; p.y = p.cy; p.vy = 0; });
    conv.ending = 0;
    if (convEl) convEl.classList.remove("on");
    document.body.classList.remove("converging");
    spawnIn = 2.5;
  }
  function updateConv(dt) {
    if (!conv) return;
    conv.t += dt;
    var G0 = conv.G;
    if (conv.ending != null) {
      conv.ending += dt; conv.lines = Math.max(0, conv.lines - dt * 1.2);
      window.__eyeBoost = Math.max(0, (window.__eyeBoost || 0) - dt * 3); window.__eyeGlow = Math.max(0, (window.__eyeGlow || 0) - dt * 0.4);
      if (conv.ending > 2) { conv = null; window.__eyeBoost = 0; window.__eyeGlow = 0; }
      return;
    }
    /* the eye spins up hard, then settles to a quick hum; it glows brighter */
    var ct = conv.t;
    window.__eyeBoost = ct < 2.2 ? 9 * Math.min(1, ct / 1.2) : 2 + 7 * Math.exp(-(ct - 2.2) * 1.2);
    window.__eyeGlow = Math.min(0.45, ct * 0.25);
    conv.rot += dt * 0.06;
    var arrived = 0;
    conv.runes.forEach(function (p) {
      var tx = G0.x + Math.cos(p.ang + conv.rot) * G0.Rr, ty = G0.y + Math.sin(p.ang + conv.rot) * G0.Rr;
      if (p.state === 8) {
        var e = Math.max(0, Math.min(1, p.t / 1.7)), k = 1 - Math.pow(1 - e, 3);
        p.cx = p.sx0 + (tx - p.sx0) * k; p.cy = p.sy0 + (ty - p.sy0) * k; p.prog = e;
        if (e >= 1) { p.state = 9; p.t = 0; tone(p.idx, p.cx, 0.25); }
      } else { p.cx = tx; p.cy = ty; arrived++; }
      p.rot += p.vr * dt;
    });
    if (arrived === 12 && !conv.chord) {           /* all twelve home: the chord, the burst, the banner */
      conv.chord = true; conv.chordAt = ct;
      for (var i = 0; i < 12; i++) (function (k) { setTimeout(function () { tone(k, G0.x + Math.cos(conv && conv.runes[k] ? conv.runes[k].ang : 0) * 40, 0.32); }, k * 55); })(i);
      bursts.push({ x: G0.x, y: G0.y, t: 0, R: G0.Rr * 0.55, pal: PALETTES[0] });
      setTimeout(function () { bursts.push({ x: G0.x, y: G0.y, t: 0, R: G0.Rr * 0.75, pal: PALETTES[1] }); }, 350);
      if (convEl) convEl.classList.add("on");
    }
    if (conv.chord) conv.lines = Math.min(1, (ct - conv.chordAt) / 1.2);
  }
  function mandalaPath(ctx, x, y, Rr, rot) {      /* 12-gon through the rune centres, a {12/5} star, two rings */
    var path = new Path2D(), i, a;
    function P(k, r) { a = -TAU / 4 + k * TAU / 12 + rot; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; }
    for (i = 0; i < 12; i++) { var p0 = P(i, Rr), p1 = P(i + 1, Rr), s1 = P(i + 5, Rr); path.moveTo(p0[0], p0[1]); path.lineTo(p1[0], p1[1]); path.moveTo(p0[0], p0[1]); path.lineTo(s1[0], s1[1]); }
    for (i = 0; i <= 72; i++) { a = i * TAU / 72; var q = [x + Math.cos(a) * Rr * 1.22, y + Math.sin(a) * Rr * 1.22]; if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]); }
    return path;
  }
  function neon(ctx, path, col, core, a, w) {
    ctx.strokeStyle = "rgba(" + col + "," + (0.07 * a).toFixed(3) + ")"; ctx.lineWidth = w * 2 + 10; ctx.stroke(path);
    ctx.strokeStyle = "rgba(" + col + "," + (0.16 * a).toFixed(3) + ")"; ctx.lineWidth = w * 2 + 4.5; ctx.stroke(path);
    ctx.strokeStyle = "rgba(" + col + "," + (0.95 * a).toFixed(3) + ")"; ctx.lineWidth = w + 0.6; ctx.stroke(path);
    ctx.strokeStyle = "rgba(" + core + "," + (0.9 * a).toFixed(3) + ")"; ctx.lineWidth = Math.max(0.2, w * 0.4); ctx.stroke(path);
  }
  function drawMandala() {
    if (!conv || conv.lines <= 0) return;
    var G0 = conv.G, a = conv.lines * 0.55;
    neon(g, mandalaPath(g, G0.x, G0.y, G0.Rr, conv.rot), "255,170,70", "255,236,200", a, 0.6);
  }

  /* ---------- share card: "I've reached Convergence" (1080 x 1350, portrait for social) ---------- */
  function makeCard() {
    cardBlob = null;
    var cw = 540, ch = 675, cvs = document.createElement("canvas"); cvs.width = cw * 2; cvs.height = ch * 2;
    var x = cvs.getContext("2d"); x.scale(2, 2);
    var eyeImg = new Image(); eyeImg.src = "assets/eye/prismatic.webp";
    var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('300 52px "Roboto Condensed"'), document.fonts.load('400 14px "Roboto Condensed"')]).catch(function () {}) : Promise.resolve();
    var imgReady = new Promise(function (ok) { eyeImg.onload = ok; eyeImg.onerror = ok; });
    var swirlReady = new Promise(function (ok) {          /* one frame of the site's swirling plasma background */
      window.__cauSnap = function (src) { var t = document.createElement("canvas"); t.width = src.width; t.height = src.height; t.getContext("2d").drawImage(src, 0, 0); ok(t); };
      setTimeout(function () { window.__cauSnap = null; ok(null); }, 1500);
    });
    Promise.all([fontsReady, imgReady, swirlReady]).then(function (res) {
      var swirl = res[2], cx = cw / 2, cy = 345, Rr = 168, rr = 27;
      x.fillStyle = "#060912"; x.fillRect(0, 0, cw, ch);
      if (swirl && swirl.width) {     /* cover the card, centred on the eye like the page */
        var eb = eyeBox(), sx = eb.x / W * swirl.width, sy = eb.y / H * swirl.height;
        var s = Math.max(cw / swirl.width, ch / swirl.height) * 1.15;
        x.drawImage(swirl, cx - sx * s, cy - sy * s, swirl.width * s, swirl.height * s);
        var vg = x.createRadialGradient(cx, cy, 120, cx, cy, 460);     /* keep the edges dark for the text */
        vg.addColorStop(0, "rgba(6,9,18,0)"); vg.addColorStop(1, "rgba(6,9,18,.82)");
        x.fillStyle = vg; x.fillRect(0, 0, cw, ch);
        var lg = x.createLinearGradient(0, 0, 0, ch);                    /* soft dark fades behind the text */
        lg.addColorStop(0, "rgba(6,9,18,.75)"); lg.addColorStop(.26, "rgba(6,9,18,0)");
        lg.addColorStop(.78, "rgba(6,9,18,0)"); lg.addColorStop(1, "rgba(6,9,18,.8)");
        x.fillStyle = lg; x.fillRect(0, 0, cw, ch);
      } else {
        var bg = x.createRadialGradient(cx, 330, 20, cx, 330, 420);
        bg.addColorStop(0, "#14295a"); bg.addColorStop(1, "#060912");
        x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
      }
      if (eyeImg.naturalWidth) { var ew = 250, eh = ew * eyeImg.naturalHeight / eyeImg.naturalWidth; x.globalAlpha = 0.95; x.drawImage(eyeImg, cx - ew / 2, cy - eh / 2, ew, eh); x.globalAlpha = 1; }
      x.globalCompositeOperation = "lighter"; x.lineCap = "round"; x.lineJoin = "round";
      neon(x, mandalaPath(x, cx, cy, Rr, 0), "255,170,70", "255,236,200", 0.5, 0.6);
      var keep = g; g = x;                         /* reuse the rune renderer on the card */
      for (var i = 0; i < 12; i++) {
        var a = -TAU / 4 + i * TAU / 12, p = make(i, cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr, rr, { rot: a + TAU / 4, pal: i % 2 });
        p.state = 9; p.t = 1; drawRune(p, 0);
      }
      g = keep;
      x.globalCompositeOperation = "source-over"; x.textAlign = "center"; x.fillStyle = "#e6f6ff";
      x.shadowColor = "rgba(110,215,255,.6)"; x.shadowBlur = 18;
      x.font = '400 15px "Roboto Condensed", system-ui, sans-serif'; x.fillStyle = "rgba(190,225,255,.85)";
      if ("letterSpacing" in x) x.letterSpacing = "5px";
      x.fillText("I'VE REACHED", cx, 70);
      if ("letterSpacing" in x) x.letterSpacing = "1px";
      x.font = '300 52px "Roboto Condensed", system-ui, sans-serif'; x.fillStyle = "#f2fbff";
      x.fillText("Convergence", cx, 122);
      x.shadowBlur = 0;
      x.font = '400 15px "Roboto Condensed", system-ui, sans-serif'; x.fillStyle = "rgba(190,225,255,.8)";
      if ("letterSpacing" in x) x.letterSpacing = "3px";
      x.fillText("100 HARMONICS", cx, 588);
      if ("letterSpacing" in x) x.letterSpacing = "0px";
      x.font = '300 15px "Roboto Condensed", system-ui, sans-serif'; x.fillStyle = "rgba(190,225,255,.75)";
      x.fillText("Free to play at", cx, 620);
      x.font = '500 15px "Roboto Condensed", system-ui, sans-serif'; x.fillStyle = "#ffb764";
      x.fillText("m1ndseye.com/eye", cx, 645);
      cvs.toBlob(function (b) { cardBlob = b; }, "image/png");
    });
  }
  var SHARE_URL = "https://m1ndseye.com/eye.html", SHARE_TEXT = "I've reached Convergence: 100 harmonics in the M1ndseye rune game.";
  function shareCard() {
    if (!cardBlob) return;
    var file = null;
    try { file = new File([cardBlob], "m1ndseye-convergence.png", { type: "image/png" }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "I've reached Convergence", text: SHARE_TEXT + " " + SHARE_URL }).catch(function () {});
      return;
    }
    var url = URL.createObjectURL(cardBlob), aEl = document.createElement("a");    /* desktop: save the image */
    aEl.href = url; aEl.download = "m1ndseye-convergence.png"; document.body.appendChild(aEl); aEl.click(); aEl.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    if (navigator.clipboard) navigator.clipboard.writeText(SHARE_TEXT + " " + SHARE_URL).catch(function () {});
    var msg = convEl && convEl.querySelector(".cym-conv__note"); if (msg) msg.textContent = "Image saved. Caption and link copied.";
  }
  if (convEl) {
    convEl.querySelector(".cym-conv__share").addEventListener("click", function (e) { e.stopPropagation(); shareCard(); });
    convEl.querySelector(".cym-conv__go").addEventListener("click", function (e) { e.stopPropagation(); endConvergence(); });
  }
  if (/debug/.test(location.search)) window.__cym.converge = converge;
  if (count >= CONVERGE_AT) setTimeout(converge, 800);

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
      best.state = 1; best.t = 0; best.T = 0; count++; setScore();
      bursts.push({ x: best.cx, y: best.cy, t: 0, R: best.R, pal: best.pal, p: best });   /* light rings ride with the rune */
      var bi = best.idx, bx = best.cx;
      setTimeout(function () { tone(bi, bx, 1); }, 380);                            /* ring the crystal at the snap */
      if (count === LEVEL2_AT && level === 1) { level = 2; spawnIn = 4.5; showBanner(); }
      if (count >= CONVERGE_AT && !converged) setTimeout(converge, 1200);
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
      b.burst = { x: mx, y: my, t: 0, R: a.R, pal: a.pal, p: null }; bursts.push(b.burst);
      var q = a.idx;
      setTimeout(function () { tone(q, mx, 1); }, 450);
      setTimeout(function () { if (window.M1Sound) M1Sound.tone(NOTES[q] * 1.5, (mx / W) * 1.6 - 0.8, 0.55); }, 540);
      if (count >= CONVERGE_AT && !converged) setTimeout(converge, 1400);
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

    updateConv(dt);
    if (!conv) spawnIn -= dt;
    if (level === 1 && count >= RUSH_AT && !conv && spawnIn > 0.3) {   /* 50-75: never an empty screen */
      var onScreen = 0;
      for (var z0 = 0; z0 < pats.length; z0++) { var q0 = pats[z0]; if (q0.state === 0 && ((q0.cx > -q0.R && q0.cx < W + q0.R && q0.cy > -q0.R && q0.cy < H + q0.R) || (q0.travel && !q0.entered))) onScreen++; }
      if (onScreen === 0) spawnIn = 0.3;
    }
    if (spawnIn <= 0 && !conv) {
      if (level === 1) { spawnOne(); spawnIn = count >= RUSH_AT ? 2 + Math.random() * 1.5 : 2.3 + Math.random() * 1.15; }   /* 1-49: every 2.3-3.45 s, 50-75: 2-3.5 s */
      else {
        var live = 0; for (var z = 0; z < pats.length; z++) if (pats[z].half && (pats[z].state === 0 || pats[z].state === 5 || pats[z].state === 6)) live++;
        if (live === 0) { spawnWave(); spawnIn = 1.5; } else spawnIn = 0.4;   /* one wave at a time, so there's always exactly one match */
      }
    }
    for (var r = bursts.length - 1; r >= 0; r--) { bursts[r].t += dt; if (bursts[r].t > 3.8) bursts.splice(r, 1); }

    g.globalCompositeOperation = "lighter";
    g.lineCap = "round"; g.lineJoin = "round";
    for (r = 0; r < bursts.length; r++) drawBurst(bursts[r]);
    drawMandala();
    for (var i = pats.length - 1; i >= 0; i--) {
      var p = pats[i];
      p.t += dt; if (p.T != null) p.T += dt;
      if (p.conv) { if (p.state === 9 || p.t > 0) drawRune(p, time); continue; }
      if (p.state === 4) {                          /* halves flying together */
        var e = Math.min(1, p.t / 0.6), k = 1 - Math.pow(1 - e, 3);
        p.cx = p.fx + (p.tx - p.fx) * k; p.cy = p.fy + (p.ty - p.fy) * k;
        if (p.mate && !p.lead) p.rot = p.fr + angDiff(p.mate.fr, p.fr) * k;
        if (e >= 1) {
          if (p.lead) {
            var full = make(p.idx, p.cx, p.cy, p.R, { rot: p.rot, vr: p.vr, slow: 1, pal: PALETTES.indexOf(p.pal) });
            full.state = 2; full.t = 0; full.T = 0.6; full.fixed = true; full.x = p.cx; full.y = p.cy;
            if (p.burst) p.burst.p = full;
            pats.push(full);
          }
          pats.splice(i, 1); continue;
        }
      } else {
        var slow = p.state >= 2 ? 0.3 : 1;
        p.y += p.vy * dt * slow; if (p.vx) p.x += p.vx * dt * slow;
        p.sway += dt * 0.5; p.rot += p.vr * dt;
        p.cx = p.fixed ? p.x : p.x + Math.sin(p.sway) * p.R * 0.1; p.cy = p.y;
        if (p.state === 6) p.cx += Math.sin(p.t * 60) * 4 * Math.max(0, 1 - p.t / 0.5);
        if (p.state === 6 && p.t > 0.5) { p.state = 0; p.t = 0; }
        if (p.state === 1 && p.t > 0.75) { p.state = 2; p.t = 0; }
        if (p.state === 2 && p.t > 1.8) { p.state = 3; p.t = 0; }
        var m2 = p.R * 1.8, outside = p.cx < -m2 || p.cx > W + m2 || p.cy < -m2 || p.cy > H + m2;
        if (!outside && p.cx > 0 && p.cx < W && p.cy > 0 && p.cy < H) p.entered = true;
        var gone = p.travel ? (p.entered && outside) : p.cy - p.R * 1.8 > H;
        if ((p.state === 3 && p.t > 1.6) || (p.state === 7 && p.t > 1.1) || gone) {
          if (p.half && p.pair > 0 && (p.state === 0 || p.state === 5 || p.state === 6)) {   /* the match was missed: clear its wave */
            for (var w = 0; w < pats.length; w++) { var o = pats[w]; if (o !== p && o.half && o.wave === p.wave && (o.state === 0 || o.state === 5 || o.state === 6)) { o.state = 7; o.t = 0; } }
          }
          if (sel === p || (sel && sel.state === 7)) sel = null;
          pats.splice(i, 1); continue;
        }
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
    if (st === 8) return Math.pow(1 - (p.prog || 0), 2);
    if (st === 9) return 0;
    if (st === 0 || st === 5 || st === 6 || st === 7) return p.half ? 0.12 : 1;
    if (st === 1) { var e = Math.max(0, Math.min(1, (t - p.dl[i]) / 0.42)); return Math.pow(1 - e, 4) - 0.06 * Math.sin(e * Math.PI) ; } /* snap with a tiny overshoot */
    if (st === 4) return 0.12 * Math.pow(1 - Math.min(1, t / 0.5), 3);
    return 0;
  }

  function wrap(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }

  function drawRune(p, time) {
    var R = p.R, st = p.state, t = p.t, sub = p.sub, cx = p.cx, cy = p.cy;
    var bright = st === 8 ? 0.6 + 0.4 * (p.prog || 0) : st === 9 ? 1 : st === 7 ? 0.75 * Math.max(0, 1 - t / 1.1) : st === 0 || st === 6 ? 0.75 : st === 5 ? 0.95 : st === 1 ? 0.75 + 0.25 * Math.min(1, t / 0.5)
      : st === 2 || st === 4 ? 1 : Math.pow(Math.max(0, 1 - t / 1.6), 1.5);
    if (p.half && (st === 0 || st === 5)) bright *= 0.82 + 0.18 * Math.sin(time * 2.2 + p.phase);   /* pairs pulse in sync */
    /* once whole, the rune expands with the light rings while it fades (same slowing curve), so its detail opens up */
    /* from the tap: a springy bounce outward while the parts combine, then a steady expansion with the rings */
    var grow = 1;
    if (p.T != null) grow = 1 + 0.55 * p.T + 0.24 * Math.sin(p.T * 13) * Math.exp(-p.T * 3.2);
    var c = Math.cos(p.rot), sn = Math.sin(p.rot);
    var col = st === 5 ? "255,170,80" : p.pal[0], core = st === 5 ? "255,240,220" : p.pal[1];
    if (st === 2 || st === 4 || st === 9 || (st === 1 && t > 0.35)) {      /* inner light once it's whole */
      var ga = (st === 1 ? (t - 0.35) / 0.4 : 1) * 0.3 * bright;
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8 * grow);
      gr.addColorStop(0, "rgba(" + core + "," + ga.toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + col + ",0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 0.8 * grow, 0, TAU); g.fill();
    }
    for (var i = 0; i < p.N; i++) {
      if (sub && !sub[i]) continue;
      var pc = p.parts[i], k = apart(p, i), s = pc.s, kk = Math.max(0, Math.min(1, k));
      var moving = (st === 0 || st === 5 || st === 6 || st === 7 || st === 8) && !reduce;
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
    if (q.p) { q.x = q.p.cx; q.y = q.p.cy; }            /* stay centred on the rune as it drifts */
    if (q.t < 0.3) {                                      /* flash at the moment of contact */
      var fl = 1 - q.t / 0.3, gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.R * 1.2);
      gr.addColorStop(0, "rgba(" + q.pal[1] + "," + (0.4 * fl).toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + q.pal[0] + ",0)");
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.R * 1.2, 0, TAU); g.fill();
    }
    for (var k = 0; k < 6; k++) {
      var tk = q.t - k * 0.26; if (tk <= 0) continue;
      var life = tk / 2.4; if (life >= 1) continue;
      var rad = q.R * (1 + 2.31 * tk);                     /* constant speed: a visible sound wave */
      var a = Math.pow(1 - life, 1.5) * (1 - k * 0.12);
      var col = k % 2 ? "255,170,90" : q.pal[0];
      g.beginPath(); g.arc(q.x, q.y, rad, 0, TAU);
      g.strokeStyle = "rgba(" + col + "," + (0.12 * a).toFixed(3) + ")"; g.lineWidth = 10; g.stroke();
      g.strokeStyle = "rgba(" + col + "," + (0.35 * a).toFixed(3) + ")"; g.lineWidth = 3.5; g.stroke();
      g.strokeStyle = "rgba(235,248,255," + (0.75 * a).toFixed(3) + ")"; g.lineWidth = 1.1; g.stroke();
    }
  }

  requestAnimationFrame(frame);
})();
