const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const staffRoutes = require("./routes/staffRoutes");
const busRoutes = require("./routes/busRoutes");
const driverRoutes = require("./routes/driverRoutes");
const routeRoutes = require("./routes/routeRoutes");
const routeRequestRoutes = require("./routes/routeRequestRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/bus", busRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/route", routeRoutes);
app.use("/api/route-requests", routeRequestRoutes);
app.use("/api/payment", paymentRoutes);

// Test Route
app.get("/", (req, res) => {
    res.send("College Bus Management API is Running...");
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});