/* Color it online. Tap a picture's color group to fill it, then save or share the result. */
(function () {
  var root = document.getElementById("colorlab");
  if (!root) return;
  var COLORS = ["#e63946", "#f77f00", "#fcbf49", "#a7c957", "#2a9d4f", "#2ec4b6", "#4cc9f0", "#3a6ea5", "#7b4fc9", "#ff8fab", "#d6336c", "#8b5a2b", "#d9b382", "#8d99ae", "#231f20", "#ffffff"];
  var scroll = root.querySelector(".colorlab__scroll"), paper = root.querySelector(".colorlab__paper"), swWrap = root.querySelector(".colorlab__swatches");
  var undoBtn = root.querySelector("[data-undo]"), resetBtn = root.querySelector("[data-reset]"), shareBtn = root.querySelector("[data-share]"), status = root.querySelector(".colorlab__status");
  var cur = COLORS[0], svg = null, cur_id = "", history = [], loadTok = 0, items = [], name = "";
  var nameInput = root.querySelector("[data-name]"), nameBox = root.querySelector(".colorlab__name--top"), animalBox = root.querySelector(".colorlab__name--animal"), animal = "";
  var NS = "http://www.w3.org/2000/svg", DOT = "dotted";

  function say(t) { status.textContent = t || ""; }
  function el(tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; for (var k in attrs || {}) e.setAttribute(k, attrs[k]); return e; }

  /* palette */
  COLORS.forEach(function (c, i) {
    var b = el("button", "colorlab__swatch", { type: "button", "aria-label": "Color " + c, "aria-pressed": i === 0 ? "true" : "false" });
    b.style.setProperty("--c", c); b.addEventListener("click", function () { pick(c, b); }); swWrap.appendChild(b);
  });
  var mix = el("button", "colorlab__swatch colorlab__mix", { type: "button", "aria-label": "Mix your own color" });
  var inp = el("input", "", { type: "color", value: "#ff8fab", "aria-label": "Mix your own color" });
  inp.addEventListener("input", function () { pick(inp.value, mix); });
  mix.appendChild(inp); swWrap.appendChild(mix);
  function pick(c, btn) {
    cur = c;
    [].forEach.call(swWrap.children, function (x) { x.setAttribute("aria-pressed", x === btn ? "true" : "false"); });
  }

  /* the child's name, in dotted print letters under the picture so it can be traced (stays on this device) */
  function dots(box, text, label) {
    box.textContent = "";
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    var s = document.createElementNS(NS, "svg"), t = document.createElementNS(NS, "text");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "colorlab__nametext");
    t.setAttribute("x", "0"); t.setAttribute("y", "64"); t.setAttribute("class", "colorlab__dots"); t.textContent = text;
    s.appendChild(t); box.appendChild(s);
    var w = 300; try { w = t.getComputedTextLength(); } catch (e) {}
    s.setAttribute("viewBox", "-12 0 " + Math.ceil(w + 24) + " 84");
    s.style.maxWidth = Math.min(620, Math.max(150, Math.round((w + 24) * 0.9))) + "px";
    box.setAttribute("aria-label", label + text);
  }
  function drawName() { dots(nameBox, name, "Name to trace: "); dots(animalBox, animal, "Word to trace: "); }
  nameInput.addEventListener("input", function () { name = nameInput.value.replace(/[^A-Za-z\u00C0-\u024F' \-]/g, "").slice(0, 14).trim(); drawName(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawName);

  /* picture rail */
  function buildRail(list) {
    items = list;
    list.forEach(function (it) {
      var b = el("button", "colorlab__pick", { type: "button", "aria-pressed": "false", "data-id": it.id });
      var im = el("img", "", { src: "color/thumb/" + it.id + ".webp", alt: "", loading: "lazy", width: 220, height: 220 });
      var sp = el("span"); sp.textContent = it.name;
      b.appendChild(im); b.appendChild(sp); b.addEventListener("click", function () { load(it, b); }); scroll.appendChild(b);
    });
    var step = function (d) { scroll.scrollBy({ left: d * Math.max(240, scroll.clientWidth * 0.8), behavior: "smooth" }); };
    root.querySelector("[data-prev]").addEventListener("click", function () { step(-1); });
    root.querySelector("[data-next]").addEventListener("click", function () { step(1); });
    load(list[0], scroll.firstChild);
  }

  function load(it, btn) {
    var tok = ++loadTok; cur_id = it.id; history = []; undoBtn.disabled = true; say("");
    [].forEach.call(scroll.children, function (x) { x.setAttribute("aria-pressed", x === btn ? "true" : "false"); });
    fetch("color/art/" + it.id + ".svg?v=2").then(function (r) { return r.text(); }).then(function (txt) {
      if (tok !== loadTok) return;
      var doc = new DOMParser().parseFromString(txt, "image/svg+xml").documentElement;
      var s = document.importNode(doc, true);
      s.removeAttribute("width"); s.removeAttribute("height"); s.setAttribute("role", "img"); s.setAttribute("aria-label", "Coloring page: " + it.name);
      [].forEach.call(s.querySelectorAll("path[data-c]"), function (p) { p.setAttribute("data-o", p.getAttribute("fill")); });
      if (svg) svg.remove(); paper.insertBefore(s, animalBox); svg = s; paper.classList.remove("is-touched");
      animal = it.name; drawName();
      link(s);
      s.addEventListener("click", tap);
    }).catch(function () { say("That picture would not load. Try another one."); });
  }

  /* Shading and highlights sit on top of a base shape. Link each one to the part it belongs to,
     so one tap recolors the whole part and keeps its light and dark detail. */
  function hls(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return { h: h, l: l, s: s };
  }
  function toHex(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return "#" + [r, g, b].map(function (v) { return ("0" + Math.round((v + m) * 255).toString(16)).slice(-2); }).join("");
  }
  function link(s) {
    var ps = [].slice.call(s.querySelectorAll("path[data-c]:not([data-k])")), info = [];
    ps.forEach(function (p, i) {
      var bb = p.getBBox(), c = hls(p.getAttribute("data-s") || p.getAttribute("data-o"));
      info.push({ p: p, x0: bb.x, y0: bb.y, x1: bb.x + bb.width, y1: bb.y + bb.height, a: bb.width * bb.height, c: c, white: (p.getAttribute("data-s") || p.getAttribute("data-o")) === "#ffffff", root: i });
    });
    info.forEach(function (d, i) {
      if (d.white) return;
      var best = -1;
      for (var j = 0; j < i; j++) {
        var b = info[j]; if (b.white || b.a <= d.a * 1.05) continue;
        if (d.x0 < b.x0 - 1.5 || d.y0 < b.y0 - 1.5 || d.x1 > b.x1 + 1.5 || d.y1 > b.y1 + 1.5) continue;
        var dh = Math.abs(d.c.h - b.c.h); dh = Math.min(dh, 360 - dh);
        var same = (d.c.s < 0.25 || b.c.s < 0.25) ? Math.abs(d.c.l - b.c.l) < 0.4 && Math.abs(d.c.s - b.c.s) < 0.3 : dh <= 12;
        if (same && (best < 0 || b.a < info[best].a)) best = j;
      }
      if (best >= 0) d.root = best;
    });
    info.forEach(function (d, i) { var r = d.root, n = 0; while (info[r].root !== r && n++ < 20) r = info[r].root; d.root = r; d.p.__g = info; d.p.__i = i; });
  }

  function tap(e) {
    var p = e.target.closest && e.target.closest("path[data-c]");
    if (!p || p.hasAttribute("data-k")) return;
    var info = p.__g, prev = [];
    if (!info) return;
    var root = info[p.__i].root, base = info[root].c, want = hls(cur);
    info.forEach(function (d) {
      if (d.root !== root) return;
      var l = d.p === info[root].p ? want.l : Math.max(0.03, Math.min(0.97, want.l + (d.c.l - base.l) * 0.9));
      var col = (want.s < 0.05 || cur === "#ffffff") ? toHex(0, 0, l) : toHex(want.h, want.s, l);
      if (d.p === info[root].p) col = cur;
      prev.push([d.p, d.p.getAttribute("fill")]); d.p.setAttribute("fill", col);
    });
    history.push(prev); undoBtn.disabled = false; paper.classList.add("is-touched"); say("");
  }
  undoBtn.addEventListener("click", function () {
    var h = history.pop(); if (!h) return; h.forEach(function (x) { x[0].setAttribute("fill", x[1]); }); undoBtn.disabled = !history.length;
  });
  resetBtn.addEventListener("click", function () {
    if (!svg) return; [].forEach.call(svg.querySelectorAll("path[data-o]"), function (p) { p.setAttribute("fill", p.getAttribute("data-o")); }); history = []; undoBtn.disabled = true;
  });

  /* export: the picture on a 4:5 card (works for Instagram and Pinterest), with a small credit line */
  function render() {
    return new Promise(function (resolve, reject) {
      var W = 1080, H = 1350, vb = svg.viewBox.baseVal, artTop = name ? 270 : 130, areaH = 850 - artTop, box = Math.min(880 / vb.width, areaH / vb.height);
      var w = vb.width * box, h = vb.height * box, x = (W - w) / 2, y = artTop + (areaH - h) / 2;
      var clone = svg.cloneNode(true); clone.setAttribute("width", Math.round(w)); clone.setAttribute("height", Math.round(h));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#fff"; g.strokeStyle = "rgba(55,6,56,.12)"; g.lineWidth = 3;
        g.beginPath(); (g.roundRect || g.rect).call(g, 60, 80, W - 120, 1000, 36); g.fill(); g.stroke();
        g.drawImage(img, x, y, w, h); URL.revokeObjectURL(url);
        function dotted(txt, base, maxFs) {
          var fs = maxFs, f = function () { g.font = '400 ' + fs + 'px PrintDashed, "Trebuchet MS", Arial, sans-serif'; }; f();
          while (g.measureText(txt).width > 880 && fs > 50) { fs -= 6; f(); }
          g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#370638"; g.strokeStyle = "#370638"; g.lineWidth = Math.max(1.5, fs / 70); g.lineJoin = "round";
          g.fillText(txt, W / 2, base); g.strokeText(txt, W / 2, base);
        }
        if (name) dotted(name, 230, 170);
        dotted(animal, 1000, 160);
        var qr = new Image();
        function finish() {
          g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#370638";
          g.font = '700 58px "Zilla Slab", Georgia, serif'; g.fillText("Colored by me!", 80, 1180);
          g.font = '500 36px Roboto, Arial, sans-serif'; g.fillStyle = "#64545f";
          g.fillText("More printable fun at", 80, 1245);
          g.font = '700 44px "Zilla Slab", Georgia, serif'; g.fillStyle = "#370638"; g.fillText("M1ndseye.com", 80, 1300);
          if (qr.naturalWidth) {
            g.fillStyle = "#fff"; g.beginPath(); (g.roundRect || g.rect).call(g, 800, 1110, 220, 220, 20); g.fill();
            g.imageSmoothingEnabled = false; g.drawImage(qr, 810, 1120, 200, 200);
          }
          cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("blob")); }, "image/png");
        }
        qr.onload = finish; qr.onerror = finish; qr.src = "color/qr.png";
      };
      img.onerror = function () { reject(new Error("img")); }; img.src = url;
    });
  }
  function track(kind) { try { if (window.gtag) gtag("event", "coloring_" + kind, { picture: cur_id, page: "workbook" }); } catch (e) {} }
  shareBtn.addEventListener("click", function () {
    if (!svg) return; shareBtn.disabled = true; say("Making your picture...");
    (document.fonts && document.fonts.load ? document.fonts.load('400 100px PrintDashed', (name || "") + animal || "A") : Promise.resolve()).catch(function () {}).then(render).then(function (blob) {
      var file = new File([blob], "m1ndseye-" + cur_id + ".png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: "My M1ndseye coloring", text: "I colored this at m1ndseye.com" }).then(function () { track("shared"); say("Shared!"); }, function (err) { if (err && err.name === "AbortError") say(""); else throw err; });
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); track("saved");
      say("Saved to your device. Post it to Pinterest or Instagram from there.");
    }).catch(function () { say("Could not make the image. Try again."); }).then(function () { shareBtn.disabled = false; });
  });

  fetch("color/manifest.json").then(function (r) { return r.json(); }).then(buildRail).catch(function () { root.hidden = true; });
})();
