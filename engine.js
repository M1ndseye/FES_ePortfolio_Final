/* M1ndseye digital creation engine: shared behavior */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav toggle ---------- */
  var nav = document.querySelector(".eng-nav");
  var toggle = document.querySelector(".eng-nav__toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest(".eng-nav__links a")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- hero engine canvas: AI (lavender) + OI (amber) streams merge into output frames ---------- */
  var canvas = document.getElementById("engine-canvas");
  if (canvas) {
    var ctx = canvas.getContext("2d");
    var W, H, dpr, core, parts = [], frames = [], running = true;
    var AI = "169,148,240", OI = "240,179,106";
    function size() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      core = { x: W * (W < 760 ? 0.5 : 0.68), y: H * (W < 760 ? 0.27 : 0.27) };
      window.m1Core = core;
      window.dispatchEvent(new Event("m1engine:resize"));
      parts = [];
      var n = W < 760 ? 70 : 150;
      for (var i = 0; i < n; i++) parts.push(spawn(i % 2 === 0 ? "ai" : "oi", true));
    }
    function spawn(kind, scatter) {
      var fromLeft = kind === "ai";
      var x = fromLeft ? -20 : W + 20;
      var y = Math.random() * H * 0.9;
      var t = scatter ? Math.random() : 0;
      return { kind: kind, x0: x, y0: y, t: t, speed: 0.0022 + Math.random() * 0.0028, wob: Math.random() * 6.28, r: 1.2 + Math.random() * 1.8 };
    }
    function pos(p) {
      var e = p.t * p.t * (3 - 2 * p.t); // smoothstep toward the core
      var x = p.x0 + (core.x - p.x0) * e;
      var y = p.y0 + (core.y - p.y0) * e + Math.sin(p.wob + p.t * 9) * (1 - e) * 22;
      return [x, y];
    }
    function drawFrame(f) {
      var w = f.s * 16, h = f.s * 9;
      ctx.strokeStyle = "rgba(244,242,251," + (f.a * 0.9) + ")";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(f.x - w / 2, f.y - h / 2, w, h);
      ctx.fillStyle = "rgba(244,242,251," + (f.a * 0.06) + ")";
      ctx.fillRect(f.x - w / 2, f.y - h / 2, w, h);
    }
    function tick(still) {
      ctx.clearRect(0, 0, W, H);
      // core glow (both colors overlap)
      var g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 160);
      g.addColorStop(0, "rgba(255,244,230,.55)"); g.addColorStop(.25, "rgba(240,179,106,.22)"); g.addColorStop(.6, "rgba(169,148,240,.10)"); g.addColorStop(1, "rgba(20,18,27,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(core.x, core.y, 160, 0, 6.283); ctx.fill();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!still) p.t += p.speed;
        if (p.t >= 1) {
          if (!still && Math.random() < 0.18) frames.push({ x: core.x, y: core.y, s: 1.2, a: 1, vx: 0.6 + Math.random() * 0.8, vy: -0.5 - Math.random() * 0.6 });
          parts[i] = p = spawn(p.kind, false);
        }
        var xy = pos(p), c = p.kind === "ai" ? AI : OI;
        ctx.beginPath(); ctx.arc(xy[0], xy[1], p.r, 0, 6.283);
        ctx.fillStyle = "rgba(" + c + "," + (0.35 + p.t * 0.6) + ")"; ctx.fill();
        if (p.t > 0.05) {
          var prev = pos({ x0: p.x0, y0: p.y0, t: Math.max(0, p.t - 0.05), wob: p.wob });
          ctx.strokeStyle = "rgba(" + c + ",0.12)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(xy[0], xy[1]); ctx.stroke();
        }
      }
      for (var j = frames.length - 1; j >= 0; j--) {
        var f = frames[j];
        if (!still) { f.x += f.vx; f.y += f.vy; f.s += 0.16; f.a -= 0.007; }
        if (f.a <= 0) { frames.splice(j, 1); continue; }
        drawFrame(f);
      }
    }
    function loop() { if (running) tick(false); requestAnimationFrame(loop); }
    size();
    window.addEventListener("resize", size);
    if (reduce) { for (var k = 0; k < 6; k++) frames.push({ x: core.x + k * 46, y: core.y - k * 22, s: 4 + k * 3, a: 0.7 - k * 0.1 }); tick(true); }
    else {
      if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting; }).observe(canvas);
      loop();
    }
  }

  /* ---------- courtroom scenes: background video plays only while on screen ---------- */
  var scenes = document.querySelectorAll(".scene[data-video], .scene[data-youtube]");
  scenes.forEach(function (scene) {
    var media = scene.querySelector(".scene__media");
    var poster = scene.getAttribute("data-poster");
    var loaded = false, el = null;
    function load() {
      if (loaded || reduce) return;
      loaded = true;
      if (scene.dataset.video) {
        el = document.createElement("video");
        el.muted = true; el.loop = true; el.playsInline = true; el.setAttribute("playsinline", ""); el.setAttribute("aria-hidden", "true");
        el.preload = "metadata"; if (poster) el.poster = poster;
        el.src = scene.dataset.video;
        media.appendChild(el);
      } else if (scene.dataset.youtube) {
        var id = scene.dataset.youtube;
        el = document.createElement("iframe");
        el.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&mute=1&controls=0&loop=1&playlist=" + id + "&playsinline=1&modestbranding=1&rel=0&disablekb=1";
        el.setAttribute("allow", "autoplay; encrypted-media"); el.setAttribute("tabindex", "-1"); el.setAttribute("aria-hidden", "true"); el.setAttribute("title", "Background example video");
        media.appendChild(el);
      }
    }
    var paused = false;
    function play(on) {
      if (!el || paused) return;
      if (el.tagName === "VIDEO") { if (on) { var p = el.play(); if (p && p.catch) p.catch(function () {}); } else el.pause(); }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { load(); play(true); } else play(false); });
      }, { threshold: 0.25 }).observe(scene);
    } else { load(); play(true); }
    var btn = scene.querySelector(".scene__ctrl");
    if (btn) btn.addEventListener("click", function () {
      paused = !paused;
      btn.textContent = paused ? "Play background video" : "Pause background video";
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      if (el && el.tagName === "VIDEO") { paused ? el.pause() : el.play().catch(function () {}); }
    });
  });

  /* ---------- courtroom contact form (same EmailJS service and template as the About page form) ---------- */
  var form = document.getElementById("court-form");
  if (form) {
    var status = form.querySelector(".cform__status");
    var submit = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.website && form.website.value) return; // honeypot: bots fill hidden fields
      if (!window.emailjs) { status.className = "cform__status is-err"; status.textContent = "The form could not load. Email steve.mindseye@gmail.com instead."; return; }
      var d = new FormData(form);
      var lines = [
        "Courtroom animation inquiry (from m1ndseye.com/courtroom-animation)",
        "Firm / company: " + (d.get("firm") || "not given"),
        "Animation type: " + (d.get("type") || "not given"),
        "Needed by: " + (d.get("needed") || "not given"),
        "",
        d.get("details")
      ];
      submit.disabled = true; status.className = "cform__status"; status.textContent = "Sending...";
      emailjs.send("service_x9xwlsf", "template_57nss0a", {
        user_name: d.get("name"), user_email: d.get("email"), message: lines.join("\n")
      }, "jf8G_9wc-MGeb3w95").then(function () {
        status.className = "cform__status is-ok";
        status.textContent = "Request sent. I will reply by email.";
        if (window.gtag) gtag("event", "generate_lead", { form: "courtroom_animation", animation_type: d.get("type") || "" });
        form.reset(); submit.disabled = false;
      }).catch(function (err) {
        console.error("EmailJS send failed:", err && err.status, err && err.text, err);
        status.className = "cform__status is-err";
        status.textContent = "The request did not send. Email steve.mindseye@gmail.com and include the same details.";
        submit.disabled = false;
      });
    });
  }

  /* ---------- courtroom case-type cards: preview plays on hover, focus, or when scrolled into view on touch ---------- */
  var cards = document.querySelectorAll(".case");
  var touchOnly = window.matchMedia && window.matchMedia("(hover: none)").matches;
  cards.forEach(function (card) {
    var media = card.querySelector(".case__media"), el = null, ready = false;
    function build() {
      if (el || reduce) return;
      if (card.dataset.video) {
        el = document.createElement("video");
        el.muted = true; el.loop = true; el.playsInline = true; el.preload = "auto"; el.setAttribute("playsinline", ""); el.setAttribute("aria-hidden", "true");
        el.src = card.dataset.video; media.appendChild(el);
      } else if (card.dataset.youtube) {
        var id = card.dataset.youtube;
        el = document.createElement("iframe");
        el.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&mute=1&controls=0&loop=1&playlist=" + id + "&playsinline=1&modestbranding=1&rel=0&disablekb=1&enablejsapi=1";
        el.setAttribute("allow", "autoplay; encrypted-media"); el.setAttribute("tabindex", "-1"); el.setAttribute("aria-hidden", "true"); el.setAttribute("title", "Case type preview");
        media.appendChild(el);
      }
    }
    function yt(cmd) { if (el && el.tagName === "IFRAME" && el.contentWindow) el.contentWindow.postMessage(JSON.stringify({ event: "command", func: cmd, args: [] }), "*"); }
    function start() { build(); if (!el) return; card.classList.add("is-playing"); if (el.tagName === "VIDEO") { var p = el.play(); if (p && p.catch) p.catch(function () {}); } else yt("playVideo"); }
    function stop() { card.classList.remove("is-playing"); if (!el) return; if (el.tagName === "VIDEO") el.pause(); else yt("pauseVideo"); }
    if (!touchOnly) {
      card.addEventListener("mouseenter", start); card.addEventListener("mouseleave", stop);
      card.addEventListener("focus", start); card.addEventListener("blur", stop);
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }, { threshold: .65 }).observe(card);
    }
    // choosing a case type fills the quote form and jumps to it
    card.addEventListener("click", function (e) {
      var f = document.getElementById("court-form"); if (!f) return;
      e.preventDefault();
      if (f.type) f.type.value = card.dataset.type || "";
      var target = document.getElementById("contact");
      if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      setTimeout(function () { if (f.name) f.name.focus({ preventScroll: true }); }, reduce ? 0 : 600);
    });
  });
})();
