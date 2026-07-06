const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Complaint = require("../models/Complaint");

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/student/register
const registerStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, phone, dept, year } = req.body;
    if (!name || !email || !password || !rollNumber) {
      return res.status(400).json({ message: "Name, email, password and roll number are required" });
    }

    const existing = await Student.findOne({ $or: [{ email }, { rollNumber }] });
    if (existing) {
      return res.status(400).json({ message: "Student already exists with this email or roll number" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const student = await Student.create({
      name,
      email,
      password: hashedPassword,
      rollNumber,
      phone,
      dept,
      year,
    });

    res.status(201).json({
      _id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      dept: student.dept,
      year: student.year,
      token: generateToken(student._id, "student"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/student/login
const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      token: generateToken(student._id, "student"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/student/profile
const getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .select("-password")
      .populate("route")
      .populate({ path: "bus", populate: { path: "driver", select: "name phone" } });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/student/complaint
const submitComplaint = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }
    const complaint = await Complaint.create({
      submittedBy: req.user._id,
      submitterModel: "Student",
      subject,
      message,
    });
    res.status(201).json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/student/complaints
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ submittedBy: req.user._id, submitterModel: "Student" }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  getProfile,
  submitComplaint,
  getMyComplaints,
};
