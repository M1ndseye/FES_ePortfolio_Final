// M1ndseye interactive network hero.
// Vanilla Canvas API: no external animation library required.

let isModalOpen = false;
let contrastToggle = false;

function toggleContrast() {
  contrastToggle = !contrastToggle;

  if (contrastToggle) {
    document.body.classList.add("dark-theme");
  } else {
    document.body.classList.remove("dark-theme");
  }
}

function contact(event) {
  event.preventDefault();

  const loading = document.querySelector(".modal__overlay--loading");
  const success = document.querySelector(".modal__overlay--success");

  loading.classList.add("modal__overlay--visible");

  emailjs
    .sendForm(
      "service_gi4jv3s",
      "template_57nss0a",
      event.target,
      "jf8G_9wc-MGeb3w95",
    )
    .then(() => {
      loading.classList.remove("modal__overlay--visible");
      success.classList.add("modal__overlay--visible");
    })
    .catch(() => {
      loading.classList.remove("modal__overlay--visible");
      alert(
        "The email service is temporarily unavailable. Please contact me directly at m1ndseye@gmail.com",
      );
    });
}

function toggleModal() {
  isModalOpen = !isModalOpen;
  document.body.classList.toggle("modal--open", isModalOpen);
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("network-canvas");
  const landing = document.getElementById("landing-page");

  if (!canvas || !landing) return;

  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [];
  let animationFrame = null;
  let lastTime = performance.now();

  const pointer = {
    x: 0,
    y: 0,
    active: false,
  };

  const settings = {
    spacing: 118,
    connectionDistance: 178,
    pointerRadius: 230,
    baseSpeed: reducedMotion ? 0 : 0.055,
    nodeRadius: 1.6,
  };

  class Node {
    constructor(x, y, index) {
      this.homeX = x;
      this.homeY = y;
      this.x = x;
      this.y = y;
      this.index = index;

      // Deterministic-feeling variation without a rigid grid appearance.
      const angle = (index * 2.399963229728653) % (Math.PI * 2);
      this.phase = index * 0.67;
      this.vx = Math.cos(angle) * settings.baseSpeed;
      this.vy = Math.sin(angle) * settings.baseSpeed;
      this.energy = 0;
    }

    update(dt, time) {
      if (!reducedMotion) {
        // Slow ambient "breathing" motion around each node's home position.
        const driftX = Math.sin(time * 0.00027 + this.phase) * 12;
        const driftY = Math.cos(time * 0.00022 + this.phase * 1.18) * 10;

        this.x += (this.homeX + driftX - this.x) * 0.018 * dt;
        this.y += (this.homeY + driftY - this.y) * 0.018 * dt;
      }

      if (pointer.active) {
        const dx = this.x - pointer.x;
        const dy = this.y - pointer.y;
        const dist = Math.hypot(dx, dy);

        if (dist < settings.pointerRadius && dist > 0.001) {
          const influence = 1 - dist / settings.pointerRadius;

          // Nodes subtly orbit/lean away from the cursor rather than "explode".
          const nx = dx / dist;
          const ny = dy / dist;
          const tangentX = -ny;
          const tangentY = nx;

          this.x += (nx * influence * 0.85 + tangentX * influence * 0.32) * dt;
          this.y += (ny * influence * 0.85 + tangentY * influence * 0.32) * dt;
          this.energy = Math.max(this.energy, influence);
        }
      }

      this.energy *= Math.pow(0.965, dt);
    }
  }

  function getPalette() {
    const dark = document.body.classList.contains("dark-theme");

    return dark
      ? {
          node: [225, 221, 237],
          line: [146, 127, 204],
          active: [181, 163, 235],
        }
      : {
          node: [67, 65, 72],
          line: [86, 65, 141],
          active: [86, 65, 141],
        };
  }

  function resize() {
    const rect = landing.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildNodes();
  }

  function buildNodes() {
    nodes = [];

    const cols = Math.ceil(width / settings.spacing) + 2;
    const rows = Math.ceil(height / settings.spacing) + 2;
    let index = 0;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        // Stagger rows and apply deterministic offsets to avoid "tech wallpaper".
        const stagger = row % 2 === 0 ? 0 : settings.spacing * 0.48;
        const jitterX = Math.sin(index * 12.9898) * 22;
        const jitterY = Math.cos(index * 78.233) * 18;

        const x = col * settings.spacing + stagger + jitterX;
        const y = row * settings.spacing + jitterY;

        nodes.push(new Node(x, y, index));
        index++;
      }
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    const palette = getPalette();

    // Connect only nearby nodes for a sparse, editorial network.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;

        if (Math.abs(dx) > settings.connectionDistance || Math.abs(dy) > settings.connectionDistance) {
          continue;
        }

        const dist = Math.hypot(dx, dy);

        if (dist < settings.connectionDistance) {
          const proximity = 1 - dist / settings.connectionDistance;
          const activity = Math.max(a.energy, b.energy);
          const alpha = 0.045 + proximity * 0.10 + activity * 0.20;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${palette.line.join(",")},${alpha})`;
          ctx.lineWidth = activity > 0.12 ? 0.95 : 0.65;
          ctx.stroke();
        }
      }
    }

    // Nodes are deliberately tiny; they read as "signals", not particles.
    for (const node of nodes) {
      const activity = node.energy;
      const radius = settings.nodeRadius + activity * 1.75;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      const rgb = activity > 0.08 ? palette.active : palette.node;
      const alpha = 0.22 + activity * 0.58;
      ctx.fillStyle = `rgba(${rgb.join(",")},${alpha})`;
      ctx.fill();

      if (activity > 0.32) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 + activity * 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${palette.active.join(",")},${activity * 0.12})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Very subtle focus halo around cursor.
    if (pointer.active) {
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        settings.pointerRadius,
      );

      gradient.addColorStop(0, `rgba(${palette.active.join(",")},0.035)`);
      gradient.addColorStop(0.55, `rgba(${palette.active.join(",")},0.012)`);
      gradient.addColorStop(1, `rgba(${palette.active.join(",")},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, settings.pointerRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animate(time) {
    const dt = Math.min((time - lastTime) / 16.67, 2);
    lastTime = time;

    for (const node of nodes) {
      node.update(dt, time);
    }

    draw(time);
    animationFrame = requestAnimationFrame(animate);
  }

  function updatePointer(event) {
    const rect = landing.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active =
      pointer.x >= 0 &&
      pointer.x <= rect.width &&
      pointer.y >= 0 &&
      pointer.y <= rect.height;
  }

  landing.addEventListener("pointermove", updatePointer, { passive: true });

  landing.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  landing.addEventListener("pointerenter", updatePointer, { passive: true });

  window.addEventListener("resize", resize, { passive: true });

  // Re-draw immediately when the site contrast mode changes.
  const themeObserver = new MutationObserver(() => draw(performance.now()));
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  resize();

  if (reducedMotion) {
    draw(performance.now());
  } else {
    animationFrame = requestAnimationFrame(animate);
  }

  window.addEventListener("pagehide", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    themeObserver.disconnect();
  });
});
