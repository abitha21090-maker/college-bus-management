const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    employeeId: { type: String, trim: true, unique: true, sparse: true }, // driver reg / employee no
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
    role: { type: String, default: "driver" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Driver", driverSchema);
