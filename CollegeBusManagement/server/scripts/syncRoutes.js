// One-time fix for data created before Bus<->Route linking was corrected.
// Run once with:  node scripts/syncRoutes.js
require("dotenv").config();
const mongoose = require("mongoose");
const Bus = require("../models/Bus");
const Route = require("../models/Route");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Syncing Bus -> Route links...");

  const buses = await Bus.find({ route: { $ne: null } });
  let fixed = 0;
  for (const bus of buses) {
    const route = await Route.findById(bus.route);
    if (route && String(route.bus || "") !== String(bus._id)) {
      route.bus = bus._id;
      await route.save();
      fixed += 1;
      console.log(`Linked bus ${bus.busNumber} -> route ${route.routeName}`);
    }
  }

  console.log(`Done. Fixed ${fixed} route(s).`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
