const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    // Generalized so both students and staff can raise complaints.
    submittedBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "submitterModel" },
    submitterModel: { type: String, required: true, enum: ["Student", "Staff"] },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "in-progress", "resolved"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Complaint", complaintSchema);
