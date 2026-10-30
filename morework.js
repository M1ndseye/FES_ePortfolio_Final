/* "More work" strip: injected near the end of each project page. Lists every other project. */
(function () {
  var W = [{"h": "providence-histotripsy-campaign.html", "i": "assets/FES_ePort_PRO_Histor_Vid_3d.jpg", "t": "Providence Histotripsy Procedure 3d Animation & Campaign", "s": "Branding, Video Editing, Motion Graphics · 1M+ views"}, {"h": "2026-multi-channel-brand-campaign-showcase.html", "i": "assets/ME-Render-TS-Social-Blog.jpg", "t": "TrialSupport Branding & Motion Graphics", "s": "Branding, Motion Graphics, Video Editing · 52% click-through lift on video vs. static posts"}, {"h": "m1ndseye-educational-assets.html", "i": "assets/FES_ePort_Sesame_Duo_Spiral_.jpg", "t": "M1ndseye Illustrated Alphabet Tracing Workbook", "s": "Meet the M1ndseye Illustrated Alphabet Tracing Workbook"}, {"h": "2024-ndm-sizzle-reel.html", "i": "assets/FES_ePort_NDM_Sizzle_Reel.jpg", "t": "NDM Brand Social & Sizzle Reel", "s": "Branding, Motion Graphics, Video Editing"}, {"h": "healthcare-editorial-systems-complete.html", "i": "assets/FES_ePort_TMMC_Map_3d.jpg", "t": "Healthcare Editorial Systems", "s": "Branding, Print Production, Motion Graphics"}, {"h": "2022-mos-edw-case-study.html", "i": "assets/EDW_Program_Collect_.jpg", "t": "Engineering Design Workshop: Program & Collection", "s": "Print, 3d Printed elements, Motion Graphics"}, {"h": "reata-glen-morningside-3d-maps.html", "i": "assets/FES_ePort_NDM_MSF_3d_Map.jpg", "t": "Reata Glen / Morningside 3D Maps", "s": "Branding, Video Editing, Motion Graphics"}, {"h": "enzoani-fashion-events.html", "i": "assets/FES_ePort_11_Fe_.jpg", "t": "Enzoani Fashion Event Branding: 2008-2016", "s": "Print, Invitation Design, Event Branding, Email Campaigns"}];
  W.unshift({ h: "courtroom-animation.html", i: "assets/ME_Endoscope_Procedure.jpg", t: "Courtroom Animation", s: "3D video that shows a jury what happened" });
  var here = location.pathname.split("/").pop() || "index.html";
  var list = W.filter(function (w) { return w.h !== here; });
  var host = document.querySelector("footer.project-footer, footer.footerProject, .eng-footer");
  if (!host || !list.length) return;
  var css = document.createElement("style");
  css.textContent = ".mw{max-width:1280px;margin:0 auto;padding:clamp(48px,6vw,88px) clamp(20px,4vw,48px) 12px;color:#fff;font-family:inherit}.mw h2{margin:0 0 20px;font-size:clamp(1.4rem,2.4vw,2rem);letter-spacing:-.01em;font-weight:700}.mw ul{list-style:none;margin:0;padding:0 0 18px;display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}.mw li{flex:0 0 min(300px,78vw);scroll-snap-align:start}.mw a{display:block;height:100%;border:1px solid rgba(255,255,255,.16);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.04);color:#fff;text-decoration:none;transition:transform .3s,border-color .3s}.mw a:hover,.mw a:focus-visible{transform:translateY(-3px);border-color:rgba(255,157,66,.7)}.mw img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.mw b{display:block;padding:12px 14px 2px;font-size:1rem;line-height:1.25}.mw span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:0 14px 14px;font-size:.84rem;line-height:1.4;color:rgba(255,255,255,.65)}";
  document.head.appendChild(css);
  var sec = document.createElement("section");
  sec.className = "mw"; sec.setAttribute("aria-labelledby", "mw-h");
  var h = document.createElement("h2"); h.id = "mw-h"; h.textContent = "More work"; sec.appendChild(h);
  var ul = document.createElement("ul");
  list.forEach(function (w) {
    var li = document.createElement("li"), a = document.createElement("a"), im = document.createElement("img"), b = document.createElement("b"), sp = document.createElement("span");
    a.href = w.h; im.src = w.i; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; b.textContent = w.t; sp.textContent = w.s;
    a.appendChild(im); a.appendChild(b); a.appendChild(sp); li.appendChild(a); ul.appendChild(li);
  });
  sec.appendChild(ul);
  host.parentNode.insertBefore(sec, host);
})();
