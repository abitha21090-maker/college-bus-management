const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Driver = require("../models/Driver");
const Complaint = require("../models/Complaint");

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/admin/register
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, adminId, inviteCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    // Admin accounts control the whole system, so require a shared invite
    // code (set by the college in server/.env) before creating one — this
    // still gives a self-service signup page without leaving it wide open.
    const requiredCode = process.env.ADMIN_SIGNUP_CODE;
    if (requiredCode && inviteCode !== requiredCode) {
      return res.status(403).json({ message: "Invalid admin invite code" });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Admin already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name, email, password: hashedPassword, adminId });

    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      adminId: admin.adminId,
      token: generateToken(admin._id, "admin"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/admin/login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      token: generateToken(admin._id, "admin"),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select("-password")
      .populate("route")
      .populate({ path: "bus", populate: { path: "driver", select: "name phone" } });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/staff
const getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find()
      .select("-password")
      .populate("route")
      .populate({ path: "bus", populate: { path: "driver", select: "name phone" } });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/students/:id/payment  (admin) — mark a student's bus fee paid/unpaid
const updateStudentPayment = async (req, res) => {
  try {
    const { status, amount, term, remarks } = req.body;
    if (!["paid", "unpaid"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'paid' or 'unpaid'" });
    }
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    student.payment = {
      status,
      amount: amount ?? student.payment?.amount ?? 0,
      term: term ?? student.payment?.term ?? "",
      remarks: remarks ?? student.payment?.remarks ?? "",
      paidOn: status === "paid" ? new Date() : null,
    };
    await student.save();
    res.json({ message: "Payment status updated", payment: student.payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/staff/:id/payment  (admin) — mark a staff member's bus fee paid/unpaid
const updateStaffPayment = async (req, res) => {
  try {
    const { status, amount, term, remarks } = req.body;
    if (!["paid", "unpaid"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'paid' or 'unpaid'" });
    }
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: "Staff member not found" });

    staff.payment = {
      status,
      amount: amount ?? staff.payment?.amount ?? 0,
      term: term ?? staff.payment?.term ?? "",
      remarks: remarks ?? staff.payment?.remarks ?? "",
      paidOn: status === "paid" ? new Date() : null,
    };
    await staff.save();
    res.json({ message: "Payment status updated", payment: staff.payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/complaints
const getAllComplaints = async (req, res) => {
  try {
    // submittedBy resolves to either a Student or Staff doc via refPath
    const complaints = await Complaint.find().populate("submittedBy", "name email rollNumber staffId department dept");
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/complaints/:id
const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }
    complaint.status = status || complaint.status;
    await complaint.save();
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllStudents,
  getAllStaff,
  updateStudentPayment,
  updateStaffPayment,
  getAllComplaints,
  updateComplaintStatus,
};
