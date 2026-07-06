// Powers the student dashboard, the staff dashboard, and the admin dashboard.
// Each function checks for the elements it needs and no-ops if they're absent.

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "student-dashboard") initRiderDashboard("student");
  if (document.body.dataset.page === "staff-dashboard") initRiderDashboard("staff");
  if (document.body.dataset.page === "admin-dashboard") initAdminDashboard();
});

/* ------------------------- Rider dashboard (student/staff) ------------------------ */

let routesCache = [];

async function initRiderDashboard(role) {
  requireRole(role, `${role}-login.html`);

  const nameEl = document.getElementById("welcome-name");
  const regEl = document.getElementById("profile-regno");
  const routeEl = document.getElementById("profile-route");
  const busEl = document.getElementById("profile-bus");
  const complaintList = document.getElementById("complaint-list");
  const complaintForm = document.getElementById("complaint-form");
  const complaintMessage = document.getElementById("complaint-message");

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    stopTrackingPoll();
    logout();
  });

  try {
    const profile = await apiRequest(`/${role}/profile`, { auth: true });
    const regNo = role === "staff" ? profile.staffId : profile.rollNumber;
    if (nameEl) nameEl.textContent = profile.name;
    if (regEl) regEl.textContent = regNo || "—";
    if (routeEl) routeEl.textContent = profile.route ? profile.route.routeName : "Not assigned yet";
    if (busEl) busEl.textContent = profile.bus ? profile.bus.busNumber : "Not assigned yet";

    renderPaymentStatus(profile.payment);

    const regnoInput = document.getElementById("rr-regno");
    if (regnoInput) regnoInput.value = regNo || "";

    renderDriverInfo(profile.bus);
    if (profile.bus) startTrackingPoll(profile.bus._id, profile.boardingPoint);
    else {
      document.getElementById("map-status").textContent = "No bus allocated yet.";
      document.getElementById("trip-progress-status").textContent = "You'll see live stop-by-stop progress here once a bus is allocated.";
    }
  } catch (error) {
    console.error(error);
  }

  await initRouteRequests(role);

  async function loadComplaints() {
    if (!complaintList) return;
    try {
      const complaints = await apiRequest(`/${role}/complaints`, { auth: true });
      complaintList.innerHTML = complaints.length
        ? complaints.map(renderComplaintItem).join("")
        : `<p class="empty-state">No complaints submitted yet.</p>`;
    } catch (error) {
      complaintList.innerHTML = `<p class="empty-state">Could not load complaints.</p>`;
    }
  }

  function renderComplaintItem(c) {
    return `
      <div class="list-card">
        <div class="list-card-header">
          <strong>${escapeHtml(c.subject)}</strong>
          <span class="badge badge-${c.status}">${c.status}</span>
        </div>
        <p>${escapeHtml(c.message)}</p>
        <span class="list-card-date">${new Date(c.createdAt).toLocaleDateString()}</span>
      </div>`;
  }

  complaintForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = document.getElementById("complaint-subject").value.trim();
    const message = document.getElementById("complaint-text").value.trim();

    try {
      await apiRequest(`/${role}/complaint`, {
        method: "POST",
        auth: true,
        body: { subject, message },
      });
      complaintForm.reset();
      showMessage(complaintMessage, "Complaint submitted successfully.", "success");
      loadComplaints();
    } catch (error) {
      showMessage(complaintMessage, error.message);
    }
  });

  loadComplaints();
}

/* --------------------------- Rider: route requests (booking) --------------------------- */

function renderPaymentStatus(payment) {
  const el = document.getElementById("payment-status-card");
  const formWrap = document.getElementById("route-request-form-wrap");
  if (!el) return;

  const isPaid = payment?.status === "paid";
  el.innerHTML = isPaid
    ? `<span class="badge badge-active">Bus fee paid</span>${payment.amount ? ` <span style="color:var(--muted); font-size:0.85rem;">₹${payment.amount}${payment.term ? ` &middot; ${escapeHtml(payment.term)}` : ""}</span>` : ""}`
    : `<span class="badge badge-pending">Bus fee unpaid</span>
       <button type="button" id="pay-now-btn" class="btn-primary" style="width:auto; padding:8px 20px; margin-left:10px;">Pay now</button>
       <span id="pay-now-message" style="display:block; margin-top:10px; color:var(--muted); font-size:0.85rem;"></span>`;

  if (formWrap) {
    formWrap.style.display = isPaid ? "block" : "none";
  }
  const lockedNotice = document.getElementById("route-request-locked");
  if (lockedNotice) lockedNotice.style.display = isPaid ? "none" : "block";

  document.getElementById("pay-now-btn")?.addEventListener("click", startRazorpayPayment);
}

async function startRazorpayPayment() {
  const msgEl = document.getElementById("pay-now-message");
  const btn = document.getElementById("pay-now-btn");
  if (typeof Razorpay === "undefined") {
    if (msgEl) msgEl.textContent = "Payment widget failed to load. Check your internet connection and try again.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Loading...";
  try {
    const order = await apiRequest("/payment/create-order", { method: "POST", auth: true });

    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "College Bus Management",
      description: `Bus fee${order.term ? ` — ${order.term}` : ""}`,
      prefill: { name: order.name },
      theme: { color: "#0f2a52" },
      handler: async (response) => {
        try {
          await apiRequest("/payment/verify", {
            method: "POST",
            auth: true,
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          location.reload();
        } catch (error) {
          if (msgEl) msgEl.textContent = error.message;
        }
      },
      modal: {
        ondismiss: () => {
          btn.disabled = false;
          btn.textContent = "Pay now";
        },
      },
    });
    rzp.on("payment.failed", (resp) => {
      if (msgEl) msgEl.textContent = `Payment failed: ${resp.error.description}`;
      btn.disabled = false;
      btn.textContent = "Pay now";
    });
    rzp.open();
    btn.disabled = false;
    btn.textContent = "Pay now";
  } catch (error) {
    if (msgEl) msgEl.textContent = error.message;
    btn.disabled = false;
    btn.textContent = "Pay now";
  }
}

async function initRouteRequests(role) {
  const form = document.getElementById("route-request-form");
  const routeSelect = document.getElementById("rr-route");
  const boardingSelect = document.getElementById("rr-boardingpoint");
  const messageEl = document.getElementById("route-request-message");
  if (!form) return;

  try {
    routesCache = await apiRequest("/route");
    routeSelect.innerHTML =
      `<option value="">Select a route</option>` +
      routesCache
        .map((r) => {
          const seats = r.availability ? `(${r.availability.available}/${r.availability.capacity} seats free)` : "(no bus assigned yet)";
          return `<option value="${r._id}">${escapeHtml(r.routeName)} — ${escapeHtml(r.startPoint)} to ${escapeHtml(r.endPoint)} ${seats}</option>`;
        })
        .join("");
  } catch (error) {
    routeSelect.innerHTML = `<option value="">Could not load routes</option>`;
  }

  routeSelect?.addEventListener("change", () => {
    if (!boardingSelect) return;
    const route = routesCache.find((r) => r._id === routeSelect.value);
    if (!route) {
      boardingSelect.innerHTML = `<option value="">Select a route first</option>`;
      return;
    }
    const points = [route.startPoint, ...(route.stops || []), route.endPoint];
    boardingSelect.innerHTML =
      `<option value="">No preference</option>` +
      points.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const body = {
        dept: document.getElementById("rr-dept").value.trim(),
        requestedRoute: routeSelect.value,
        boardingPoint: boardingSelect ? boardingSelect.value : "",
      };
      const yearInput = document.getElementById("rr-year");
      const designationInput = document.getElementById("rr-designation");
      if (yearInput) body.year = yearInput.value;
      if (designationInput) body.designation = designationInput.value.trim();

      await apiRequest("/route-requests", {
        method: "POST",
        auth: true,
        body,
      });
      form.reset();
      const regnoInput = document.getElementById("rr-regno");
      if (regnoInput) regnoInput.value = getUser()?.rollNumber || getUser()?.staffId || "";
      showMessage(messageEl, "Route request submitted. The admin will review it shortly.", "success");
      loadMyRouteRequests();
    } catch (error) {
      showMessage(messageEl, error.message);
    }
  });

  loadMyRouteRequests();
}

async function loadMyRouteRequests() {
  const listEl = document.getElementById("route-request-list");
  if (!listEl) return;

  try {
    const requests = await apiRequest("/route-requests/my", { auth: true });
    listEl.innerHTML = requests.length
      ? requests
          .map((r) => {
            const routeName = (r.status === "approved" ? r.allocatedRoute : r.requestedRoute)?.routeName || "—";
            return `
        <div class="list-card">
          <div class="list-card-header">
            <strong>${escapeHtml(routeName)}</strong>
            <span class="badge badge-${r.status === "approved" ? "resolved" : r.status === "rejected" ? "pending" : "in-progress"}">${r.status}</span>
          </div>
          <p>Dept: ${escapeHtml(r.dept)}${r.year ? ` &middot; Year: ${escapeHtml(r.year)}` : ""}${r.designation ? ` &middot; ${escapeHtml(r.designation)}` : ""}${r.boardingPoint ? ` &middot; Boarding at: ${escapeHtml(r.boardingPoint)}` : ""}</p>
          ${r.status === "approved" && r.allocatedBus ? `<p>Bus: ${escapeHtml(r.allocatedBus.busNumber)} &middot; Driver: ${r.allocatedBus.driver ? escapeHtml(r.allocatedBus.driver.name) : "—"} (${r.allocatedBus.driver?.phone ? escapeHtml(r.allocatedBus.driver.phone) : "no phone on file"})</p>` : ""}
          ${r.status === "rejected" && r.remarks ? `<p>Reason: ${escapeHtml(r.remarks)}</p>` : ""}
          <span class="list-card-date">${new Date(r.createdAt).toLocaleDateString()}</span>
        </div>`;
          })
          .join("")
      : `<p class="empty-state">You haven't requested a route yet.</p>`;
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load your requests.</p>`;
  }
}

/* --------------------------- Rider: driver, map & trip progress -------------------------- */

function renderDriverInfo(bus) {
  const el = document.getElementById("driver-info");
  if (!el) return;
  if (!bus || !bus.driver) {
    el.innerHTML = `<p class="empty-state">No driver assigned yet.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="list-card">
      <div class="list-card-header"><strong>${escapeHtml(bus.driver.name)}</strong></div>
      <p>Bus: ${escapeHtml(bus.busNumber)} &middot; Phone: ${bus.driver.phone ? escapeHtml(bus.driver.phone) : "Not on file"}</p>
    </div>`;
}

let trackingPollId = null;
let trackingMap = null;
let trackingMarker = null;

function startTrackingPoll(busId, boardingPoint) {
  const statusEl = document.getElementById("map-status");
  const mapEl = document.getElementById("tracking-map");
  const tripStatusEl = document.getElementById("trip-progress-status");
  const tripListEl = document.getElementById("trip-progress-list");

  const poll = async () => {
    try {
      const { currentLocation, trip, route } = await apiRequest(`/bus/${busId}/location`, { auth: true });

      if (tripStatusEl) {
        let statusLine = describeTripStatus(route, trip);
        if (boardingPoint && route && trip?.status === "in-transit") {
          const stops = route.stops || [];
          const boardIdx = stops.indexOf(boardingPoint);
          if (boardIdx !== -1) {
            if (trip.currentStopIndex < boardIdx) statusLine += ` Your stop (${boardingPoint}) is still ahead.`;
            else if (trip.currentStopIndex === boardIdx) statusLine += ` The bus is arriving at your stop (${boardingPoint}) now!`;
            else statusLine += ` The bus has already passed your stop (${boardingPoint}).`;
          } else if (boardingPoint === route.startPoint) {
            statusLine += ` That's your boarding point — the bus has already left.`;
          } else if (boardingPoint === route.endPoint) {
            statusLine += ` You board at the final stop, ${route.endPoint}.`;
          }
        }
        tripStatusEl.textContent = statusLine;
      }
      if (tripListEl) tripListEl.innerHTML = renderStopProgressList(route, trip);

      if (!currentLocation || currentLocation.lat == null) {
        statusEl.style.display = "block";
        mapEl.style.display = "none";
        statusEl.textContent = "Your driver hasn't started sharing location yet.";
        return;
      }

      statusEl.style.display = "none";
      mapEl.style.display = "block";
      const { lat, lng } = currentLocation;

      if (!trackingMap) {
        trackingMap = L.map("tracking-map").setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(trackingMap);
        trackingMarker = L.marker([lat, lng]).addTo(trackingMap);
      } else {
        trackingMap.setView([lat, lng]);
        trackingMarker.setLatLng([lat, lng]);
      }
    } catch (error) {
      statusEl.style.display = "block";
      mapEl.style.display = "none";
      statusEl.textContent = "Could not load live location.";
    }
  };

  poll();
  trackingPollId = setInterval(poll, 10000);
}

function stopTrackingPoll() {
  if (trackingPollId) {
    clearInterval(trackingPollId);
    trackingPollId = null;
  }
}

/* ----------------------------- Admin dashboard ----------------------------- */

async function initAdminDashboard() {
  requireRole("admin", "admin-login.html");

  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("admin-name").textContent = getUser()?.name || "Admin";

  setupTabs();
  await Promise.all([loadBuses(), loadDrivers(), loadRoutes(), loadStudents(), loadStaff(), loadComplaints(), loadRouteRequests()]);
  startFleetMapPoll();

  document.getElementById("bus-form")?.addEventListener("submit", handleBusSubmit);
  document.getElementById("driver-form")?.addEventListener("submit", handleDriverSubmit);
  document.getElementById("route-form")?.addEventListener("submit", handleRouteSubmit);
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

// ----- Buses -----
async function loadBuses() {
  const listEl = document.getElementById("bus-list");
  const routeSelect = document.getElementById("bus-route");
  const driverSelect = document.getElementById("bus-driver");
  if (!listEl) return;

  try {
    const buses = await apiRequest("/bus");
    listEl.innerHTML = buses.length
      ? buses
          .map(
            (b) => `
        <div class="list-card">
          <div class="list-card-header">
            <strong>${escapeHtml(b.busNumber)}</strong>
            <span class="badge badge-${b.status}">${b.status}</span>
          </div>
          <p>Capacity: ${b.capacity} &middot; Driver: ${b.driver ? escapeHtml(b.driver.name) : "Unassigned"} &middot; Route: ${b.route ? escapeHtml(b.route.routeName) : "Unassigned"}</p>
          <button class="btn-danger" data-delete-bus="${b._id}">Delete</button>
        </div>`
          )
          .join("")
      : `<p class="empty-state">No buses added yet.</p>`;

    listEl.querySelectorAll("[data-delete-bus]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this bus?")) return;
        await apiRequest(`/bus/${btn.dataset.deleteBus}`, { method: "DELETE", auth: true });
        loadBuses();
      })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load buses.</p>`;
  }

  populateSelect(driverSelect, await safeList("/driver", true), (d) => d.name);
  populateSelect(routeSelect, await safeList("/route"), (r) => r.routeName);
}

async function handleBusSubmit(e) {
  e.preventDefault();
  const messageEl = document.getElementById("bus-message");
  try {
    await apiRequest("/bus", {
      method: "POST",
      auth: true,
      body: {
        busNumber: document.getElementById("bus-number").value.trim(),
        capacity: Number(document.getElementById("bus-capacity").value),
        driver: document.getElementById("bus-driver").value || null,
        route: document.getElementById("bus-route").value || null,
      },
    });
    e.target.reset();
    showMessage(messageEl, "Bus added successfully.", "success");
    loadBuses();
  } catch (error) {
    showMessage(messageEl, error.message);
  }
}

// ----- Drivers -----
async function loadDrivers() {
  const listEl = document.getElementById("driver-list");
  if (!listEl) return;

  try {
    const drivers = await apiRequest("/driver", { auth: true });
    listEl.innerHTML = drivers.length
      ? drivers
          .map(
            (d) => `
        <div class="list-card">
          <div class="list-card-header"><strong>${escapeHtml(d.name)}</strong></div>
          <p>${escapeHtml(d.email)} &middot; License: ${escapeHtml(d.licenseNumber)}${d.employeeId ? ` &middot; ID: ${escapeHtml(d.employeeId)}` : ""} &middot; Bus: ${d.bus ? escapeHtml(d.bus.busNumber) : "Unassigned"}</p>
          <button class="btn-danger" data-delete-driver="${d._id}">Delete</button>
        </div>`
          )
          .join("")
      : `<p class="empty-state">No drivers added yet.</p>`;

    listEl.querySelectorAll("[data-delete-driver]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this driver?")) return;
        await apiRequest(`/driver/${btn.dataset.deleteDriver}`, { method: "DELETE", auth: true });
        loadDrivers();
      })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load drivers.</p>`;
  }
}

async function handleDriverSubmit(e) {
  e.preventDefault();
  const messageEl = document.getElementById("driver-message");
  try {
    await apiRequest("/driver/register", {
      method: "POST",
      auth: true,
      body: {
        name: document.getElementById("driver-name").value.trim(),
        email: document.getElementById("driver-email").value.trim(),
        password: document.getElementById("driver-password").value,
        phone: document.getElementById("driver-phone").value.trim(),
        licenseNumber: document.getElementById("driver-license").value.trim(),
        employeeId: document.getElementById("driver-employee-id").value.trim(),
      },
    });
    e.target.reset();
    showMessage(messageEl, "Driver added successfully.", "success");
    loadDrivers();
  } catch (error) {
    showMessage(messageEl, error.message);
  }
}

// ----- Routes -----
async function loadRoutes() {
  const listEl = document.getElementById("route-list");
  if (!listEl) return;

  try {
    const routes = await apiRequest("/route");
    listEl.innerHTML = routes.length
      ? routes
          .map(
            (r) => `
        <div class="list-card">
          <div class="list-card-header"><strong>${escapeHtml(r.routeName)}</strong></div>
          <p>${escapeHtml(r.startPoint)} &rarr; ${escapeHtml(r.endPoint)} &middot; Stops: ${r.stops?.length ? r.stops.map(escapeHtml).join(", ") : "None"}</p>
          <button class="btn-danger" data-delete-route="${r._id}">Delete</button>
        </div>`
          )
          .join("")
      : `<p class="empty-state">No routes added yet.</p>`;

    listEl.querySelectorAll("[data-delete-route]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this route?")) return;
        await apiRequest(`/route/${btn.dataset.deleteRoute}`, { method: "DELETE", auth: true });
        loadRoutes();
      })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load routes.</p>`;
  }
}

async function handleRouteSubmit(e) {
  e.preventDefault();
  const messageEl = document.getElementById("route-message");
  try {
    const stopsRaw = document.getElementById("route-stops").value.trim();
    await apiRequest("/route", {
      method: "POST",
      auth: true,
      body: {
        routeName: document.getElementById("route-name").value.trim(),
        startPoint: document.getElementById("route-start").value.trim(),
        endPoint: document.getElementById("route-end").value.trim(),
        stops: stopsRaw ? stopsRaw.split(",").map((s) => s.trim()) : [],
      },
    });
    e.target.reset();
    showMessage(messageEl, "Route added successfully.", "success");
    loadRoutes();
  } catch (error) {
    showMessage(messageEl, error.message);
  }
}

// ----- Route Requests -----
async function loadRouteRequests() {
  const listEl = document.getElementById("request-list");
  if (!listEl) return;

  try {
    const requests = await apiRequest("/route-requests", { auth: true });
    listEl.innerHTML = requests.length
      ? requests.map(renderRequestCard).join("")
      : `<p class="empty-state">No route requests yet.</p>`;

    listEl.querySelectorAll("[data-allocate]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const messageEl = document.getElementById("request-message");
        try {
          await apiRequest(`/route-requests/${btn.dataset.allocate}/allocate`, { method: "PUT", auth: true });
          showMessage(messageEl, "Route allocated to student.", "success");
          loadRouteRequests();
          loadRoutes();
        } catch (error) {
          showMessage(messageEl, error.message);
        }
      })
    );

    listEl.querySelectorAll("[data-reject]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Reject this route request?")) return;
        await apiRequest(`/route-requests/${btn.dataset.reject}/reject`, {
          method: "PUT",
          auth: true,
          body: { remarks: "Not allocated by admin" },
        });
        loadRouteRequests();
      })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load route requests.</p>`;
  }
}

function renderRequestCard(r) {
  const seatInfo = r.requestedRouteAvailability
    ? `${r.requestedRouteAvailability.available}/${r.requestedRouteAvailability.capacity} seats free`
    : "no bus assigned to this route yet";
  const badgeClass = r.status === "approved" ? "resolved" : r.status === "rejected" ? "pending" : "in-progress";

  const actions =
    r.status === "pending"
      ? `<button class="btn-primary" style="width:auto; padding:8px 16px; margin-right:8px;" data-allocate="${r._id}">Allocate</button>
         <button class="btn-danger" data-reject="${r._id}">Reject</button>`
      : r.status === "approved" && r.allocatedBus
      ? `<p>Bus: ${escapeHtml(r.allocatedBus.busNumber)} &middot; Driver: ${r.allocatedBus.driver ? escapeHtml(r.allocatedBus.driver.name) : "—"} ${r.allocatedBus.driver?.phone ? `(${escapeHtml(r.allocatedBus.driver.phone)})` : ""}</p>`
      : "";

  return `
    <div class="list-card">
      <div class="list-card-header">
        <strong>${escapeHtml(r.requester?.name || "Unknown")} &middot; ${escapeHtml(r.regNo)} <span class="stop-tag">${escapeHtml(r.requesterModel || "")}</span></strong>
        <span class="badge badge-${badgeClass}">${r.status}</span>
      </div>
      <p>Dept: ${escapeHtml(r.dept)}${r.year ? ` &middot; Year: ${escapeHtml(r.year)}` : ""}${r.designation ? ` &middot; ${escapeHtml(r.designation)}` : ""}${r.boardingPoint ? ` &middot; Boarding at: ${escapeHtml(r.boardingPoint)}` : ""}</p>
      <p>Requested route: ${escapeHtml(r.requestedRoute?.routeName || "—")} &middot; ${seatInfo}</p>
      ${actions}
      <span class="list-card-date">${new Date(r.createdAt).toLocaleDateString()}</span>
    </div>`;
}

// ----- Live fleet map -----
let fleetMap = null;
let fleetMarkers = {};
let fleetPollId = null;

function startFleetMapPoll() {
  const statusEl = document.getElementById("fleet-map-status");
  const mapEl = document.getElementById("fleet-map");
  if (!statusEl || !mapEl) return;

  const poll = async () => {
    try {
      const buses = await apiRequest("/bus");
      const located = buses.filter((b) => b.currentLocation && b.currentLocation.lat != null);

      if (!located.length) {
        statusEl.style.display = "block";
        mapEl.style.display = "none";
        return;
      }

      statusEl.style.display = "none";
      mapEl.style.display = "block";

      if (!fleetMap) {
        fleetMap = L.map("fleet-map").setView([located[0].currentLocation.lat, located[0].currentLocation.lng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(fleetMap);
      }

      located.forEach((b) => {
        const { lat, lng } = b.currentLocation;
        if (fleetMarkers[b._id]) {
          fleetMarkers[b._id].setLatLng([lat, lng]);
        } else {
          fleetMarkers[b._id] = L.marker([lat, lng]).addTo(fleetMap).bindPopup(escapeHtml(b.busNumber));
        }
      });
    } catch (error) {
      statusEl.style.display = "block";
      mapEl.style.display = "none";
    }
  };

  poll();
  fleetPollId = setInterval(poll, 10000);
}

// ----- Students (read-only) -----
async function loadStudents() {
  const listEl = document.getElementById("student-list");
  if (!listEl) return;

  try {
    const students = await apiRequest("/admin/students", { auth: true });
    listEl.innerHTML = students.length
      ? students.map((s) => renderPersonCard(s, "student")).join("")
      : `<p class="empty-state">No students registered yet.</p>`;
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load students.</p>`;
  }
}

// ----- Staff (read-only) -----
async function loadStaff() {
  const listEl = document.getElementById("staff-list");
  if (!listEl) return;

  try {
    const staff = await apiRequest("/admin/staff", { auth: true });
    listEl.innerHTML = staff.length
      ? staff.map((s) => renderPersonCard(s, "staff")).join("")
      : `<p class="empty-state">No staff registered yet.</p>`;
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load staff.</p>`;
  }
}

// Shared card for a student or staff member, with a small inline control to
// mark the one-time/term bus fee as paid or unpaid.
function renderPersonCard(person, role) {
  const idLine =
    role === "student"
      ? `Roll No: ${escapeHtml(person.rollNumber)} &middot; Dept: ${escapeHtml(person.dept || "—")}`
      : `Staff ID: ${escapeHtml(person.staffId)} &middot; Dept: ${escapeHtml(person.department || "—")}${person.designation ? ` (${escapeHtml(person.designation)})` : ""}`;
  const routeLine = `Route: ${person.route ? escapeHtml(person.route.routeName) : "Unassigned"}${person.boardingPoint ? ` &middot; Boards at: ${escapeHtml(person.boardingPoint)}` : ""}`;
  const isPaid = person.payment?.status === "paid";
  const badge = isPaid
    ? `<span class="badge badge-active">Paid${person.payment.amount ? ` &middot; ₹${person.payment.amount}` : ""}</span>`
    : `<span class="badge badge-pending">Unpaid</span>`;

  return `
    <div class="list-card" data-person-id="${person._id}" data-role="${role}">
      <div class="list-card-header"><strong>${escapeHtml(person.name)}</strong>${badge}</div>
      <p>${escapeHtml(person.email)} &middot; ${idLine}</p>
      <p>${routeLine}</p>
      <div class="payment-controls">
        <input type="number" min="0" class="payment-amount-input" placeholder="Amount (₹)" value="${person.payment?.amount || ""}" />
        ${
          isPaid
            ? `<button type="button" class="btn-outline mark-unpaid-btn">Mark unpaid</button>`
            : `<button type="button" class="btn-primary mark-paid-btn" style="width:auto; padding:8px 16px;">Mark paid</button>`
        }
      </div>
    </div>`;
}

// One delegated listener handles every person-card's payment buttons.
document.addEventListener("click", async (e) => {
  const paidBtn = e.target.closest(".mark-paid-btn");
  const unpaidBtn = e.target.closest(".mark-unpaid-btn");
  const btn = paidBtn || unpaidBtn;
  if (!btn) return;

  const card = btn.closest("[data-person-id]");
  const personId = card.dataset.personId;
  const role = card.dataset.role;
  const amountInput = card.querySelector(".payment-amount-input");
  const status = paidBtn ? "paid" : "unpaid";

  try {
    await apiRequest(`/admin/${role === "student" ? "students" : "staff"}/${personId}/payment`, {
      method: "PUT",
      auth: true,
      body: { status, amount: amountInput.value ? Number(amountInput.value) : undefined },
    });
    if (role === "student") loadStudents();
    else loadStaff();
  } catch (error) {
    alert(error.message);
  }
});

// ----- Complaints -----
async function loadComplaints() {
  const listEl = document.getElementById("admin-complaint-list");
  if (!listEl) return;

  try {
    const complaints = await apiRequest("/admin/complaints", { auth: true });
    listEl.innerHTML = complaints.length
      ? complaints
          .map(
            (c) => `
        <div class="list-card">
          <div class="list-card-header">
            <strong>${escapeHtml(c.subject)}</strong>
            <span class="badge badge-${c.status}">${c.status}</span>
          </div>
          <p>${escapeHtml(c.message)}</p>
          <p class="list-card-date">From: ${c.submittedBy ? escapeHtml(c.submittedBy.name) : "Unknown"} ${c.submitterModel ? `(${escapeHtml(c.submitterModel)})` : ""}</p>
          <select data-complaint-id="${c._id}" class="status-select">
            <option value="pending" ${c.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="in-progress" ${c.status === "in-progress" ? "selected" : ""}>In progress</option>
            <option value="resolved" ${c.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>`
          )
          .join("")
      : `<p class="empty-state">No complaints submitted yet.</p>`;

    listEl.querySelectorAll(".status-select").forEach((select) =>
      select.addEventListener("change", async () => {
        await apiRequest(`/admin/complaints/${select.dataset.complaintId}`, {
          method: "PUT",
          auth: true,
          body: { status: select.value },
        });
      })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="empty-state">Could not load complaints.</p>`;
  }
}

/* -------------------------------- Utilities -------------------------------- */

async function safeList(path, auth = false) {
  try {
    return await apiRequest(path, { auth });
  } catch {
    return [];
  }
}

function populateSelect(selectEl, items, labelFn) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML =
    `<option value="">Unassigned</option>` +
    items.map((item) => `<option value="${item._id}">${escapeHtml(labelFn(item))}</option>`).join("");
  selectEl.value = current;
}
