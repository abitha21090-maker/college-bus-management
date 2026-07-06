const express = require("express");
const router = express.Router();
const {
  createRoute,
  getAllRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
} = require("../controllers/routeController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", getAllRoutes);
router.get("/:id", getRouteById);
router.post("/", protect, authorize("admin"), createRoute);
router.put("/:id", protect, authorize("admin"), updateRoute);
router.delete("/:id", protect, authorize("admin"), deleteRoute);

module.exports = router;
