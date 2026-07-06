const express = require("express");
const router = express.Router();
const {
  registerStaff,
  loginStaff,
  getProfile,
  submitComplaint,
  getMyComplaints,
} = require("../controllers/staffController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/register", registerStaff);
router.post("/login", loginStaff);
router.get("/profile", protect, authorize("staff"), getProfile);
router.post("/complaint", protect, authorize("staff"), submitComplaint);
router.get("/complaints", protect, authorize("staff"), getMyComplaints);

module.exports = router;
