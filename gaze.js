/* M1ndseye home: the eye follows the pointer; caustic light follows the eye.
   Eight photographed gaze directions are cross-faded by angle. Caustics are a WebGL shader. */
(function () {
  var stage = document.querySelector(".gaze-stage");
  var eye = document.getElementById("eye");
  var cv = document.getElementById("caustics");
  if (!stage || !eye) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var imgs = eye.querySelectorAll("img");           // order: E, SE, S, SW, W, NW, N, NE (clockwise from east)
  var doors = { left: document.querySelector(".door--left"), right: document.querySelector(".door--right") };

  /* ---------- gaze state ---------- */
  var tx = .35, ty = .05, gx = .35, gy = .05, dirx = 1, diry = 0, lastMove = -1e9, energy = 0, phase = 6, running = true;
  var cx = 0, cy = 0, R = 400, ptrX = 0, ptrY = 0, rawX = 0, rawY = 0, pull = 0;
  function measure() {
    var r = eye.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    R = Math.max(window.innerWidth * .34, 320);
  }
  measure();
  window.addEventListener("resize", function () { measure(); sizeGL(); });
  window.addEventListener("scroll", measure, { passive: true });

  window.addEventListener("pointermove", function (e) {
    var dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R, len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; len = 1; }
    if (len > .08) { dirx = dx / len; diry = dy / len; tx = dx; ty = dy; }
    else { tx = dirx * len; ty = diry * len; }           // dead zone: keep the last direction instead of flipping
    rawX = e.clientX; rawY = e.clientY; lastMove = performance.now();
    if (reduce) { gx = tx; gy = ty; frame(performance.now(), 0); }
  }, { passive: true });

  /* courtroom door: the same deposition clip that opens the courtroom page, loaded on first interest */
  var veilVideo = null;
  function courtVideo(play) {
    if (reduce || !doors.left) return;
    if (!veilVideo) {
      if (!play) return;
      veilVideo = document.createElement("video");
      veilVideo.muted = true; veilVideo.loop = true; veilVideo.playsInline = true; veilVideo.preload = "auto";
      veilVideo.setAttribute("playsinline", ""); veilVideo.setAttribute("aria-hidden", "true");
      veilVideo.src = "assets/_Jane_Doe_Depo_Clip_.mp4";
      doors.left.querySelector(".door__veil").appendChild(veilVideo);
    }
    if (play) { var p = veilVideo.play(); if (p && p.catch) p.catch(function () {}); } else veilVideo.pause();
  }
  if (doors.left) {
    ["mouseenter", "focus"].forEach(function (ev) { doors.left.addEventListener(ev, function () { courtVideo(true); }); });
    if ("IntersectionObserver" in window && window.matchMedia("(max-width: 860px)").matches)
      new IntersectionObserver(function (e) { courtVideo(e[0].isIntersecting); }, { threshold: .3 }).observe(doors.left);
  }

  /* educational door: the workbook commercial (vertical, compressed for the web), loaded on first interest */
  var eduV = null;
  function eduVideo(play) {
    if (reduce || !doors.right) return;
    if (!eduV) {
      if (!play) return;
      eduV = document.createElement("video");
      eduV.muted = true; eduV.loop = true; eduV.playsInline = true; eduV.preload = "auto";
      eduV.setAttribute("playsinline", ""); eduV.setAttribute("aria-hidden", "true");
      eduV.src = "assets/ME_Vid_Workbook_Door.mp4";
      doors.right.querySelector(".door__veil").appendChild(eduV);
    }
    if (play) { var p = eduV.play(); if (p && p.catch) p.catch(function () {}); } else eduV.pause();
  }
  if (doors.right) {
    ["mouseenter", "focus"].forEach(function (ev) { doors.right.addEventListener(ev, function () { eduVideo(true); }); });
    if ("IntersectionObserver" in window && window.matchMedia("(max-width: 860px)").matches)
      new IntersectionObserver(function (e) { eduVideo(e[0].isIntersecting); }, { threshold: .3 }).observe(doors.right);
  }

  var gazed = { left: false, right: false };
  function setEye() {
    var ang = Math.atan2(gy, gx); if (ang < 0) ang += Math.PI * 2;
    var idx = ang / (Math.PI / 4), i0 = Math.floor(idx) % 8, i1 = (i0 + 1) % 8, f = idx - Math.floor(idx);
    f = f * f * (3 - 2 * f);
    for (var i = 0; i < 8; i++) imgs[i].style.opacity = i === i0 ? 1 : (i === i1 ? f : 0);
    var m = Math.min(1, Math.sqrt(gx * gx + gy * gy));
    eye.style.transform = "perspective(1400px) translate3d(" + (gx * 18) + "px," + (gy * 12) + "px,0) rotateY(" + (gx * 7) + "deg) rotateX(" + (-gy * 5) + "deg) scale(" + (1 + m * .015) + ")";
    var L = gx < -.42, Rr = gx > .42;
    if (L !== gazed.left && doors.left) { gazed.left = L; doors.left.classList.toggle("is-gazed", L); courtVideo(L); }
    if (Rr !== gazed.right && doors.right) { gazed.right = Rr; doors.right.classList.toggle("is-gazed", Rr); eduVideo(Rr); }
  }

  /* ---------- caustics (WebGL) ---------- */
  var gl = cv && cv.getContext("webgl", { antialias: false, alpha: false }), U = {};
  if (gl) {
    var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
    var FS = [
      "precision highp float;",
      "uniform vec2 uRes; uniform float uPhase; uniform vec2 uCenter; uniform float uR; uniform vec2 uPtr; uniform float uPull; uniform float uEnergy; uniform float uTint;",
      "const float PI = 3.14159265;",
      "float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
      "float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);",
      "  return mix(mix(h(i), h(i+vec2(1.,0.)), f.x), mix(h(i+vec2(0.,1.)), h(i+vec2(1.,1.)), f.x), f.y); }",
      "float caust(vec2 uv, float t){",
      "  vec2 p = mod(uv*6.28318530718, 6.28318530718) - 250.0;",
      "  vec2 i = p; float c = 1.0; const float inten = .005;",
      "  for (int n = 0; n < 5; n++) {",
      "    float tt = t*(1.0 - (3.5/float(n+1)));",
      "    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));",
      "    c += 1.0/length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten)));",
      "  }",
      "  c /= 5.0; c = 1.17 - pow(c, 1.4);",
      "  return pow(abs(c), 8.0);",
      "}",
      "// one family of filaments: x is the lane coordinate, wobble bends the lanes, flicker switches them on and off",
      "float lanes(float x, float wob, float seed, float t){",
      "  x += wob;",
      "  float id = floor(x), g = abs(fract(x) - .5);",
      "  float on = smoothstep(.30, .62, vn(vec2(id*3.17 + seed, t*.55)));",
      "  return exp(-g*g*520.) * on;",
      "}",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / uRes;",
      "  vec2 p = (uv - .5) * vec2(uRes.x/uRes.y, 1.) - uCenter;",
      "  float r = length(p), th = atan(p.y, p.x);",
      "  // the touch point on the glass: the pointer, held to the surface of the ball",
      "  vec2 q = uPtr; float qr = length(q); if (qr > uR) q *= uR/qr; qr = length(q);",
      "  float thp = atan(q.y, q.x);",
      "  float d = th - thp; d = mod(d + PI, 2.*PI) - PI;",
      "  float t = uPhase;",
      "  // free filaments: slow radial tendrils from the electrode",
      "  float wf = (vn(vec2(r*5. + t*.45, th*2.6)) - .5) * 2.6 * smoothstep(0., uR, r);",
      "  float free1 = lanes(th*13./(2.*PI), wf, 1., t) + .55*lanes(th*23./(2.*PI), wf*1.4, 7., t*1.3);",
      "  float freeFade = smoothstep(.0, uR*.35, r) * (1. - smoothstep(uR*.55, uR*.98, r));",
      "  // touch bundle: the lanes crowd toward the touch point and end there",
      "  float pinch = uPull * smoothstep(.0, max(qr, .05), r);",
      "  float dE = d / (1. - .94*pinch);",
      "  float wb = (vn(vec2(r*7. - t*.9, dE*2. + t*.3)) - .5) * (1.2 + 3.*uEnergy) * pinch;",
      "  float bund = lanes(dE*9./(2.*PI), wb, 3., t*1.6);",
      "  float angMask = smoothstep(mix(1.7, .30, uPull), 0., abs(d));",
      "  float endMask = smoothstep(qr + .02, qr - .05, r) * smoothstep(.0, uR*.3, r);",
      "  float touch = bund * angMask * endMask * uPull;",
      "  float fil = free1 * freeFade * (.6 - .35*uPull) + touch * 1.15;",
      "  // hot spot, halo and a ripple where the glass is touched",
      "  float dp = length(p - q);",
      "  float hot = exp(-dp*dp*1400.) * uPull;",
      "  float halo = exp(-dp*7.) * .22 * uPull;",
      "  float ripple = exp(-pow((dp - fract(t*.32)*.2)*45., 2.)) * .35 * uPull * (1. - fract(t*.32));",
      "  // the glass: soft rim, faint inner sheen, a highlight on the upper left",
      "  float rim = exp(-pow((r - uR)*170., 2.)) * .16 + smoothstep(uR, uR*.2, r) * .04;",
      "  float spec = pow(max(0., dot(normalize(p + 1e-4), normalize(vec2(-.6, .8)))), 22.) * exp(-pow((r - uR*.94)*34., 2.)) * .22;",
      "  float amb = caust(p*1.1 + .15, t*.6) * .07 * exp(-r*1.6);",
      "  vec3 sapph = vec3(.18,.42,1.), amber = vec3(1.,.62,.24);",
      "  vec3 tint = mix(sapph, amber, clamp(uTint, 0., 1.));",
      "  vec3 col = vec3(.015,.025,.06) + tint*(.05*exp(-r*2.2) + fil*1.0 + halo + rim + amb + ripple) + vec3(.8,.9,1.)*(hot*.9 + fil*.22 + spec);",
      "  col = 1. - exp(-col*1.3);",
      "  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453) - .5) / 255.;",
      "  gl_FragColor = vec4(col, 1.);",
      "}"
    ].join("\n");
    var mk = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.error("caustics:", gl.getShaderInfoLog(o)); return null; } return o; };
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS), pr = gl.createProgram();
    if (vs && fs) {
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
        gl.useProgram(pr);
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        ["uRes","uPhase","uCenter","uR","uPtr","uPull","uEnergy","uTint"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
      } else { console.error(gl.getProgramInfoLog(pr)); gl = null; }
    } else gl = null;
  }
  function sizeGL() {
    if (!gl) return;
    var scale = Math.min(window.devicePixelRatio || 1, 2) * .5;
    var w = Math.max(2, Math.round(stage.clientWidth * scale)), h = Math.max(2, Math.round(stage.clientHeight * scale));
    var cap = 800000; if (w * h > cap) { var k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }
  sizeGL();
  function drawGL() {
    if (!gl) return;
    var sr = stage.getBoundingClientRect(), H = sr.height || 1;
    var ecx = ((cx - sr.left) - sr.width / 2) / H, ecy = -((cy - sr.top) - sr.height / 2) / H;
    var eyeW = eye.offsetWidth || 700;
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uPhase, phase);
    gl.uniform2f(U.uCenter, ecx, ecy); gl.uniform1f(U.uR, eyeW * .56 / H);
    gl.uniform2f(U.uPtr, ((ptrX - sr.left) - sr.width / 2) / H - ecx, -((ptrY - sr.top) - sr.height / 2) / H - ecy);
    gl.uniform1f(U.uPull, pull); gl.uniform1f(U.uEnergy, energy); gl.uniform1f(U.uTint, .5 + gx * .45);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- loop ---------- */
  var prev = 0;
  function frame(now, dtOverride) {
    var dt = dtOverride !== undefined ? dtOverride : Math.min(.05, (now - prev) / 1000 || .016); prev = now;
    if (!reduce && now - lastMove > 3500) { tx = Math.cos(now * .0004) * .7; ty = Math.sin(now * .00031) * .45; }
    var px = gx, py = gy, k = reduce ? 1 : 1 - Math.pow(.0009, dt);   // time-corrected easing
    gx += (tx - gx) * k; gy += (ty - gy) * k;
    var speed = dt > 0 ? Math.sqrt((gx - px) * (gx - px) + (gy - py) * (gy - py)) / dt : 0;
    energy += (Math.min(1, speed * .8) - energy) * .1;
    if (!reduce) phase += dt * (.35 + energy * 3);
    var touching = now - lastMove < 2600, pk = reduce ? 1 : 1 - Math.pow(.02, dt);
    pull += ((touching ? 1 : 0) - pull) * pk;
    if (!touching) { rawX = cx + gx * R; rawY = cy + gy * R * .7; }
    var qk = reduce ? 1 : 1 - Math.pow(.0005, dt); ptrX += (rawX - ptrX) * qk; ptrY += (rawY - ptrY) * qk;
    setEye(); drawGL();
  }
  function loop(now) { if (running) frame(now); requestAnimationFrame(loop); }
  frame(performance.now(), 0);
  if (!reduce) requestAnimationFrame(loop);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting && !document.hidden; }).observe(stage);
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });
})();
