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
  var cx = 0, cy = 0, R = 400;
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
    lastMove = performance.now();
    if (reduce) { gx = tx; gy = ty; frame(performance.now(), 0); }
  }, { passive: true });

  var gazed = { left: false, right: false };
  function setEye() {
    var ang = Math.atan2(gy, gx); if (ang < 0) ang += Math.PI * 2;
    var idx = ang / (Math.PI / 4), i0 = Math.floor(idx) % 8, i1 = (i0 + 1) % 8, f = idx - Math.floor(idx);
    f = f * f * (3 - 2 * f);
    for (var i = 0; i < 8; i++) imgs[i].style.opacity = i === i0 ? 1 : (i === i1 ? f : 0);
    var m = Math.min(1, Math.sqrt(gx * gx + gy * gy));
    eye.style.transform = "perspective(1400px) translate3d(" + (gx * 18) + "px," + (gy * 12) + "px,0) rotateY(" + (gx * 7) + "deg) rotateX(" + (-gy * 5) + "deg) scale(" + (1 + m * .015) + ")";
    var L = gx < -.42, Rr = gx > .42;
    if (L !== gazed.left && doors.left) { gazed.left = L; doors.left.classList.toggle("is-gazed", L); }
    if (Rr !== gazed.right && doors.right) { gazed.right = Rr; doors.right.classList.toggle("is-gazed", Rr); }
  }

  /* ---------- caustics (WebGL) ---------- */
  var gl = cv && cv.getContext("webgl", { antialias: false, alpha: false }), U = {};
  if (gl) {
    var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
    var FS = [
      "precision highp float;",
      "uniform vec2 uRes; uniform float uPhase; uniform vec2 uGaze; uniform float uEnergy;",
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
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / uRes;",
      "  vec2 p = (uv - .5) * vec2(uRes.x/uRes.y, 1.);",
      "  vec2 g = vec2(uGaze.x, -uGaze.y);",
      "  float d = length(p * vec2(.85, 1.2));",
      "  float near = exp(-d*1.8);",
      "  vec2 w = p + g*.10*near + .03*vec2(sin(p.y*7.+uPhase*.7), cos(p.x*7.-uPhase*.6))*(.4+uEnergy*2.);",
      "  vec2 o = g*.15;",
      "  vec3 c3 = vec3(caust(w*1.35 + o, uPhase), caust(w*1.37 + o, uPhase), caust(w*1.39 + o, uPhase));\n      c3 = mix(vec3((c3.r+c3.g+c3.b)/3.), c3, .3);",
      "  float len = length(g);",
      "  vec2 dir = normalize(p + 1e-4);",
      "  float side = len > .01 ? smoothstep(-.1, 1., dot(dir, g/len)) * len : 0.;",
      "  float I = near*.95 + side*exp(-d*.7)*.95 + .07*exp(-d*.5);",
      "  vec3 sapph = vec3(.16,.40,1.), amber = vec3(1.,.62,.22);",
      "  vec3 tint = mix(sapph, amber, clamp(.32 + g.x*.5 + side*.25, 0., 1.));",
      "  vec3 col = vec3(.02,.03,.07) + tint*near*.11 + c3*tint*I*1.25;",
      "  col = 1. - exp(-col*1.25);",
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
        ["uRes","uPhase","uGaze","uEnergy"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
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
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uPhase, phase);
    gl.uniform2f(U.uGaze, gx, gy); gl.uniform1f(U.uEnergy, energy);
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
    setEye(); drawGL();
  }
  function loop(now) { if (running) frame(now); requestAnimationFrame(loop); }
  frame(performance.now(), 0);
  if (!reduce) requestAnimationFrame(loop);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting && !document.hidden; }).observe(stage);
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });
})();
