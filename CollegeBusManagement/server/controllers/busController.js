const Bus = require("../models/Bus");
const Route = require("../models/Route");

// Keep the two-way link in sync: a bus's `route` field and that route's
// `bus` field must always point at each other, or the booking/allocation
// flow (which checks Route.bus) won't see buses assigned from this form.
const syncRouteLink = async (busId, newRouteId, oldRouteId) => {
  if (oldRouteId && String(oldRouteId) !== String(newRouteId || "")) {
    await Route.findByIdAndUpdate(oldRouteId, { bus: null });
  }
  if (newRouteId) {
    await Route.findByIdAndUpdate(newRouteId, { bus: busId });
  }
};

// POST /api/bus
const createBus = async (req, res) => {
  try {
    const { busNumber, capacity, driver, route, status } = req.body;
    if (!busNumber || !capacity) {
      return res.status(400).json({ message: "Bus number and capacity are required" });
    }

    const existing = await Bus.findOne({ busNumber });
    if (existing) {
      return res.status(400).json({ message: "A bus with this number already exists" });
    }

    const bus = await Bus.create({ busNumber, capacity, driver, route, status });
    if (route) await syncRouteLink(bus._id, route, null);
    res.status(201).json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bus
const getAllBuses = async (req, res) => {
  try {
    const buses = await Bus.find().populate("driver", "-password").populate("route");
    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bus/:id
const getBusById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).populate("driver", "-password").populate("route");
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }
    res.json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/bus/:id
const updateBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    const oldRouteId = bus.route;
    Object.assign(bus, req.body);
    await bus.save();
    if (String(oldRouteId || "") !== String(bus.route || "")) {
      await syncRouteLink(bus._id, bus.route, oldRouteId);
    }
    res.json(bus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/bus/:id
const deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }
    if (bus.route) await Route.findByIdAndUpdate(bus.route, { bus: null });
    await bus.deleteOne();
    res.json({ message: "Bus deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/bus/:id/location  (driver — updates their own bus's live position)
const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "lat and lng (numbers) are required" });
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    // A driver may only broadcast location for the bus they are assigned to
    if (req.userRole === "driver" && String(bus.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: "You are not assigned to this bus" });
    }

    bus.currentLocation = { lat, lng, updatedAt: new Date() };
    await bus.save();
    res.json({ message: "Location updated", currentLocation: bus.currentLocation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/bus/:id/location  (student/admin/driver — read the live position + trip progress)
const getLocation = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .select("busNumber currentLocation trip route")
      .populate("route", "routeName startPoint endPoint stops");
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }
    res.json({
      busNumber: bus.busNumber,
      currentLocation: bus.currentLocation,
      trip: bus.trip,
      route: bus.route,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Shared helper: only the driver assigned to a bus (or an admin) may control its trip
const assertCanControlBus = (req, bus) => {
  return !(req.userRole === "driver" && String(bus.driver) !== String(req.user._id));
};

// PUT /api/bus/:id/trip/start  (driver/admin) — bus departs the first/start point
const startTrip = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!assertCanControlBus(req, bus)) {
      return res.status(403).json({ message: "You are not assigned to this bus" });
    }

    bus.trip = { status: "in-transit", currentStopIndex: 0, startedAt: new Date(), updatedAt: new Date() };
    await bus.save();
    res.json({ message: "Trip started", trip: bus.trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/bus/:id/trip/advance  (driver/admin) — bus has reached the next stop
const advanceStop = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!assertCanControlBus(req, bus)) {
      return res.status(403).json({ message: "You are not assigned to this bus" });
    }
    if (bus.trip.status !== "in-transit") {
      return res.status(400).json({ message: "Start the trip before advancing stops" });
    }

    const route = bus.route ? await Route.findById(bus.route) : null;
    const totalStops = route ? route.stops.length : 0;

    bus.trip.currentStopIndex = Math.min(bus.trip.currentStopIndex + 1, totalStops);
    bus.trip.updatedAt = new Date();
    if (bus.trip.currentStopIndex >= totalStops) {
      bus.trip.status = "completed";
    }
    await bus.save();
    res.json({ message: "Advanced to next stop", trip: bus.trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/bus/:id/trip/end  (driver/admin) — trip finished / bus reached the end point
const endTrip = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!assertCanControlBus(req, bus)) {
      return res.status(403).json({ message: "You are not assigned to this bus" });
    }

    bus.trip.status = "completed";
    bus.trip.updatedAt = new Date();
    await bus.save();
    res.json({ message: "Trip ended", trip: bus.trip });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBus,
  getAllBuses,
  getBusById,
  updateBus,
  deleteBus,
  updateLocation,
  getLocation,
  startTrip,
  advanceStop,
  endTrip,
};
