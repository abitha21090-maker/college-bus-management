// Shared config & helpers used across every page.
const API_BASE_URL = "https://college-bus-backend-grn2.onrender.com/api";

function saveSession(role, data) {
  localStorage.setItem("cbm_role", role);
  localStorage.setItem("cbm_token", data.token);
  localStorage.setItem("cbm_user", JSON.stringify(data));
}

function getToken() {
  return localStorage.getItem("cbm_token");
}

function getRole() {
  return localStorage.getItem("cbm_role");
}

function getUser() {
  const raw = localStorage.getItem("cbm_user");
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem("cbm_role");
  localStorage.removeItem("cbm_token");
  localStorage.removeItem("cbm_user");
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

async function apiRequest(path, { method = "GET", body = null, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

function showMessage(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.style.display = "block";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Builds the ordered stop list (start point -> intermediate stops -> end
// point) as <li> markup, marking each as done/current/upcoming based on the
// bus's trip progress. Shared by the driver, student, and staff dashboards.
// trip.currentStopIndex: -1 = not started, 0..stops.length-1 = number of
// intermediate stops already reached, stops.length/"completed" = arrived.
function renderStopProgressList(route, trip) {
  if (!route) return `<li class="empty-state" style="padding-left:0;">No route assigned yet.</li>`;
  const stops = route.stops || [];
  const fullStops = [route.startPoint, ...stops, route.endPoint];
  const idx = trip && typeof trip.currentStopIndex === "number" ? trip.currentStopIndex : -1;
  const completed = trip?.status === "completed";

  return fullStops
    .map((name, i) => {
      let cls = "";
      if (i === 0) {
        cls = idx > -1 ? "done" : "";
      } else if (i === fullStops.length - 1) {
        cls = idx >= stops.length ? "done" : "";
      } else {
        const stopIdx = i - 1;
        if (stopIdx < idx || completed) cls = "done";
        else if (stopIdx === idx) cls = "current";
      }
      const tag = cls === "current" ? `<span class="stop-tag">Next stop</span>` : "";
      return `<li class="${cls}">${escapeHtml(name)}${tag}</li>`;
    })
    .join("");
}

// Human-readable one-line trip status, e.g. for a rider's dashboard.
function describeTripStatus(route, trip) {
  if (!trip || trip.status === "not-started") return "The driver hasn't started this trip yet.";
  const started = trip.startedAt ? new Date(trip.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  if (trip.status === "completed") {
    return route ? `Trip completed — the bus reached ${route.endPoint}.` : "Trip completed.";
  }
  const stops = route?.stops || [];
  const idx = trip.currentStopIndex ?? 0;
  const nextStop = idx < stops.length ? stops[idx] : route?.endPoint;
  return `Bus departed${started ? ` at ${started}` : ""}${route ? ` from ${route.startPoint}` : ""}. Heading to ${nextStop || "the next stop"} next.`;
}

// Requires a specific role to view a dashboard; redirects otherwise.
function requireRole(role, loginPage) {
  if (getRole() !== role || !getToken()) {
    window.location.href = loginPage;
  }
}
