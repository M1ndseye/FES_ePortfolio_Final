/* M1ndseye refractive glass eye (raw WebGL, no libraries).
   The logo mask becomes a beveled glass slab. The slab refracts a live copy of the hero's
   engine canvas plus soft light bars, splits colors at the edges, and reacts to the pointer. */
(function () {
  var wrap = document.getElementById("eye-glass");
  var hero = document.querySelector(".hero");
  var engine = document.getElementById("engine-canvas");
  if (!wrap || !hero) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ASPECT = 1040 / 707;
  var canvas = wrap.querySelector("canvas");
  var fallback = wrap.querySelector("img");

  /* ---------- layout: sit on the engine core ---------- */
  var cssW = 0, cssH = 0;
  function layout() {
    var hw = hero.clientWidth, hh = hero.clientHeight;
    var c = window.m1Core || { x: hw * 0.68, y: hh * 0.32 };
    cssW = Math.min(hw < 760 ? hw * 0.8 : 540, hw * (hw < 760 ? 0.8 : 0.44));
    cssH = cssW / ASPECT;
    wrap.style.width = cssW + "px"; wrap.style.height = cssH + "px";
    wrap.style.left = (c.x - cssW / 2) + "px"; wrap.style.top = (c.y - cssH / 2) + "px";
    return c;
  }
  layout();

  var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return; // fallback image stays visible

  /* ---------- shaders ---------- */
  var VS = "attribute vec2 p; varying vec2 v; void main(){ v = p*.5+.5; gl_Position = vec4(p,0.,1.); }";
  var FS = [
    "precision highp float;",
    "varying vec2 v;",
    "uniform sampler2D uN; uniform sampler2D uBg;",
    "uniform vec2 uM; uniform float uT; uniform float uAsp; uniform float uHasBg;",
    "float hash(float n){ return fract(sin(n*127.1)*43758.5453); }",
    "vec3 bar(vec2 uv, vec2 c, float ang, float w, vec3 col){",
    "  vec2 d = vec2(cos(ang), sin(ang));",
    "  float s = abs(dot(uv - c, vec2(-d.y, d.x)));",
    "  return col * smoothstep(w, 0., s);",
    "}",
    "vec3 backdrop(vec2 uv){",
    "  vec3 c = vec3(.035,.03,.06);",
    "  if (uHasBg > .5) c += texture2D(uBg, vec2(uv.x, 1.-uv.y)).rgb * 1.25;",
    "  vec2 m = uM * .22;",
    "  c += bar(uv, vec2(.18,.5) + m, 1.15, .035, vec3(.66,.58,.95)) * 1.5;",
    "  c += bar(uv, vec2(.62,.5) - m*1.4, -1.0, .022, vec3(1.,.72,.40)) * 1.7;",
    "  c += bar(uv, vec2(.86,.5) + m*.6, 1.4, .05, vec3(.95,.95,1.)) * 1.1;",
    "  c += bar(uv, vec2(.40,.5) - m, .30, .012, vec3(1.)) * 1.2;",
    "  return c;",
    "}",
    "void main(){",
    "  vec4 t = texture2D(uN, v);",
    "  float a = t.a;",
    "  if (a < .003) { gl_FragColor = vec4(0.); return; }",
    "  vec2 g = (t.rg*2.-1.);",
    "  float thick = t.b;",
    "  vec2 q = (v - .5); q.x *= uAsp;",
    "  g += (q - uM*vec2(.16,-.16)) * .55;",           // domed lens that follows the pointer
    "  vec2 tilt = vec2(uM.x, -uM.y);",
    "  // fine scratches, like the reference glass",
    "  float sc = 0.;",
    "  for (int i = 0; i < 2; i++) {",
    "    float ang = i == 0 ? .35 : 1.95;",
    "    mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));",
    "    vec2 pp = R * (v * vec2(uAsp,1.));",
    "    vec2 p = pp * vec2(1., 70.) + tilt*.6;",
    "    float id = floor(p.y), h = hash(id + float(i)*17.);",
    "    float line = smoothstep(.05, .0, abs(fract(p.y)-.5)-.44);",
    "    float ext = step(h, .35) * smoothstep(.0,.1, .5-abs(pp.x - h*1.6 + .4));",
    "    sc += line * ext;",
    "  }",
    "  g += vec2(sc) * .022;",
    "  float k = .17 + .1 * thick;",
    "  float disp = .22;",
    "  vec2 off = g * k + tilt * .03;",
    "  vec3 col;",
    "  col.r = backdrop(v + off * (1. - disp)).r;",
    "  col.g = backdrop(v + off).g;",
    "  col.b = backdrop(v + off * (1. + disp*1.6)).b;",
    "  col *= mix(1., .72, thick) * vec3(.93,.95,1.);",
    "  vec3 N = normalize(vec3(g*1.6, 1.));",
    "  vec3 V = vec3(0.,0.,1.);",
    "  vec3 L = normalize(vec3(-uM.x*1.3, uM.y*1.3, .75));",
    "  vec3 H = normalize(L + V);",
    "  float spec = pow(max(dot(N,H),0.), 70.) * 1.5 + pow(max(dot(N,H),0.), 12.) * .12;",
    "  float rim = pow(1. - N.z, 2.2);",
    "  vec3 rimCol = mix(vec3(.66,.58,.95), vec3(1.,.72,.40), clamp(v.x*1.2 + uM.x*.3, 0., 1.));",
    "  col += spec * vec3(1.) + rim * rimCol * .85 + sc * .15 * pow(max(dot(N,H),0.),4.);",
    "  col = col / (1. + col*.35);",                    // soft highlight roll-off
    "  col = pow(col, vec3(.95));",
    "  gl_FragColor = vec4(col * a, a);",
    "}"
  ].join("\n");
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error("eye shader:", gl.getShaderInfoLog(s)); return null; } return s; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ["uN","uBg","uM","uT","uAsp","uHasBg"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uN, 0); gl.uniform1i(U.uBg, 1); gl.uniform1f(U.uAsp, ASPECT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function makeTex(unit) {
    var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  var texN = makeTex(0), texBg = makeTex(1);
  var bgC = document.createElement("canvas"); bgC.width = 256; bgC.height = Math.round(256 / ASPECT);
  var bgX = bgC.getContext("2d");
  var hasBg = 0;

  /* ---------- bevel map: blur the mask, derive slopes (R,G), thickness (B), coverage (A) ---------- */
  function boxBlur(src, w, h, r) {
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), i, x, y, acc, n = 2 * r + 1;
    for (y = 0; y < h; y++) { acc = 0; for (x = -r; x <= r; x++) acc += src[y*w + Math.min(w-1, Math.max(0, x))];
      for (x = 0; x < w; x++) { tmp[y*w + x] = acc / n; acc += src[y*w + Math.min(w-1, x+r+1)] - src[y*w + Math.max(0, x-r)]; } }
    for (x = 0; x < w; x++) { acc = 0; for (y = -r; y <= r; y++) acc += tmp[Math.min(h-1, Math.max(0, y))*w + x];
      for (y = 0; y < h; y++) { out[y*w + x] = acc / n; acc += tmp[Math.min(h-1, y+r+1)*w + x] - tmp[Math.max(0, y-r)*w + x]; } }
    return out;
  }
  function build(img) {
    var W = 640, H = Math.round(W / ASPECT);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"); x.drawImage(img, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data, a = new Float32Array(W * H), i;
    for (i = 0; i < W * H; i++) a[i] = d[i*4 + 3] / 255;
    var b = a; for (var pass = 0; pass < 3; pass++) b = boxBlur(b, W, H, 7);
    var px = new Uint8Array(W * H * 4), S = 2.2 * 7 * 3 * .55;
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
      var k = yy*W + xx, x0 = Math.max(0,xx-1), x1 = Math.min(W-1,xx+1), y0 = Math.max(0,yy-1), y1 = Math.min(H-1,yy+1);
      var gx = (b[yy*W + x1] - b[yy*W + x0]) * .5 * S, gy = (b[y1*W + xx] - b[y0*W + xx]) * .5 * S;
      var nx = Math.max(-1, Math.min(1, -gx)), ny = Math.max(-1, Math.min(1, gy));   // y flipped for GL
      px[k*4] = Math.round((nx*.5 + .5) * 255); px[k*4+1] = Math.round((ny*.5 + .5) * 255);
      px[k*4+2] = Math.round(Math.min(1, b[k] * 1.6) * 255); px[k*4+3] = Math.round(a[k] * 255);
    }
    // flip rows because GL's v runs bottom to top
    var flipped = new Uint8Array(px.length);
    for (var r = 0; r < H; r++) flipped.set(px.subarray(r*W*4, (r+1)*W*4), (H-1-r)*W*4);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texN);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, flipped);
  }

  /* ---------- pointer ---------- */
  var tx = 0, ty = 0, mx = 0, my = 0, lastMove = -1e9, running = true, ready = false, raf = 0;
  window.addEventListener("pointermove", function (e) {
    var r = wrap.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * .5)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * .5)));
    lastMove = performance.now();
    if (reduce || !running) draw(performance.now());
  }, { passive: true });

  function size() {
    var c = layout(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    return c;
  }
  function grabBackdrop() {
    if (!engine) return;
    try {
      var cr = engine.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      var sx = (wr.left - cr.left) / cr.width * engine.width, sy = (wr.top - cr.top) / cr.height * engine.height;
      var sw = wr.width / cr.width * engine.width, sh2 = wr.height / cr.height * engine.height;
      bgX.clearRect(0, 0, bgC.width, bgC.height);
      bgX.drawImage(engine, sx, sy, sw, sh2, 0, 0, bgC.width, bgC.height);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texBg);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgC);
      hasBg = 1;
    } catch (e) { hasBg = 0; }
  }
  function draw(now) {
    if (!ready) return;
    var idle = !reduce && now - lastMove > 2500;
    if (idle) { tx = Math.sin(now * .00035) * .55; ty = Math.cos(now * .00027) * .35; }
    var k = reduce ? 1 : .08; mx += (tx - mx) * k; my += (ty - my) * k;
    grabBackdrop();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uM, mx, my); gl.uniform1f(U.uT, now * .001); gl.uniform1f(U.uHasBg, hasBg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) { if (running) draw(now); raf = requestAnimationFrame(loop); }

  var img = new Image();
  img.onload = function () {
    try { build(img); } catch (e) { console.error("eye mask:", e); return; }
    ready = true; size();
    wrap.classList.add("is-live"); if (fallback) fallback.style.visibility = "hidden";
    draw(performance.now());
    if (!reduce) raf = requestAnimationFrame(loop);
  };
  img.src = "assets/m1-eye-mask.png";
  window.addEventListener("resize", function () { size(); draw(performance.now()); });
  window.addEventListener("m1engine:resize", function () { size(); draw(performance.now()); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting; }).observe(wrap);
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });
})();
