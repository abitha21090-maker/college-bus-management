const mongoose = require("mongoose");

const routeRequestSchema = new mongoose.Schema(
  {
    // Generalized "booking" request — a student or staff member asking to be
    // put on a route/bus. Admin approves it (subject to seat availability)
    // and it becomes an allocation.
    requester: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "requesterModel" },
    requesterModel: { type: String, required: true, enum: ["Student", "Staff"] },
    regNo: { type: String, required: true, trim: true }, // roll no. (student) or staff ID
    dept: { type: String, required: true, trim: true },
    year: { type: String, trim: true, default: "" }, // student year, blank for staff
    designation: { type: String, trim: true, default: "" }, // staff designation, blank for student
    boardingPoint: { type: String, trim: true, default: "" }, // chosen stop on the route
    requestedRoute: { type: mongoose.Schema.Types.ObjectId, ref: "Route", required: true },
    allocatedRoute: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    allocatedBus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    remarks: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RouteRequest", routeRequestSchema);
