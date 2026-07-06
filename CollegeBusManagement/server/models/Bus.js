const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true, trim: true },
    capacity: { type: Number, required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
    route: { type: mongoose.Schema.Types.ObjectId, ref: "Route", default: null },
    status: { type: String, enum: ["active", "maintenance", "inactive"], default: "active" },
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    // Stop-by-stop trip progress, driven by the driver's dashboard.
    // currentStopIndex: -1 = not started, 0..stops.length-1 = en route to that
    // stop on the route, stops.length = arrived at the final/end point.
    trip: {
      status: { type: String, enum: ["not-started", "in-transit", "completed"], default: "not-started" },
      currentStopIndex: { type: Number, default: -1 },
      startedAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);
