/* M1ndseye home: optional sound. Crystal Cavern bed + pointer-driven crystal swell (short licensed samples in assets/audio).
   Off until the visitor taps the Sound button (browsers block autoplay anyway).
   Preference remembered in localStorage. */
(function () {
  var host = document.querySelector(".gaze-foot");
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!host || !AC) return;

  var KEY = "m1ndseye-sound";
  var ctx = null, on = false, speed = 0, lastX = null, lastY = null, lastT = 0;
  var master = null;

  /* ---------- button ---------- */
  var st = document.createElement("style");
  st.textContent =
    ".snd{position:absolute;right:0;bottom:calc(100% + 12px);display:inline-flex;align-items:center;gap:.55em;" +
    "font:inherit;font-size:.9rem;color:var(--muted,#9aa6bf);background:rgba(13,19,34,.55);border:1px solid var(--line,rgba(244,242,251,.14));" +
    "border-radius:999px;padding:.35em .9em .35em .75em;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}" +
    ".snd:hover,.snd:focus-visible{color:var(--text,#f4f2fb);border-color:var(--ai,#6f9bff)}" +
    ".snd:focus-visible{outline:2px solid var(--ai,#6f9bff);outline-offset:3px}" +
    ".snd__bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px}" +
    ".snd__bars i{display:block;width:2px;height:3px;background:currentColor;border-radius:1px}" +
    ".snd[aria-pressed=true]{color:var(--text,#f4f2fb)}" +
    ".snd[aria-pressed=true] .snd__bars i{animation:sndb 1.1s ease-in-out infinite}" +
    ".snd__bars i:nth-child(2){animation-delay:.18s!important}.snd__bars i:nth-child(3){animation-delay:.36s!important}.snd__bars i:nth-child(4){animation-delay:.54s!important}" +
    "@keyframes sndb{0%,100%{height:3px}50%{height:12px}}" +
    "@media (prefers-reduced-motion:reduce){.snd[aria-pressed=true] .snd__bars i{animation:none;height:8px}}";
  document.head.appendChild(st);
  if (getComputedStyle(host).position === "static") host.style.position = "relative";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "snd";
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = '<span class="snd__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="snd__t">Sound off</span>';
  host.appendChild(btn);
  function label() {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.querySelector(".snd__t").textContent = on ? "Sound on" : "Sound off";
  }

  /* ---------- audio graph ---------- */
  var BASE = "assets/audio/";
  var buf = {}, loading = null, lastSwell = 0;

  function load() {
    if (loading) return loading;
    function get(n) {
      return fetch(BASE + n + ".mp3").then(function (r) { return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
        .then(function (b) { buf[n] = b; });
    }
    loading = Promise.all([get("swell")]).then(start).catch(function () {});
    return loading;
  }

  function shot(name, gain, rate, dest) {
    var s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf[name]; s.playbackRate.value = rate || 1; g.gain.value = gain;
    s.connect(g); g.connect(dest || master); s.start();
    return s;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    /* short, soft echo for glue */
    var dly = ctx.createDelay(1); dly.delayTime.value = .38;
    var fb = ctx.createGain(); fb.gain.value = .3;
    var dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 3500;
    var wet = ctx.createGain(); wet.gain.value = .35;
    send = ctx.createGain();
    send.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(wet); wet.connect(master);
    master.connect(ctx.destination);
    /* Crystal Cavern Echoes: streamed and looped (about 2:56), evened out with a gentle compressor */
    bedEl = new Audio(BASE + "background.mp3");
    bedEl.loop = true; bedEl.preload = "auto";
    var bsrc = ctx.createMediaElementSource(bedEl);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.ratio.value = 3; comp.knee.value = 12; comp.attack.value = .02; comp.release.value = .4;
    var bg = ctx.createGain(); bg.gain.value = .3;
    bsrc.connect(comp); comp.connect(bg); bg.connect(master); bg.connect(send);
    load();
  }
  var send = null, bedEl = null;

  function start() {
    if (started) return; started = true;
  }
  var started = false;

  /* Airborne: crystal swell on pointer movement; louder and a touch higher the faster you move */
  function swellCheck() {
    if (!ctx || !started) return;
    var now = performance.now();
    if (speed > .35 && now - lastSwell > 900 && on && ctx.state === "running") {
      lastSwell = now;
      var s = Math.min(1, speed / 2);
      var src = shot("swell", .22 + .55 * s, .94 + .14 * s, master);
      var g = ctx.createGain(); g.gain.value = .4; src.connect(g); g.connect(send);
    }
  }
  function tick() {
    var now = performance.now();
    speed *= Math.pow(.5, (now - (tick.t || now)) / 260); tick.t = now;
    swellCheck();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function move(e) {
    var now = performance.now();
    if (lastX !== null && now > lastT) {
      var v = Math.hypot(e.clientX - lastX, e.clientY - lastY) / (now - lastT); /* px per ms */
      speed = Math.max(speed, Math.min(v, 4) * .85) * .6 + speed * .4;
    }
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    swellCheck();
  }
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerleave", function () { lastX = null; });

  function set(v, remember) {
    on = v;
    if (v) {
      if (!ctx) build();
      if (ctx.resume) ctx.resume();
      if (bedEl) { var pr = bedEl.play(); if (pr && pr.catch) pr.catch(function () {}); }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.9, ctx.currentTime, .8);   /* slow fade-in */
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .25);
      setTimeout(function () { if (!on && ctx) { if (bedEl) bedEl.pause(); if (ctx.suspend) ctx.suspend(); } }, 1500);
    }
    if (remember) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
    label();
  }
  btn.addEventListener("click", function () { set(!on, true); });
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !on) return;
    if (document.hidden) { ctx.suspend(); if (bedEl) bedEl.pause(); } else { ctx.resume(); if (bedEl) bedEl.play().catch(function () {}); }
  });

  /* returning visitors who chose sound: start on their first tap/key (autoplay rules need a gesture) */
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "1") {
    var arm = function (e) {
      if (btn.contains(e.target)) { cleanup(); return; }
      cleanup(); if (!on) set(true, false);
    };
    var cleanup = function () { ["pointerdown", "keydown"].forEach(function (n) { document.removeEventListener(n, arm, true); }); };
    ["pointerdown", "keydown"].forEach(function (n) { document.addEventListener(n, arm, true); });
  }
})();
