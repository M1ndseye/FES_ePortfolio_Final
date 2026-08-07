// template_57nss0a
// service_gi4jv3s
// jf8G_9wc-MGeb3w95
//global scale variables at top
let isModalOpen = false;
let contrastToggle = false;

// function moveBackground(event) {
//   const shapes = document.querySelectorAll(".shape");

//   // Normalize mouse position to viewport center
//   const xRatio = (event.clientX / window.innerWidth) - 0.5;
//   const yRatio = (event.clientY / window.innerHeight) - 0.5;

//   const rotationScale = 20; // adjust for more/less rotation

//   for (let i = 0; i < shapes.length; ++i) {
//     const isOdd = i % 2 !== 0;
//     const direction = isOdd ? -1 : 1;

//     const rotateZ = direction * (xRatio + yRatio) * rotationScale;

//     shapes[i].style.transform = `rotate(${rotateZ}deg)`;
//   }
// }

function toggleContrast() {
  contrastToggle = !contrastToggle;
  if (contrastToggle) {
    document.body.classList += " dark-theme";
  } else {
    document.body.classList.remove("dark-theme");
  }
}

function contact(event) {
  event.preventDefault();
  const loading = document.querySelector(".modal__overlay--loading");
  const success = document.querySelector(".modal__overlay--success");
  loading.classList += " modal__overlay--visible";
  emailjs
    .sendForm(
      "service_gi4jv3s",
      "template_57nss0a",
      event.target,
      "jf8G_9wc-MGeb3w95",
    )
    .then(() => {
      loading.classList.remove("modal__overlay--visible");
      success.classList += " modal__overlay--visible";
    })
    .catch(() => {
      loading.classList.remove("modal__overlay--visible");
      alert(
        "The email service is temporarily unavailable. Please contact me directly at m1ndseye@gmail.com",
      );
    });
}

function toggleModal() {
  if (isModalOpen) {
    isModalOpen = false;
    return document.body.classList.remove("modal--open");
  }
  isModalOpen = true;
  document.body.classList += " modal--open";
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("network-canvas");
  const section = document.getElementById("landing-page");

  if (!canvas || !section) return;

  const ctx = canvas.getContext("2d");

  let width;
  let height;
  let nodes = [];

  const mouse = {
    x: null,
    y: null,
  };

  function resizeCanvas() {
    const rect = section.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createNodes();
  }

  function createNodes() {
    nodes = [];

    const count = window.innerWidth < 768 ? 55 : 130;

    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.8 + 1.8,
      });
    }
  }

  section.addEventListener("mousemove", (event) => {
    const rect = section.getBoundingClientRect();

    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });

  section.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    const isDark = document.body.classList.contains("dark-theme");

    const nodeColor = isDark
      ? "rgba(255,255,255,0.45)"
      : "rgba(86,65,141,0.40)";

    const lineColor = isDark ? "rgba(255,255,255," : "rgba(86,65,141,";

    nodes.forEach((node) => {
      node.x += node.vx;
      node.y += node.vy;

      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;

      if (mouse.x !== null) {
        const dx = node.x - mouse.x;
        const dy = node.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 260 && distance > 0) {
          const force = (260 - distance) / 260;

          node.x += (dx / distance) * force * 1.8;
          node.y += (dy / distance) * force * 1.8;
        }
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 145) {
          const opacity = (1 - distance / 145) * 0.18;

          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);

          ctx.strokeStyle = lineColor + opacity + ")";

          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  animate();
});
