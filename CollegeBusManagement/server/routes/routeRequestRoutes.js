const express = require("express");
const router = express.Router();
const {
  createRouteRequest,
  getMyRequests,
  getAllRequests,
  allocateRoute,
  rejectRequest,
} = require("../controllers/routeRequestController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("student", "staff"), createRouteRequest);
router.get("/my", protect, authorize("student", "staff"), getMyRequests);
router.get("/", protect, authorize("admin"), getAllRequests);
router.put("/:id/allocate", protect, authorize("admin"), allocateRoute);
router.put("/:id/reject", protect, authorize("admin"), rejectRequest);

module.exports = router;
