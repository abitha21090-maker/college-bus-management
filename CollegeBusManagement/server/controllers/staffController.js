const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");
const Complaint = require("../models/Complaint");

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/staff/register
const registerStaff = async (req, res) => {
  try {
    const { name, email, password, staffId, phone, department, designation } = req.body;
    if (!name || !email || !password || !staffId) {
      return res.status(400).json({ message: "Name, email, password and staff ID are required" });
    }

    const existing = await Staff.findOne({ $or: [{ email }, { staffId }] });
    if (existing) {
      return res.status(400).json({ message: "Staff already exists with this email or staff ID" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const staff = await Staff.create({
      name,
      email,
      password: hashedPassword,
      staffId,
      phone,
      department,
      designation,
    });

    res.status(201).json({
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      staffId: staff.staffId,
      department: staff.department,
      designation: staff.designation,
      token: generateToken(staff._id, "staff"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/staff/login
const loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    const staff = await Staff.findOne({ email });
    if (!staff) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      staffId: staff.staffId,
      token: generateToken(staff._id, "staff"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/staff/profile
const getProfile = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user._id)
      .select("-password")
      .populate("route")
      .populate({ path: "bus", populate: { path: "driver", select: "name phone" } });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/staff/complaint
const submitComplaint = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }
    const complaint = await Complaint.create({
      submittedBy: req.user._id,
      submitterModel: "Staff",
      subject,
      message,
    });
    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/staff/complaints
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ submittedBy: req.user._id, submitterModel: "Staff" }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerStaff,
  loginStaff,
  getProfile,
  submitComplaint,
  getMyComplaints,
};
