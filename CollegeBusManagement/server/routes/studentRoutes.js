const express = require("express");
const router = express.Router();
const {
  registerStudent,
  loginStudent,
  getProfile,
  submitComplaint,
  getMyComplaints,
} = require("../controllers/studentController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.get("/profile", protect, authorize("student"), getProfile);
router.post("/complaint", protect, authorize("student"), submitComplaint);
router.get("/complaints", protect, authorize("student"), getMyComplaints);

module.exports = router;
