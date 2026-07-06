const express = require("express");
const router = express.Router();
const {
  registerAdmin,
  loginAdmin,
  getAllStudents,
  getAllStaff,
  updateStudentPayment,
  updateStaffPayment,
  getAllComplaints,
  updateComplaintStatus,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/students", protect, authorize("admin"), getAllStudents);
router.get("/staff", protect, authorize("admin"), getAllStaff);
router.put("/students/:id/payment", protect, authorize("admin"), updateStudentPayment);
router.put("/staff/:id/payment", protect, authorize("admin"), updateStaffPayment);
router.get("/complaints", protect, authorize("admin"), getAllComplaints);
router.put("/complaints/:id", protect, authorize("admin"), updateComplaintStatus);

module.exports = router;
