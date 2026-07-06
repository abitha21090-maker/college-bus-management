const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment } = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/create-order", protect, authorize("student", "staff"), createOrder);
router.post("/verify", protect, authorize("student", "staff"), verifyPayment);

module.exports = router;
