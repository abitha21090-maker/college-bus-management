// Handles both the student and admin login forms.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  if (!form) return;

  const role = form.dataset.role; // "student" or "admin"
  const messageEl = document.getElementById("form-message");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      const data = await apiRequest(`/${role}/login`, {
        method: "POST",
        body: { email, password },
      });
      saveSession(role, data);
      window.location.href = `${role}-dashboard.html`;
    } catch (error) {
      showMessage(messageEl, error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  });
});
