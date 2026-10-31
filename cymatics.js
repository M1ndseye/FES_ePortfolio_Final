/* M1ndseye eye screensaver: cymatics game (laser edition).
   Level 1: a tumbling jumble of glowing laser sticks drifts down (one every 5-8 s). Tap it and the plate "rings":
   every stick flies to its place on the pattern's nodal lines, that mode's tone sounds, and glowing laser
   rings burst outward like a release of energy.
   Level 2 (after 25 hits): waves of half-patterns fall. Exactly two halves in each wave belong to the same
   pattern; tap both and they fly together into the complete pattern with a chord.
   Patterns come from the square-plate (Chladni) formula
     f = cos(n*pi*x/2) cos(m*pi*y/2) - s * cos(m*pi*x/2) cos(n*pi*y/2)
   masked to a soft circle, so there are no square edges.
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

  /* ---------- modes, simplest to busiest; each gets the next note up a D major pentatonic ---------- */
  var MODES = [[1,2,-1],[1,3,-1],[1,4,-1],[2,3,-1],[1,5,-1],[2,4,-1],[2,5,-1],[3,4,-1],[2,6,-1],[3,5,-1],[3,5,1],[4,5,-1],[4,6,-1],[5,6,-1]];
  var NOTES = [220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.26, 739.99, 880, 987.77, 1174.66, 1318.51];
  var LEVEL2_AT = 25, STICK = 0.09, GAP = 0.105;
  var cache = {};

  /* sample the nodal lines, then keep evenly spaced points; each becomes a stick lying along the line */
  function plate(idx) {
    if (cache[idx]) return cache[idx];
    var n = MODES[idx][0], m = MODES[idx][1], s = MODES[idx][2], P = Math.PI / 2;
    function grad(x, y) {
      var cnx = Math.cos(n*P*x), cmy = Math.cos(m*P*y), cmx = Math.cos(m*P*x), cny = Math.cos(n*P*y);
      return [cnx*cmy - s*cmx*cny,
        -n*P*Math.sin(n*P*x)*cmy + s*m*P*Math.sin(m*P*x)*cny,
        -m*P*cnx*Math.sin(m*P*y) + s*n*P*cmx*Math.sin(n*P*y)];
    }
    var cand = [], tries = 0;
    while (cand.length < 2500 && tries < 150000) {
      tries++;
      var x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, r = Math.hypot(x, y);
      if (r > 0.97) continue;
      var q = grad(x, y), gl = Math.hypot(q[1], q[2]);
      if (gl < 0.4) continue;                                   /* skip blobby crossings */
      if (Math.abs(q[0]) / gl > 0.01) continue;                 /* must sit on a nodal line */
      var edge = r < 0.6 ? 1 : Math.max(0, 1 - (r - 0.6) / 0.37); /* soft round falloff, no square edges */
      if (Math.random() > edge) continue;
      cand.push([x, y, Math.atan2(q[1], -q[2])]);               /* tangent = perpendicular to gradient */
    }
    var X = [], Y = [], A = [];
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i], ok = true;
      for (var j = 0; j < X.length && ok; j++) if (Math.abs(X[j] - c[0]) < GAP && Math.hypot(X[j] - c[0], Y[j] - c[1]) < GAP) ok = false;
      if (ok) { X.push(c[0]); Y.push(c[1]); A.push(c[2]); }
    }
    return (cache[idx] = { x: Float32Array.from(X), y: Float32Array.from(Y), a: Float32Array.from(A) });
  }

  /* ---------- state ---------- */
  var pats = [], bursts = [], count = 0, spawnIn = 0.8, sel = null;
  var level = /level=2/.test(location.search) ? 2 : 1;
  if (level === 2) count = LEVEL2_AT;
  var scoreEl = document.querySelector(".cym-score b"), bannerEl = document.querySelector(".cym-banner");
  function setScore() { if (scoreEl) { scoreEl.textContent = count; scoreEl.parentNode.classList.add("on"); } }
  if (level === 2) setScore();
  if (/debug/.test(location.search)) window.__cym = { pats: function () { return pats; } };

  function make(idx, x, y, R, opts) {
    var pl = plate(idx), N = pl.x.length;
    var p = {
      idx: idx, pl: pl, N: N, R: R, x: x, y: y, cx: x, cy: y,
      vy: H * (opts.slow ? 0.032 : 0.04 + Math.random() * 0.02), sway: Math.random() * 6.28,
      rot: opts.rot != null ? opts.rot : Math.random() * 6.28, vr: opts.vr != null ? opts.vr : (Math.random() - 0.5) * 0.12,
      state: 0, t: 0, half: !!opts.half, pair: opts.pair || 0, sub: null,
      jx: new Float32Array(N), jy: new Float32Array(N), ja: new Float32Array(N), js: new Float32Array(N), dl: new Float32Array(N)
    };
    if (opts.half) {     /* split into alternating wedges; side A keeps even wedges, side B odd */
      p.sub = new Uint8Array(N);
      for (var q = 0; q < N; q++) {
        var aa = (Math.atan2(pl.y[q], pl.x[q]) + opts.off + 12.566) % 6.283;
        p.sub[q] = (Math.floor(aa / (6.283 / opts.wedges)) % 2) === opts.side ? 1 : 0;
      }
    }
    for (var i = 0; i < N; i++) {  /* the jumble: sticks heaped loosely near the center, each spinning */
      var ra = Math.random() * 6.283, rd = Math.sqrt(Math.random()) * 0.6;
      p.jx[i] = Math.cos(ra) * rd; p.jy[i] = Math.sin(ra) * rd * 0.85;
      p.ja[i] = Math.random() * 3.1416; p.js[i] = (Math.random() - 0.5) * 2.4;
      p.dl[i] = Math.random() * 0.3;
    }
    return p;
  }

  function radius() { return Math.max(70, Math.min(170, Math.min(W, H) * (0.2 + Math.random() * 0.07))); }
  function spawnOne() {
    var R = radius();
    pats.push(make(Math.floor(Math.random() * MODES.length), R + Math.random() * (W - 2 * R), -R * 1.1, R, {}));
  }

  var pairId = 0;
  function spawnWave() {
    var n = W > 700 ? 5 : 4, R = Math.max(58, Math.min(130, W / n * 0.48, H * 0.13));
    var m = Math.floor(Math.random() * MODES.length), id = ++pairId;
    var wedges = 2 + 2 * Math.floor(Math.random() * 2), off = Math.random() * 6.283;
    var rot = Math.random() * 6.28, vr = (Math.random() - 0.5) * 0.08, i;
    var pool = []; for (i = 0; i < MODES.length; i++) if (i !== m) pool.push(i);
    var slots = []; for (i = 0; i < n; i++) slots.push(i);
    slots.sort(function () { return Math.random() - 0.5; });
    var lane = W / n;
    function at(s) { return lane * (s + 0.5) + (Math.random() - 0.5) * lane * 0.2; }
    function y0(k) { return -R * (1.1 + k * 0.9 + Math.random() * 0.5); }
    pats.push(make(m, at(slots[0]), y0(0), R, { half: 1, side: 0, wedges: wedges, off: off, rot: rot, vr: vr, pair: id, slow: 1 }));
    pats.push(make(m, at(slots[1]), y0(1), R, { half: 1, side: 1, wedges: wedges, off: off, rot: rot, vr: vr, pair: id, slow: 1 }));
    for (i = 2; i < n; i++) {
      var o = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      pats.push(make(o, at(slots[i]), y0(i), R, { half: 1, side: Math.random() < 0.5 ? 0 : 1, wedges: wedges, off: Math.random() * 6.283, rot: Math.random() * 6.28, vr: vr, pair: -1, slow: 1 }));
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
      if (d < p.R * 0.9 && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    e.cymHit = true;                 /* tapping a pattern doesn't pop up the exit/volume controls */
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {}

    if (!best.half) {
      best.state = 1; best.t = 0; count++; setScore();
      bursts.push({ x: best.cx, y: best.cy, t: -0.55, R: best.R });   /* rings fire as the sticks lock in */
      tone(best.idx, best.cx, 1);
      if (count === LEVEL2_AT && level === 1) { level = 2; spawnIn = 4.5; showBanner(); }
      return;
    }
    if (best.state === 5) { best.state = 0; sel = null; return; }   /* tap again to let go */
    if (!sel) { sel = best; best.state = 5; best.t = 0; tone(best.idx, best.cx, 0.45); return; }
    var a = sel, b = best; sel = null;
    if (a.pair > 0 && a.pair === b.pair) {
      var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
      [a, b].forEach(function (h) { h.state = 4; h.t = 0; h.fx = h.cx; h.fy = h.cy; h.tx = mx; h.ty = my; h.fr = h.rot; });
      a.mate = b; b.mate = a; b.lead = true;
      count++; setScore();
      bursts.push({ x: mx, y: my, t: -0.6, R: a.R * 1.2 });
      tone(a.idx, mx, 1);
      var q = a.idx; setTimeout(function () { if (window.M1Sound) M1Sound.tone(NOTES[q] * 1.5, (mx / W) * 1.6 - 0.8, 0.6); }, 90);
    } else {
      tone(b.idx, b.cx, 0.35);
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

    for (var r = bursts.length - 1; r >= 0; r--) { bursts[r].t += dt; if (bursts[r].t > 1.8) bursts.splice(r, 1); }

    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (var i = pats.length - 1; i >= 0; i--) {
      var p = pats[i];
      p.t += dt;
      if (p.state === 4) {                          /* halves flying together */
        var e = Math.min(1, p.t / 0.6), k = 1 - Math.pow(1 - e, 3);
        p.cx = p.fx + (p.tx - p.fx) * k; p.cy = p.fy + (p.ty - p.fy) * k;
        if (p.mate && !p.lead) p.rot = p.fr + angDiff(p.mate.fr, p.fr) * k;
        if (e >= 1) {
          if (p.lead) {
            var full = make(p.idx, p.cx, p.cy, p.R, { rot: p.rot, vr: p.vr, slow: 1 });
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
        if (p.state === 1 && p.t > 0.95) { p.state = 2; p.t = 0; }
        if (p.state === 2 && p.t > 1.6) { p.state = 3; p.t = 0; }
        if ((p.state === 3 && p.t > 1.2) || p.cy - p.R > H) { if (sel === p) sel = null; pats.splice(i, 1); continue; }
      }
      drawPat(p, time);
    }
    for (r = 0; r < bursts.length; r++) drawBurst(bursts[r]);
    for (i = 0; i < pats.length; i++) if (pats[i].state === 5) halo(pats[i], time);
    g.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  }
  function angDiff(a, b) { var d = (a - b) % 6.283; if (d > 3.1416) d -= 6.283; if (d < -3.1416) d += 6.283; return d; }
  function lineDiff(a, b) { var d = (a - b) % 3.1416; if (d > 1.5708) d -= 3.1416; if (d < -1.5708) d += 3.1416; return d; } /* sticks look the same flipped */

  /* how far each stick is from its place: 1 = fully jumbled, 0 = locked on the pattern */
  function mixFor(p, i) {
    var st = p.state, t = p.t;
    if (st === 0 || st === 5 || st === 6) return p.half ? 0.13 : 1;   /* halves stay readable: fractured, not jumbled */
    if (st === 1) { var e = Math.max(0, Math.min(1, (t - p.dl[i]) / 0.6)); return Math.pow(1 - e, 3); }
    if (st === 4) { var e2 = Math.min(1, p.t / 0.5); return 0.13 * Math.pow(1 - e2, 3); }
    return 0;
  }

  function drawPat(p, time) {
    var pl = p.pl, N = p.N, R = p.R, c = Math.cos(p.rot), s = Math.sin(p.rot), cx = p.cx, cy = p.cy;
    var st = p.state, t = p.t, sub = p.sub, L = STICK * R * 0.5;
    var bright = st === 0 || st === 6 ? 0.62 : st === 5 ? 0.9 : st === 1 ? 0.62 + 0.38 * Math.min(1, t / 0.7)
      : st === 2 || st === 4 ? 1 : Math.max(0, 1 - t / 1.2);
    var spread = st === 3 ? 1 + t * 0.25 : 1;
    var pulse = st === 2 ? 0.15 * Math.sin(t * 9) : 0;
    var path = new Path2D();
    for (var i = 0; i < N; i++) {
      if (sub && !sub[i]) continue;
      var k = mixFor(p, i);
      var tx = pl.x[i], ty = pl.y[i], ta = pl.a[i];
      var jx = p.jx[i] + (reduce ? 0 : 0.03 * Math.sin(time * 0.9 + i)), jy = p.jy[i], ja = p.ja[i] + (reduce ? 0 : p.js[i] * time);
      var ux = (tx + (jx - tx) * k) * spread, uy = (ty + (jy - ty) * k) * spread;
      var a = ta + lineDiff(ja, ta) * k + p.rot;
      var px = cx + (ux * c - uy * s) * R, py = cy + (ux * s + uy * c) * R;
      var dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      path.moveTo(px - dx, py - dy); path.lineTo(px + dx, py + dy);
    }
    var tint = st === 5 ? "255,190,120" : "70,190,255";
    g.strokeStyle = "rgba(" + tint + "," + (0.13 * bright + pulse * 0.1).toFixed(3) + ")"; g.lineWidth = 7; g.stroke(path);   /* outer glow */
    g.strokeStyle = "rgba(" + tint + "," + (0.35 * bright).toFixed(3) + ")"; g.lineWidth = 3; g.stroke(path);                 /* inner glow */
    g.strokeStyle = "rgba(225,248,255," + (0.95 * bright).toFixed(3) + ")"; g.lineWidth = 1.2; g.stroke(path);               /* hot core */
  }

  function halo(p, time) {           /* soft amber ring around a selected half */
    var a = 0.25 + 0.12 * Math.sin(time * 5);
    g.lineWidth = 1.5; g.strokeStyle = "rgba(255,190,120," + a.toFixed(3) + ")";
    g.beginPath(); g.arc(p.cx, p.cy, p.R * 1.02, 0, 6.283); g.stroke();
  }

  /* release of energy: glowing laser rings racing outward, fastest first */
  function drawBurst(q) {
    if (q.t <= 0) return;
    var life = q.t / 1.8;
    for (var k = 0; k < 4; k++) {
      var tk = q.t - k * 0.12; if (tk <= 0) continue;
      var rad = q.R * (0.55 + tk * (2.6 - k * 0.35) + tk * tk * 0.8);
      var a = Math.pow(Math.max(0, 1 - tk / (1.8 - k * 0.12)), 1.4) * (1 - k * 0.18);
      var col = k % 2 ? "255,170,90" : "90,200,255";
      g.beginPath(); g.arc(q.x, q.y, rad, 0, 6.283);
      g.strokeStyle = "rgba(" + col + "," + (0.14 * a).toFixed(3) + ")"; g.lineWidth = 12; g.stroke();
      g.strokeStyle = "rgba(" + col + "," + (0.4 * a).toFixed(3) + ")"; g.lineWidth = 4; g.stroke();
      g.strokeStyle = "rgba(235,250,255," + (0.85 * a).toFixed(3) + ")"; g.lineWidth = 1.3; g.stroke();
    }
    if (life < 0.25) {               /* bright flash at the core */
      var fl = 1 - life / 0.25, gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.R * 0.9);
      gr.addColorStop(0, "rgba(200,240,255," + (0.45 * fl).toFixed(3) + ")"); gr.addColorStop(1, "rgba(200,240,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.R * 0.9, 0, 6.283); g.fill();
    }
  }

  requestAnimationFrame(frame);
})();
