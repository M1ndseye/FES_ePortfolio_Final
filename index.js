// template_57nss0a
// service_gi4jv3s
// jf8G_9wc-MGeb3w95

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
    
}