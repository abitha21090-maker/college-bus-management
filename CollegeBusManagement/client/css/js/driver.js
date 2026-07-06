// Powers the driver dashboard: shows assigned bus/route, trip controls
// (start / mark stop / end), and streams live GPS.
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "driver-dashboard") return;
  initDriverDashboard();
});

let watchId = null;
let driverMap = null;
let driverMarker = null;
let assignedBusId = null;
let assignedRoute = null;

async function initDriverDashboard() {
  requireRole("driver", "driver-login.html");

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    stopSharing();
    logout();
  });
  document.getElementById("driver-welcome-name").textContent = getUser()?.name || "Driver";

  const busEl = document.getElementById("driver-bus");
  const routeEl = document.getElementById("driver-route");
  const toggleBtn = document.getElementById("toggle-sharing");
  const messageEl = document.getElementById("driver-message");

  try {
    const profile = await apiRequest("/driver/profile", { auth: true });
    if (profile.bus) {
      assignedBusId = profile.bus._id;
      assignedRoute = profile.bus.route || null;
      busEl.textContent = profile.bus.busNumber;
      routeEl.textContent = assignedRoute ? assignedRoute.routeName : "Not assigned yet";
      renderTripUI(profile.bus.trip);
    } else {
      busEl.textContent = "Not assigned yet";
      routeEl.textContent = "—";
      document.getElementById("trip-stop-list").innerHTML = `<li class="empty-state" style="padding-left:0;">No bus assigned yet.</li>`;
    }
  } catch (error) {
    showMessage(messageEl, "Could not load your profile.");
  }

  setupTripControls();

  toggleBtn?.addEventListener("click", () => {
    if (!assignedBusId) {
      showMessage(messageEl, "You don't have a bus assigned yet. Contact the admin.");
      return;
    }
    if (watchId === null) startSharing(messageEl, toggleBtn);
    else stopSharing(toggleBtn);
  });
}

/* -------------------------------- Trip control ------------------------------ */

function renderTripUI(trip) {
  const statusEl = document.getElementById("trip-status-text");
  const startBtn = document.getElementById("trip-start-btn");
  const advanceBtn = document.getElementById("trip-advance-btn");
  const endBtn = document.getElementById("trip-end-btn");
  const listEl = document.getElementById("trip-stop-list");

  const status = trip?.status || "not-started";
  const labels = { "not-started": "Not started", "in-transit": "In transit", completed: "Completed" };
  statusEl.textContent = labels[status];

  startBtn.style.display = status === "not-started" ? "inline-block" : "none";
  advanceBtn.style.display = status === "in-transit" ? "inline-block" : "none";
  endBtn.style.display = status === "in-transit" ? "inline-block" : "none";

  if (status === "in-transit" && assignedRoute) {
    const stops = assignedRoute.stops || [];
    const idx = trip.currentStopIndex ?? 0;
    const nextStop = idx < stops.length ? stops[idx] : assignedRoute.endPoint;
    advanceBtn.textContent = `Mark arrived: ${nextStop}`;
  }

  listEl.innerHTML = renderStopProgressList(assignedRoute, trip);
}

function setupTripControls() {
  const messageEl = document.getElementById("trip-message");

  document.getElementById("trip-start-btn")?.addEventListener("click", async () => {
    if (!assignedBusId) return;
    try {
      const { trip } = await apiRequest(`/bus/${assignedBusId}/trip/start`, { method: "PUT", auth: true });
      renderTripUI(trip);
      showMessage(messageEl, "Trip started. Riders can now see your progress.", "success");
    } catch (error) {
      showMessage(messageEl, error.message);
    }
  });

  document.getElementById("trip-advance-btn")?.addEventListener("click", async () => {
    if (!assignedBusId) return;
    try {
      const { trip } = await apiRequest(`/bus/${assignedBusId}/trip/advance`, { method: "PUT", auth: true });
      renderTripUI(trip);
      showMessage(messageEl, "Stop marked as reached.", "success");
    } catch (error) {
      showMessage(messageEl, error.message);
    }
  });

  document.getElementById("trip-end-btn")?.addEventListener("click", async () => {
    if (!assignedBusId) return;
    if (!confirm("End this trip?")) return;
    try {
      const { trip } = await apiRequest(`/bus/${assignedBusId}/trip/end`, { method: "PUT", auth: true });
      renderTripUI(trip);
      showMessage(messageEl, "Trip ended.", "success");
    } catch (error) {
      showMessage(messageEl, error.message);
    }
  });
}

/* ------------------------------ Location sharing ----------------------------- */

function startSharing(messageEl, toggleBtn) {
  if (!navigator.geolocation) {
    showMessage(messageEl, "Your browser does not support location sharing.");
    return;
  }

  const mapContainer = document.getElementById("driver-map");
  mapContainer.style.display = "block";

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      if (!driverMap) {
        driverMap = L.map("driver-map").setView([latitude, longitude], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(driverMap);
        driverMarker = L.marker([latitude, longitude]).addTo(driverMap);
      } else {
        driverMap.setView([latitude, longitude]);
        driverMarker.setLatLng([latitude, longitude]);
      }

      try {
        await apiRequest(`/bus/${assignedBusId}/location`, {
          method: "PUT",
          auth: true,
          body: { lat: latitude, lng: longitude },
        });
      } catch (error) {
        showMessage(messageEl, error.message);
      }
    },
    () => showMessage(messageEl, "Could not get your location. Please allow location access."),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );

  document.getElementById("driver-sharing-status").textContent = "Live";
  toggleBtn.textContent = "Stop sharing location";
  showMessage(messageEl, "Sharing your location. Keep this tab open while driving.", "success");
}

function stopSharing(toggleBtn) {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  document.getElementById("driver-sharing-status").textContent = "Off";
  if (toggleBtn) toggleBtn.textContent = "Start sharing location";
}
