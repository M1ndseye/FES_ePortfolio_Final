// template_57nss0a
// service_gi4jv3s
// jf8G_9wc-MGeb3w95
//global scale variables at top
let isModalOpen = false;
let contrastToggle = false;
const scaleFactor = 10;

let rotation = 0;
let velocity = 0;

const friction = 0.95;     // higher = longer spin
const spinStrength = 250;  // higher = more rotations per move


// function moveBackground(event) {
//   const shapes = document.querySelectorAll(".shape");
//   const x = event.clientX * scaleFactor;
//   const y = event.clientY * scaleFactor;

//   for (let i = 0; i < shapes.length; ++i) {
//     const isOdd = i % 2 !== 0;
//     const boolInt = isOdd ? -1 : 1;
//     shapes[i].style.transform =
//       `translate(${x * oddInteger}px, ${y * oddInteger}px)`;
//   }
// }

function moveBackground(event) {
  const xRatio = event.clientX / window.innerWidth - 0.5;
  velocity += xRatio * spinStrength;
}

function animate() {
  const shapes = document.querySelectorAll(".shape");

  rotation += velocity;
  velocity *= friction;

  shapes.forEach((shape, i) => {
    const direction = i % 2 ? -1 : 1;

    shape.style.transform = `
      rotate(${rotation * direction}deg)
    `;
  });

  requestAnimationFrame(animate);
}

animate();

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

window.addEventListener("mousemove", moveBackground);

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
