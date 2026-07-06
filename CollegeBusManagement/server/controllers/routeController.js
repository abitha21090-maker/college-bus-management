const Route = require("../models/Route");
const Student = require("../models/Student");
const Staff = require("../models/Staff");

// POST /api/route
const createRoute = async (req, res) => {
  try {
    const { routeName, startPoint, endPoint, stops, distanceKm, bus } = req.body;
    if (!routeName || !startPoint || !endPoint) {
      return res.status(400).json({ message: "Route name, start point and end point are required" });
    }

    const route = await Route.create({ routeName, startPoint, endPoint, stops, distanceKm, bus });
    res.status(201).json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/route
// Includes live seat-availability for each route's bus (if one is assigned),
// so students picking a route and admins allocating requests can see capacity.
const getAllRoutes = async (req, res) => {
  try {
    const routes = await Route.find().populate({ path: "bus", populate: { path: "driver", select: "name phone" } });

    const withAvailability = await Promise.all(
      routes.map(async (r) => {
        const obj = r.toObject();
        if (r.bus) {
          const [studentCount, staffCount] = await Promise.all([
            Student.countDocuments({ bus: r.bus._id }),
            Staff.countDocuments({ bus: r.bus._id }),
          ]);
          const occupied = studentCount + staffCount;
          obj.availability = {
            capacity: r.bus.capacity,
            occupied,
            available: Math.max(r.bus.capacity - occupied, 0),
          };
        } else {
          obj.availability = null;
        }
        return obj;
      })
    );

    res.json(withAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/route/:id
const getRouteById = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id).populate("bus");
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }
    res.json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/route/:id
const updateRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }
    Object.assign(route, req.body);
    await route.save();
    res.json(route);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/route/:id
const deleteRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }
    await route.deleteOne();
    res.json({ message: "Route deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createRoute, getAllRoutes, getRouteById, updateRoute, deleteRoute };
