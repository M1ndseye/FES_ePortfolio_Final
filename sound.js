/* M1ndseye home: optional sound. Crystal Cavern bed + pointer-driven crystal swell (short licensed samples in assets/audio).
   Off until the visitor turns it on in the gear (settings) modal (browsers block autoplay anyway).
   Preference remembered in localStorage. */
(function () {
  var host = document.querySelector(".gaze-foot");
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!host || !AC) return;

  var KEY = "m1ndseye-sound";
  var ctx = null, on = false, speed = 0, lastX = null, lastY = null, lastT = 0;
  var master = null;

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
      '<a class="setm__row" href="eye.html?from=home"><span>Eye screensaver<small>Full-screen mechanical eye</small></span><span class="setm__go" aria-hidden="true">&rarr;</span></a>' +
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

  function label() {
    sw.setAttribute("aria-checked", on ? "true" : "false");
    btn.classList.toggle("is-on", on);
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
      master.gain.setTargetAtTime(.9, ctx.currentTime, .8);   /* slow fade-in */
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .25);
      setTimeout(function () { if (!on && ctx) { if (bedEl) bedEl.pause(); if (ctx.suspend) ctx.suspend(); } }, 1500);
    }
    if (remember) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
    label();
  }
  sw.addEventListener("click", function () { set(!on, true); });
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !on) return;
    if (document.hidden) { ctx.suspend(); if (bedEl) bedEl.pause(); } else { ctx.resume(); if (bedEl) bedEl.play().catch(function () {}); }
  });

  /* returning visitors who chose sound: start on their first tap/key (autoplay rules need a gesture) */
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "1") {
    var arm = function (e) {
      if (btn.contains(e.target) || modal.contains(e.target)) { cleanup(); return; }
      cleanup(); if (!on) set(true, false);
    };
    var cleanup = function () { ["pointerdown", "keydown"].forEach(function (n) { document.removeEventListener(n, arm, true); }); };
    ["pointerdown", "keydown"].forEach(function (n) { document.addEventListener(n, arm, true); });
  }
})();
