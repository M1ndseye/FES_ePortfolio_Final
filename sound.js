/* M1ndseye home: optional ambient synth + saber hum that follows pointer speed.
   Off until the visitor taps the Sound button (browsers block autoplay anyway).
   Pure WebAudio, no files. Preference remembered in localStorage. */
(function () {
  var host = document.querySelector(".gaze-foot");
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!host || !AC) return;

  var KEY = "m1ndseye-sound";
  var ctx = null, on = false, speed = 0, lastX = null, lastY = null, lastT = 0;
  var hum = null, master = null;

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
  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;

    /* lofi colour: gentle low-pass + soft saturation + tape-style delay */
    var tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 2400; tone.Q.value = .4;
    var sat = ctx.createWaveShaper(), c = new Float32Array(257);
    for (var i = 0; i < 257; i++) { var x = i / 128 - 1; c[i] = Math.tanh(1.6 * x); }
    sat.curve = c;
    var dly = ctx.createDelay(1); dly.delayTime.value = .42;
    var fb = ctx.createGain(); fb.gain.value = .38;
    var dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 1100;
    var wet = ctx.createGain(); wet.gain.value = .5;
    var wob = ctx.createOscillator(), wobG = ctx.createGain();
    wob.frequency.value = .35; wobG.gain.value = .004; wob.connect(wobG); wobG.connect(dly.delayTime); wob.start();
    var bus = ctx.createGain();
    bus.connect(sat); sat.connect(tone); tone.connect(master);
    tone.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(wet); wet.connect(master);
    master.connect(ctx.destination);

    /* ambient pad: detuned saws on an open A-minor stack, slow filter drift */
    var pad = ctx.createGain(); pad.gain.value = .075;
    var pf = ctx.createBiquadFilter(); pf.type = "lowpass"; pf.frequency.value = 420; pf.Q.value = 2.2;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = .07; lg.gain.value = 190; lfo.connect(lg); lg.connect(pf.frequency); lfo.start();
    [55, 82.41, 110, 164.81, 220].forEach(function (f, n) {
      [-7, 7].forEach(function (d) {
        var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d + n;
        var g = ctx.createGain(); g.gain.value = n > 2 ? .35 : 1;
        o.connect(g); g.connect(pf); o.start();
      });
    });
    pf.connect(pad); pad.connect(bus);

    /* soft tape hiss */
    var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (var k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    var ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 3200; nf.Q.value = .5;
    var ng = ctx.createGain(); ng.gain.value = .006;
    ns.connect(nf); nf.connect(ng); ng.connect(bus); ns.start();

    /* saber hum: two close saws beat against each other; speed opens the filter and lifts pitch */
    var h1 = ctx.createOscillator(), h2 = ctx.createOscillator(), hs = ctx.createOscillator();
    h1.type = h2.type = "sawtooth"; h1.frequency.value = 98; h2.frequency.value = 99.6;
    hs.type = "square"; hs.frequency.value = 49;
    var hf = ctx.createBiquadFilter(); hf.type = "lowpass"; hf.frequency.value = 260; hf.Q.value = 5;
    var hg = ctx.createGain(); hg.gain.value = .0;
    var tr = ctx.createOscillator(), trg = ctx.createGain();   /* slow shimmer */
    tr.frequency.value = 7.5; trg.gain.value = 6; tr.connect(trg); trg.connect(h1.detune); trg.connect(h2.detune); tr.start();
    var sg = ctx.createGain(); sg.gain.value = .5;
    h1.connect(hf); h2.connect(hf); hs.connect(sg); sg.connect(hf); hf.connect(hg); hg.connect(bus);
    h1.start(); h2.start(); hs.start();
    hum = { h1: h1, h2: h2, hs: hs, hf: hf, hg: hg };
    tick();
  }

  function tick() {
    if (!ctx) return;
    var now = performance.now();
    speed *= Math.pow(.5, (now - (tick.t || now)) / 260); tick.t = now; /* ~260 ms half-life */
    var s = Math.min(1, speed / 2.2), t = ctx.currentTime;
    hum.hg.gain.setTargetAtTime(.012 + .30 * s * s * (3 - 2 * s) , t, .06);
    hum.hf.frequency.setTargetAtTime(240 + 1700 * s, t, .08);
    var f = 98 * (1 + .22 * s);
    hum.h1.frequency.setTargetAtTime(f, t, .09);
    hum.h2.frequency.setTargetAtTime(f * 1.016, t, .09);
    hum.hs.frequency.setTargetAtTime(f / 2, t, .09);
    requestAnimationFrame(tick);
  }

  function move(e) {
    var now = performance.now();
    if (lastX !== null && now > lastT) {
      var v = Math.hypot(e.clientX - lastX, e.clientY - lastY) / (now - lastT); /* px per ms */
      speed = Math.max(speed, Math.min(v, 4) * .85) * .6 + speed * .4;
    }
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  }
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerleave", function () { lastX = null; });

  function set(v, remember) {
    on = v;
    if (v) {
      if (!ctx) build();
      if (ctx.resume) ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.9, ctx.currentTime, .8);   /* slow fade-in */
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .25);
      setTimeout(function () { if (!on && ctx && ctx.suspend) ctx.suspend(); }, 1500);
    }
    if (remember) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
    label();
  }
  btn.addEventListener("click", function () { set(!on, true); });
  document.addEventListener("visibilitychange", function () {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
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
