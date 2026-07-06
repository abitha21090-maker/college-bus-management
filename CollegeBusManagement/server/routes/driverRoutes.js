const express = require("express");
const router = express.Router();
const {
  registerDriver,
  loginDriver,
  getAllDrivers,
  getDriverById,
  getMyProfile,
  updateDriver,
  deleteDriver,
} = require("../controllers/driverController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/login", loginDriver);
router.get("/profile", protect, authorize("driver"), getMyProfile);
router.get("/", protect, authorize("admin"), getAllDrivers);
router.get("/:id", protect, authorize("admin", "driver"), getDriverById);
// Public so drivers can self-register from the Driver portal; an admin can
// also add drivers straight from the dashboard using the same endpoint.
router.post("/register", registerDriver);
router.put("/:id", protect, authorize("admin"), updateDriver);
router.delete("/:id", protect, authorize("admin"), deleteDriver);

module.exports = router;
