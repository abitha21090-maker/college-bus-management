const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
  {
    routeName: { type: String, required: true, trim: true },
    startPoint: { type: String, required: true, trim: true },
    endPoint: { type: String, required: true, trim: true },
    stops: [{ type: String, trim: true }],
    distanceKm: { type: Number, default: 0 },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Route", routeSchema);
