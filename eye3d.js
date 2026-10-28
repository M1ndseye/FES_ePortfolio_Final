/* M1ndseye 3D glass mechanism: loads a .glb and renders it with raw WebGL (no library).
   Glass = analytic refraction + chromatic dispersion + fresnel, lit by a procedural studio of blue and amber light.
   Usage: <canvas data-eye3d="assets/mechanical-eye.glb"> then include this script. */
(function () {
  var cv = document.querySelector("canvas[data-eye3d]");
  if (!cv) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gl = cv.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) { cv.dispatchEvent(new Event("eye3d-fail")); return; }
  var u32 = gl.getExtension("OES_element_index_uint");

  /* ---- tiny mat4 ---- */
  function ident() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function trs(t, q, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
             2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
             2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
    for (var i = 0; i < 3; i++) { m[i] *= s[0]; m[4 + i] *= s[1]; m[8 + i] *= s[2]; }
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m;
  }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
  function persp(f, asp, n, fr) { var t = 1 / Math.tan(f / 2); return [t / asp,0,0,0, 0,t,0,0, 0,0,(fr + n) / (n - fr),-1, 0,0,2 * fr * n / (n - fr),0]; }

  /* ---- GLB parse ---- */
  function parse(buf) {
    var dv = new DataView(buf), jl = dv.getUint32(12, true);
    var j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    var off = 20 + jl, bin = off + 8;
    function acc(i) {
      var a = j.accessors[i], bv = j.bufferViews[a.bufferView];
      var n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], base = bin + (bv.byteOffset || 0) + (a.byteOffset || 0);
      var T = a.componentType === 5126 ? Float32Array : a.componentType === 5123 ? Uint16Array : Uint32Array;
      var stride = bv.byteStride;
      if (stride && stride !== n * T.BYTES_PER_ELEMENT) {
        var out = new T(a.count * n), src = new DataView(buf);
        for (var k = 0; k < a.count; k++) for (var c = 0; c < n; c++) out[k * n + c] = a.componentType === 5126 ? src.getFloat32(base + k * stride + c * 4, true) : src.getUint16(base + k * stride + c * 2, true);
        return out;
      }
      return new T(buf.slice(base, base + a.count * n * T.BYTES_PER_ELEMENT));
    }
    return { j: j, acc: acc };
  }

  /* ---- shaders ---- */
  var VS = "attribute vec3 p;attribute vec3 n;uniform mat4 M,V,P;varying vec3 wn,wp;" +
    "void main(){vec4 w=M*vec4(p,1.);wp=w.xyz;wn=normalize(mat3(M)*n);gl_Position=P*V*w;}";
  var FS = "precision highp float;varying vec3 wn,wp;uniform vec3 cam;uniform float alpha,time;uniform vec2 gaze;" +
    "vec3 studio(vec3 d,vec3 at){" +
    " vec3 c=mix(vec3(.05,.08,.2),vec3(.12,.2,.46),smoothstep(-.7,.9,d.y));" +
    " float a=dot(d,normalize(vec3(.75,.55,.5)+vec3(gaze*.25,0.)));c+=vec3(1.,.55,.16)*pow(max(a,0.),5.)*2.6;" +
    " float b=dot(d,normalize(vec3(-.8,.2,.55)));c+=vec3(.32,.52,1.)*pow(max(b,0.),4.)*2.2;" +
    " float s=dot(d,normalize(vec3(.1,.95,.3)));c+=vec3(.9,.95,1.)*pow(max(s,0.),60.)*2.2;" +
    " float band=sin(at.x*2.1+at.y*3.3+d.x*5.+time*.15);c+=vec3(.45,.6,1.)*smoothstep(.7,1.,band)*.7;" +
    " float band2=sin(at.x*-1.7+at.y*2.4+d.y*4.-time*.1);c+=vec3(1.,.6,.25)*smoothstep(.74,1.,band2)*.6;" +
    " return c;}" +
    "void main(){vec3 N=normalize(wn),V=normalize(wp-cam);if(dot(N,-V)<0.)N=-N;" +
    " float cosT=clamp(dot(N,-V),0.,1.),fr=pow(1.-cosT,3.);" +
    " vec3 rr=reflect(V,N);vec3 col=studio(rr,wp)*(.25+fr*1.6);" +
    " vec3 t;for(int i=0;i<3;i++){float eta=1./(1.45+float(i)*.035);vec3 d=refract(V,N,eta);if(dot(d,d)<.001)d=rr;" +
    "  vec3 s=studio(normalize(d+vec3(0.,0.,-.15)),wp+d*.7);" +
    "  if(i==0)t.r=s.r;else if(i==1)t.g=s.g;else t.b=s.b;}" +
    " col+=t*(.8+.5*(1.-fr));" +
    " col+=vec3(.5,.65,1.)*pow(1.-cosT,4.)*1.1;" +
    " col=col/(1.+col*.35);col=pow(col,vec3(.92));" +
    " gl_FragColor=vec4(col,alpha*mix(.34,1.,clamp(fr*1.5+(1.-cosT),0.,1.)));}";
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  gl.useProgram(prog);
  var loc = {}; ["M","V","P","cam","alpha","time","gaze"].forEach(function (k) { loc[k] = gl.getUniformLocation(prog, k); });
  var aP = gl.getAttribLocation(prog, "p"), aN = gl.getAttribLocation(prog, "n");

  var parts = [], byName = {};
  function build(buf) {
    var g = parse(buf), j = g.j;
    j.nodes.forEach(function (nd) {
      if (nd.mesh === undefined) return;
      var pr = j.meshes[nd.mesh].primitives[0];
      var P = g.acc(pr.attributes.POSITION), N = g.acc(pr.attributes.NORMAL), I = g.acc(pr.indices);
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
      var nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, N, gl.STATIC_DRAW);
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
      var part = { name: nd.name, vb: vb, nb: nb, ib: ib, count: I.length, type: I instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,
        t: nd.translation || [0,0,0], q: nd.rotation || [0,0,0,1], s: nd.scale || [1,1,1], spin: 0, axis: "z", speed: 0, pane: nd.name === "Plane" };
      parts.push(part); byName[nd.name] = part;
    });
    /* gear train: speed ~ 1 / radius, neighbours turn opposite ways; spin axis is the thin axis of each part */
    var rule = { "Cube.004": [-.07, "z"], "Cube.003": [.14, "z"], "Cube": [-.28, "z"], "Cube.002": [.5, "z"], "Cube.007": [.05, "z"], "Circle": [-.12, "y"] };
    Object.keys(rule).forEach(function (k) { if (byName[k]) { byName[k].speed = rule[k][0]; byName[k].axis = rule[k][1]; } });
    parts.sort(function (a, b) { return (a.pane ? 1 : 0) - (b.pane ? 1 : 0); });
  }

  /* ---- sizing, pointer ---- */
  var W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect(); W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  size(); window.addEventListener("resize", size);
  var tx = 0, ty = 0, gx = 0, gy = 0;
  function ptr(e) { var r = cv.getBoundingClientRect(); tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)); ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2)); }
  window.addEventListener("pointermove", ptr, { passive: true });
  window.addEventListener("pointerdown", ptr, { passive: true });

  var CENTER = [-1.15, -.5, 0];      /* model-space point the camera orbits around */
  var t0 = performance.now(), running = true;
  function draw(now, still) {
    var t = (now - t0) / 1000;
    gx += (tx - gx) * .06; gy += (ty - gy) * .06;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
    var asp = W / H, dist = asp > 1.6 ? 9.4 : 9.4 * (1.6 / asp) * .86;
    var tiltY = gx * .30, tiltX = gy * .20;
    var V = mul(mul([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-dist,1], mul(rotX(tiltX), rotY(tiltY))), [1,0,0,0, 0,1,0,0, 0,0,1,0, -CENTER[0], -CENTER[1], -CENTER[2], 1]);
    var camPos = [0, 0, dist];
    /* camera position in model space (inverse of the rotation applied above) */
    var ry = -tiltY, rx = -tiltX;
    var cx0 = Math.sin(ry) * Math.cos(rx) * dist, cy0 = -Math.sin(rx) * dist, cz0 = Math.cos(ry) * Math.cos(rx) * dist;
    gl.uniformMatrix4fv(loc.V, false, new Float32Array(V));
    gl.uniformMatrix4fv(loc.P, false, new Float32Array(persp(.55, asp, .5, 60)));
    gl.uniform3f(loc.cam, cx0 + CENTER[0], cy0 + CENTER[1], cz0 + CENTER[2]);
    gl.uniform1f(loc.time, t); gl.uniform2f(loc.gaze, gx, -gy);
    parts.forEach(function (p) {
      var local = trs(p.t, p.q, p.s);
      var ang = (still ? 0 : t) * p.speed * 6.2832;
      if (p.speed) {
        var sp = p.axis === "y" ? rotY(ang) : rotZ(ang);
        local = mul(local, sp);
      }
      gl.uniformMatrix4fv(loc.M, false, new Float32Array(local));
      gl.uniform1f(loc.alpha, p.pane ? .55 : .96);
      gl.depthMask(!p.pane);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.vb); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.nb); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ib); gl.drawElements(gl.TRIANGLES, p.count, p.type, 0);
    });
    document.documentElement.setAttribute("data-eye3d", "ready");
  }
  function loop(now) { if (!running) return; draw(now, reduce); if (!reduce) requestAnimationFrame(loop); }
  document.addEventListener("visibilitychange", function () { running = !document.hidden; if (running) requestAnimationFrame(loop); });
  fetch(cv.getAttribute("data-eye3d")).then(function (r) { return r.arrayBuffer(); }).then(function (b) { build(b); requestAnimationFrame(loop); })
    .catch(function (e) { console.log("eye3d failed", e); cv.dispatchEvent(new Event("eye3d-fail")); });
  window.__eye3d = { draw: function (t) { draw(t0 + t * 1000, false); } };
})();
