/* M1ndseye home: optional sound. Crystal Cavern bed + pointer-driven crystal swell (short licensed samples in assets/audio).
   Off until the visitor turns it on in the gear (settings) modal (browsers block autoplay anyway).
   Preference remembered in localStorage. */
(function () {
  /* home page: gear + settings modal in the footer. eye screensaver (body[data-saver]): volume slider along the bottom */
  var saver = document.body.hasAttribute("data-saver");
  var host = saver ? document.body : document.querySelector(".gaze-foot");
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!host || !AC) return;

  var KEY = "m1ndseye-sound";
  var ctx = null, on = false, speed = 0, lastX = null, lastY = null, lastT = 0;
  var master = null;
  var VKEY = "m1ndseye-volume", vol = 1;
  try { var sv = parseFloat(localStorage.getItem(VKEY)); if (sv >= 0 && sv <= 1) vol = sv; } catch (e) {}
  var label, ui, sw = null;

  if (!saver) {
  /* ---------- settings: gear button + modal (sound switch, eye screensaver) ---------- */
  var st = document.createElement("style");
  st.textContent =
    ".gear{position:absolute;right:0;bottom:calc(100% + 12px);width:42px;height:42px;display:grid;place-items:center;padding:0;" +
    "color:var(--muted,#9aa6bf);background:rgba(13,19,34,.55);border:1px solid var(--line,rgba(244,242,251,.14));border-radius:50%;cursor:pointer;" +
    "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:color .2s,border-color .2s}" +
    ".gear svg{width:20px;height:20px;transition:transform .6s cubic-bezier(.3,.7,.2,1)}" +
    ".gear:hover,.gear:focus-visible,.gear[aria-expanded=true]{color:var(--text,#f4f2fb);border-color:var(--ai,#6f9bff)}" +
    ".gear:hover svg,.gear[aria-expanded=true] svg{transform:rotate(60deg)}" +
    ".gear.is-on::after{content:'';position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--oi,#ff9d42);box-shadow:0 0 6px var(--oi,#ff9d42)}" +
    "@media (max-width:860px){.gear{bottom:auto;top:-2px;right:var(--pad,20px)}}" +
    ".setm{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:20px;background:rgba(4,6,13,.55);" +
    "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .2s}" +
    ".setm.is-open{opacity:1}.setm[hidden]{display:none}" +
    ".setm__card{position:relative;width:min(340px,100%);padding:22px 22px 20px;border-radius:18px;color:var(--text,#f4f2fb);" +
    "background:linear-gradient(160deg,rgba(28,38,66,.78),rgba(10,14,26,.86));border:1px solid rgba(244,242,251,.16);" +
    "box-shadow:0 20px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);" +
    "transform:translateY(8px) scale(.98);transition:transform .2s}" +
    ".setm.is-open .setm__card{transform:none}" +
    ".setm__h{margin:0 0 14px;font-size:1.05rem;font-weight:600;letter-spacing:.02em}" +
    ".setm__x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:var(--muted,#9aa6bf);font-size:1.3rem;line-height:1;cursor:pointer}" +
    ".setm__x:hover{color:var(--text,#f4f2fb)}" +
    ".setm__row{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:14px 0;border:0;border-top:1px solid var(--line,rgba(244,242,251,.14));" +
    "background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;text-decoration:none}" +
    ".setm__row small{display:block;color:var(--muted,#9aa6bf);font-size:.82rem;margin-top:2px}" +
    ".setm__row:hover .setm__go{color:var(--text,#f4f2fb);transform:translateX(3px)}" +
    ".setm__go{color:var(--muted,#9aa6bf);transition:transform .2s,color .2s}" +
    ".sw{flex:none;position:relative;width:44px;height:26px;border-radius:999px;background:rgba(244,242,251,.14);transition:background .2s}" +
    ".sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#f4f2fb;transition:transform .2s}" +
    ".setm__row[aria-checked=true] .sw{background:var(--ai,#6f9bff)}" +
    ".setm__row[aria-checked=true] .sw::after{transform:translateX(18px)}" +
    "@media (prefers-reduced-motion:reduce){.gear svg,.setm,.setm__card,.sw,.sw::after{transition:none}}";
  document.head.appendChild(st);
  if (getComputedStyle(host).position === "static") host.style.position = "relative";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gear";
  btn.setAttribute("aria-label", "Settings");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  host.appendChild(btn);

  var modal = document.createElement("div");
  modal.className = "setm"; modal.hidden = true;
  modal.innerHTML =
    '<div class="setm__card" role="dialog" aria-modal="true" aria-labelledby="setm-h">' +
      '<h2 class="setm__h" id="setm-h">Settings</h2>' +
      '<button type="button" class="setm__x" aria-label="Close">&times;</button>' +
      '<button type="button" class="setm__row" id="setm-snd" role="switch" aria-checked="false"><span>Sound<small>Ambient crystal score</small></span><span class="sw" aria-hidden="true"></span></button>' +
      '<a class="setm__row" href="eye.html?from=home"><span>Mini game<small>Tap the runes to make them whole</small></span><span class="setm__go" aria-hidden="true">&rarr;</span></a>' +
    '</div>';
  document.body.appendChild(modal);
  var sw = modal.querySelector("#setm-snd");

  function openM() {
    modal.hidden = false; btn.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () { modal.classList.add("is-open"); });
    sw.focus();
  }
  function closeM() {
    modal.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false");
    setTimeout(function () { if (!modal.classList.contains("is-open")) modal.hidden = true; }, 200);
    btn.focus();
  }
  btn.addEventListener("click", function () { modal.hidden ? openM() : closeM(); });
  modal.querySelector(".setm__x").addEventListener("click", closeM);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeM(); });
  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") { closeM(); return; }
    if (e.key === "Tab") {   /* keep focus inside the modal */
      var f = modal.querySelectorAll("button,a[href]"), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  label = function () {
    sw.setAttribute("aria-checked", on ? "true" : "false");
    btn.classList.toggle("is-on", on);
  };
  ui = { contains: function (t) { return btn.contains(t) || modal.contains(t); } };

  } else {
  /* ---------- screensaver: horizontal volume slider, fades in/out with the exit button ---------- */
  var st2 = document.createElement("style");
  st2.textContent =
    ".vol{position:fixed;z-index:5;left:max(14px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));" +
    "box-sizing:border-box;width:44px;height:44px;overflow:hidden;display:flex;align-items:center;gap:10px;padding:0 4px;border-radius:999px;" +
    "transition:opacity .4s,width .35s cubic-bezier(.2,.8,.2,1),padding .35s;" +
    "background:rgba(13,19,34,.55);border:1px solid rgba(244,242,251,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);" +
    "color:#f4f2fb;opacity:0;pointer-events:none;transition:opacity .4s;touch-action:none}" +
    ".vol.show{opacity:.9;pointer-events:auto}" +
    ".vol.open{width:min(300px,calc(100vw - 28px));padding:0 18px 0 4px}" +
    ".vol:not(.open) .vol__r{opacity:0;pointer-events:none}.vol__r{transition:opacity .25s .1s}" +
    ".vol__m{flex:none;width:34px;height:34px;margin-left:0;display:grid;place-items:center;border-radius:50%;border:0;padding:0;background:transparent;color:inherit;cursor:pointer}" +
    ".vol__m svg{width:20px;height:20px}.vol__m .w{transition:opacity .2s}.vol[data-muted=true] .vol__m .w{opacity:0}.vol__m .x{opacity:0}.vol[data-muted=true] .vol__m .x{opacity:1}" +
    ".vol__r{flex:1;min-width:0;height:34px;margin:0;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer;--p:100%}" +
    ".vol__r::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,#6f9bff,#ff9d42) 0/var(--p) 100% no-repeat,rgba(244,242,251,.18)}" +
    ".vol__r::-moz-range-track{height:4px;border-radius:2px;background:rgba(244,242,251,.18)}" +
    ".vol__r::-moz-range-progress{height:4px;border-radius:2px;background:linear-gradient(90deg,#6f9bff,#ff9d42)}" +
    ".vol__r::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-8px;border-radius:50%;background:#f4f2fb;border:0;box-shadow:0 0 10px rgba(111,155,255,.6)}" +
    ".vol__r::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#f4f2fb;border:0;box-shadow:0 0 10px rgba(111,155,255,.6)}" +
    ".vol__r:focus-visible{outline:2px solid #ff9d42;outline-offset:4px;border-radius:4px}";
  document.head.appendChild(st2);
  var bar = document.createElement("div");
  bar.className = "vol";
  bar.innerHTML = '<button type="button" class="vol__m" aria-label="Mute"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path class="w" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/><path class="x" d="m16 9 6 6m0-6-6 6"/></svg></button>' +
    '<input class="vol__r" type="range" min="0" max="100" step="1" aria-label="Volume" />';
  document.body.appendChild(bar);
  var rng = bar.querySelector(".vol__r"), mb = bar.querySelector(".vol__m");
  function paint() {
    var p = on ? Math.round(vol * 100) : 0;
    rng.value = p; rng.style.setProperty("--p", p + "%");
    rng.setAttribute("aria-valuetext", on ? p + "%" : "Muted");
    bar.setAttribute("data-muted", on && vol > 0 ? "false" : "true");
    mb.setAttribute("aria-label", on ? "Mute" : "Unmute");
  }
  rng.addEventListener("input", function () {
    var v = rng.value / 100;
    if (v > 0) { vol = v; try { localStorage.setItem(VKEY, String(v)); } catch (e) {} }
    if (v > 0 && !on) set(true, true);
    else if (v === 0 && on) set(false, true);
    else if (on && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(.9 * vol, ctx.currentTime, .05); }
    paint();
  });
  /* collapsed: a small round speaker; tap it to slide the volume out. Once open, the speaker mutes / unmutes. */
  var shut;
  function open(v) { bar.classList.toggle("open", v); mb.setAttribute("aria-expanded", v ? "true" : "false"); }
  function holdOpen() { clearTimeout(shut); shut = setTimeout(function () { open(false); }, 4000); }
  mb.addEventListener("click", function () {
    if (!bar.classList.contains("open")) { open(true); holdOpen(); return; }
    if (!on && vol < .05) vol = .5; set(!on, true); holdOpen();
  });
  rng.addEventListener("input", holdOpen);
  document.addEventListener("pointerdown", function (e) { if (!bar.contains(e.target)) open(false); }, true);
  new MutationObserver(function () { if (!bar.classList.contains("show")) open(false); }).observe(bar, { attributes: true, attributeFilter: ["class"] });
  open(false);
  label = paint;
  ui = bar;
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
    /* iOS 17+: treat this as media playback so the ring/silent switch doesn't mute it */
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
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
    var bg = ctx.createGain(); bg.gain.value = .225;
    bsrc.connect(comp); comp.connect(bg); bg.connect(master);
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
      var src = shot("swell", .141 + .352 * s, .94 + .14 * s, master);
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
      master.gain.setTargetAtTime(.9 * vol, ctx.currentTime, .8);   /* slow fade-in */
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .25);
      setTimeout(function () { if (!on && ctx) { if (bedEl) bedEl.pause(); if (ctx.suspend) ctx.suspend(); } }, 1500);
    }
    if (remember) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
    label();
  }
  if (sw) sw.addEventListener("click", function () { set(!on, true); });

  /* cymatics game: a crystal-bowl tone per pattern (fundamental + bowl partials, long decay), through the master volume */
  var armed = false, pend = null, verb = null;
  function reverb() {     /* synthetic hall: ~5 s of decaying, darkening stereo noise as the impulse response */
    if (verb) return verb;
    var len = Math.round(ctx.sampleRate * 5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var k = i / len, cut = .55 - .45 * k;
        lp += (Math.random() * 2 - 1 - lp) * cut;
        d[i] = lp * Math.pow(1 - k, 2.4) * (i < 300 ? i / 300 : 1);
      }
    }
    verb = ctx.createConvolver(); verb.buffer = ir;
    var vo = ctx.createGain(); vo.gain.value = .55; verb.connect(vo); vo.connect(master);
    return verb;
  }
  window.M1Sound = {
    tone: function (f, pan, gain) {
      if (!on || !ctx || !master) { if (armed) pend = [f, pan, performance.now(), gain]; return; }
      var t = ctx.currentTime, out = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      out.gain.value = gain == null ? 1 : gain;
      if (p) { p.pan.value = Math.max(-1, Math.min(1, pan || 0)); out.connect(p); p.connect(master); } else out.connect(master);
      var sg = ctx.createGain(); sg.gain.value = .35; out.connect(sg); sg.connect(send);
      var vg = ctx.createGain(); vg.gain.value = .9; out.connect(vg); vg.connect(reverb());
      /* struck crystal: glass-bowl partials; the slightly detuned pair beats slowly, so the tone pulses
         and fades out like ripples spreading on a pond */
      [[1, .15, 6.5], [1.0026, .09, 6.0], [2.32, .04, 3.4], [4.25, .022, 1.9], [6.63, .011, 1.0], [9.38, .006, .5]].forEach(function (h) {
        var o = ctx.createOscillator(), a = ctx.createGain();
        o.type = "sine"; o.frequency.value = f * h[0];
        a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(h[1], t + .006);
        a.gain.exponentialRampToValueAtTime(.0001, t + h[2]);
        o.connect(a); a.connect(out); o.start(t); o.stop(t + h[2] + .05);
      });
    }
  };

  /* Mobile browsers only unlock audio inside a finished gesture (touchend / click / key), not during a
     slider drag or on pointerdown. So on every such gesture, if sound is meant to be on, (re)start it. */
  var unlocked = false;
  function kick() {
    if (!on || !ctx) return;
    if (!unlocked) {   /* a silent one-sample blip inside the gesture unlocks Web Audio on older iOS */
      try { var s0 = ctx.createBufferSource(); s0.buffer = ctx.createBuffer(1, 1, 22050); s0.connect(ctx.destination); s0.start(0); unlocked = true; } catch (e) {}
    }
    if (ctx.state !== "running" && ctx.resume) ctx.resume();
    if (bedEl && bedEl.paused) { var pr = bedEl.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }
  ["touchend", "pointerup", "click", "keydown", "change"].forEach(function (n) { document.addEventListener(n, kick, true); });
  label();
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !on) return;
    if (document.hidden) { ctx.suspend(); if (bedEl) bedEl.pause(); } else { ctx.resume(); if (bedEl) bedEl.play().catch(function () {}); }
  });

  /* returning visitors who chose sound: start on their first tap/key (autoplay rules need a gesture) */
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "1" || (saver && saved === null)) {
    var arm = function (e) {
      if (ui.contains(e.target)) { cleanup(); return; }
      cleanup(); if (!on) set(true, false); kick();
      if (pend && performance.now() - pend[2] < 800) { var q = pend; pend = null; setTimeout(function () { M1Sound.tone(q[0], q[1], q[3]); }, 30); }
    };
    armed = true;
    var cleanup = function () { armed = false; ["touchend", "pointerup", "keydown"].forEach(function (n) { document.removeEventListener(n, arm, true); }); };
    ["touchend", "pointerup", "keydown"].forEach(function (n) { document.addEventListener(n, arm, true); });
  }
})();
