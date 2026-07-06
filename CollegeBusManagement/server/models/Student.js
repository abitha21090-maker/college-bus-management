const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    dept: { type: String, trim: true },
    year: { type: String, trim: true },
    boardingPoint: { type: String, trim: true, default: "" },
    payment: {
      status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
      amount: { type: Number, default: 0 },
      term: { type: String, trim: true, default: "" }, // e.g. "2026 Odd Semester"
      paidOn: { type: Date, default: null },
      remarks: { type: String, trim: true, default: "" },
      razorpayOrderId: { type: String, default: "" },
      razorpayPaymentId: { type: String, default: "" },
    },
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
    role: { type: String, default: "student" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
