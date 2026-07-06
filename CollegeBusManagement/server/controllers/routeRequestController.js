const RouteRequest = require("../models/RouteRequest");
const Route = require("../models/Route");
const Bus = require("../models/Bus");
const Student = require("../models/Student");
const Staff = require("../models/Staff");

// Pick the right model based on who's asking (student or staff)
const requesterModelFor = (role) => (role === "staff" ? Staff : Student);
const requesterModelName = (role) => (role === "staff" ? "Staff" : "Student");

// Helper: how many seats on a bus are already taken (students + staff combined)
const getOccupiedSeats = async (busId) => {
  if (!busId) return 0;
  const [students, staff] = await Promise.all([
    Student.countDocuments({ bus: busId }),
    Staff.countDocuments({ bus: busId }),
  ]);
  return students + staff;
};

// POST /api/route-requests  (student or staff)
const createRouteRequest = async (req, res) => {
  try {
    if (req.user.payment?.status !== "paid") {
      return res.status(403).json({
        message: "You need to pay the bus fee before booking a route. Please contact the admin office to complete payment.",
      });
    }

    const { dept, year, designation, requestedRoute, boardingPoint } = req.body;
    if (!dept || !requestedRoute) {
      return res.status(400).json({ message: "Department and requested route are required" });
    }

    const route = await Route.findById(requestedRoute);
    if (!route) {
      return res.status(404).json({ message: "Selected route does not exist" });
    }

    const modelName = requesterModelName(req.userRole);

    const existingPending = await RouteRequest.findOne({
      requester: req.user._id,
      requesterModel: modelName,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({ message: "You already have a pending route request" });
    }

    const regNo = modelName === "Staff" ? req.user.staffId : req.user.rollNumber;

    const request = await RouteRequest.create({
      requester: req.user._id,
      requesterModel: modelName,
      regNo,
      dept,
      year: year || "",
      designation: designation || "",
      boardingPoint: boardingPoint || "",
      requestedRoute,
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/route-requests/my  (student or staff)
const getMyRequests = async (req, res) => {
  try {
    const modelName = requesterModelName(req.userRole);
    const requests = await RouteRequest.find({ requester: req.user._id, requesterModel: modelName })
      .sort({ createdAt: -1 })
      .populate("requestedRoute")
      .populate("allocatedRoute")
      .populate({
        path: "allocatedBus",
        populate: { path: "driver", select: "name phone" },
      });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/route-requests  (admin)
const getAllRequests = async (req, res) => {
  try {
    const requests = await RouteRequest.find()
      .sort({ createdAt: -1 })
      .populate("requester", "name email rollNumber staffId")
      .populate({
        path: "requestedRoute",
        populate: { path: "bus", select: "busNumber capacity" },
      })
      .populate("allocatedRoute")
      .populate({
        path: "allocatedBus",
        populate: { path: "driver", select: "name phone" },
      });

    // Attach live seat-availability info for the route requested, so the
    // admin can see at a glance whether it can still be granted.
    const withAvailability = await Promise.all(
      requests.map(async (r) => {
        const obj = r.toObject();
        const bus = r.requestedRoute?.bus;
        if (bus) {
          const occupied = await getOccupiedSeats(bus._id);
          obj.requestedRouteAvailability = {
            capacity: bus.capacity,
            occupied,
            available: Math.max(bus.capacity - occupied, 0),
          };
        } else {
          obj.requestedRouteAvailability = null;
        }
        return obj;
      })
    );

    res.json(withAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/route-requests/:id/allocate  (admin)
// Body: { routeId } — optional override if admin wants to allocate a different
// route than the one originally requested (e.g. because it's full).
const allocateRoute = async (req, res) => {
  try {
    const request = await RouteRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Route request not found" });
    }
    if (request.status === "approved") {
      return res.status(400).json({ message: "This request has already been approved" });
    }

    const routeId = req.body.routeId || request.requestedRoute;
    const route = await Route.findById(routeId).populate("bus");
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }
    if (!route.bus) {
      return res.status(400).json({ message: "This route has no bus assigned yet. Assign a bus to it first." });
    }

    const bus = await Bus.findById(route.bus._id).populate("driver", "name phone");
    const occupied = await getOccupiedSeats(bus._id);
    if (occupied >= bus.capacity) {
      return res.status(400).json({
        message: `${route.routeName} is full (${occupied}/${bus.capacity} seats taken). Choose another route or bus.`,
      });
    }

    // Allocate: link the requester (student or staff) to this route & bus
    const Model = requesterModelFor(request.requesterModel === "Staff" ? "staff" : "student");
    const requesterDoc = await Model.findById(request.requester);
    if (!requesterDoc) {
      return res.status(404).json({ message: "Requester not found" });
    }
    requesterDoc.route = route._id;
    requesterDoc.bus = bus._id;
    if (request.boardingPoint) requesterDoc.boardingPoint = request.boardingPoint;
    await requesterDoc.save();

    request.status = "approved";
    request.allocatedRoute = route._id;
    request.allocatedBus = bus._id;
    request.remarks = "";
    await request.save();

    res.json({
      message: "Route allocated successfully",
      route: { _id: route._id, routeName: route.routeName, startPoint: route.startPoint, endPoint: route.endPoint },
      bus: { _id: bus._id, busNumber: bus.busNumber, capacity: bus.capacity },
      driver: bus.driver ? { name: bus.driver.name, phone: bus.driver.phone } : null,
      seatsLeft: bus.capacity - (occupied + 1),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/route-requests/:id/reject  (admin)
const rejectRequest = async (req, res) => {
  try {
    const request = await RouteRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Route request not found" });
    }
    request.status = "rejected";
    request.remarks = req.body.remarks || "Not allocated";
    await request.save();
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createRouteRequest,
  getMyRequests,
  getAllRequests,
  allocateRoute,
  rejectRequest,
};
