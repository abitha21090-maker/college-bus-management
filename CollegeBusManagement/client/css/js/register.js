// Handles self-registration for every role (student, staff, driver, admin).
// Each register form declares data-role="student|staff|driver|admin" and its
// fields use `name="..."` attributes matching the API's expected body keys.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  if (!form) return;

  const role = form.dataset.role;
  const messageEl = document.getElementById("form-message");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = form.querySelector("[name='password']")?.value || "";
    const confirmPassword = form.querySelector("[name='confirmPassword']")?.value;
    if (confirmPassword !== undefined && password !== confirmPassword) {
      showMessage(messageEl, "Passwords do not match.");
      return;
    }

    // Build the request body from every named field on the form.
    const body = {};
    form.querySelectorAll("[name]").forEach((input) => {
      if (input.name === "confirmPassword") return;
      body[input.name] = input.type === "checkbox" ? input.checked : input.value.trim ? input.value.trim() : input.value;
    });
    body.password = password; // keep un-trimmed password exactly as typed

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    try {
      const data = await apiRequest(`/${role}/register`, {
        method: "POST",
        body,
      });
      saveSession(role, data);
      window.location.href = `${role}-dashboard.html`;
    } catch (error) {
      showMessage(messageEl, error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
});
