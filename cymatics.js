/* M1ndseye eye screensaver: cymatics game.
   Level 1: fragmented Chladni (cymatic) patterns drift down. Tap one and the plate "rings": the loose sand
   rushes onto its nodal lines, that mode's tone sounds, and a water ripple spreads from the tap.
   Level 2 (after 25 hits): waves of half-patterns fall. Exactly two halves in each wave belong to the same
   pattern; tap both and they fly together into the complete pattern with a chord.
   Patterns come from the square-plate formula
     f = cos(n*pi*x/2) cos(m*pi*y/2) - s * cos(m*pi*x/2) cos(n*pi*y/2)
   masked to a soft circle, so there are no square edges.
   Test hook: eye.html?level=2 starts at the harmony round. */
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
  var LEVEL2_AT = 25;
  var PTS = W * H > 900000 ? 1500 : 1150;
  var cache = {};

  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.6; }
  function plate(idx) {
    if (cache[idx]) return cache[idx];
    var n = MODES[idx][0], m = MODES[idx][1], s = MODES[idx][2], P = Math.PI / 2;
    var xs = [], ys = [], tries = 0, w = 0.022;
    while (xs.length < PTS && tries < 120000) {
      tries++;
      var x = Math.random() * 2 - 1, y = Math.random() * 2 - 1, r = Math.hypot(x, y);
      if (r > 1) continue;
      var cnx = Math.cos(n*P*x), cmy = Math.cos(m*P*y), cmx = Math.cos(m*P*x), cny = Math.cos(n*P*y);
      var f = cnx*cmy - s*cmx*cny;
      var fx = -n*P*Math.sin(n*P*x)*cmy + s*m*P*Math.sin(m*P*x)*cny;
      var fy = -m*P*cnx*Math.sin(m*P*y) + s*n*P*cmx*Math.sin(n*P*y);
      var d = Math.abs(f) / (Math.hypot(fx, fy) + 0.6);             /* ~distance to the nodal line */
      var edge = r < 0.62 ? 1 : Math.max(0, 1 - (r - 0.62) / 0.38);  /* soft round falloff, no square edges */
      if (Math.random() < Math.exp(-(d / w) * (d / w)) * edge * edge) { xs.push(x); ys.push(y); }
    }
    for (var i = 0; i < 40; i++) { /* bright grain cluster at the plate's center */
      var a = Math.random() * 6.283, rr = Math.abs(gauss()) * 0.025;
      xs.push(Math.cos(a) * rr); ys.push(Math.sin(a) * rr);
    }
    return (cache[idx] = { x: Float32Array.from(xs), y: Float32Array.from(ys) });
  }

  /* ---------- state ---------- */
  var pats = [], ripples = [], count = 0, spawnIn = 0.5, sel = null, banner = null;
  var level = /level=2/.test(location.search) ? 2 : 1;
  if (level === 2) count = LEVEL2_AT;
  var scoreEl = document.querySelector(".cym-score b"), bannerEl = document.querySelector(".cym-banner");
  function setScore() { if (scoreEl) { scoreEl.textContent = count; scoreEl.parentNode.classList.add("on"); } }
  if (level === 2) setScore();
  if (/debug/.test(location.search)) window.__cym = { pats: function () { return pats; } };

  function radius() { return Math.max(55, Math.min(150, Math.min(W, H) * (0.15 + Math.random() * 0.07))); }

  /* a pattern object: full (level 1) or a half (level 2, `sub` marks which grains it carries) */
  function make(idx, x, y, R, opts) {
    var pl = plate(idx), N = pl.x.length;
    var p = {
      idx: idx, pl: pl, N: N, R: R, x: x, y: y, sx: x,
      vy: H * (opts.slow ? 0.03 : 0.045 + Math.random() * 0.025), sway: Math.random() * 6.28,
      rot: opts.rot != null ? opts.rot : Math.random() * 6.28, vr: opts.vr != null ? opts.vr : (Math.random() - 0.5) * 0.12,
      state: 0, t: 0, half: !!opts.half, pair: opts.pair || 0,
      lx: new Float32Array(N), ly: new Float32Array(N), loose: new Uint8Array(N), dl: new Float32Array(N), ph: new Float32Array(N),
      sub: null, tint: opts.half ? "110,215,255" : opts.tint || (Math.random() < 0.75 ? "110,215,255" : "110,255,205")
    };
    var gaps = [], k = opts.half ? 0 : 3 + Math.floor(Math.random() * 3), j;
    for (j = 0; j < k; j++) gaps.push([Math.random() * 6.283, 0.35 + Math.random() * 0.55]);
    if (opts.half) {      /* split the plate into alternating wedges; side A keeps even wedges, side B odd */
      p.sub = new Uint8Array(N);
      var wedges = opts.wedges, off = opts.off;
      for (var q = 0; q < N; q++) {
        var aa = (Math.atan2(pl.y[q], pl.x[q]) + off + 6.283 * 2) % 6.283;
        p.sub[q] = (Math.floor(aa / (6.283 / wedges)) % 2) === opts.side ? 1 : 0;
      }
    }
    for (var i = 0; i < N; i++) {
      var a = Math.atan2(pl.y[i], pl.x[i]), lo = Math.random() < (opts.half ? 0.1 : 0.18);
      for (j = 0; j < k && !lo; j++) { var da = Math.abs(((a - gaps[j][0] + 9.425) % 6.283) - 3.1416); if (da < gaps[j][1] / 2) lo = true; }
      p.loose[i] = lo ? 1 : 0;
      var sa = Math.random() * 6.283, sd = lo ? 0.08 + Math.random() * 0.32 : Math.random() * 0.012;
      p.lx[i] = Math.cos(sa) * sd; p.ly[i] = Math.sin(sa) * sd;
      p.dl[i] = Math.random() * 0.28; p.ph[i] = Math.random() * 6.283;
    }
    return p;
  }

  function spawnOne() {
    var R = radius();
    pats.push(make(Math.floor(Math.random() * MODES.length), R + Math.random() * (W - 2 * R), -R * 1.1, R, {}));
  }

  var pairId = 0;
  function spawnWave() {
    var n = W > 700 ? 5 : 4, R = Math.max(50, Math.min(120, W / n * 0.42, H * 0.12));
    var m = Math.floor(Math.random() * MODES.length), id = ++pairId;
    var wedges = 2 + 2 * Math.floor(Math.random() * 2), off = Math.random() * 6.283;  /* 2 or 4 wedges */
    var rot = Math.random() * 6.28, vr = (Math.random() - 0.5) * 0.08;
    var others = [], pool = []; for (var i = 0; i < MODES.length; i++) if (i !== m) pool.push(i);
    for (i = 0; i < n - 2; i++) others.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    var slots = []; for (i = 0; i < n; i++) slots.push(i);
    slots.sort(function () { return Math.random() - 0.5; });
    var lane = W / n;
    function at(s) { return lane * (s + 0.5) + (Math.random() - 0.5) * lane * 0.2; }
    function y0() { return -R * (1.1 + Math.random() * 1.6); }
    pats.push(make(m, at(slots[0]), y0(), R, { half: 1, side: 0, wedges: wedges, off: off, rot: rot, vr: vr, pair: id, slow: 1 }));
    pats.push(make(m, at(slots[1]), y0(), R, { half: 1, side: 1, wedges: wedges, off: off, rot: rot, vr: vr, pair: id, slow: 1 }));
    for (i = 0; i < others.length; i++)
      pats.push(make(others[i], at(slots[i + 2]), y0(), R, { half: 1, side: Math.random() < 0.5 ? 0 : 1, wedges: wedges, off: Math.random() * 6.283, rot: Math.random() * 6.28, vr: vr, pair: -1, slow: 1 }));
  }

  function showBanner() {
    if (!bannerEl) return;
    bannerEl.classList.add("on");
    setTimeout(function () { bannerEl.classList.remove("on"); }, 4200);
  }

  /* ---------- sound helpers ---------- */
  function tone(idx, x, gain) { if (window.M1Sound) M1Sound.tone(NOTES[idx], (x / W) * 1.6 - 0.8, gain); }

  /* ---------- tap ---------- */
  cv.addEventListener("pointerdown", function (e) {
    var best = null, bd = 1e9;
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i]; if (p.state !== 0 && p.state !== 5) continue;
      var d = Math.hypot(e.clientX - p.cx, e.clientY - p.cy);
      if (d < p.R * 0.95 && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    e.cymHit = true;                 /* tapping a pattern doesn't pop up the exit/volume controls */
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {}

    if (!best.half) {                /* level 1: complete it */
      best.state = 1; best.t = 0; count++; setScore();
      ripples.push({ x: e.clientX, y: e.clientY, t: 0, R: best.R });
      tone(best.idx, best.cx, 1);
      if (count === LEVEL2_AT && level === 1) { level = 2; spawnIn = 4.5; showBanner(); }
      return;
    }
    /* level 2: pick two halves */
    if (best.state === 5) { best.state = 0; sel = null; return; }   /* tap again to let go */
    if (!sel) { sel = best; best.state = 5; best.t = 0; tone(best.idx, best.cx, 0.45); return; }
    var a = sel, b = best; sel = null;
    if (a.pair > 0 && a.pair === b.pair) {
      var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
      [a, b].forEach(function (h) { h.state = 4; h.t = 0; h.fx = h.cx; h.fy = h.cy; h.tx = mx; h.ty = my; h.fr = h.rot; });
      a.mate = b; b.mate = a; b.lead = true;
      count++; setScore();
      ripples.push({ x: mx, y: my, t: 0, R: a.R * 1.3 });
      tone(a.idx, mx, 1);
      var q = a.idx; setTimeout(function () { if (window.M1Sound) M1Sound.tone(NOTES[q] * 1.5, (mx / W) * 1.6 - 0.8, 0.6); }, 90); /* a fifth above */
    } else {
      tone(b.idx, b.cx, 0.35);
      [a, b].forEach(function (h) { h.state = 6; h.t = 0; });
    }
  });

  /* ---------- frame ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);

    spawnIn -= dt;
    if (spawnIn <= 0) {
      if (level === 1 && pats.length < 7) { spawnOne(); spawnIn = 1.5 + Math.random() * 1.1; }
      else if (level === 2) {
        var live = 0; for (var z = 0; z < pats.length; z++) if (pats[z].half && pats[z].state !== 3) live++;
        if (live < 3) { spawnWave(); spawnIn = 5 + Math.random() * 2; } else spawnIn = 0.5;
      }
    }

    for (var r = ripples.length - 1; r >= 0; r--) { ripples[r].t += dt; if (ripples[r].t > 2.2) ripples.splice(r, 1); }

    g.globalCompositeOperation = "lighter";
    for (var i = pats.length - 1; i >= 0; i--) {
      var p = pats[i];
      p.t += dt;
      if (p.state === 4) {                         /* halves flying together */
        var e = Math.min(1, p.t / 0.7), k = 1 - Math.pow(1 - e, 3);
        p.cx = p.fx + (p.tx - p.fx) * k; p.cy = p.fy + (p.ty - p.fy) * k;
        if (p.mate && !p.lead) p.rot = p.fr + (angDiff(p.mate.fr, p.fr)) * k;
        if (e >= 1) {
          if (p.lead) {                            /* swap the two halves for one complete pattern */
            var full = make(p.idx, p.cx, p.cy, p.R, { rot: p.rot, vr: p.vr, slow: 1, tint: p.tint });
            full.state = 2; full.t = 0; full.x = full.sx = p.cx; full.y = p.cy; full.sway = 0; full.fixed = true;
            pats.push(full);
          }
          pats.splice(i, 1); continue;
        }
      } else {
        p.y += p.vy * dt * (p.state >= 2 ? 0.35 : 1);
        p.sway += dt * 0.5; p.rot += p.vr * dt;
        p.cx = p.fixed ? p.x : p.x + Math.sin(p.sway) * p.R * 0.12; p.cy = p.y;
        if (p.state === 6) p.cx += Math.sin(p.t * 60) * 4 * Math.max(0, 1 - p.t / 0.5);
        if (p.state === 6 && p.t > 0.5) { p.state = 0; p.t = 0; }
        if (p.state === 1 && p.t > 1.0) { p.state = 2; p.t = 0; }
        if (p.state === 2 && p.t > 1.5) { p.state = 3; p.t = 0; }
        if ((p.state === 3 && p.t > 1.4) || p.cy - p.R > H) { if (sel === p) sel = null; pats.splice(i, 1); continue; }
      }
      drawPat(p, now / 1000);
    }
    g.globalCompositeOperation = "source-over";
    for (i = 0; i < pats.length; i++) if (pats[i].state === 5) ring(pats[i], now / 1000);
    for (r = 0; r < ripples.length; r++) drawRipple(ripples[r]);
    requestAnimationFrame(frame);
  }
  function angDiff(a, b) { var d = (a - b) % 6.283; if (d > 3.1416) d -= 6.283; if (d < -3.1416) d += 6.283; return d; }

  function ripplePush(px, py) {     /* the water ripple nudges nearby grains */
    var ox = 0, oy = 0;
    for (var r = 0; r < ripples.length; r++) {
      var q = ripples[r], dx = px - q.x, dy = py - q.y, d = Math.hypot(dx, dy) || 1;
      var band = d - q.t * q.R * 2.2;
      if (band > -40 && band < 40) {
        var amp = 5 * Math.sin(band / 40 * Math.PI * 2) * Math.cos(band / 80 * Math.PI) * Math.max(0, 1 - q.t / 2.2);
        ox += dx / d * amp; oy += dy / d * amp;
      }
    }
    return [ox, oy];
  }

  function drawPat(p, time) {
    var pl = p.pl, N = p.N, R = p.R, c = Math.cos(p.rot), s = Math.sin(p.rot), cx = p.cx, cy = p.cy;
    var st = p.state, t = p.t, sub = p.sub;
    var bright = st === 0 || st === 6 ? 0.5 : st === 5 ? 0.85 : st === 1 ? 0.5 + 0.5 * Math.min(1, t / 0.8) : st === 2 || st === 4 ? 1 : Math.max(0, 1 - t / 1.4);
    var spread = st === 3 ? 1 + t * 0.35 : 1;
    var hasRip = ripples.length > 0;
    var glow = st === 1 || st === 2 || st === 3 || st === 4;
    var passes = glow ? 2 : 1;
    for (var pass = 0; pass < passes; pass++) {
      var sz = passes === 2 && pass === 0 ? 3.2 : 1.5;
      var al = passes === 2 && pass === 0 ? 0.07 * bright * (st === 1 ? Math.min(1, t / 0.8) : 1) : 0.85 * bright;
      g.fillStyle = "rgba(" + p.tint + "," + al.toFixed(3) + ")";
      for (var i = 0; i < N; i++) {
        if (sub && !sub[i]) continue;
        var ux = pl.x[i], uy = pl.y[i], la = p.loose[i], k = 0;
        if (st === 0 || st === 5 || st === 6) k = la ? 1 : 0.6;
        else if (st === 1) { var e = Math.max(0, Math.min(1, (t - p.dl[i]) / 0.65)); k = (la ? 1 : 0.6) * Math.pow(1 - e, 3); }
        else if (st === 4) k = (la ? 1 : 0.6) * Math.pow(1 - Math.min(1, t / 0.6), 3);
        if (k) {
          var wob = la && !reduce && st !== 4 ? 0.04 * Math.sin(time * 1.3 + p.ph[i]) : 0;
          ux += p.lx[i] * k + wob; uy += p.ly[i] * k + wob * 0.7;
        }
        ux *= spread; uy *= spread;
        var px = cx + (ux * c - uy * s) * R, py = cy + (ux * s + uy * c) * R;
        if (hasRip) { var o = ripplePush(px, py); px += o[0]; py += o[1]; }
        if (k && la && pass === passes - 1 && st !== 4) { g.globalAlpha = 0.55; g.fillRect(px, py, sz, sz); g.globalAlpha = 1; }
        else g.fillRect(px, py, sz, sz);
      }
    }
  }

  function ring(p, time) {           /* soft halo around a selected half */
    var a = 0.25 + 0.12 * Math.sin(time * 5);
    g.lineWidth = 1.5; g.strokeStyle = "rgba(255,190,120," + a.toFixed(3) + ")";
    g.beginPath(); g.arc(p.cx, p.cy, p.R * 1.05, 0, 6.283); g.stroke();
  }

  function drawRipple(q) {
    var life = q.t / 2.2, fade = Math.pow(1 - life, 1.6);
    for (var k = 0; k < 4; k++) {
      var rad = q.t * q.R * 2.2 - k * 22;
      if (rad <= 2) continue;
      var a = fade * (1 - k * 0.22);
      g.lineWidth = 2.2 + life * 3;
      g.strokeStyle = "rgba(170,225,255," + (0.42 * a).toFixed(3) + ")";      /* crest */
      g.beginPath(); g.arc(q.x, q.y, rad, 0, 6.283); g.stroke();
      g.lineWidth = 3 + life * 4;
      g.strokeStyle = "rgba(2,6,16," + (0.35 * a).toFixed(3) + ")";           /* trough just inside it */
      g.beginPath(); g.arc(q.x, q.y, Math.max(1, rad - 4 - life * 3), 0, 6.283); g.stroke();
    }
  }

  requestAnimationFrame(frame);
})();
