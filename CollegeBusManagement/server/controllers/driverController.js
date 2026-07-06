const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Driver = require("../models/Driver");

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/driver/register (self-signup, or an admin can add one from the dashboard)
const registerDriver = async (req, res) => {
  try {
    const { name, email, password, phone, licenseNumber, employeeId } = req.body;
    if (!name || !email || !password || !licenseNumber) {
      return res.status(400).json({ message: "Name, email, password and license number are required" });
    }

    const existing = await Driver.findOne({ $or: [{ email }, { licenseNumber }] });
    if (existing) {
      return res.status(400).json({ message: "Driver already exists with this email or license number" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const driver = await Driver.create({
      name,
      email,
      password: hashedPassword,
      phone,
      licenseNumber,
      employeeId,
    });

    res.status(201).json({
      _id: driver._id,
      name: driver.name,
      email: driver.email,
      licenseNumber: driver.licenseNumber,
      employeeId: driver.employeeId,
      token: generateToken(driver._id, "driver"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/driver/login
const loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: driver._id,
      name: driver.name,
      email: driver.email,
      token: generateToken(driver._id, "driver"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/driver
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().select("-password").populate("bus");
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/driver/:id
const getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password").populate("bus");
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/driver/:id
const updateDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const { password, ...rest } = req.body;
    Object.assign(driver, rest);
    if (password) {
      driver.password = await bcrypt.hash(password, 10);
    }
    await driver.save();
    res.json({ ...driver.toObject(), password: undefined });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/driver/:id
const deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    await driver.deleteOne();
    res.json({ message: "Driver deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/driver/profile  (the logged-in driver's own info)
const getMyProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user._id)
      .select("-password")
      .populate({ path: "bus", populate: { path: "route" } });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerDriver,
  loginDriver,
  getAllDrivers,
  getDriverById,
  getMyProfile,
  updateDriver,
  deleteDriver,
};
