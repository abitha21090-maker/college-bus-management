const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    staffId: { type: String, required: true, unique: true, trim: true }, // employee / staff reg no
    department: { type: String, trim: true },
    designation: { type: String, trim: true }, // e.g. "Professor", "Office Staff"
    phone: { type: String, trim: true },
    boardingPoint: { type: String, trim: true, default: "" },
    payment: {
      status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
      amount: { type: Number, default: 0 },
      term: { type: String, trim: true, default: "" },
      paidOn: { type: Date, default: null },
      remarks: { type: String, trim: true, default: "" },
      razorpayOrderId: { type: String, default: "" },
      razorpayPaymentId: { type: String, default: "" },
    },
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
    role: { type: String, default: "staff" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Staff", staffSchema);
