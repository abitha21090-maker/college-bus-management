const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/busController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", getAllBuses);
router.get("/:id", getBusById);
router.get("/:id/location", protect, getLocation);
router.put("/:id/location", protect, authorize("driver", "admin"), updateLocation);
router.put("/:id/trip/start", protect, authorize("driver", "admin"), startTrip);
router.put("/:id/trip/advance", protect, authorize("driver", "admin"), advanceStop);
router.put("/:id/trip/end", protect, authorize("driver", "admin"), endTrip);
router.post("/", protect, authorize("admin"), createBus);
router.put("/:id", protect, authorize("admin"), updateBus);
router.delete("/:id", protect, authorize("admin"), deleteBus);

module.exports = router;
