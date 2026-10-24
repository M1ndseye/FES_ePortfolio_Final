/* About page: portraits of Steve that shatter into refracting crystal shards and reform as the next portrait.
   Raw WebGL1, one fragment shader. Click, tap or use the dots to trigger it from that spot; it also runs on its own. */
(function () {
  var root = document.getElementById("crystal");
  if (!root) return;
  var SHOTS = [
    { src: "assets/steve/plaid.webp", alt: "Steve Padilla in a red plaid flannel shirt, arms crossed" },
    { src: "assets/steve/floral.webp", alt: "Steve Padilla in a black floral shirt, arms crossed" },
    { src: "assets/steve/burgundy.webp", alt: "Steve Padilla in a burgundy suit, arms crossed" },
    { src: "assets/steve/navy.webp", alt: "Steve Padilla in a navy suit, arms crossed" },
    { src: "assets/steve/vest.webp", alt: "Steve Padilla in a red vest and denim jacket, arms crossed" }
  ];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fb = root.querySelector(".crystal__fb");
  var dots = [].slice.call(root.querySelectorAll(".crystal__dot"));
  var MIX = .72, cur = 0, mixc = MIX, mixn = MIX, busy = false, visible = true, auto = null;

  function mark(i) {
    dots.forEach(function (d, k) { d.setAttribute("aria-current", k === i ? "true" : "false"); });
    if (fb) fb.alt = SHOTS[i].alt;
  }
  mark(0);

  /* ---------- fallback: simple crossfade (no WebGL, or reduced motion) ---------- */
  function startFallback() {
    var imgs = [fb];
    SHOTS.forEach(function (s, i) {
      if (i === 0) return;
      var im = new Image(); im.src = s.src; im.alt = ""; im.className = "crystal__fb"; im.setAttribute("aria-hidden", "true"); im.style.opacity = 0;
      root.insertBefore(im, root.querySelector(".crystal__dots")); imgs.push(im);
    });
    imgs.forEach(function (im) { im.style.transition = reduce ? "none" : "opacity .7s"; });
    function go(i) {
      imgs.forEach(function (im, k) { im.style.opacity = k === i ? 1 : 0; });
      cur = i; mark(i);
    }
    dots.forEach(function (d, k) { d.addEventListener("click", function () { go(k); }); });
    root.addEventListener("click", function (e) { if (!e.target.closest(".crystal__dot")) go((cur + 1) % SHOTS.length); });
  }

  var cv = root.querySelector("canvas");
  var gl = cv && cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl || reduce) { if (cv) cv.hidden = true; startFallback(); return; }

  /* ---------- shader ---------- */
  var VS = "attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }";
  var FS = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D u0, u1, u2, u3, u4;",
    "uniform float uT, uAsp, uPtrOn, uCur, uNxt, uMixC, uMixN;",
    "uniform vec2 uOrg, uPtr;",
    "vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }",
    "float h1(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5453); }",
    "float inb(vec2 q){ return step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.); }",
    "vec4 sm(float k, vec2 q){",
    "  vec4 c;",
    "  if(k<.5) c = texture2D(u0,q); else if(k<1.5) c = texture2D(u1,q); else if(k<2.5) c = texture2D(u2,q); else if(k<3.5) c = texture2D(u3,q); else c = texture2D(u4,q);",
    "  return c*inb(q);",
    "}",
    "// which portrait a facet shows when the whole is 'base': most facets show base, some show another Steve",
    "float facetShot(vec2 cid, float base, float mixAmt){",
    "  float r = h1(cid+4.3);",
    "  float alt = mod(base + 1. + floor(h1(cid+9.1)*4.), 5.);",
    "  return r < mixAmt ? alt : base;",
    "}",
    "vec2 vid(vec2 pp){",
    "  vec2 ip = floor(pp), fp = fract(pp); float dm = 9.; vec2 id = ip;",
    "  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){",
    "    vec2 g = vec2(float(i),float(j)); float d = length(g+h2(ip+g)*.84+.08-fp);",
    "    if(d<dm){ dm=d; id=ip+g; }",
    "  }",
    "  return id;",
    "}",
    "// caustic: every facet bends the key light (Snell) and lands, shifted, on the plane behind the crystal.",
    "// a pixel's brightness is how many shifted facets cover it: 0 = shadow, 1 = plain light, 2+ = focused light.",
    "float cover(vec2 p, vec2 here, vec3 L, float depth, float ior){",
    "  float cnt = 0.;",
    "  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){",
    "    if(abs(float(i))+abs(float(j)) > 1.5) continue;",
    "    vec2 f = here + vec2(float(i),float(j));",
    "    vec2 nf = (h2(f+7.3)-.5)*2.;",
    "    vec3 R = refract(-L, normalize(vec3(nf*.55,1.)), ior);",
    "    vec2 off = R.xy/max(-R.z,.25)*depth;",
    "    cnt += step(length(vid(p-off)-f),.1);",
    "  }",
    "  return cnt;",
    "}",
    "void main(){",
    "  float S = 3.6;",
    "  vec2 asp = vec2(uAsp,1.);",
    "  vec2 p = vUv*asp*S;",
    "  vec2 ip = floor(p), fp = fract(p);",
    "  float d1 = 9., d2 = 9.; vec2 cid = ip, cc = ip;",
    "  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){",
    "    vec2 g = vec2(float(i),float(j)); vec2 o = h2(ip+g)*.84+.08;",
    "    float d = length(g+o-fp);",
    "    if(d<d1){ d2=d1; d1=d; cid=ip+g; cc=ip+g+o; } else if(d<d2){ d2=d; }",
    "  }",
    "  float edge = d2-d1;",
    "  vec2 c = cc/S/asp;",
    "  vec2 hs = h2(cid+7.3);",
    "  vec2 n = (hs-.5)*2.;",
    "  // the wave: each facet tips, flashes, and comes back showing its portrait for the next whole",
    "  float dd = length((c-uOrg)*asp);",
    "  float local = clamp((uT*1.5 - dd*.8 - hs.x*.15)/.5, 0., 1.);",
    "  float s = sin(local*3.14159);",
    "  float k = local < .5 ? facetShot(cid,uCur,uMixC) : facetShot(cid,uNxt,uMixN);",
    "  // refraction: each facet bends the view a little, more as the light (pointer) moves and as it tips",
    "  vec2 t = (uPtr-.5)*uPtrOn;",
    "  vec2 off = n*.008 + t*(hs.yx-.5)*.05 + n*.07*s;",
    "  vec2 disp = n*(.004 + .012*s) + t*.006;",
    "  vec2 q = c + (vUv-c)*(1.+s*.07) + off;",
    "  vec4 cr = sm(k,q+disp), cg = sm(k,q), cb = sm(k,q-disp);",
    "  vec4 col = vec4(cr.r, cg.g, cb.b, max(max(cr.a,cg.a),cb.a));",
    "  // facet light: a fixed key light that swings toward the pointer",
    "  vec3 L = normalize(vec3(-.45+t.x*1.4, .5+t.y*1.4, .75));",
    "  float lit = dot(normalize(vec3(n*.5,1.)), L);",
    "  col.rgb *= 1. + (lit-.72)*(.55+.9*s);",
    "  float vis = smoothstep(0.,.5,col.a);",
    "  float near = uPtrOn * smoothstep(.45,0.,length((vUv-uPtr)*asp));",
    "  float glow = .22 + .6*s + .5*near;",
    "  float gap = 1.-smoothstep(0.,.012,edge);",
    "  float flank = (1.-smoothstep(.008,.07,edge));",
    "  vec3 tint = mix(vec3(.44,.61,1.), vec3(1.,.66,.3), h1(cid));",
    "  float dep = .85 + .9*s;",
    "  float cR = cover(p, cid, L, dep*1.0, .62), cB = cover(p, cid, L, dep*1.0, .72);",
    "  vec3 cv = vec3(cR, .5*(cR+cB), cB);",
    "  float amt = (.1 + .4*(local < .5 ? uMixC : uMixN)) + .7*s + .5*near;",
    "  float caus = pow(max(lit,0.),7.)*(.25+.5*s+.4*near);",
    "  vec3 rgb = col.rgb;",
    "  rgb = mix(rgb, rgb*.35, gap*.8*vis);",
    "  float cm = .5*(cR+cB);",
    "  rgb *= 1. + (cm-1.)*.22*amt;",
    "  vec3 focus = max(cm-1.,0.)*vec3(.5,.6,.85) + (cv-cm)*.1;",
    "  rgb += (focus*amt*.55 + tint*flank*glow*.5 + vec3(1.,.97,.9)*(caus*.4 + gap*glow*.7))*vis;",
    "  float a = clamp(col.a + (flank*glow*.25 + caus*.3)*vis, 0., 1.);",
    "  gl_FragColor = vec4(rgb*min(1.,a/max(col.a,.001)), a);",
    "}"
  ].join("\n");

  function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { cv.hidden = true; startFallback(); return; }
  var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.hidden = true; startFallback(); return; }
  gl.useProgram(pr);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ["u0", "u1", "u2", "u3", "u4", "uT", "uAsp", "uPtrOn", "uOrg", "uPtr", "uCur", "uNxt", "uMixC", "uMixN"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
  for (var u = 0; u < 5; u++) gl.uniform1i(U["u" + u], u);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.clearColor(0, 0, 0, 0);

  var texs = [], loaded = 0, ready = false, ASP = 900 / 1300;
  SHOTS.forEach(function (s, i) {
    var im = new Image(); im.decoding = "async";
    im.onload = function () {
      gl.activeTexture(gl.TEXTURE0 + i); var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      texs[i] = t; loaded++;
      if (loaded === SHOTS.length) { ready = true; root.classList.add("is-gl"); size(); draw(); scheduleAuto(); }
    };
    im.onerror = function () { cv.hidden = true; startFallback(); };
    im.src = s.src;
  });

  var T = 0, nxt = 0, org = [.5, .3], ptr = [.5, .5], ptrOn = 0, ptrTarget = 0, raf = 0, t0 = 0, DUR = 2300;
  function size() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
  }
  function draw() {
    if (!ready) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uT, T); gl.uniform1f(U.uAsp, ASP); gl.uniform1f(U.uCur, cur); gl.uniform1f(U.uMixC, mixc); gl.uniform1f(U.uNxt, busy ? nxt : cur); gl.uniform1f(U.uMixN, busy ? mixn : mixc);
    gl.uniform1f(U.uPtrOn, ptrOn); gl.uniform2f(U.uOrg, org[0], org[1]); gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) {
    raf = 0;
    ptrOn += (ptrTarget - ptrOn) * .12;
    if (busy && !frozen) {
      T = Math.min(1, (now - t0) / DUR);
      if (T >= 1) { cur = nxt; mixc = mixn; busy = false; T = 0; mark(cur); }
    }
    draw(now);
    if (busy || Math.abs(ptrTarget - ptrOn) > .01) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && ready) raf = requestAnimationFrame(loop); }


  /* ---------- sound: a crack, shards clicking apart and back together, and a low hum, only when someone pushes it ---------- */
  var AC = window.AudioContext || window.webkitAudioContext, ac = null, master = null, noiseBuf = null, soundOn = true;
  try { soundOn = localStorage.getItem("crystalSound") !== "off"; } catch (e) {}
  var sndBtn = document.createElement("button");
  sndBtn.type = "button"; sndBtn.className = "crystal__snd";
  function paintSnd() {
    sndBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    sndBtn.setAttribute("aria-label", soundOn ? "Sound on. Turn crystal sound off" : "Sound off. Turn crystal sound on");
    sndBtn.innerHTML = soundOn
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  }
  paintSnd();
  if (AC) {
    root.appendChild(sndBtn);
    sndBtn.addEventListener("click", function (e) {
      e.stopPropagation(); soundOn = !soundOn; paintSnd();
      try { localStorage.setItem("crystalSound", soundOn ? "on" : "off"); } catch (er) {}
      if (soundOn) sfx(.5);
    });
  }
  function sfx(x) {
    if (!AC || !soundOn) return;
    try {
      if (!ac) {
        ac = new AC(); master = ac.createGain(); master.gain.value = .55;
        var comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * .25, ac.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var n = 0; n < d.length; n++) d[n] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
      var t = ac.currentTime + .02, pan = Math.max(-1, Math.min(1, (x - .5) * 1.4));
      function out(g) {
        if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
      }
      /* a short glass click: filtered noise plus a tiny resonant tick */
      function click(at, vol, freq, q, tickF) {
        var src = ac.createBufferSource(); src.buffer = noiseBuf;
        var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
        var g = ac.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + .035 + Math.random() * .03);
        src.connect(bp); bp.connect(g); out(g); src.start(at, Math.random() * .15); src.stop(at + .09);
        if (tickF) {
          var o = ac.createOscillator(), tg = ac.createGain(); o.type = "sine"; o.frequency.value = tickF;
          tg.gain.setValueAtTime(vol * .35, at); tg.gain.exponentialRampToValueAtTime(.0001, at + .05);
          o.connect(tg); out(tg); o.start(at); o.stop(at + .07);
        }
      }
      /* the fracture: one hard crack, then shards scattering */
      click(t, .5, 3800, .7, 0);
      click(t + .012, .3, 1700, 1.2, 640);
      for (var k = 0; k < 14; k++) {
        var at = t + .05 + Math.pow(Math.random(), 1.4) * .6;
        click(at, .09 + Math.random() * .16, 2200 + Math.random() * 4800, 2 + Math.random() * 5, Math.random() < .5 ? 1800 + Math.random() * 2600 : 0);
      }
      /* the reassembly: clicks that speed up as the shards lock into place, then a soft settle */
      var rt = t + .75, gap = .17;
      for (var j = 0; j < 16; j++) {
        click(rt, .12 + j * .008, 2600 + Math.random() * 3200, 3 + Math.random() * 4, Math.random() < .6 ? 2200 + Math.random() * 2200 : 0);
        rt += gap; gap = Math.max(.028, gap * .8);
      }
      click(rt + .02, .42, 1500, .9, 520);
      var th = ac.createOscillator(), thg = ac.createGain(); th.type = "sine"; th.frequency.setValueAtTime(150, rt); th.frequency.exponentialRampToValueAtTime(70, rt + .14);
      thg.gain.setValueAtTime(.22, rt); thg.gain.exponentialRampToValueAtTime(.0001, rt + .22); th.connect(thg); out(thg); th.start(rt); th.stop(rt + .25);
      /* the hum */
      var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
      var hg = ac.createGain(); hg.gain.setValueAtTime(.0001, t); hg.gain.exponentialRampToValueAtTime(.06, t + .5); hg.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
      [[98, "sine", 0], [147.2, "triangle", 4], [196.5, "sine", -5]].forEach(function (h) {
        var o = ac.createOscillator(); o.type = h[1]; o.frequency.value = h[0]; o.detune.value = h[2]; o.connect(lp); o.start(t); o.stop(t + 2.5);
      });
      lp.connect(hg); out(hg);
    } catch (e) {}
  }

  var frozen = (location.search.match(/crystalT=([\d.]+)/) || [])[1];
  function go(i, from, mx, audible) {
    mx = mx === undefined ? MIX : mx;
    if (!ready || busy || (i === cur && mx === mixc)) return;
    if (audible) sfx((from || [.5])[0]);
    mixn = mx;
    nxt = i; org = from || [.5, .3];
     busy = true; T = frozen ? parseFloat(frozen) : 0; t0 = performance.now();
    mark(i); draw(performance.now()); kick(); scheduleAuto();
  }
  function step(from, audible) { go((cur + 1) % SHOTS.length, from, MIX, audible); }
  function scheduleAuto() {
    clearTimeout(auto);
    auto = setTimeout(function () {
      if (visible && !document.hidden) step([.5 + (Math.random() - .5) * .3, .22 + Math.random() * .2]);
      else scheduleAuto();
    }, 5500);
  }
  function uvOf(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; }

  cv.addEventListener("pointerdown", function (e) { step(uvOf(e), true); });
  cv.addEventListener("pointermove", function (e) { ptr = uvOf(e); ptrTarget = 1; kick(); });
  cv.addEventListener("pointerleave", function () { ptrTarget = 0; kick(); });
  dots.forEach(function (d, k) {
    d.addEventListener("click", function () {
      var r = d.getBoundingClientRect(), c = cv.getBoundingClientRect();
      go(k, [Math.min(1, Math.max(0, (r.left + r.width / 2 - c.left) / c.width)), 0.04], MIX, true);
    });
  });
  window.addEventListener("resize", function () { if (ready) { size(); draw(); } });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: .15 }).observe(root);
  cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); ready = false; root.classList.remove("is-gl"); });
  cv.addEventListener("webglcontextrestored", function () { location.reload(); });
})();
