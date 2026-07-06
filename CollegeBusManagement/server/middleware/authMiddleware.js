const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Student = require("../models/Student");
const Driver = require("../models/Driver");
const Staff = require("../models/Staff");

const MODEL_BY_ROLE = {
  admin: Admin,
  student: Student,
  driver: Driver,
  staff: Staff,
};

// Verifies the JWT and attaches req.user + req.userRole
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const Model = MODEL_BY_ROLE[decoded.role];
    if (!Model) {
      return res.status(401).json({ message: "Not authorized, invalid token role" });
    }

    const user = await Model.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = user;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Restricts access to specific roles, e.g. authorize("admin")
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
};

module.exports = { protect, authorize };
