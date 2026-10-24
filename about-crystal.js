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
  var cur = 0, busy = false, visible = true, auto = null;

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
    "uniform sampler2D uA, uB;",
    "uniform float uT, uTime, uAsp, uPtrOn;",
    "uniform vec2 uOrg, uPtr;",
    "vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }",
    "float h1(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5453); }",
    "vec4 tex(vec2 q, float flip){ vec4 a = texture2D(uA,q), b = texture2D(uB,q); float ok = step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.); return mix(a,b,flip)*ok; }",
    "void main(){",
    "  float S = 8.;",
    "  vec2 asp = vec2(uAsp,1.);",
    "  vec2 p = vUv*asp*S;",
    "  vec2 ip = floor(p), fp = fract(p);",
    "  float d1 = 9., d2 = 9.; vec2 cid = ip, cc = ip;",
    "  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){",
    "    vec2 g = vec2(float(i),float(j)); vec2 o = h2(ip+g)*.82+.09;",
    "    float d = length(g+o-fp);",
    "    if(d<d1){ d2=d1; d1=d; cid=ip+g; cc=ip+g+o; } else if(d<d2){ d2=d; }",
    "  }",
    "  float edge = d2-d1;",
    "  vec2 c = cc/S/asp;",
    "  vec2 hs = h2(cid+7.3);",
    "  float dd = length((c-uOrg)*asp);",
    "  float local = clamp((uT*1.65 - dd*.9 - hs.x*.14)/.5, 0., 1.);",
    "  float s = sin(local*3.14159);",
    "  float flip = smoothstep(.44,.56,local);",
    "  vec2 n = (hs-.5)*2.;",
    "  float ang = (hs.y-.5)*.9*s;",
    "  vec2 r = (vUv-c)*asp; r = vec2(cos(ang)*r.x - sin(ang)*r.y, sin(ang)*r.x + cos(ang)*r.y)/asp;",
    "  vec2 q = c + r + n*.03*s;",
    "  vec2 disp = n*.014*s;",
    "  vec4 cr = tex(q+disp, flip), cg = tex(q, flip), cb = tex(q-disp, flip);",
    "  vec4 col = vec4(cr.r, cg.g, cb.b, max(max(cr.a,cg.a),cb.a));",
    "  // facet shading and caustic highlight",
    "  vec3 fn = normalize(vec3(n*.55, 1.));",
    "  float lit = dot(fn, normalize(vec3(-.45,.55,.7)));",
    "  float idle = uPtrOn * smoothstep(.4,0.,length((vUv-uPtr)*asp));",
    "  float act = max(s, idle*.2);",
    "  col.rgb *= 1. + (lit-.72)*.9*act;",
    "  float caus = pow(max(lit,0.),7.)*act*.55;",
    "  float vis = smoothstep(0.,.5,col.a);",
    "  float eg = (1.-smoothstep(0.,.07,edge)) * act * vis;",
    "  vec3 tint = mix(vec3(.44,.61,1.), vec3(1.,.62,.26), h1(cid));",
    "  vec3 add = tint*eg*1.1 + vec3(1.,.97,.9)*caus*vis + tint*caus*.3*vis;",
    "  gl_FragColor = vec4(col.rgb + add*vis, clamp(col.a + (eg*.55+caus*.4)*vis, 0., 1.));",
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
  var U = {}; ["uA", "uB", "uT", "uTime", "uAsp", "uPtrOn", "uOrg", "uPtr"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.clearColor(0, 0, 0, 0);

  var texs = [], loaded = 0, ready = false, ASP = 900 / 1300;
  SHOTS.forEach(function (s, i) {
    var im = new Image(); im.decoding = "async";
    im.onload = function () {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      texs[i] = t; loaded++;
      if (loaded === SHOTS.length) { ready = true; root.classList.add("is-gl"); size(); draw(); scheduleAuto(); }
    };
    im.onerror = function () { cv.hidden = true; startFallback(); };
    im.src = s.src;
  });

  var T = 0, nxt = 0, org = [.5, .3], ptr = [.5, .5], ptrOn = 0, ptrTarget = 0, raf = 0, t0 = 0, DUR = 1700;
  function size() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
  }
  function draw(now) {
    if (!ready) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs[cur]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texs[busy ? nxt : cur]);
    gl.uniform1f(U.uT, T); gl.uniform1f(U.uTime, (now || 0) / 1000); gl.uniform1f(U.uAsp, ASP);
    gl.uniform1f(U.uPtrOn, ptrOn); gl.uniform2f(U.uOrg, org[0], org[1]); gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) {
    raf = 0;
    ptrOn += (ptrTarget - ptrOn) * .12;
    if (busy) {
      T = Math.min(1, (now - t0) / DUR);
      if (T >= 1) { cur = nxt; busy = false; T = 0; mark(cur); }
    }
    draw(now);
    if (busy || Math.abs(ptrTarget - ptrOn) > .01) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && ready) raf = requestAnimationFrame(loop); }

  function go(i, from) {
    if (!ready || busy || i === cur) return;
    nxt = i; org = from || [.5, .3]; busy = true; T = 0; t0 = performance.now();
    mark(i); kick(); scheduleAuto();
  }
  function scheduleAuto() {
    clearTimeout(auto);
    auto = setTimeout(function () {
      if (visible && !document.hidden) go((cur + 1) % SHOTS.length, [.5 + (Math.random() - .5) * .3, .22 + Math.random() * .2]);
      else scheduleAuto();
    }, 6500);
  }
  function uvOf(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; }

  cv.addEventListener("pointerdown", function (e) { go((cur + 1) % SHOTS.length, uvOf(e)); });
  cv.addEventListener("pointermove", function (e) { ptr = uvOf(e); ptrTarget = 1; kick(); });
  cv.addEventListener("pointerleave", function () { ptrTarget = 0; kick(); });
  dots.forEach(function (d, k) {
    d.addEventListener("click", function () {
      var r = d.getBoundingClientRect(), c = cv.getBoundingClientRect();
      go(k, [Math.min(1, Math.max(0, (r.left + r.width / 2 - c.left) / c.width)), 0.04]);
    });
  });
  window.addEventListener("resize", function () { if (ready) { size(); draw(); } });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: .15 }).observe(root);
  cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); ready = false; root.classList.remove("is-gl"); });
  cv.addEventListener("webglcontextrestored", function () { location.reload(); });
})();
