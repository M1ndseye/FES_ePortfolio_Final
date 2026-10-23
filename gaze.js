/* M1ndseye home: one prismatic glass eye, tilted in 3D toward the pointer, over a plasma-light background.
   Everything is drawn in a single WebGL shader so the background light is refracted by the glass itself. */
(function () {
  var stage = document.querySelector(".gaze-stage");
  var eye = document.getElementById("eye");
  var cv = document.getElementById("caustics");
  if (!stage || !eye) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fallbackImg = eye.querySelector("img");
  var doors = { left: document.querySelector(".door--left"), right: document.querySelector(".door--right") };
  var ASPECT = 1586 / 992;

  /* ---------- pointer / gaze state ---------- */
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
    else { tx = dirx * len; ty = diry * len; }
    rawX = e.clientX; rawY = e.clientY; lastMove = performance.now();
    if (reduce) { gx = tx; gy = ty; frame(performance.now(), 0); }
  }, { passive: true });

  /* ---------- doors: show text and play video when the eye turns toward them ---------- */
  function lazyVideo(door, src) {
    var v = null;
    return function (play) {
      if (reduce || !door) return;
      if (!v) {
        if (!play) return;
        v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true"); v.src = src;
        door.querySelector(".door__veil").appendChild(v);
      }
      if (play) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
    };
  }
  var courtVideo = lazyVideo(doors.left, "assets/ME_Sizzle_Door.mp4");
  var eduVideo = lazyVideo(doors.right, "assets/ME_Vid_Workbook_Door.mp4");
  [["left", courtVideo], ["right", eduVideo]].forEach(function (d) {
    var door = doors[d[0]], fn = d[1];
    if (!door) return;
    ["mouseenter", "focus"].forEach(function (ev) { door.addEventListener(ev, function () { fn(true); }); });
    if ("IntersectionObserver" in window && window.matchMedia("(max-width: 860px)").matches)
      new IntersectionObserver(function (e) { fn(e[0].isIntersecting); }, { threshold: .3 }).observe(door);
  });
  var gazed = { left: false, right: false };
  function setDoors() {
    var L = gx < -.42, Rr = gx > .42;
    if (L !== gazed.left && doors.left) { gazed.left = L; doors.left.classList.toggle("is-gazed", L); courtVideo(L); }
    if (Rr !== gazed.right && doors.right) { gazed.right = Rr; doors.right.classList.toggle("is-gazed", Rr); eduVideo(Rr); }
  }

  /* ---------- WebGL ---------- */
  var gl = cv && cv.getContext("webgl", { antialias: false, alpha: false }), U = {}, eyeReady = false;
  if (gl) {
    var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
    var FS = [
      "precision highp float;",
      "uniform sampler2D uEye;",
      "uniform vec2 uRes; uniform float uPhase; uniform vec2 uCenter; uniform vec2 uEyeSize; uniform float uR;",
      "uniform vec2 uPtr; uniform float uPull; uniform float uEnergy; uniform float uTint; uniform vec2 uGaze; uniform float uEyeOn;",
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
      "float lanes(float x, float wob, float seed, float t, float sc){",
      "  x += wob;",
      "  float id = floor(x), g = abs(fract(x) - .5);",
      "  float on = smoothstep(.30, .62, vn(vec2(id*3.17 + seed, t*.55)));",
      "  return exp(-g*g*sc*sc) * on;",
      "}",
      "// plasma light: tendrils from the eye, one bundle pulled toward the touch point; p is relative to the eye",
      "vec3 plasma(vec2 p){",
      "  float r = length(p), th = atan(p.y, p.x), t = uPhase;",
      "  vec2 q = uPtr; float qr = length(q);",
      "  float thp = atan(q.y, q.x);",
      "  float d = th - thp; d = mod(d + PI, 2.*PI) - PI;",
      "  float wf = (vn(vec2(r*5. + t*.45, th*2.6)) - .5) * 2.6 * smoothstep(0., uR, r);",
      "  float free1 = lanes(th*13./(2.*PI), wf, 1., t, 6.28*max(r,.15)/13./.011) + .55*lanes(th*23./(2.*PI), wf*1.4, 7., t*1.3, 6.28*max(r,.15)/23./.011);",
      "  float freeFade = smoothstep(.0, uR*.35, r) * (1. - smoothstep(uR*.7, uR*1.9, r)) / (1. + r*1.2);",
      "  float pinch = uPull * smoothstep(.0, max(qr, .05), r);",
      "  float dE = d / (1. - .94*pinch);",
      "  float wb = (vn(vec2(r*7. - t*.9, dE*2. + t*.3)) - .5) * (1.2 + 3.*uEnergy) * pinch;",
      "  float bund = lanes(dE*9./(2.*PI), wb, 3., t*1.6, 22.);",
      "  float angMask = smoothstep(mix(1.7, .30, uPull), 0., abs(d));",
      "  float endMask = smoothstep(qr + .02, qr - .05, r) * smoothstep(.0, uR*.3, r);",
      "  float touch = bund * angMask * endMask * uPull;",
      "  float fil = free1 * freeFade * (.5 - .3*uPull) + touch * 1.15;",
      "  float dp = length(p - q);",
      "  float hot = exp(-dp*dp*1400.) * uPull;",
      "  float halo = exp(-dp*7.) * .22 * uPull;",
      "  float ripple = exp(-pow((dp - fract(t*.32)*.2)*45., 2.)) * .35 * uPull * (1. - fract(t*.32));",
      "  float amb = caust(p*1.1 + .15, t*.6) * .07 * exp(-r*1.6);",
      "  vec3 sapph = vec3(.18,.42,1.), amber = vec3(1.,.62,.24);",
      "  vec3 tint = mix(sapph, amber, clamp(uTint, 0., 1.));",
      "  vec3 col = vec3(.015,.025,.06) + tint*(.05*exp(-r*2.2) + fil*1.0 + halo + amb + ripple) + vec3(.8,.9,1.)*(hot*.9 + fil*.22);",
      "  return 1. - exp(-col*1.3);",
      "}",
      "// bars of light that exist only to be bent by the glass",
      "vec3 bars(vec2 s, vec2 m){",
      "  vec3 c = vec3(0.);",
      "  vec2 a = vec2(cos(1.15), sin(1.15)), b = vec2(cos(-1.0), sin(-1.0)), e = vec2(cos(.3), sin(.3));",
      "  c += vec3(.45,.65,1.) * smoothstep(.05, 0., abs(dot(s - vec2(-.22,0.) - m, vec2(-a.y, a.x))));",
      "  c += vec3(1.,.66,.30) * smoothstep(.03, 0., abs(dot(s - vec2(.20,0.) + m*1.4, vec2(-b.y, b.x))));",
      "  c += vec3(1.) * .8 * smoothstep(.015, 0., abs(dot(s - vec2(-.05,0.) - m*.7, vec2(-e.y, e.x))));",
      "  return c;",
      "}",
      "float A(vec2 t){ return (t.x < 0. || t.x > 1. || t.y < 0. || t.y > 1.) ? 0. : texture2D(uEye, t).a; }",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / uRes;",
      "  vec2 p = (uv - .5) * vec2(uRes.x/uRes.y, 1.) - uCenter;",
      "  vec2 g = vec2(uGaze.x, -uGaze.y);",
      "  vec3 base = plasma(p);",
      "  vec3 col = base;",
      "  if (uEyeOn > .5) {",
      "    // the eye is a flat plate tilted in 3D toward the pointer",
      "    vec2 s = p / uEyeSize.x;",
      "    float ax = g.x * .26, ay = -g.y * .20;",
      "    float cxr = cos(ax), sxr = sin(ax), cyr = cos(ay), syr = sin(ay);",
      "    vec3 n = vec3(sxr*cyr, -syr, cxr*cyr);",
      "    float D = 3.2;",
      "    vec3 dir = vec3(s, -D);",
      "    float tt = -D*n.z / dot(n, dir);",
      "    vec3 hit = vec3(0., 0., D) + tt*dir;",
      "    // local plane coordinates: undo the rotation (Y then X)",
      "    vec3 l = vec3(cxr*hit.x - sxr*hit.z, hit.y, sxr*hit.x + cxr*hit.z);",
      "    l = vec3(l.x, cyr*l.y + syr*l.z, -syr*l.y + cyr*l.z);",
      "    vec2 t = vec2(l.x + .5, .5 - l.y * ASPECT_);",
      "    if (tt > 0. && t.x > 0. && t.x < 1. && t.y > 0. && t.y < 1.) {",
      "      vec4 e = texture2D(uEye, t);",
      "      float k1 = .004, k2 = .012;",
      "      vec2 g1 = vec2(A(t+vec2(k1,0.)) - A(t-vec2(k1,0.)), A(t+vec2(0.,k1)) - A(t-vec2(0.,k1)));",
      "      vec2 g2 = vec2(A(t+vec2(k2,0.)) - A(t-vec2(k2,0.)), A(t+vec2(0.,k2)) - A(t-vec2(0.,k2)));",
      "      vec2 gr = (g1*.7 + g2) * vec2(1., -1.);",
      "      float edge = clamp(length(gr)*1.6, 0., 1.);",
      "      float glass = clamp(e.a*(1. - e.a)*4., 0., 1.);",
      "      vec2 off = -gr * .035 + g*.012*glass;",
      "      vec3 bref;",
      "      bref.r = plasma(p + off*.8).r;",
      "      bref.g = plasma(p + off).g;",
      "      bref.b = plasma(p + off*1.45).b;",
      "      bref += bars(s, g*.05) * (.25 + .75*max(edge, glass)) * .55;",
      "      vec3 body = bref*(1. - e.a) + e.rgb;",
      "      // prismatic shimmer follows the pointer",
      "      float hu = dot(s, normalize(g + vec2(1e-3))) * 2.6 + uPhase*.05;",
      "      vec3 rb = .5 + .5*cos(6.28318*(hu + vec3(0., .33, .67)));",
      "      float lenG = min(1., length(g));",
      "      body += rb * max(edge, glass*.6) * (.10 + .30*lenG);",
      "      vec3 N = normalize(vec3(gr*5., 1.));",
      "      vec3 L = normalize(vec3(-g.x*1.1, g.y*1.1, .8));",
      "      float spec = pow(max(dot(N, normalize(L + vec3(0.,0.,1.))), 0.), 60.) * edge;",
      "      body += vec3(1.) * spec * .8;",
      "      col = mix(base, body, step(.001, max(e.a, dot(e.rgb, vec3(1.)))));",
      "    }",
      "  }",
      "  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453) - .5) / 255.;",
      "  gl_FragColor = vec4(col, 1.);",
      "}"
    ].join("\n").replace(/ASPECT_/g, "1.6");
    var mk = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.error("shader:", gl.getShaderInfoLog(o)); return null; } return o; };
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS), pr = gl.createProgram();
    if (vs && fs) {
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
        gl.useProgram(pr);
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        ["uEye","uRes","uPhase","uCenter","uEyeSize","uR","uPtr","uPull","uEnergy","uTint","uGaze","uEyeOn"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
        gl.uniform1i(U.uEye, 0);
        var tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var img = new Image();
        img.onload = function () {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          eyeReady = true; if (fallbackImg) fallbackImg.style.visibility = "hidden"; frame(performance.now(), 0);
        };
        img.src = "assets/eye/prismatic.webp";
      } else { console.error(gl.getProgramInfoLog(pr)); gl = null; }
    } else gl = null;
  }
  function sizeGL() {
    if (!gl) return;
    var cssW = stage.clientWidth, cssH = stage.clientHeight;
    var scale = Math.min(window.devicePixelRatio || 1, 2), cap = 2300000;
    if (cssW * cssH * scale * scale > cap) scale = Math.sqrt(cap / (cssW * cssH));
    var w = Math.max(2, Math.round(cssW * scale)), h = Math.max(2, Math.round(cssH * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }
  sizeGL();
  function drawGL() {
    if (!gl) return;
    var sr = stage.getBoundingClientRect(), H = sr.height || 1;
    var ecx = ((cx - sr.left) - sr.width / 2) / H, ecy = -((cy - sr.top) - sr.height / 2) / H;
    var boxW = eye.offsetWidth || 700;
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uPhase, phase);
    gl.uniform2f(U.uCenter, ecx, ecy); gl.uniform2f(U.uEyeSize, boxW / H, boxW / ASPECT / H);
    gl.uniform1f(U.uR, boxW * .5 / H);
    gl.uniform2f(U.uPtr, ((ptrX - sr.left) - sr.width / 2) / H - ecx, -((ptrY - sr.top) - sr.height / 2) / H - ecy);
    gl.uniform1f(U.uPull, pull); gl.uniform1f(U.uEnergy, energy); gl.uniform1f(U.uTint, .5 + gx * .45);
    gl.uniform2f(U.uGaze, gx, gy); gl.uniform1f(U.uEyeOn, eyeReady ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- loop ---------- */
  var prev = 0;
  function frame(now, dtOverride) {
    var dt = dtOverride !== undefined ? dtOverride : Math.min(.05, (now - prev) / 1000 || .016); prev = now;
    if (!reduce && now - lastMove > 3500) { tx = Math.cos(now * .0004) * .7; ty = Math.sin(now * .00031) * .45; }
    var px = gx, py = gy, k = reduce ? 1 : 1 - Math.pow(.0009, dt);
    gx += (tx - gx) * k; gy += (ty - gy) * k;
    var speed = dt > 0 ? Math.sqrt((gx - px) * (gx - px) + (gy - py) * (gy - py)) / dt : 0;
    energy += (Math.min(1, speed * .8) - energy) * .1;
    if (!reduce) phase += dt * (.35 + energy * 3);
    var touching = now - lastMove < 2600, pk = reduce ? 1 : 1 - Math.pow(.02, dt);
    pull += ((touching ? 1 : 0) - pull) * pk;
    if (!touching) { rawX = cx + gx * R; rawY = cy + gy * R * .7; }
    var qk = reduce ? 1 : 1 - Math.pow(.0005, dt); ptrX += (rawX - ptrX) * qk; ptrY += (rawY - ptrY) * qk;
    setDoors(); drawGL();
  }
  function loop(now) { if (running) frame(now); requestAnimationFrame(loop); }
  frame(performance.now(), 0);
  if (!reduce) requestAnimationFrame(loop);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting && !document.hidden; }).observe(stage);
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });
})();
